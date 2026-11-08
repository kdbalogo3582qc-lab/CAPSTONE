# Repeated upload with a successful matching analysis

Default Analyze/Retry now checks for a successful completed run before requesting another provider review for a newly uploaded file. Matching requires the same authenticated user, SHA-256 file contents, normalized comments, analysis/guideline settings, current versions, implementation digest and runtime identity. Renaming a byte-identical upload does not prevent a match.

The matching source run and its original review are validated through the existing completed-run access checks. If valid, the original guideline findings are recorded against the new upload's own review reference. Source acknowledgement is not copied. A flagged new upload still requires its own Proceed acknowledgement; only then does the existing completed-result cache supply the core analysis without a new provider call. A passed matching review can continue directly to the same completed core result.

Re-analyze still explicitly requests fresh analysis. Without a successful full match, the usual provider review/analysis path remains necessary, and real provider restrictions can still prevent completion. Failed or incomplete attempts are never used as successful results. Existing valid reviews on a retry retain their acknowledgement.

This fixes the previous ordering gap where a fresh provider review could fail before the application checked for a successful matching result. No analysis version, scoring formula, generation setting, database schema or existing saved result was changed by this orchestration fix. It does not invalidate the implementation digest used by the current analysis pipeline.

No tests, builds or live provider calls were run, following the user's instruction. Restart the backend; no SQL migration is needed.

## Processing display for repeated videos

Analyze/Retry keeps a visible processing timeline even when an earlier result is already on screen or a matching completed result is returned quickly. It reports actual upload/file verification, settings checks, guideline handling, result selection and recording of the new run. The completed timeline remains visible with the results. No artificial delays or pretend AI analysis stages are added. When a completed match is used, the success message explicitly states that its existing results were retained. Re-analyze remains the separate fresh AI request, whose output can vary. These display/orchestration changes do not change the analysis pipeline identity or invalidate existing successful matches.

The client now applies a three-second minimum loading presentation before revealing a successful result. If guideline confirmation is required, the minimum restarts when Proceed is selected. Actual work that already takes at least three seconds incurs no additional wait. Fast completed-result reuse displays “Preparing results…” for the remaining presentation time. This is a UI timing choice only, not additional model analysis, and does not alter results, provider behavior, cancellation or failure handling.
