# Guideline confirmation for each new attempt

Apply `003_review_acknowledgements.sql` once after migrations 001 and 002, in the configured application database, then restart the backend and update the frontend. Existing reviews, saved videos and completed analysis runs are not rewritten.

Every new flagged Analyze/Retry/Re-analyze request must now receive an explicit Proceed confirmation before analysis or result reuse. The upload's earlier acknowledgement no longer authorizes a different request. A matching completed result still supplies identical core output after confirmation, and the existing three-second loading presentation remains in effect.

The server stores each confirmation in `video_review_acknowledgements`, bound to the authenticated user, exact upload review reference, request key and full analysis identity. It accepts no frontend acknowledgement/bypass boolean. The pending options and request reference must match the review presented for confirmation. Confirming a request records server time. Duplicate transport retries of the same already-confirmed request remain idempotent; a genuinely new attempt requires a new confirmation.

The original earliest upload-level acknowledgement is retained for historical records. New runs' precise request-specific acknowledgement times are recovered by joining their request key and analysis identity to the confirmation table during saving/history loading. No source result's acknowledgement is copied into a new request. Cancel stops that pending attempt before any analysis/cache delivery; the uploaded video and older completed runs remain available for a later independently confirmed attempt.

This supersedes earlier notes saying the same upload would not ask for confirmation again on a new retry. Internal resumption of the same confirmed request still retains its acknowledgement. Unflagged content requires no guideline confirmation. Provider restrictions remain respected.

No tests, builds, migrations or live provider calls were executed, per the user's instruction.
