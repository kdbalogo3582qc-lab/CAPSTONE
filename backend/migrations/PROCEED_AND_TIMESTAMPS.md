# Proceed acknowledgement and guideline timestamps

The application acknowledgement and the provider's processing decision are separate. Proceed records the acknowledgement before requesting effectiveness/audio analysis. A provider restriction can still stop that request; the application cannot promise successful analysis or override that restriction.

The error response now includes the original review, acknowledgement time, review reference and `analysis_status: provider_limited` when this happens after acknowledgement. The upload review retains a `provider_limited` phase. The UI keeps the findings visible, states that acknowledgement was saved, and labels the stop as a provider limitation. It no longer displays “Processing complete” after errors or cancellation. Retrying the same upload retains the acknowledgement. Terminal failed client requests receive a new request reference on a subsequent attempt, while network/busy retries retain idempotency protection. Replaying an already failed provider-limited run reports the same limitation rather than disguising it as a missing acknowledgement.

Provider finish reasons and block reasons are inspected explicitly. An unspecified/zero block reason is not treated as a refusal. Provider blocks are still respected, and no safety thresholds or fallback providers were added.

Timestamps represent elapsed playback positions, not the time of day. New review instructions require absolute positions from the first frame of the complete upload, with no default `00:00`. Supplied positions are parsed, canonicalized and checked against the probed video duration when available. Invalid or absent positions remain unavailable. The UI labels AI review timestamps approximate; a valid zero position reads “Approx. start of video (00:00)”. Old saved findings are retained and are not silently rewritten with guessed positions.

The guideline version is now `community-guidelines-v2` for newly generated reviews. Existing reviews retain their findings and version; re-upload for a new review under the updated timestamp instructions. Relevant implementation changes also invalidate effectiveness cache reuse through its source digest.

No SQL migration is needed for these changes: the existing phase column accepts the provider-limited state, and review JSON carries timestamp metadata. Restart the backend and update the client. No tests, builds or live provider calls were run, as requested by the user.
