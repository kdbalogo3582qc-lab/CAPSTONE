import os
import logging
import sys
import json
import re
from pathlib import Path
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
                preset='medium',
                crf=18,
                audio_bitrate='128k',
                ar=48000,
                ac=2,
                threads=1,
                map_metadata='-1',
                loglevel='error'
            )
            .overwrite_output()
            .run()
        )
        return output_path
    except Exception as e:
        logging.error(f"FFmpeg normalization failed: {e}")
        raise RuntimeError("Video preprocessing failed. Check FFmpeg and retry; analysis was not run on a different fallback input.") from e


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


ANALYSIS_CONFIG = json.loads((Path(__file__).with_name("analysis-config.json")).read_text())
MODEL_ID = ANALYSIS_CONFIG["model"]
GENERATION_SETTINGS = ANALYSIS_CONFIG["generation_settings"]

COMMUNITY_STANDARDS_CATEGORIES = (
    "nudity_or_sexual_content",
    "illegal_drugs_or_drug_use",
    "smoking_vaping_or_tobacco",
    "violence_gore_or_disturbing_content",
    "hate_harassment_or_discrimination",
    "illegal_activities_or_dangerous_behavior",
    "sexual_content_involving_minors",
    "other_general_audience_unsuitability",
)
COMMUNITY_STANDARDS_CLEAR_STATUSES = {"clear", "allowed_educational_context"}


def _normalize_community_standards(value):
    """Unknown or contradictory evidence is a processing failure, never a violation."""
    failed = {"state": "review_failed", "reason": "The guideline review was incomplete or invalid. Please retry.",
              "violations": [], "violation_details": []}
    if not isinstance(value, dict):
        return failed
    categories = value.get("categories")
    violations = value.get("violations")
    if not isinstance(categories, dict) or not isinstance(violations, list):
        return failed
    if any(not isinstance(categories.get(c), str) or categories.get(c) not in COMMUNITY_STANDARDS_CLEAR_STATUSES | {"violation"}
           for c in COMMUNITY_STANDARDS_CATEGORIES):
        return failed
    found = [c for c in COMMUNITY_STANDARDS_CATEGORIES if categories[c] == "violation"]
    if any(not isinstance(c, str) for c in violations) or set(found) != set(violations):
        return failed
    if value.get("decision") != ("rejected" if found else "approved") or value.get("safe_for_general_audiences") is not (not found):
        return failed
    supplied = value.get("violation_details")
    if not isinstance(supplied, list) or len(supplied) != len(found):
        return failed
    details = []
    for category in found:
        matches = [d for d in supplied if isinstance(d, dict) and d.get("category") == category]
        if len(matches) != 1 or not isinstance(matches[0].get("reason"), str) or not matches[0]["reason"].strip():
            return failed
        detail = {"category": category, "reason": matches[0]["reason"].strip()}
        for key in ("transcript_excerpt",):
            if isinstance(matches[0].get(key), str) and matches[0][key].strip():
                detail[key] = matches[0][key].strip()
        position = _review_timestamp(matches[0].get("timestamp"))
        if position is not None:
            detail.update(position)
        details.append(detail)
    return {**value, "state": "flagged" if found else "passed", "violation_details": details}


class ModelResponseFormatError(RuntimeError):
    """A retryable provider response-format error, not a guideline violation."""


class ProviderLimitationError(RuntimeError):
    def __init__(self, reason):
        super().__init__("The AI provider could not analyze this video because of its content restrictions. Your guideline acknowledgement does not override the provider's restrictions.")
        self.provider_reason = reason


def _provider_text(response):
    """Keep provider refusals distinct from missing output or application review flags."""
    def enum_name(value):
        return str(getattr(value, "value", value) or "").upper().rsplit(".", 1)[-1]
    feedback = getattr(response, "prompt_feedback", None)
    block = enum_name(getattr(feedback, "block_reason", None))
    if block and block not in {"0", "UNSPECIFIED", "BLOCKED_REASON_UNSPECIFIED", "BLOCK_REASON_UNSPECIFIED"}:
        raise ProviderLimitationError(block)
    restricted = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION", "SPII", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT"}
    for candidate in (getattr(response, "candidates", None) or []):
        reason = enum_name(getattr(candidate, "finish_reason", None))
        if reason in restricted or any(getattr(rating, "blocked", False) for rating in (getattr(candidate, "safety_ratings", None) or [])):
            raise ProviderLimitationError(reason or "SAFETY")
        if reason == "MAX_TOKENS":
            raise ModelResponseFormatError("The AI response was cut short. Please try again; your video is still uploaded.")
    return response.text


def _review_timestamp(value, duration=None):
    """Parse actual supplied playback positions; never substitute zero for missing evidence."""
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"(?:(\d{1,3}):)?(\d{1,2}):([0-5]\d)(?:\.(\d{1,3}))?", value.strip())
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2))
    if match.group(1) is not None and minutes >= 60:
        return None
    seconds = hours * 3600 + minutes * 60 + int(match.group(3)) + float("0." + (match.group(4) or "0"))
    if duration is not None and seconds > duration:
        return None
    whole = int(seconds)
    display = f"{whole // 3600:02d}:{whole // 60 % 60:02d}:{whole % 60:02d}" if whole >= 3600 else f"{whole // 60:02d}:{whole % 60:02d}"
    if seconds % 1:
        display += f"{seconds % 1:.3f}"[1:].rstrip("0")
    return {"timestamp": display, "timestamp_seconds": seconds, "timestamp_source": "ai_video_review"}


def _escape_json_string_whitespace(value):
    """Losslessly escape raw LF/CR/tab inside strings; never invent or close JSON."""
    output = []
    in_string = False
    escaped = False
    for char in value:
        if in_string:
            if ord(char) < 32:
                if escaped or char not in ("\n", "\r", "\t"):
                    raise ModelResponseFormatError("The AI provider returned an invalid response. Please try again.")
                output.append(json.dumps(char)[1:-1])
                continue
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
        output.append(char)
    return "".join(output)


def _parse_json_object(text):
    """Read one complete object, repairing only unescaped string whitespace."""
    message = "The AI provider returned an incomplete or unreadable response. Please try again; your video is still uploaded."
    if not isinstance(text, str) or not text.strip():
        raise ModelResponseFormatError(message)
    payload = text.strip().lstrip("\ufeff")
    if payload.startswith("```"):
        fence = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", payload, flags=re.DOTALL | re.IGNORECASE)
        if not fence:
            raise ModelResponseFormatError(message)
        payload = fence.group(1).strip()
    start = payload.find("{")
    if start < 0:
        raise ModelResponseFormatError(message)
    payload = payload[start:]

    def no_constants(value):
        raise ModelResponseFormatError(message)

    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ModelResponseFormatError(message)
            result[key] = value
        return result

    decoder = json.JSONDecoder(parse_constant=no_constants, object_pairs_hook=unique_keys)
    try:
        try:
            parsed, end = decoder.raw_decode(payload)
        except json.JSONDecodeError as error:
            if not error.msg.startswith("Invalid control character"):
                raise
            repaired = _escape_json_string_whitespace(payload)
            parsed, end = decoder.raw_decode(repaired)
            payload = repaired
            logging.debug("Escaped raw line breaks or tabs in AI JSON string values; response content preserved.")
        if not isinstance(parsed, dict) or payload[end:].strip():
            raise ModelResponseFormatError(message)
        return parsed
    except json.JSONDecodeError as error:
        logging.warning("AI response JSON rejected: %s at line %s column %s", error.msg, error.lineno, error.colno)
        raise ModelResponseFormatError(message) from error


COMMUNITY_STANDARDS_PROMPT = """You are the mandatory Community Standards gate for an advertisement video. Inspect the complete video: visuals, on-screen text, spoken/sung words, sound effects, and the overall message and call to action. Do not analyze the ad's effectiveness, audience, transcript, or any other attribute. Return ONLY the JSON decision below.

The advertisement must be safe for both children and adults. Reject content that promotes, encourages, glorifies, normalizes, or instructs viewers to engage in nudity or sexually explicit content; illegal drugs/drug use; smoking, vaping or tobacco use; excessive violence, gore or disturbing content; hate speech, harassment or discrimination; illegal activities or dangerous behavior; or sexual/sexually suggestive content involving minors. Reject anything otherwise unsuitable for children or general audiences. If the video cannot be assessed confidently, return {"state":"review_failed"} rather than inventing a violation.

Educational, awareness, prevention, health, and public-service messages may be allowed when their overall intent is to discourage, warn about, prevent, or help viewers avoid harmful behavior (for example, “Avoid using drugs,” “Stop smoking,” or “Say no to drugs”). That exception never permits graphic imagery, sexual content, harmful instructions, or a message that ultimately promotes or glorifies the behavior. Evaluate context and intent, not keywords alone.

Set approved only when every category is clearly safe. Otherwise reject. Each category must be exactly clear, allowed_educational_context, or violation. List only violation category keys. For every violation, add one matching violation_details entry that explains specifically what was detected and why it violates the guideline. Keep the explanation factual, non-graphic, and understandable to the advertiser. Do not merely repeat the category name. Include timestamp and transcript_excerpt fields only when directly supported by the video; omit them when unavailable. Never invent evidence. Timestamps must be absolute elapsed playback positions in MM:SS (or HH:MM:SS) from the first frame of the complete upload, including any intro. Never use 00:00 as a placeholder. Use 00:00 only when the observation is visible or audible at the actual beginning; otherwise omit the timestamp when its position is uncertain.

{
  "decision": "approved | rejected",
  "safe_for_general_audiences": true,
  "reason": "concise, context-aware explanation",
  "categories": {
    "nudity_or_sexual_content": "clear | allowed_educational_context | violation",
    "illegal_drugs_or_drug_use": "clear | allowed_educational_context | violation",
    "smoking_vaping_or_tobacco": "clear | allowed_educational_context | violation",
    "violence_gore_or_disturbing_content": "clear | allowed_educational_context | violation",
    "hate_harassment_or_discrimination": "clear | allowed_educational_context | violation",
    "illegal_activities_or_dangerous_behavior": "clear | allowed_educational_context | violation",
    "sexual_content_involving_minors": "clear | allowed_educational_context | violation",
    "other_general_audience_unsuitability": "clear | allowed_educational_context | violation"
  },
  "violations": [],
  "violation_details": [
    {
      "category": "<violation category key>",
      "reason": "specific, non-graphic explanation of what was detected and why it violates the guideline"
    }
  ]
}
"""


def _build_comments_block(comments):
    """
    Turn a raw comments payload (JSON string or list of strings/objects) into a
    numbered evidence block for the Gemini prompt. Returns "" if there is
    nothing usable — the prompt then falls back to content-only prediction.
    """
    if not comments:
        return ""

    try:
        parsed = comments if isinstance(comments, list) else json.loads(comments)
    except (TypeError, ValueError):
        parsed = [str(comments)]

    if not isinstance(parsed, list):
        parsed = [parsed]

    lines = []
    for item in parsed[:300]:
        if isinstance(item, dict):
            text = str(item.get("text") or item.get("comment") or item.get("body") or "").strip()
        else:
            text = str(item).strip()
        if text:
            lines.append(text)

    if not lines:
        return ""

    numbered = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(lines))
    return f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIEWER COMMENTS / FEEDBACK (real audience data — additional evidence source)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{numbered}

Use these comments as a second evidence source, alongside the video content itself, for the
predicted_target_audience section below. Look for patterns: who is engaging, recurring
interests/concerns, and demographic clues — but ONLY when the text gives reasonable evidence
(explicit self-description, clearly context-specific language, etc.). Do NOT infer a commenter's
age, gender, income, or any other demographic from their username, writing style, or stereotypes
alone. If the comments don't support a demographic claim, don't make it.
"""


def measure_audio(video_path):
    """Measure a fixed mono 16 kHz PCM signal. Missing/failed measurements stay null."""
    fields = ("duration_seconds", "avg_energy_db", "energy_variability", "silence_ratio",
              "zero_crossing_rate", "spectral_centroid_hz")
    unavailable = {key: None for key in fields}
    try:
        import numpy as np
        raw, _ = (ffmpeg.input(video_path).output("pipe:", format="f32le", acodec="pcm_f32le", ar=16000, ac=1)
                  .run(capture_stdout=True, capture_stderr=True))
        samples = np.frombuffer(raw, dtype="<f4").astype(np.float64)
        if not samples.size or not np.isfinite(samples).all():
            return {**unavailable, "status": "unavailable", "reason": "No measurable audio samples"}
        rms = float(np.sqrt(np.mean(samples ** 2)))
        duration = samples.size / 16000.0
        frames = samples[:samples.size // 400 * 400].reshape(-1, 400)
        if not len(frames):
            return {**unavailable, "duration_seconds": duration, "status": "unavailable", "reason": "Audio shorter than one 25 ms frame"}
        frame_rms = np.sqrt(np.mean(frames ** 2, axis=1))
        frame_db = 20 * np.log10(np.maximum(frame_rms, 1e-12))
        spectrum = np.abs(np.fft.rfft(frames * np.hanning(400), axis=1))
        weights = spectrum.sum(axis=1)
        usable = weights > 1e-10
        centroid = float(np.mean((spectrum[usable] * np.fft.rfftfreq(400, 1 / 16000)).sum(axis=1) / weights[usable])) if usable.any() else None
        return {"status": "measured", "duration_seconds": round(duration, 6),
                "avg_energy_db": round(20 * float(np.log10(rms)), 3) if rms > 0 else None,
                "energy_variability": round(float(np.std(frame_db)), 3) if rms > 0 else None,
                "silence_ratio": round(float(np.mean(frame_db < -40)), 6),
                "zero_crossing_rate": round(float(np.mean(np.signbit(samples[1:]) != np.signbit(samples[:-1]))), 6) if samples.size > 1 else None,
                "spectral_centroid_hz": round(centroid, 3) if centroid is not None else None,
                "pcm_sample_rate": 16000, "frame_samples": 400, "silence_threshold_dbfs": -40}
    except Exception:
        logging.warning("Audio measurements unavailable; no zero-valued substitutes will be used")
        return {**unavailable, "status": "unavailable", "reason": "No audio track or PCM measurement failed"}


def audio_with_sources(ai, measured):
    audio = dict(ai)
    sources = {}
    measured_fields = ("avg_energy_db", "energy_variability", "silence_ratio", "zero_crossing_rate", "spectral_centroid_hz")
    for key in measured_fields:
        audio[key] = measured.get(key)
        sources[key] = "measured_PCM_16k_mono" if audio[key] is not None else "unavailable"
    for key in ("avg_pitch_hz", "pitch_variability", "tempo_bpm"):
        value = ai.get(key)
        if measured.get("status") != "measured" or measured.get("silence_ratio") == 1 or isinstance(value, bool) or not isinstance(value, (int, float)) or not (0 <= value < 100000 if key == "pitch_variability" else 0 < value < 100000):
            value = None
        audio[key] = value
        sources[key] = "AI_estimate" if value is not None else "unavailable"
    if measured.get("status") != "measured" or measured.get("silence_ratio") == 1:
        audio["inferred_tone"] = None
    sources["inferred_tone"] = "AI_estimate" if audio.get("inferred_tone") else "unavailable"
    audio["feature_sources"] = sources
    return audio


def transcribe_and_translate_audio(video_path, comments=None, review_only=False, recorded_review=None, generation_settings=None):
    """
    Review the video separately, or analyze using a server-recorded review.
    Provider safety restrictions remain active for every call.
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

        community_standards = recorded_review
        if community_standards is None:
            logging.info("Running community guideline review...")
            moderation_response = client.models.generate_content(
                model=MODEL_ID,
                config=types.GenerateContentConfig(**GENERATION_SETTINGS),
                contents=[types.Part.from_bytes(data=base64.b64decode(video_bytes), mime_type="video/mp4"),
                          COMMUNITY_STANDARDS_PROMPT],
            )
            community_standards = _normalize_community_standards(_parse_json_object(_provider_text(moderation_response)))
            try:
                duration = float(ffmpeg.probe(working_video_path).get("format", {}).get("duration", "nan"))
            except Exception:
                duration = None
            for detail in community_standards.get("violation_details", []):
                position = _review_timestamp(detail.get("timestamp"), duration)
                for key in ("timestamp", "timestamp_seconds", "timestamp_source"):
                    detail.pop(key, None)
                if position is not None:
                    detail.update(position)
        if review_only or (recorded_review is None and community_standards.get("state") == "flagged"):
            return {"community_standards": community_standards, "analysis_status": "awaiting_acknowledgement" if community_standards.get("state") == "flagged" else "reviewed"}
        if community_standards.get("state") not in ("passed", "flagged"):
            raise RuntimeError("Guideline review failed. Please retry.")
        logging.info("Running effectiveness and audio analysis...")

        comments_block = _build_comments_block(comments)

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
overall_score      → null (the server calculates the final score from validated components)
speech_pace_wpm    → int
pace_rating        → "Too Slow" | "Ideal" | "Fast" | "Too Fast"
filler_words       → AI estimated int or null when no speech (count of: um, uh, ah, like, you know, eh, ano, parang used as filler)
tone_stability     → AI estimated int 0–100 or null when unavailable
audio_quality      → AI estimated int 0–100 or null when unavailable
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
SECTION 6 — PREDICTED TARGET AUDIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is a PREDICTION, not a measured or confirmed fact. Never phrase it as something the
audience has already experienced — phrase it as who the content is most likely aimed at / would
resonate with, based on the evidence available to you.

Identify WHO is most likely the target audience of this specific video — not a generic bucket
like "children", "adults", "students", or "general public". Use whatever combination of the
following dimensions the evidence actually supports: age range, gender (only with sufficient
evidence), occupation/profession, education level, geographic/location characteristics,
interests, lifestyle, and other relevant behavioral characteristics. If a dimension isn't
supported by evidence, set its value to
"Unknown" or "Not enough evidence" — never invent it.
{comments_block}
Produce a ranked list: one primary_segment (the strongest, best-evidenced match) and zero or more
secondary_segments (plausible but weaker matches), each with:
- label: a short descriptive name for the segment (not a generic bucket)
- demographics: an object with only the dimensions you have evidence for
- evidence: a specific, evidence-based explanation referencing actual content from the video
  and, if used, actual patterns from the comments — not a generic statement like "this suits
  young people". Explicitly note whether each point is drawn from the video content, the
  comments, or is an AI inference, and never present an inference as a confirmed fact.
- confidence: "High", "Medium", or "Low", reflecting how strong the evidence actually is — do
  not default to "High" for weakly-supported guesses.

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
    "overall_score": null,
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
    "predicted_target_audience": {
      "title": "Predicted Target Audience",
      "primary_segment": {
        "label": "<short descriptive name, not a generic bucket>",
        "demographics": {
          "age_range": "<e.g. '18-24' or 'Unknown'>",
          "gender": "<only if evidenced, else 'Unknown'>",
          "occupation": "<or 'Unknown'>",
          "education_level": "<or 'Unknown'>",
          "location": "<or 'Unknown'>",
          "interests": ["<interest>", "..."],
          "lifestyle": "<or 'Unknown'>"
        },
        "evidence": "<specific, evidence-based reasoning citing content and/or comments; label each point as content, comments, or inference>",
        "confidence": "High | Medium | Low"
      },
      "secondary_segments": [
        {
          "label": "<short descriptive name>",
          "demographics": { "...": "same shape as primary_segment.demographics, only include supported fields" },
          "evidence": "<evidence-based reasoning>",
          "confidence": "High | Medium | Low"
        }
      ]
    },
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

        prompt = prompt.replace("{comments_block}", comments_block)
        prompt += "\nReturn exactly one complete valid JSON object. Escape line breaks, carriage returns and tabs inside JSON strings. Never put literal control characters inside a JSON string. Do not repeat the response object."

        response = client.models.generate_content(
            model=MODEL_ID,
            config=types.GenerateContentConfig(**(generation_settings or GENERATION_SETTINGS)),
            contents=[
                types.Part.from_bytes(data=base64.b64decode(video_bytes), mime_type="video/mp4"),
                prompt
            ]
        )

        if not _provider_text(response):
            reason_str = "unknown"
            if response.candidates:
                cand = response.candidates[0]
                finish_reason = getattr(cand, "finish_reason", "unknown")
                safety_ratings = getattr(cand, "safety_ratings", None)
                reason_str = f"finish_reason={finish_reason}"
                if safety_ratings:
                    blocked = [
                        f"{r.category}:{r.probability}"
                        for r in safety_ratings
                        if getattr(r, "blocked", False) or str(getattr(r, "probability", "")).upper() not in ("NEGLIGIBLE", "LOW")
                    ]
                    if blocked:
                        reason_str += f", safety_flags=[{', '.join(blocked)}]"
            else:
                pf = getattr(response, "prompt_feedback", None)
                if pf is not None:
                    reason_str = f"prompt_feedback_block_reason={getattr(pf, 'block_reason', 'unknown')}"
                else:
                    reason_str = "no candidates returned, no prompt_feedback available"

            logging.error(f"Returned empty response.text. Reason: {reason_str}")
            raise RuntimeError(f"Returned no analyzable content for this video ({reason_str})")

        result = _parse_json_object(_provider_text(response))
        if not all(isinstance(result.get(k), dict) and result[k] for k in ("audio_analysis", "summary", "speech_clarity", "emotion_analysis")):
            raise RuntimeError("Analysis response was incomplete. Please retry.")

        if not all(isinstance(result.get(key), str) for key in ("original_transcript", "translated_transcript", "detected_language")):
            raise RuntimeError("Transcript response was incomplete. Please retry.")
        if not isinstance(result.get("summary", {}).get("summary", {}).get("content"), str) or not result["summary"]["summary"]["content"].strip():
            raise RuntimeError("Summary response was incomplete. Please retry.")
        original   = result.get("original_transcript", "").strip()
        translated = result.get("translated_transcript", "").strip()
        detected   = result.get("detected_language", "unknown")

        if not original:
            logging.warning("No spoken dialogue detected — video may be music or visual-only")
            original   = "[No spoken dialogue detected]"
            translated = "[No spoken dialogue detected]"
        elif not translated:
            translated = original

        measured_audio = measure_audio(working_video_path)
        # Speaker labels and non-spoken stage directions must not count as words.
        spoken = re.sub(r"(?m)^[^:\n]{1,60}:\s*", "", original)
        spoken = re.sub(r"\[[^\]]*\]", "", spoken)
        word_count = len(re.findall(r"[^\W_]+(?:['’][^\W_]+)*", spoken, flags=re.UNICODE))
        if measured_audio.get("silence_ratio") == 1:
            word_count = 0
        logging.info(f"Analysis complete. Language: {detected}")
        return {
            "original_transcript":   original,
            "translated_transcript": translated,
            "detected_language":     detected,
            "language_confidence":   result.get("language_confidence") if isinstance(result.get("language_confidence"), (int, float)) and not isinstance(result.get("language_confidence"), bool) and 0 <= result["language_confidence"] <= 1 else None,
            "community_standards":   community_standards,
            "audio_analysis":        audio_with_sources(result.get("audio_analysis", {}), measured_audio),
            "measured_audio":        measured_audio,
            "provider_model_version": str(getattr(response, "model_version", "") or "unknown"),
            "transcript_word_count": word_count,
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
        if not response.text:
            logging.warning("Returned no text during translation fallback; using original text.")
            return text
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
        if not val_resp.text:
            finish_reason = val_resp.candidates[0].finish_reason if val_resp.candidates else "no candidates"
            logging.error(f"Returned empty text during validation. finish_reason={finish_reason}")
            raise RuntimeError(f"Returned no text during validation (finish_reason={finish_reason})")
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
        if not response.text:
            finish_reason = response.candidates[0].finish_reason if response.candidates else "no candidates"
            logging.error(f"Returned empty text answering prompt. finish_reason={finish_reason}")
            raise RuntimeError(f"Returned no text (finish_reason={finish_reason})")
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

    if len(sys.argv) == 3 and sys.argv[1] == "--video-job":
        try:
            job = json.load(sys.stdin)
            result = transcribe_and_translate_audio(sys.argv[2], comments=job.get("comments"),
                review_only=job["mode"] == "review", recorded_review=job.get("review"), generation_settings=job.get("generation_settings"))
            if "original_transcript" in result:
                result["transcript"] = result.pop("original_transcript")
            _output_result(result)
        except Exception as e:
            _output_result({"error": str(e), "code": "PROVIDER_LIMITATION" if isinstance(e, ProviderLimitationError) else "INVALID_MODEL_RESPONSE" if isinstance(e, ModelResponseFormatError) else "PROCESSING_ERROR",
                            "provider_reason": getattr(e, "provider_reason", None)})

    elif len(sys.argv) == 3 and sys.argv[1] == "--prompt":
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

    elif len(sys.argv) in (2, 3):
        video_path   = sys.argv[1]
        comments_arg = sys.argv[2] if len(sys.argv) == 3 else None
        try:
            result = transcribe_and_translate_audio(video_path, comments=comments_arg)
            if "original_transcript" in result:
                result["transcript"] = result.pop("original_transcript")
            _output_result(result)

        except Exception as e:
            logging.error(f"Fatal error: {e}")
            _output_result({"error": str(e)})
    else:
        _output_result({"error": "Invalid arguments"})
        sys.exit(1)
