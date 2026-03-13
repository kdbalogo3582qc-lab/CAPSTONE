import os
import logging
import sys
import json
import numpy as np
from pydub import AudioSegment
import whisper
import librosa
import google.generativeai as genai
from deep_translator import GoogleTranslator
from dotenv import load_dotenv
import warnings
import tempfile

# ─── Silence ALL library stdout noise BEFORE anything else runs ───────────────
# Critical on Windows: whisper/librosa/numba print to stdout which breaks JSON
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"]    = "2"
os.environ["GRPC_VERBOSITY"]          = "NONE"
os.environ["TOKENIZERS_PARALLELISM"]  = "false"

# Configure logging to stderr only — stdout is reserved for our JSON output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)

# Suppress noisy third-party loggers
for _noisy in ["whisper", "librosa", "numba", "audioread", "urllib3", "httpx"]:
    logging.getLogger(_noisy).setLevel(logging.ERROR)

# ─── Sentinel-based output ────────────────────────────────────────────────────
# Node.js looks for __RESULT__ to reliably extract the JSON even if stray text
# leaks onto stdout from libraries we can't fully silence.

def _output_result(data):
    """Write JSON result to stdout with sentinel marker."""
    sys.stdout.write("__RESULT__" + json.dumps(data, ensure_ascii=False) + "\n")
    sys.stdout.flush()


# ─── Load env & configure Gemini ─────────────────────────────────────────────
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("API_KEY")
if api_key:
    try:
        genai.configure(api_key=api_key)
        logging.info("Gemini API configured successfully")
    except Exception as e:
        logging.error(f"Failed to configure Gemini API: {e}")
        _output_result({"error": f"API configuration failed: {str(e)}"})
        sys.exit(1)
else:
    logging.error("No API key found")
    _output_result({"error": "No API key found. Please set GEMINI_API_KEY in .env file"})
    sys.exit(1)


# ─── Audio Extraction ─────────────────────────────────────────────────────────

def extract_audio_from_video(video_path):
    """Extract audio from a video file using pydub/ffmpeg."""
    # Use system temp dir — always writable on Windows & Linux
    audio_output_path = os.path.join(tempfile.gettempdir(), "adlytica_audio.wav")
    try:
        audio = AudioSegment.from_file(video_path)
        audio.export(audio_output_path, format="wav")
        logging.info(f"Audio extracted and saved to {audio_output_path}")

        if not os.path.exists(audio_output_path) or os.path.getsize(audio_output_path) == 0:
            raise RuntimeError("Audio extraction produced an empty file")

        return audio_output_path
    except Exception as e:
        logging.error(f"Error extracting audio: {e}")
        raise


# ─── Transcription ────────────────────────────────────────────────────────────

def transcribe_audio(audio_path):
    """Transcribe audio to text using OpenAI Whisper."""
    try:
        model  = whisper.load_model("base").to("cpu")
        # verbose=False stops Whisper from printing progress to stdout
        result = model.transcribe(audio_path, fp16=False, verbose=False)
        if not result["text"].strip():
            raise ValueError("Whisper transcription returned empty text")
        logging.info("Audio transcription completed successfully")
        return result["text"]
    except Exception as e:
        logging.error(f"Error transcribing audio: {e}")
        raise


# ─── Translation ──────────────────────────────────────────────────────────────

def translate_text(text, target_language="en"):
    """Translate text to the target language using Google Translate."""
    try:
        translation = GoogleTranslator(source="auto", target=target_language).translate(text)
        logging.info(f"Text translated to {target_language}")
        return translation
    except Exception as e:
        logging.error(f"Error translating text: {e}")
        raise


# ─── Audio Feature Analysis ───────────────────────────────────────────────────

def analyze_audio_features(audio_path):
    """Extract tonal and acoustic features from the audio stream using librosa."""
    try:
        y, sr = librosa.load(audio_path, sr=None, mono=True)

        # Pitch (F0) via YIN
        f0     = librosa.yin(y, fmin=50, fmax=500)
        voiced = f0[f0 > 0]
        avg_pitch = float(np.mean(voiced)) if len(voiced) else 0.0
        pitch_var = float(np.std(voiced))  if len(voiced) else 0.0

        # Energy
        rms          = librosa.feature.rms(y=y)[0]
        rms_db       = librosa.amplitude_to_db(rms, ref=np.max)
        avg_energy_db = float(np.mean(rms_db))
        energy_var    = float(np.std(rms_db))

        # Tempo
        tempo, _  = librosa.beat.beat_track(y=y, sr=sr)
        tempo_bpm = float(tempo)

        # Spectral centroid
        centroid     = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        avg_centroid = float(np.mean(centroid))

        # Zero-crossing rate
        zcr     = librosa.feature.zero_crossing_rate(y)[0]
        avg_zcr = float(np.mean(zcr))

        # Silence ratio
        non_silent_intervals = librosa.effects.split(y, top_db=30)
        non_silent_samples   = sum(end - start for start, end in non_silent_intervals)
        silence_ratio        = float(1.0 - non_silent_samples / max(len(y), 1))

        # Speaking rate
        onset_frames   = librosa.onset.onset_detect(y=y, sr=sr)
        duration_sec   = librosa.get_duration(y=y, sr=sr)
        onsets_per_sec = len(onset_frames) / duration_sec if duration_sec > 0 else 0
        estimated_wpm  = onsets_per_sec / 1.5 * 0.3 * 60

        # Heuristic tone
        if avg_energy_db > -15 and pitch_var > 40:
            inferred_tone = "energetic"
        elif avg_energy_db > -15 and pitch_var <= 40:
            inferred_tone = "intense"
        elif avg_energy_db <= -15 and pitch_var > 40:
            inferred_tone = "expressive/calm"
        else:
            inferred_tone = "neutral/monotone"

        result = {
            "avg_pitch_hz":                  round(avg_pitch, 2),
            "pitch_variability":             round(pitch_var, 2),
            "avg_energy_db":                 round(avg_energy_db, 2),
            "energy_variability":            round(energy_var, 2),
            "tempo_bpm":                     round(tempo_bpm, 2),
            "spectral_centroid_hz":          round(avg_centroid, 2),
            "zero_crossing_rate":            round(avg_zcr, 5),
            "silence_ratio":                 round(silence_ratio, 4),
            "estimated_speaking_rate_wpm":   round(estimated_wpm, 1),
            "inferred_tone":                 inferred_tone,
        }

        logging.info("Audio feature analysis completed successfully")
        return result

    except Exception as e:
        logging.error(f"Error analyzing audio features: {e}")
        return {"error": str(e)}


# ─── Emotion Detection ────────────────────────────────────────────────────────

def detect_voice_emotion(audio_path, audio_features=None):
    """Classify speaker emotion from audio using acoustic features."""
    try:
        y, sr = librosa.load(audio_path, sr=None, mono=True)

        if audio_features and not audio_features.get("error"):
            avg_pitch     = audio_features.get("avg_pitch_hz", 0)
            pitch_var     = audio_features.get("pitch_variability", 0)
            avg_energy    = audio_features.get("avg_energy_db", -30)
            energy_var    = audio_features.get("energy_variability", 0)
            silence_ratio = audio_features.get("silence_ratio", 0)
        else:
            f0            = librosa.yin(y, fmin=50, fmax=500)
            voiced        = f0[f0 > 0]
            avg_pitch     = float(np.mean(voiced)) if len(voiced) else 0.0
            pitch_var     = float(np.std(voiced))  if len(voiced) else 0.0
            rms           = librosa.feature.rms(y=y)[0]
            rms_db        = librosa.amplitude_to_db(rms, ref=np.max)
            avg_energy    = float(np.mean(rms_db))
            energy_var    = float(np.std(rms_db))
            non_silent    = librosa.effects.split(y, top_db=30)
            non_sil_samp  = sum(e - s for s, e in non_silent)
            silence_ratio = float(1.0 - non_sil_samp / max(len(y), 1))

        mfccs        = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        from scipy import stats as scipy_stats
        contrast     = librosa.feature.spectral_contrast(y=y, sr=sr)
        avg_contrast = float(np.mean(contrast))

        scores = {"happy": 0.0, "neutral": 0.0, "angry": 0.0, "sad": 0.0, "nervous": 0.0}

        scores["happy"] = (
            max(0, (avg_pitch - 100) / 300) * 0.30 +
            max(0, (pitch_var - 20)  / 150) * 0.25 +
            max(0, (avg_energy + 30) / 30)  * 0.25 +
            max(0, 1.0 - silence_ratio)      * 0.20
        )
        pitch_norm  = min(1.0, avg_pitch / 250)
        energy_norm = min(1.0, (avg_energy + 40) / 40)
        scores["neutral"] = (
            (1.0 - abs(pitch_norm - 0.5))      * 0.35 +
            (1.0 - abs(energy_norm - 0.5))     * 0.35 +
            (1.0 - min(pitch_var / 100, 1.0))  * 0.30
        )
        scores["angry"] = (
            max(0, (avg_energy + 10) / 20) * 0.40 +
            max(0, 1.0 - pitch_var / 60)    * 0.30 +
            max(0, (energy_var - 5) / 20)   * 0.30
        )
        scores["sad"] = (
            max(0, 1.0 - avg_pitch / 200)   * 0.30 +
            max(0, (-avg_energy - 20) / 30) * 0.30 +
            silence_ratio                    * 0.40
        )
        scores["nervous"] = (
            max(0, pitch_var  / 100)         * 0.35 +
            max(0, energy_var / 20)           * 0.35 +
            max(0, (avg_contrast - 20) / 40) * 0.30
        )

        total      = sum(scores.values()) or 1.0
        normalised = {k: round(v / total, 4) for k, v in scores.items()}
        dominant   = max(normalised, key=normalised.get)

        logging.info("Voice emotion detection completed successfully")
        return {**normalised, "dominant_emotion": dominant}

    except Exception as e:
        logging.error(f"Error in voice emotion detection: {e}")
        return {
            "happy": 0.25, "neutral": 0.40, "angry": 0.10, "sad": 0.15, "nervous": 0.10,
            "dominant_emotion": "neutral", "error": str(e)
        }


# ─── Speech Clarity ───────────────────────────────────────────────────────────

def compute_speech_clarity(audio_path, transcript, audio_features=None):
    """Evaluate speech clarity and return a composite score (0-100)."""
    import re
    try:
        y, sr        = librosa.load(audio_path, sr=None, mono=True)
        duration_sec = librosa.get_duration(y=y, sr=sr)

        word_count = len(transcript.split()) if transcript else 0
        wpm        = round((word_count / duration_sec) * 60) if duration_sec > 0 else 0

        if wpm < 100:       pace_rating = "Too Slow"
        elif wpm <= 160:    pace_rating = "Ideal"
        elif wpm <= 200:    pace_rating = "Fast"
        else:               pace_rating = "Too Fast"

        ideal_wpm   = 135
        wpm_penalty = abs(wpm - ideal_wpm) / ideal_wpm
        pace_score  = max(0, min(100, round(100 - wpm_penalty * 80)))

        FILLERS = ["um", "uh", "ah", "like", "you know", "so", "basically",
                   "literally", "actually", "right", "okay", "well", "hmm"]
        lower_t      = (transcript or "").lower()
        filler_count = sum(len(re.findall(r'\b' + re.escape(f) + r'\b', lower_t)) for f in FILLERS)
        filler_per_min = (filler_count / duration_sec * 60) if duration_sec > 0 else 0
        filler_score   = max(0, min(100, round(100 - filler_per_min * 8)))

        if audio_features and not audio_features.get("error"):
            pitch_var  = audio_features.get("pitch_variability", 50)
            energy_var = audio_features.get("energy_variability", 10)
        else:
            f0         = librosa.yin(y, fmin=50, fmax=500)
            voiced     = f0[f0 > 0]
            pitch_var  = float(np.std(voiced)) if len(voiced) else 50.0
            rms        = librosa.feature.rms(y=y)[0]
            rms_db     = librosa.amplitude_to_db(rms, ref=np.max)
            energy_var = float(np.std(rms_db))

        pitch_stability  = max(0, min(100, round(100 - (pitch_var / 100) * 60)))
        energy_stability = max(0, min(100, round(100 - (energy_var / 20) * 40)))
        tone_stability   = round((pitch_stability + energy_stability) / 2)

        spec_flatness         = librosa.feature.spectral_flatness(y=y)[0]
        avg_flatness          = float(np.mean(spec_flatness))
        quality_from_flatness = max(0, min(100, round((1 - avg_flatness) * 100)))
        centroid              = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_std          = float(np.std(centroid))
        quality_from_centroid = max(0, min(100, round(100 - (centroid_std / 2000) * 50)))
        audio_quality         = round(quality_from_flatness * 0.5 + quality_from_centroid * 0.5)

        overall_score = round(pace_score * 0.25 + filler_score * 0.25 +
                              tone_stability * 0.25 + audio_quality * 0.25)

        logging.info("Speech clarity score computed successfully")
        return {
            "overall_score":   overall_score,
            "speech_pace_wpm": wpm,
            "pace_rating":     pace_rating,
            "filler_words":    filler_count,
            "tone_stability":  tone_stability,
            "audio_quality":   audio_quality,
        }

    except Exception as e:
        logging.error(f"Error computing speech clarity: {e}")
        return {
            "overall_score": 70, "speech_pace_wpm": 130, "pace_rating": "Ideal",
            "filler_words": 0, "tone_stability": 70, "audio_quality": 70, "error": str(e)
        }


# ─── Gemini Summary ───────────────────────────────────────────────────────────

def generate_summary(transcript, audio_analysis):
    """Generate a structured analysis using Gemini."""
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    tone       = audio_analysis.get("inferred_tone", "N/A")
    pitch      = audio_analysis.get("avg_pitch_hz", "N/A")
    pitch_var  = audio_analysis.get("pitch_variability", "N/A")
    energy     = audio_analysis.get("avg_energy_db", "N/A")
    energy_var = audio_analysis.get("energy_variability", "N/A")
    tempo      = audio_analysis.get("tempo_bpm", "N/A")
    silence    = audio_analysis.get("silence_ratio", "N/A")
    wpm        = audio_analysis.get("estimated_speaking_rate_wpm", "N/A")

    prompt = (
        "You are an expert content and advertising analyst.\n\n"
        f"TRANSCRIPT:\n{transcript}\n\n"
        f"Audio Metrics (supplementary only):\n"
        f"- Tone: {tone} | Pitch: {pitch} Hz | Pitch Var: {pitch_var} Hz\n"
        f"- Energy: {energy} dBFS | Energy Var: {energy_var} dB\n"
        f"- Speaking Rate: {wpm} WPM | Tempo: {tempo} BPM | Silence: {silence}\n\n"
        "Return ONLY a raw JSON object — no markdown, no backticks, no explanation before or after. "
        "Use exactly this structure:\n"
        '{"transcript":{"title":"Transcript","content":"<full transcript>"},'
        '"summary":{"title":"Summary","content":"<core message>"},'
        '"impact":{"title":"Impact on Audience","content":"<audience impact>"},'
        '"advertisement_effectiveness":{"title":"Advertisement Effectiveness","content":"<ad evaluation>"},'
        '"audio_appeal":{"title":"Audio Appeal","content":"<delivery analysis>"},'
        '"emotional_tone":{"title":"Emotional Tone","content":"<emotions conveyed>"},'
        '"overall_assessment":{"title":"Overall Assessment","content":"<strengths and weaknesses>"},'
        '"listener_emotions":{"title":"Listener Emotions",'
        '"content":{"Happy":"X%","Sad":"Y%","Excited":"Z%","Neutral":"W%"},'
        '"reason":{"Happy":"<reason>","Sad":"<reason>","Excited":"<reason>","Neutral":"<reason>"}}}'
    )

    try:
        response  = model.generate_content(prompt)
        json_text = response.text.strip()

        # Strip markdown fences if Gemini adds them despite instructions
        json_text = json_text.replace("```json", "").replace("```", "").strip()

        # Extract just the JSON object in case there's any preamble text
        start = json_text.find("{")
        end   = json_text.rfind("}") + 1
        if start != -1 and end > start:
            json_text = json_text[start:end]

        result = json.loads(json_text)
        logging.info("Summary generated successfully")
        return result

    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse Gemini JSON: {e}. Raw: {response.text[:300]}")
        return {"error": "Failed to parse Gemini response"}
    except Exception as e:
        logging.error(f"Error generating summary: {e}")
        return {"error": str(e)}


# ─── Chat / Prompt Handler ────────────────────────────────────────────────────

def validate_and_process_prompt(user_prompt, analysis_result):
    """Validate prompt relevance then generate a contextual response."""
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    transcript     = analysis_result.get("translated_transcript", analysis_result.get("transcript", ""))
    audio_analysis = analysis_result.get("audio_analysis", {})
    summary_data   = analysis_result.get("summary", {})

    validation_prompt = (
        f'Is this question related to audio/speech analysis or the analyzed media content?\n'
        f'Question: "{user_prompt}"\n'
        'Reply with ONLY raw JSON (no markdown): {"is_valid": true/false, "reason": "brief reason"}'
    )

    try:
        val_resp   = model.generate_content(validation_prompt)
        val_text   = val_resp.text.strip().replace("```json", "").replace("```", "").strip()
        val_start  = val_text.find("{")
        val_end    = val_text.rfind("}") + 1
        val_result = json.loads(val_text[val_start:val_end])

        if not val_result.get("is_valid", False):
            return {
                "response": f"I can only help with questions related to the analyzed audio. {val_result.get('reason', '')}",
                "error": "Invalid prompt"
            }

        context_prompt = (
            f"Answer this question about the analyzed media.\n\n"
            f"Transcript:\n{transcript[:2000]}\n\n"
            f"Audio Metrics: tone={audio_analysis.get('inferred_tone','N/A')}, "
            f"pitch={audio_analysis.get('avg_pitch_hz','N/A')}Hz, "
            f"energy={audio_analysis.get('avg_energy_db','N/A')}dBFS, "
            f"rate={audio_analysis.get('estimated_speaking_rate_wpm','N/A')}WPM\n\n"
            f"Question: {user_prompt}\n\n"
            'Reply with ONLY raw JSON (no markdown): {"response": "<your answer>"}'
        )

        response  = model.generate_content(context_prompt)
        resp_text = response.text.strip().replace("```json", "").replace("```", "").strip()

        try:
            rs    = resp_text.find("{")
            re_   = resp_text.rfind("}") + 1
            parsed = json.loads(resp_text[rs:re_])
            return {"response": parsed.get("response", resp_text)}
        except json.JSONDecodeError:
            return {"response": resp_text}

    except Exception as e:
        logging.error(f"Error in validate_and_process_prompt: {e}")
        return {"response": f"Error processing your question: {str(e)}", "error": str(e)}


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":

    logging.info(f"sys.argv received: {sys.argv}")
    logging.info(f"len(sys.argv): {len(sys.argv)}")

    if len(sys.argv) == 3 and sys.argv[1] == "--prompt":
        # Chat mode
        try:
            user_prompt     = input().strip()
            analysis_result = json.loads(sys.argv[2])
            _output_result(validate_and_process_prompt(user_prompt, analysis_result))
        except Exception as e:
            _output_result({"error": str(e), "response": "Failed to process prompt"})

    elif len(sys.argv) == 4:
        # Suggestion-card mode
        title       = sys.argv[1]
        description = sys.argv[2]
        try:
            analysis_result = json.loads(sys.argv[3])
            _output_result(validate_and_process_prompt(f"{title}: {description}", analysis_result))
        except json.JSONDecodeError as e:
            _output_result({"error": f"Invalid JSON: {str(e)}"})
            sys.exit(1)

    elif len(sys.argv) == 2:
        # Main video analysis mode
        video_path = sys.argv[1]
        try:
            audio_path            = extract_audio_from_video(video_path)
            transcript            = transcribe_audio(audio_path)
            translated_transcript = translate_text(transcript, target_language="en")
            audio_analysis        = analyze_audio_features(audio_path)
            emotion_analysis      = detect_voice_emotion(audio_path, audio_features=audio_analysis)
            speech_clarity        = compute_speech_clarity(audio_path, translated_transcript, audio_features=audio_analysis)
            summary               = generate_summary(translated_transcript, audio_analysis)

            _output_result({
                "transcript":            transcript,
                "translated_transcript": translated_transcript,
                "audio_analysis":        audio_analysis,
                "emotion_analysis":      emotion_analysis,
                "speech_clarity":        speech_clarity,
                "summary":               summary,
            })

        except Exception as e:
            logging.error(f"Fatal error: {e}")
            _output_result({"error": str(e)})

    else:
        _output_result({"error": "Invalid arguments"})
        sys.exit(1)