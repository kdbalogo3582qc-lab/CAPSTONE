import os
import logging
import sys
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
import warnings

sys.stdout.reconfigure(line_buffering=True)

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"]   = "2"
os.environ["GRPC_VERBOSITY"]         = "NONE"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)

for _noisy in ["urllib3", "httpx"]:
    logging.getLogger(_noisy).setLevel(logging.ERROR)


def _output_result(data):
    """Write JSON result to stdout with sentinel marker."""
    sys.stdout.write("__RESULT__" + json.dumps(data, ensure_ascii=False) + "\n")
    sys.stdout.flush()


import ffmpeg

def sanitize_media_file(input_path):
    output_path = os.path.splitext(input_path)[0] + "_sanitized.mp4"
    try:
        logging.info("Normalizing video container formats via FFmpeg...")
        (
            ffmpeg
            .input(input_path)
            .output(
                output_path,
                vcodec='libx264',
                acodec='aac',
                pix_fmt='yuv420p',
                vf='scale=trunc(iw/2)*2:trunc(ih/2)*2',
                movflags='+faststart',
                loglevel='error'
            )
            .overwrite_output()
            .run()
        )
        return output_path
    except Exception as e:
        logging.error(f"FFmpeg normalization failed: {e}")
        return input_path


load_dotenv()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("API_KEY")
if api_key:
    try:
        client = genai.Client(api_key=api_key)
        logging.info("API configured successfully")
    except Exception as e:
        logging.error(f"Failed to configure API: {e}")
        _output_result({"error": f"API configuration failed: {str(e)}"})
        sys.exit(1)
else:
    logging.error("No API key found")
    _output_result({"error": "No API key found. Please set GEMINI_API_KEY in .env file"})
    sys.exit(1)


MODEL_ID = "gemini-3.1-flash-lite"


def transcribe_and_translate_audio(video_path):
    """
    Upload the MP4 once and get ALL analysis in a single Gemini call:
    transcript, translation, audio features, emotion, clarity, and summary.
    """
    uploaded_file = None
    working_video_path = video_path
    try:
        if not os.path.exists(video_path) or os.path.getsize(video_path) == 0:
            raise RuntimeError(f"Video file missing or empty: {video_path}")

        file_size_kb = os.path.getsize(video_path) / 1024
        logging.info(f"Uploading MP4 video ({file_size_kb:.1f} KB) to Files API...")

        working_video_path = sanitize_media_file(video_path)
        file_size_kb = os.path.getsize(working_video_path) / 1024
        logging.info(f"Sending video inline as base64 ({file_size_kb:.1f} KB)...")

        import base64
        with open(working_video_path, "rb") as vf:
            video_bytes = base64.b64encode(vf.read()).decode("utf-8")

        logging.info("Video encoded. Running analysis...")

        prompt = """You are an expert multimodal analyst for Filipino and Southeast Asian video advertisements.

Watch this video in full. Return ONE raw JSON object covering all analysis dimensions below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — TRANSCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Capture EVERY spoken layer: dialogue, announcer voiceover, jingle lyrics, overlapping voices.
Label speakers (e.g. Customer 1, Vendor, Announcer).
Include sung lyrics if present.
Do NOT include stage directions, visual descriptions, or bracketed notes like [Visual:], [Music:], [Text on screen:], [On-screen signs:], [Shocked], etc.
Write only what is actually spoken or sung — pure dialogue and voiceover text only.

original_transcript   → verbatim in original language(s), speakers labeled, spoken/sung content only
translated_transcript → natural idiomatic English, same structure, spoken/sung content only
detected_language     → language name(s) detected
language_confidence   → float 0.0–1.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — AUDIO FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimate from what you hear in the video:
avg_pitch_hz                 → float
pitch_variability            → float
avg_energy_db                → float (negative dBFS, e.g. -18.5)
energy_variability           → float
tempo_bpm                    → float
spectral_centroid_hz         → float
zero_crossing_rate           → float (e.g. 0.08)
silence_ratio                → float 0.0–1.0
estimated_speaking_rate_wpm  → float
inferred_tone                → one of: "energetic" | "intense" | "expressive/calm" | "neutral/monotone"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — EMOTION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score the emotional qualities in the voices throughout the ad.
All five scores must sum to exactly 1.0. Use decimals.
happy, neutral, nervous, angry, sad → float each
dominant_emotion → string
emotion_reasoning → 2–3 sentences

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — SPEECH CLARITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
overall_score      → int 0–100 (pace 25% + filler_penalty 25% + tone_stability 25% + audio_quality 25%)
speech_pace_wpm    → int
pace_rating        → "Too Slow" | "Ideal" | "Fast" | "Too Fast"
filler_words       → int (count of: um, uh, ah, like, you know, eh, ano, parang used as filler)
tone_stability     → int 0–100
audio_quality      → int 0–100
clarity_reasoning  → 2–3 sentences

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5 — SUMMARY & ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identify the actual product being advertised (usually stated by announcer VO near the end).
Analyze both the comedic hook and the product reveal — not just the skit.
Reference specific words and moments from the transcript.
Do NOT mention any character names, actor names, or named individuals from the video. Refer to people by their role only (e.g. "the customer", "the vendor", "the protagonist", "a young woman", "the announcer"). Keep all descriptions general and role-based.

Each "content" string field must be AT LEAST 3 full sentences.
Each "reason" string under listener_emotions must be AT LEAST 2 sentences.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURN FORMAT — copy this structure exactly, fill all values:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "original_transcript": "<spoken/sung content only, speakers labeled>",
  "translated_transcript": "<spoken/sung content only, speakers labeled>",
  "detected_language": "<language>",
  "language_confidence": <float>,
  "audio_analysis": {
    "avg_pitch_hz": <float>,
    "pitch_variability": <float>,
    "avg_energy_db": <float>,
    "energy_variability": <float>,
    "tempo_bpm": <float>,
    "spectral_centroid_hz": <float>,
    "zero_crossing_rate": <float>,
    "silence_ratio": <float>,
    "estimated_speaking_rate_wpm": <float>,
    "inferred_tone": "<string>"
  },
  "emotion_analysis": {
    "happy": <float>,
    "neutral": <float>,
    "nervous": <float>,
    "angry": <float>,
    "sad": <float>,
    "dominant_emotion": "<string>",
    "reasoning": "<string>"
  },
  "speech_clarity": {
    "overall_score": <int>,
    "speech_pace_wpm": <int>,
    "pace_rating": "<string>",
    "filler_words": <int>,
    "tone_stability": <int>,
    "audio_quality": <int>,
    "reasoning": "<string>"
  },
  "summary": {
    "transcript": {"title": "Transcript", "content": "<full original transcript>"},
    "summary": {"title": "Summary", "content": "<3+ sentences>"},
    "impact": {"title": "Impact on Audience", "content": "<3+ sentences>"},
    "advertisement_effectiveness": {"title": "Advertisement Effectiveness", "content": "<3+ sentences>"},
    "audio_appeal": {"title": "Audio Appeal", "content": "<3+ sentences>"},
    "emotional_tone": {"title": "Emotional Tone", "content": "<3+ sentences>"},
    "overall_assessment": {"title": "Overall Assessment", "content": "<3+ sentences>"},
    "listener_emotions": {
      "title": "Listener Emotions",
      "content": {"Happy": "<X%>", "Sad": "<Y%>", "Excited": "<Z%>", "Neutral": "<W%>"},
      "reason": {
        "Happy": "<2+ sentences>",
        "Sad": "<2+ sentences>",
        "Excited": "<2+ sentences>",
        "Neutral": "<2+ sentences>"
      }
    }
  }
}"""

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=[
                types.Part.from_bytes(data=base64.b64decode(video_bytes), mime_type="video/mp4"),
                prompt
            ]
        )

        json_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        start = json_text.find("{")
        end   = json_text.rfind("}") + 1
        if start == -1 or end <= start:
            raise ValueError("Model returned no valid JSON")

        result = json.loads(json_text[start:end])

        original   = result.get("original_transcript", "").strip()
        translated = result.get("translated_transcript", "").strip()
        detected   = result.get("detected_language", "unknown")

        if not original:
            logging.warning("No spoken dialogue detected — video may be music or visual-only")
            original   = "[No spoken dialogue detected]"
            translated = "[No spoken dialogue detected]"
        elif not translated:
            translated = original

        logging.info(f"Analysis complete. Language: {detected}")
        return {
            "original_transcript":   original,
            "translated_transcript": translated,
            "detected_language":     detected,
            "language_confidence":   result.get("language_confidence", 1.0),
            "audio_analysis":        result.get("audio_analysis", {}),
            "emotion_analysis":      result.get("emotion_analysis", {}),
            "speech_clarity":        result.get("speech_clarity", {}),
            "summary":               result.get("summary", {}),
        }

    except Exception as e:
        logging.error(f"Analysis failed: {e}")
        raise

    finally:
        pass  # No Files API upload to clean up
        if working_video_path != video_path:
            try:
                os.remove(working_video_path)
            except OSError:
                pass


def _gemini_translate(text, detected_language):
    """Translate text to English using Gemini (used by Whisper fallback path)."""
    try:
        if detected_language in ("en", "english"):
            return text
        prompt = (
            f"Translate the following advertisement transcript from {detected_language} to natural, "
            f"idiomatic English. Preserve humor, tone, slang, and ad intent. "
            f"Output ONLY the translated text, no labels or markdown.\n\n"
            f"TRANSCRIPT:\n{text}"
        )
        response = client.models.generate_content(model=MODEL_ID, contents=prompt)
        return response.text.strip() or text
    except Exception:
        return text


# ─── Chat / Prompt Handler ────────────────────────────────────────────────────

def validate_and_process_prompt(user_prompt, analysis_result):
    """Validate prompt relevance then generate a contextual response with intent-aware matching."""
    transcript     = analysis_result.get("translated_transcript", analysis_result.get("transcript", ""))
    audio_analysis = analysis_result.get("audio_analysis", {})
    summary_data   = analysis_result.get("summary", {})

    validation_prompt = (
        f'You are an intent classifier for a video analysis chatbot.\n\n'
        f'TASK: Determine if the user\'s question is answerable from the analyzed video content.\n\n'
        f'INTENT MATCHING RULES:\n'
        f'- Identify the KEY INTENT of the question, not just the literal keywords.\n'
        f'- Match even if the phrasing is indirect, conversational, or in Tagalog/Taglish/English.\n'
        f'- Common intents and their variations:\n'
        f'    • "target audience" → "sino ang target", "para kanino", "who is this for", "audience nito"\n'
        f'    • "ad message/goal" → "ano ang ibig sabihin", "what is the purpose", "ano ang mensahe"\n'
        f'    • "effectiveness" → "maganda ba", "effective ba", "does it work", "impact"\n'
        f'    • "emotion/tone" → "pakiramdam", "mood", "how does it feel", "tone ng ad"\n'
        f'    • "product/service" → "anong binebenta", "what is advertised", "ano ang product"\n'
        f'- NEVER reject a query if the intent is inferable, even if phrasing is vague or partial.\n'
        f'- If unsure, default to is_valid: true — attempt an answer rather than wrongly reject.\n\n'
        f'You CAN answer questions about:\n'
        f'- Spoken content, topic, message, narrative, or product being advertised\n'
        f'- Speaker delivery, tone, emotion, speech patterns\n'
        f'- Advertisement effectiveness, impact, audience appeal, target audience\n'
        f'- Audio features: pitch, energy, pacing, clarity\n'
        f'- Visual elements or cultural context inferable from the transcript\n'
        f'- Filipino/Taglish slang or local tropes referenced in the content\n\n'
        f'You CANNOT answer (is_valid: false ONLY for these):\n'
        f'- Topics completely unrelated to the video (weather, recipes, math homework, etc.)\n'
        f'- Requests to perform actions outside analysis (write code, translate unrelated text, etc.)\n\n'
        f'Question: "{user_prompt}"\n\n'
        f'Transcript excerpt (for context): "{transcript[:600]}"\n\n'
        'Reply with ONLY raw JSON (no markdown): {{"is_valid": true/false, "intent": "brief intent label", "reason": "brief reason"}}'
    )

    try:
        val_resp   = client.models.generate_content(model=MODEL_ID, contents=validation_prompt)
        val_text   = val_resp.text.strip().replace("```json", "").replace("```", "").strip()
        val_start  = val_text.find("{")
        val_end    = val_text.rfind("}") + 1
        val_result = json.loads(val_text[val_start:val_end])

        if not val_result.get("is_valid", True):
            return {
                "response": (
                    f"That question seems to be outside what I can analyze from this video. "
                    f"I can answer questions about the video's content, message, target audience, tone, "
                    f"effectiveness, or anything inferable from the transcript. "
                    f"Could you rephrase or ask something more specific about the video?"
                ),
                "error": "Invalid prompt"
            }

        detected_intent = val_result.get("intent", "general inquiry")

        context_prompt = (
            f"You are an expert media analyst chatbot specializing in Filipino and Southeast Asian advertising.\n\n"
            f"Detected user intent: {detected_intent}\n\n"
            f"Full Transcript:\n{transcript[:3000]}\n\n"
            f"Audio Analysis Data:\n"
            f"- Inferred Tone: {audio_analysis.get('inferred_tone', 'N/A')}\n"
            f"- Avg Pitch: {audio_analysis.get('avg_pitch_hz', 'N/A')} Hz "
            f"(variability: {audio_analysis.get('pitch_variability', 'N/A')} Hz)\n"
            f"- Energy: {audio_analysis.get('avg_energy_db', 'N/A')} dBFS\n"
            f"- Speaking Rate: {audio_analysis.get('estimated_speaking_rate_wpm', 'N/A')} WPM\n"
            f"- Silence Ratio: {audio_analysis.get('silence_ratio', 'N/A')}\n\n"
            f"Summary Context: {json.dumps(summary_data)[:1200]}\n\n"
            f"User Question: {user_prompt}\n\n"
            f"ANSWER RULES:\n"
            f"- Address the detected intent directly, even if the question is phrased vaguely or in Tagalog/Taglish.\n"
            f"- For 'target audience' questions: identify demographics, psychographics, and cultural relevance.\n"
            f"- For 'emotion/tone' questions: prioritize actual audio tone data over keywords in transcript.\n"
            f"- For 'effectiveness' questions: evaluate clarity, memorability, and cultural resonance.\n"
            f"- If the question is partially clear, give a best-effort answer then ask one clarifying follow-up.\n"
            f"- NEVER say 'I cannot answer' for questions related to the video — always attempt a response.\n"
            f"- Be conversational, specific, and direct. Reference actual transcript moments when helpful.\n\n"
            'Reply with ONLY raw JSON (no markdown): {"response": "<your answer>"}'
        )

        response  = client.models.generate_content(model=MODEL_ID, contents=context_prompt)
        resp_text = response.text.strip().replace("```json", "").replace("```", "").strip()

        try:
            rs     = resp_text.find("{")
            re_    = resp_text.rfind("}") + 1
            parsed = json.loads(resp_text[rs:re_])
            return {"response": parsed.get("response", resp_text)}
        except json.JSONDecodeError:
            return {"response": resp_text}

    except Exception as e:
        logging.error(f"Error in validate_and_process_prompt: {e}")
        return {"response": f"Error processing your question: {str(e)}", "error": str(e)}


if __name__ == "__main__":

    if len(sys.argv) == 3 and sys.argv[1] == "--prompt":
        try:
            user_prompt     = input().strip()
            analysis_result = json.loads(sys.argv[2])
            _output_result(validate_and_process_prompt(user_prompt, analysis_result))
        except Exception as e:
            _output_result({"error": str(e), "response": "Failed to process prompt"})

    elif len(sys.argv) == 4:
        title       = sys.argv[1]
        description = sys.argv[2]
        try:
            analysis_result = json.loads(sys.argv[3])
            _output_result(validate_and_process_prompt(f"{title}: {description}", analysis_result))
        except json.JSONDecodeError as e:
            _output_result({"error": f"Invalid JSON: {str(e)}"})
            sys.exit(1)

    elif len(sys.argv) == 2:
        video_path = sys.argv[1]
        try:
            result = transcribe_and_translate_audio(video_path)
            _output_result({
                "transcript":            result["original_transcript"],
                "translated_transcript": result["translated_transcript"],
                "detected_language":     result["detected_language"],
                "language_confidence":   result["language_confidence"],
                "audio_analysis":        result.get("audio_analysis", {}),
                "emotion_analysis":      result.get("emotion_analysis", {}),
                "speech_clarity":        result.get("speech_clarity", {}),
                "summary":               result.get("summary", {}),
            })

        except Exception as e:
            logging.error(f"Fatal error: {e}")
            _output_result({"error": str(e)})
    else:
        _output_result({"error": "Invalid arguments"})
        sys.exit(1)