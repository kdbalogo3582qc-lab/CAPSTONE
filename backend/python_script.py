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
    """Validate the model's moderation result and fail closed on any ambiguity."""
    rejected = {
        "decision": "rejected",
        "safe_for_general_audiences": False,
        "reason": "The Community Standards evaluation was missing, incomplete, or invalid.",
        "categories": {},
        "violations": ["other_general_audience_unsuitability"],
    }
    if not isinstance(value, dict):
        return rejected

    categories = value.get("categories")
    violations = value.get("violations")
    is_explicitly_safe = (
        value.get("decision") == "approved"
        and value.get("safe_for_general_audiences") is True
        and isinstance(categories, dict)
        and isinstance(violations, list)
        and not violations
        and all(categories.get(category) in COMMUNITY_STANDARDS_CLEAR_STATUSES
                for category in COMMUNITY_STANDARDS_CATEGORIES)
    )
    if not is_explicitly_safe:
        rejected["reason"] = str(value.get("reason") or rejected["reason"])
        rejected["categories"] = categories if isinstance(categories, dict) else {}
        rejected["violations"] = violations if isinstance(violations, list) and violations else [
            "other_general_audience_unsuitability"
        ]
        return rejected

    return {
        "decision": "approved",
        "safe_for_general_audiences": True,
        "reason": str(value.get("reason") or "The advertisement passed the Community Standards Protocol."),
        "categories": {category: categories[category] for category in COMMUNITY_STANDARDS_CATEGORIES},
        "violations": [],
    }


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


def transcribe_and_translate_audio(video_path, comments=None):
    """
    Upload the MP4 once and get ALL analysis in a single Gemini call:
    transcript, translation, audio features, emotion, clarity, and summary
    (including the predicted target audience, informed by comments/feedback
    when available).
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
SECTION 6 — COMMUNITY STANDARDS PROTOCOL (MANDATORY APPROVAL GATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Decide whether this advertisement is suitable for BOTH children and adults and safe for a general
audience. Inspect the complete video: visuals, on-screen text, spoken/sung words, sound effects,
and the overall message and call to action. Do not rely on a single keyword.

REJECT when the advertisement promotes, encourages, glorifies, normalizes, or instructs viewers
to engage in any of the following:
- nudity or sexually explicit content;
- illegal drugs or drug use;
- smoking, vaping, or tobacco use;
- excessive violence, gore, or disturbing content;
- hate speech, harassment, or discrimination;
- illegal activities or dangerous behavior; or
- sexual or sexually suggestive content involving minors.

Also REJECT content that is otherwise unsuitable for children or general audiences. In particular,
reject when the evidence is unclear or the video cannot be assessed confidently; this gate is
strict and must fail closed.

CONTEXT EXCEPTION: Allow educational, awareness, prevention, health, or public-service messages
that mention sensitive topics solely to discourage, warn about, prevent, or help people avoid the
harmful behavior (for example, “Avoid using drugs,” “Stop smoking,” or “Say no to drugs”). This
exception does NOT allow graphic imagery, sexual content, instructions for harmful conduct, or a
message that ultimately promotes/glorifies the behavior. Evaluate the advertisement's overall
intent and context, not keywords alone.

Set decision to "approved" ONLY if every standard is satisfied and the video is clearly safe for
general audiences. Otherwise set it to "rejected". Every category must use exactly one status:
"clear", "allowed_educational_context", or "violation". Include only categories with a
"violation" in violations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7 — PREDICTED TARGET AUDIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is a PREDICTION, not a measured or confirmed fact. Never phrase it as something the
audience has already experienced — phrase it as who the content is most likely aimed at / would
resonate with, based on the evidence available to you.

Identify WHO is most likely the target audience of this specific video — not a generic bucket
like "children", "adults", "students", or "general public". Use whatever combination of the
following dimensions the evidence actually supports: age range, gender (only with sufficient
evidence), occupation/profession, education level, geographic/location characteristics,
income/economic segment (only if reasonably supported), interests, lifestyle, and other relevant
behavioral characteristics. If a dimension isn't supported by evidence, set its value to
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
  "community_standards": {
    "decision": "approved | rejected",
    "safe_for_general_audiences": <true | false>,
    "reason": "<concise context-aware explanation of the overall decision>",
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
    "violations": ["<only the category keys whose status is violation>"]
  },
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
          "income_segment": "<only if reasonably supported, else 'Unknown'>",
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

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=[
                types.Part.from_bytes(data=base64.b64decode(video_bytes), mime_type="video/mp4"),
                prompt
            ]
        )

        if not response.text:
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

        json_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        start = json_text.find("{")
        end   = json_text.rfind("}") + 1
        if start == -1 or end <= start:
            raise ValueError("Model returned no valid JSON")

        result = json.loads(json_text[start:end])

        community_standards = _normalize_community_standards(result.get("community_standards"))

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
            "community_standards":   community_standards,
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

    elif len(sys.argv) in (2, 3):
        video_path   = sys.argv[1]
        comments_arg = sys.argv[2] if len(sys.argv) == 3 else None
        try:
            result = transcribe_and_translate_audio(video_path, comments=comments_arg)
            _output_result({
                "transcript":            result["original_transcript"],
                "translated_transcript": result["translated_transcript"],
                "detected_language":     result["detected_language"],
                "language_confidence":   result["language_confidence"],
                "community_standards":   result["community_standards"],
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
