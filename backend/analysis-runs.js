import { randomUUID } from 'crypto';
import { analysisIdentity, finalizeAnalysis } from './analysis-identity.js';
const decode = value => typeof value === 'string' ? JSON.parse(value) : value;
const error = (message, code = 'PROCESSING_BUSY', status = 409) => Object.assign(new Error(message), { code, status });
const hasKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && keys.every(key => Object.hasOwn(value, key));
const complete = result => Boolean(result && typeof result.transcript === 'string' && typeof result.translated_transcript === 'string' &&
    typeof result.summary?.summary?.content === 'string' && result.summary.summary.content.trim() &&
    hasKeys(result.audio_analysis, ['inferred_tone']) &&
    hasKeys(result.speech_clarity, ['filler_words', 'tone_stability', 'audio_quality']) &&
    hasKeys(result.emotion_analysis, ['happy', 'neutral', 'nervous', 'angry', 'sad', 'dominant_emotion']));

export function createAnalysisRuns({ query, run }) {
    function envelope(record, reviewRow) {
        const review = decode(reviewRow.review_json);
        if (!['passed', 'flagged'].includes(review?.state) || (review.state === 'flagged' && !reviewRow.acknowledged_at))
            throw error('Acknowledge the current guideline findings before continuing.', 'ACKNOWLEDGEMENT_REQUIRED', 422);
        const result = decode(record.result_json);
        if (record.status !== 'completed' || !complete(result)) throw error('This run has no completed result.', 'RUN_INCOMPLETE', 422);
        return { ...result, run_id: record.id, review_id: reviewRow.id, community_standards: review,
            guideline_acknowledged_at: reviewRow.acknowledged_at,
            analysis_status: review.state === 'flagged' ? 'completed_flagged' : 'completed',
            analysis_metadata: { ...decode(record.metadata_json), run_id: record.id, identity_hash: record.identity_hash,
                file_hash: record.file_hash, execution_kind: record.execution_kind, source_run_id: record.source_run_id,
                completed_at: record.completed_at } };
    }
    async function get(user, reviewRow, id) {
        if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw error('Invalid analysis run reference.', 'INVALID_RUN', 400);
        const rows = await query('SELECT * FROM analysis_runs WHERE id=? AND user_id=? AND review_id=?', [id, user, reviewRow.id]);
        if (!rows[0]) throw error('Invalid analysis run reference.', 'INVALID_RUN', 404);
        return envelope(rows[0], reviewRow);
    }
    async function execute(user, reviewRow, options, progress = () => {}) {
        const identity = analysisIdentity(reviewRow.file_hash, options, reviewRow.guideline_version, decode(reviewRow.review_json)?.review_metadata);
        const requestKey = options.requestId || randomUUID();
        const findRequest = () => query('SELECT * FROM analysis_runs WHERE user_id=? AND request_key=?', [user, requestKey]);
        const existing = (await findRequest())[0];
        if (existing) {
            if (existing.review_id !== reviewRow.id || existing.identity_hash !== identity.hash || decode(existing.metadata_json).requested_fresh !== options.forceFresh)
                throw error('This request reference belongs to different analysis inputs. Start a new request.', 'INVALID_RUN', 400);
            if (existing.status === 'completed') return envelope(existing, reviewRow);
            if (existing.status === 'failed') {
                if (existing.error_code === 'PROVIDER_LIMITATION') throw error('The AI provider declined this analysis run. The recorded guideline acknowledgement is retained.', 'PROVIDER_LIMITATION', 422);
                throw error('This run failed. Retry with a new requestId.', 'RUN_FAILED_RETRY');
            }
        }
        await query('INSERT IGNORE INTO analysis_identity_locks (user_id,identity_hash) VALUES (?,?)', [user, identity.hash]);
        const lease = randomUUID();
        const lock = await query(`UPDATE analysis_identity_locks SET lease_token=?, lease_until=DATE_ADD(NOW(), INTERVAL 15 MINUTE)
            WHERE user_id=? AND identity_hash=? AND (lease_token IS NULL OR lease_until < NOW())`, [lease, user, identity.hash]);
        if (!lock.affectedRows) throw error('An analysis of this exact video and settings is running. Please retry after it finishes.');
        let id;
        try {
            // A pending record with an expired lease is a failed interrupted run, never cacheable.
            if (existing) {
                await query("UPDATE analysis_runs SET status='failed', error_code='WORKER_INTERRUPTED' WHERE id=? AND status='pending'", [existing.id]);
                throw error('The previous run was interrupted. Retry with a new requestId.', 'RUN_FAILED_RETRY');
            }
            let source;
            if (!options.forceFresh) {
                const cached = await query("SELECT * FROM analysis_runs WHERE user_id=? AND identity_hash=? AND status='completed' ORDER BY completed_at DESC, id DESC LIMIT 1", [user, identity.hash]);
                if (cached[0] && complete(decode(cached[0].result_json))) source = cached[0];
            }
            id = randomUUID();
            const metadata = { ...identity.metadata, requested_fresh: options.forceFresh,
                generated_at: source ? decode(source.metadata_json).generated_at : new Date().toISOString() };
            const record = { id, user_id: user, review_id: reviewRow.id, identity_hash: identity.hash, file_hash: reviewRow.file_hash,
                execution_kind: source ? 'reused' : 'fresh', source_run_id: source ? source.source_run_id || source.id : null,
                metadata_json: JSON.stringify(metadata) };
            await query(`INSERT INTO analysis_runs (id,user_id,review_id,request_key,identity_hash,file_hash,execution_kind,source_run_id,metadata_json)
                VALUES (?,?,?,?,?,?,?,?,?)`, [id, user, reviewRow.id, requestKey, identity.hash, reviewRow.file_hash,
                record.execution_kind, record.source_run_id, record.metadata_json]);
            let result;
            if (source) {
                progress('Reusing a completed result with identical content, comments, versions and settings');
                result = decode(source.result_json);
            } else {
                progress('Running fresh effectiveness and audio analysis');
                result = await run(reviewRow.absolutePath, { mode: 'analyze', review: decode(reviewRow.review_json),
                    comments: options.comments, generation_settings: options.settings }, progress);
                if (!complete(result)) throw error('Analysis response was incomplete. Please retry.', 'PROCESSING_ERROR', 502);
                result = finalizeAnalysis(result);
                // Moderation and acknowledgement belong to the upload's review, not the reusable payload.
                for (const key of ['community_standards', 'review_id', 'guideline_acknowledged_at', 'analysis_status', 'analysis_metadata', 'run_id']) delete result[key];
            }
            record.status = 'completed'; record.result_json = JSON.stringify(result); record.completed_at = new Date().toISOString();
            await query("UPDATE analysis_runs SET status='completed', result_json=?, completed_at=NOW() WHERE id=? AND status='pending'", [record.result_json, id]);
            return envelope(record, reviewRow);
        } catch (e) {
            if (id) await query("UPDATE analysis_runs SET status='failed', error_code=? WHERE id=? AND status='pending'", [e.code || 'PROCESSING_ERROR', id]);
            throw e;
        } finally {
            await query('UPDATE analysis_identity_locks SET lease_token=NULL, lease_until=NULL WHERE user_id=? AND identity_hash=? AND lease_token=?', [user, identity.hash, lease]);
        }
    }
    return { execute, get };
}
