# Revision 1 rollout

For the subsequent Revision 2 migration, behavior, source investigation and unexecuted validation procedure, see [REVISION_2.md](REVISION_2.md). The test results recorded below apply to the earlier Revision 1 implementation only.

1. Back up the configured application database.
2. In phpMyAdmin, select the database named by `DB_NAME` in `backend/.env` and import `001_guideline_review.sql` **once**, before starting the updated backend. Alternatively, from the repository root:
   ```sh
   mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/migrations/001_guideline_review.sql
   ```
3. Restart the backend and deploy/rebuild the client. Do not re-import `py_project.sql` into an existing installation.

The migration only creates `video_reviews`; it does not alter or rewrite existing saved records. New saves use the existing `saved_videos.analysis` JSON column to retain `community_standards`, `guideline_acknowledged_at`, `review_id`, and `analysis_status`. Old saved videos remain readable and receive no retroactive badge. Uploads created before rollout have no ownership/review record and must be uploaded once again before new processing or saving.

Uploads, processing (including SSE), acknowledgement, cancellation, and saving require the user's access-token cookie. SSE clients must enable credentials. Review records bind a random reference to the authenticated user, canonical uploaded path, SHA-256 hash, and actual size. Pending reviews expire after 24 hours. A completed result remains saveable after that deadline. Workers time out after 10 minutes; a process interrupted by a server restart can be retried after its 15-minute database lease expires. Duplicate active requests return `PROCESSING_BUSY`; completed retries return the stored result. Cancel is idempotent and terminal for that review; a new analysis after cancellation requires a new upload.

## API flow

- `POST /upload-video` (multipart `video`) registers ownership and returns `videoPath` and `reviewId`.
- `POST /process-video` with `{ "videoPath": "uploads/..." }`, or credentialed `GET /process-video-stream?videoPath=uploads/...`, reviews the upload. Passing content continues automatically. Flags return `analysis_status: "awaiting_acknowledgement"`, `review_id`, and the original specific findings (`review` SSE event). A failed review returns a processing error with `review_state: "review_failed"`, never a violation finding.
- `POST /process-video` with `{ "videoPath": "uploads/...", "reviewId": "returned reference", "action": "proceed" }` records acknowledgement server-side and runs effectiveness/audio analysis using the recorded review. `action: "cancel"` stops before analysis. GET cannot acknowledge or cancel. Both processing transports use the same service and resume stored acknowledged jobs; frontend bypass flags are ignored.
- `POST /save-video` with `video_path` saves the server's completed result, not client-provided analysis, findings, acknowledgement, status, summary, size, or derived metrics. A flagged result requires recorded acknowledgement. Reopening loads this complete JSON from the existing saved-video endpoint.
- Provider safety refusals return `PROVIDER_LIMITATION` with an explanation; acknowledging application guideline flags does not override provider restrictions.

## Validation

From the repository root:

```sh
node --test backend/tests/review-flow.test.js
python3 -m unittest discover -s backend/tests -p 'test_*.py'
```

From `client`:

```sh
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/components/user/Home.review.test.jsx src/components/user/GuidelineReview.test.jsx
npm run build
```

The Node service/transport tests use a persistent repository double and fake provider; Python tests exercise the production parser and multimodal function with fake responses; UI tests exercise proceed/cancel/retry, upload reuse, and saved findings/badges. These do not measure live model accuracy.

Optional real MySQL test (requires database create/drop privileges):

```sh
RUN_DB_TESTS=1 node --test backend/tests/review-mysql.test.js
```

It uses credentials from `backend/.env`, creates a unique temporary `capstone_revision1_test_...` database, applies the actual migration beside an existing legacy saved record, checks preservation, concurrency, acknowledgement, restart, save/reopen, cancellation, and expiry, then removes only that temporary database. Set `TEST_DB_SOCKET` when a Unix socket is required. It never migrates the configured production database.

Validation on this implementation: 8 Node service/transport tests, 9 Python tests, and 8 targeted React tests pass. The production client build passes with warnings in unchanged components. The full client test command also runs the unchanged `App.test.js`, which currently fails because the installed Jest resolver cannot resolve `react-router-dom`. The real MySQL test was attempted but the local XAMPP socket refused the connection; migration execution and live database save/reopen remain unverified. No live Gemini/video or manual browser verification was performed.
