# Revision 2: analysis identity, repeatability and run comparison

## Delivery and validation status

**No tests, builds, syntax-check commands, live provider analyses, database migrations, or browser checks were run for Revision 2, at the user's explicit request.** The five-fresh-run baseline and all field-level repeatability measurements remain **unverified**. The findings below are a trace of the implementation, not measured performance or accuracy claims. Revision 1's earlier test results do not validate Revision 2.

## Migration and deployment

1. Back up the configured database. Apply `001_guideline_review.sql` if Revision 1 has not already been installed. Do not run it again if its table exists.
2. Import `002_analysis_runs.sql` once into the database selected by `backend/.env` (`DB_NAME`), using phpMyAdmin. Alternatively, from the repository root:
   ```sh
   mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/migrations/002_analysis_runs.sql
   ```
3. Restart the backend and deploy the updated frontend. Set `PYTHON_EXECUTABLE` to the Python executable with the application's dependencies if necessary (for example, the project's `venv/bin/python3`). No dependencies are installed automatically.

Migration 002 adds pending-request context and a guideline-version field to `video_reviews`, plus two new tables: `analysis_runs` and `analysis_identity_locks`. It does not rewrite or delete `saved_videos`, original findings, acknowledgement times, or previous result JSON. Historical records with no analysis metadata display **Unknown**; version labels and provenance are not invented retrospectively. Revision 1's existing completed upload results remain saveable. They are not seeded into the new reusable cache because their analysis versions/settings cannot be established.

## What the source investigation found

| Field | Before Revision 2 | Revision 2 generation, persistence and display |
| --- | --- | --- |
| Transcript and translation | Multimodal Gemini generation; no independent reference transcript | Still AI generated. Required string fields are checked before completion. Original text is retained in immutable run payloads and saved JSON; Compare Runs shows both transcripts. There is no claim of verified transcription accuracy. |
| Clarity | Gemini emitted the overall score and its components; the application did not implement the suggested weights | Node calculates the final score from validated components using the formula below. The old AI overall score, if supplied, is retained only as `ai_overall_score`. UI uses the server score and shows unavailable components explicitly. |
| Pace | Two independently estimated fields, `speech_clarity.speech_pace_wpm` and `audio_analysis.estimated_speaking_rate_wpm`, could disagree | Both are assigned one transcript-derived value: word count / full measured audio duration × 60. Speaker labels and bracketed non-spoken text are excluded. This is not independently measured speech-only articulation rate; transcript errors and music/pauses affect it. |
| Audio measurements | Pitch, energy, tempo, silence and spectral features were all requested as AI estimates | Duration, RMS energy in dBFS, frame-energy variation, silence ratio, zero crossings and spectral centroid are measured from decoded mono 16 kHz PCM where possible. Pitch and tempo remain explicitly labeled AI estimates. Missing/unmeasurable features are null, not synthetic zeroes. |
| Tone | Gemini inferred a qualitative tone | Remains an AI estimate with source metadata. Missing/no-audio tone is unavailable. |
| Emotion | Gemini supplied a probability distribution and dominant label; missing percentages appeared as 0% | Remains an AI estimate. Values must be finite within [0,1], with a total within 0.02 of 1. Invalid or unmeasurable distributions become unavailable rather than zeros. No local MFCC classifier is claimed by the UI. |
| Guidelines | Separate review, preserved findings and server-side acknowledgement from Revision 1 | Every new upload still receives its own review before result reuse. Findings and acknowledgement are attached from that upload's review, not the source of a reused payload. Provider safety failures still block processing. |
| Saving and reopening | Server-validated upload's latest result JSON was copied into `saved_videos` | Saves can name `run_id` to select a particular completed owned run. Each run is retained separately; saved JSON includes identity, origin, versions and its own review/acknowledgement. Run selection cannot import another user's result or another upload's acknowledgement. |

Likely sources of fresh-run variation: stochastic/provider inference despite identical requests; model alias/backend changes; transcript wording and segmentation affecting derived pace and filler frequency; subjective tone/stability/quality/emotion estimates; separately generated guideline judgments; formerly implicit generation settings and an original-file fallback when FFmpeg failed. Historical zero defaults also made unavailable values appear to be measured numbers. These are source-based hypotheses; no five-run measurements were made.

## Identity, scope, reuse and fresh runs

- The upload's SHA-256 is streamed from **file contents**, independent of its filename. A renamed byte-identical file shares the hash; different bytes with the same name do not. Re-encoded visually identical videos may have different hashes.
- Identity includes file hash; normalized ordered comments; model; identity, prompt, guideline, preprocessing and scoring versions; analysis and guideline generation settings; an implementation digest; and detected Python, NumPy, google-genai, ffmpeg-python and FFmpeg runtime versions. Comments use Unicode NFC, collapsed whitespace, trimmed empty entries and text/comment/body object extraction; order and duplicates are preserved. Metadata records a normalized-comments digest and count.
- `analysis-config.json` is the version manifest. Restart the backend after source, manifest, model or dependency changes; do not edit processing code during active jobs. The implementation digest also invalidates reuse when relevant source changes without a manual version bump. Runtime detection failure introduces a process-specific scope so unknown runtimes do not reuse results across restarts. Runtime metadata describes the executing server; no environment secrets are recorded.
- The configured model identifier may be an alias. A remote provider can change its backing implementation without a local file change. The observed `provider_model_version` is retained when returned, but cache hits cannot discover an unseen remote update. Use a supported pinned model release or bump the manifest when changing/refreshing the provider configuration.
- Default generation is explicit: temperature 0, top_p 1, one candidate, JSON response. The API accepts temperature in [0,2] and top_p in (0,1]; unsupported overrides are rejected. These fields are present in the installed google-genai SDK's `GenerateContentConfig`; actual provider/model acceptance has not been tested. No unsupported seed or safety bypass is sent. Low-temperature generation does **not** guarantee deterministic responses.
- Preprocessing uses fixed libx264/medium/CRF18/yuv420p, even dimensions, AAC 128k/stereo/48 kHz, one encoder thread and stripped input metadata. Failure is retryable; the worker no longer silently analyzes an original-file fallback. Measurement uses mono PCM at 16 kHz with 400-sample (25 ms) frames and a −40 dBFS silence threshold. All-silent energy/pitch/tempo/clarity and spectral measurements without usable energy remain unavailable where undefined; a measured silence ratio of 1 or measured zero crossings of 0 remains a legitimate number.
- Only completed, structurally valid runs in the **same authenticated user scope** are eligible for reuse. Failed and pending runs are never candidates. Reuse creates a distinct run record labeled `reused`, with `source_run_id`; it does not overwrite a fresh result or copy source moderation/acknowledgement. Each new upload's guideline review happens first, including a new acknowledgement when that review flags it.
- **Re-analyze** requests a fresh effectiveness/audio run and stores it separately. For the same existing upload, it retains that upload's original review and acknowledgement. To measure guideline repeatability too, upload the same bytes again so each upload has its own review.
- A database lease serializes work for `(user_id, full_identity_hash)` across uploads and server processes. Concurrent attempts receive `PROCESSING_BUSY`; they can retry and reuse the completed payload. Fresh requests require a stable unique `requestId` for idempotency. Replaying a completed request returns that request's run, including for `forceFresh`; a genuinely new fresh run needs a new request ID. An identity lease lasts 15 minutes, longer than the 10-minute worker timeout. Interrupted/failed run records cannot be reused as completed; retry failed requests with a new ID.
- Existing upload reviews retain their original guideline version (unknown for historical records). New uploads use the current guideline version. Reusing an existing upload's review does not replace its findings with another upload's findings. Re-upload if a fresh review under changed guideline settings is required.

## Clarity formula (`clarity-components-v2`)

Let `W` be the transcript word count and `D` the measured full audio duration in seconds. Require measurable non-silent audio, `W > 0`, `D > 0`; set pace `P = round(60W/D, 1)`. Pace score is `100P/120` below 120 WPM, 100 from 120 through 180, and `100 − 100(P−180)/180` above 180, clamped to [0,100].

Require an integer AI estimated filler count `F` between 0 and `W`. Filler score is `clamp(100 − 10 × (100F/W), 0, 100)`. Require finite AI estimated tone stability `T` and audio quality `Q` in [0,100]. Final clarity is `round((pace_score + filler_score + T + Q)/4)`. Missing or invalid components yield a null overall score, rather than silently renormalizing weights or substituting zero. Component values, sources and scoring version remain in JSON for audit.

This formula is a documented heuristic, not a validated clinical, linguistic or acoustic accuracy metric. Repeatable computation over AI estimated components does not make those components ground truth.

## API and UI workflow

- Upload and process as in Revision 1. `POST /process-video` accepts `videoPath`, `comments`, optional `settings`, `requestId`, and `forceFresh`. SSE accepts the same serialized fields. Default `forceFresh` is false. A fresh request requires a unique alphanumeric/underscore/hyphen request ID of 16–100 characters (UUID is suitable).
- Flagged initial review returns its review reference and pauses. Proceed uses the server-recorded pending comments/settings/fresh intent; a conflicting request reference is rejected. Send `action: "proceed"` with the returned `reviewId`. Cancel remains a server-side terminal cancellation for that upload review.
- Completed output contains `run_id`, `analysis_metadata`, original guideline findings, acknowledgement and analysis status. The client **Re-analyze** button creates a fresh request and retains older results. A previous-run selector loads completed runs for the current upload; the export button downloads the selected analysis JSON. Save sends its `run_id`, so selecting an earlier run saves that run rather than the upload's latest pointer.
- `GET /analysis-runs?videoPath=...` returns up to 50 completed owned runs for that upload. Saved Videos show source provenance; reopening reads all metadata from saved JSON. Compare Runs compares saved snapshots, identifies known identical content, labels fresh/reused/unknown origins, shows version/settings differences and accurate numeric B−A differences. Same-video variation is never labeled video improvement. Missing historical metadata remains Unknown; filenames are not used to infer identical contents.

## Reproducible baseline procedure for the user (not executed)

1. Before changing processing versions again, preserve a reference video, its exact bytes/hash, the exact ordered comments JSON, and the manifest/runtime metadata. Keep them unchanged for all runs. Store the current implementation if a pre-Revision-2 versus post-Revision-2 comparison is needed; this change cannot reconstruct the old baseline retrospectively.
2. Make five sequential **fresh, uncached** requests under one user. For effectiveness/audio repeatability alone, use Re-analyze five times on the same upload. To include guideline variability, upload the identical bytes five times and use a new UUID `requestId` plus `forceFresh: true` for each first processing request. Complete each independent flagged-review acknowledgement when required. Respect provider safety limitations; record refused/failed attempts as failures instead of replacing them with invented measurements.
3. Export each complete result JSON. Confirm every measured run has `execution_kind: "fresh"`, a distinct `run_id`, the same file hash, normalized-comments digest, model, full identity and settings. Fresh runs should have no `source_run_id`. A failed attempt is not one of five completed results; report both the number attempted and completed.
4. Record per-run original and translated transcript; transcript word count; duration; all measured audio features; clarity component values and overall score; pace; inferred tone; all emotion probabilities and dominant label; review state, categories and each specific evidence statement; observed provider model version and runtime metadata. For numbers report range and standard deviation over available values, plus a missing-value count. For transcript and qualitative fields report exact matches, differing strings/categories, and manually inspect evidence. Compare Runs helps inspect saved pairs; retain the exported JSON for the full five-run report.
5. Separately perform default non-fresh requests with the same complete identity. Verify `execution_kind: "reused"`, a new run record pointing at a source run, and identical **core** analysis values. Guideline findings, acknowledgement times, request/run IDs and reuse metadata belong to individual requests/reviews and should not be required to match. Report cache hit rate/core equality separately from fresh-run variation.
6. Evaluate accuracy only using manually reviewed reference transcripts, acoustic/reference labels and guideline evidence. Lower variance or identical cached outputs alone does not demonstrate improved accuracy.

## Manual validation scenarios (not executed)

| Scenario | Expected behavior to verify |
| --- | --- |
| Rename an identical upload | Same content hash/identity with unchanged inputs; review remains independent; core result may reuse within the same user. |
| Different bytes, identical filename | Different hashes and no reuse based on name. |
| Whitespace-equivalent comments versus changed text/order | Equivalent normalization reuses; changed normalized content/order changes identity. |
| Change temperature/top_p or a processing version/runtime | Full identity changes; old outputs remain intact; invalid settings are rejected. Restart after deployment changes. |
| Explicit Re-analyze and duplicate request | New request ID creates a fresh immutable run; replaying the same ID returns that run; concurrent work is busy rather than duplicated. |
| Two uploads/servers concurrently processing one identity | One effectiveness worker at a time for that user/identity; retry after completion reuses unless explicitly fresh. Independent upload reviews still run. |
| Another user/request/file/reference | No cross-user cache or run access; a run cannot be saved under another upload; frontend acknowledgement flags are ignored. |
| Flagged review followed by potential cache hit | Findings/dialog/acknowledgement still required before effectiveness result reuse; source acknowledgement never substitutes. |
| Review failure or provider refusal | Retryable review error or understandable provider limitation; no successful cache record created. |
| Missing audio, silence, invalid AI component or malformed result | Undefined values display Unavailable; incomplete results cannot be marked completed; valid real zeros remain numbers. |
| Interrupted/failed run | Not cacheable; lease expiry allows recovery; a new request ID retries a failed run. |
| Save earlier run after Re-analyze | Selected run's scores, findings, provenance and acknowledgement survive save/reopen; earlier completed run is not overwritten. |
| Historical record | Still readable; missing identities, versions/settings and origins display Unknown; same-video identity is not guessed from a filename. |

No measured result, reduced fresh-run variance, improved accuracy, or migration success is asserted for this delivery.
