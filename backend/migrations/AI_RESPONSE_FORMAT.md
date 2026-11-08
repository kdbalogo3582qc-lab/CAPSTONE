# AI response parsing and session startup fix

The reported `Invalid control character` error originates from decoding the provider's generated JSON, not from a missing guideline acknowledgement. A raw newline, carriage return or tab inside a quoted JSON string is invalid JSON even when the surrounding analysis fields are present.

The parser now first attempts normal strict decoding. Only an invalid-control-character error enables a narrow lexical repair: escape raw LF/CR/tab characters inside quoted strings without changing their text meaning. It then strictly decodes the repaired object. It does not invent fields, append missing quotes/braces, strip unknown characters, guess escape sequences, or issue another model call. Duplicate keys, nonfinite constants, multiple objects/trailing content and other invalid syntax are rejected. Existing schema/completion validation still applies after decoding. Truncated (`MAX_TOKENS`) responses are rejected as incomplete.

Unrecoverable provider formatting errors return the retryable `INVALID_MODEL_RESPONSE` code with a readable message, rather than exposing Python line/column exceptions in the dialog. The upload and any recorded guideline acknowledgement remain in place. The client clears the terminal failed request reference so the next manual attempt creates a new run instead of repeatedly replaying the failed request. No failed response is treated as a completed cached analysis. New analysis instructions explicitly require escaped string whitespace and one complete JSON object; the prompt version is `effectiveness-v3`.

The SSE client now has one error handler, avoiding an additional misleading “connection lost” handler after a structured provider error. Full guideline/error payloads are no longer printed to the browser console.

Session initialization now registers the response/refresh interceptor before requesting `/user/me`. Concurrent 401 recovery shares one refresh request; the bootstrap request is cancelled on effect cleanup. A real missing/revoked session still requires login. Browser developer tools may still show the original 401 response during a valid refresh sequence or before login; status codes are not hidden or converted to success.

A real provider content restriction remains a separate `PROVIDER_LIMITATION`. This change does not change safety thresholds or make acknowledgement override a provider refusal.

Restart the backend and update the frontend. No new SQL migration is needed. No tests, builds, migration execution, or live provider calls were run, following the user's instruction.
