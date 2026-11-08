import { createAnalysisRuns } from './analysis-runs.js';
import { normalizeOptions, analysisConfig, analysisIdentity } from './analysis-identity.js';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';

export const fingerprint = async (file) => {
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of createReadStream(file)) { hash.update(chunk); size += chunk.length; }
    return { hash: hash.digest('hex'), size };
};
const decode = value => typeof value === 'string' ? JSON.parse(value) : value;
export function flowError(message, status = 409, code = 'INVALID_REVIEW') {
    return Object.assign(new Error(message), { status, code });
}
export function createReviewFlow({ query, run, identify = fingerprint }) {
    const analyses = createAnalysisRuns({ query, run });
    async function reusableReview(user, row, options) {
        if (options.forceFresh) return null;
        const identity = analysisIdentity(row.file_hash, options, analysisConfig.guideline_version, {
            model: analysisConfig.model, generation_settings: analysisConfig.generation_settings,
            preprocessing_version: analysisConfig.preprocessing_version,
        });
        const candidates = await query(`SELECT r.*, a.id AS source_run_id
            FROM analysis_runs a JOIN video_reviews r ON r.id=a.review_id AND r.user_id=a.user_id
            WHERE a.user_id=? AND a.file_hash=? AND a.identity_hash=? AND a.status='completed'
                AND r.file_hash=? AND r.guideline_version=?
            ORDER BY a.completed_at DESC, a.id DESC LIMIT 5`,
            [user, row.file_hash, identity.hash, row.file_hash, analysisConfig.guideline_version]);
        for (const candidate of candidates) {
            try {
                // Reuse only a structurally valid completed result whose source review was satisfied.
                // This validates ownership and acknowledgement without copying acknowledgement.
                const verified = await analyses.get(user, candidate, candidate.source_run_id);
                return {
                    ...verified.community_standards,
                    review_reuse: { source_review_id: candidate.id, source_run_id: verified.run_id },
                };
            } catch (err) {
                if (!(err instanceof SyntaxError) && !['INVALID_RUN', 'RUN_INCOMPLETE', 'ACKNOWLEDGEMENT_REQUIRED'].includes(err.code)) throw err;
            }
        }
        return null;
    }
    async function requestAcknowledgement(user, row, requestId, identityHash) {
        const records = await query(`SELECT identity_hash, acknowledged_at FROM video_review_acknowledgements
            WHERE user_id=? AND review_id=? AND request_key=?`, [user, row.id, requestId]);
        if (records[0] && records[0].identity_hash !== identityHash)
            throw flowError('This confirmation belongs to different analysis inputs. Start a new request.', 409, 'INVALID_REVIEW');
        return records[0]?.acknowledged_at || null;
    }
    async function withRunAcknowledgement(user, row, result) {
        if (!result?.run_id || result.community_standards?.state !== 'flagged') return result;
        const records = await query(`SELECT a.acknowledged_at FROM analysis_runs r
            JOIN video_review_acknowledgements a ON a.user_id=r.user_id AND a.review_id=r.review_id
                AND a.request_key=r.request_key AND a.identity_hash=r.identity_hash
            WHERE r.id=? AND r.user_id=? AND r.review_id=?`, [result.run_id, user, row.id]);
        // Historical completed runs retain the original review acknowledgement.
        return records[0] ? { ...result, guideline_acknowledged_at: records[0].acknowledged_at } : result;
    }
    async function register(user, file) {
        const { hash, size } = await identify(file.absolutePath);
        const id = randomUUID();
        await query(`INSERT INTO video_reviews (id,user_id,video_path,file_hash,file_size,guideline_version,expires_at)
            VALUES (?,?,?,?,?,?,DATE_ADD(NOW(), INTERVAL 24 HOUR))`, [id, user, file.key, hash, size, analysisConfig.guideline_version]);
        return id;
    }
    async function load(user, file, id, allowExpired = false) {
        const rows = await query('SELECT * FROM video_reviews WHERE user_id=? AND video_path=?', [user, file.key]);
        const row = rows[0];
        if (!row || (id && row.id !== id)) throw flowError('Invalid review reference. Upload the video again.', 404);
        if (!allowExpired && row.phase !== 'completed' && new Date(row.expires_at).getTime() <= Date.now())
            throw flowError('This review has expired. Upload the video again.', 410, 'REVIEW_EXPIRED');
        let actual;
        try { actual = await identify(file.absolutePath); }
        catch { throw flowError('The uploaded file is no longer available. Upload it again.', 410); }
        if (actual.hash !== row.file_hash) throw flowError('The uploaded file has changed. Upload it again.');
        return row;
    }
    async function process(user, file, input = {}, progress = () => {}) {
        const { reviewId, action = 'review' } = input;
        if (!['review', 'proceed', 'cancel'].includes(action)) throw flowError('Invalid review action.', 400);
        if (action !== 'review' && !reviewId) throw flowError('A valid review reference is required.', 400);
        progress('Checking the uploaded video and its file contents.');
        const row = await load(user, file, reviewId);
        progress('Uploaded video verified.');
        if (row.phase === 'cancelled' && action === 'cancel') return { analysis_status: 'cancelled', review_id: row.id };
        if (row.phase === 'cancelled') throw flowError('Processing was cancelled. Upload again to start a new review.');
        // Completed uploads can create additional immutable analysis runs.
        const pending = decode(row.pending_options_json);
        let options = ['proceed', 'cancel'].includes(action) && pending
            ? { ...pending } : normalizeOptions(input);
        if (!options.requestId) options.requestId = randomUUID();
        if (action === 'proceed' && !pending?.requestId)
            throw flowError('Open the guideline review before confirming this attempt.', 409, 'INVALID_REVIEW');
        if (pending?.cancelled && pending.requestId === options.requestId && action !== 'cancel')
            throw flowError('This processing attempt was cancelled. Start a new request.', 409, 'PROCESSING_CANCELLED');
        progress('Comments and analysis settings checked.');
        if (['proceed', 'cancel'].includes(action) && input.requestId && options.requestId && input.requestId !== options.requestId)
            throw flowError('The pending review options changed in another request. Refresh the review before proceeding.', 409, 'REVIEW_OPTIONS_CHANGED');
        if (action === 'cancel') {
            if (row.phase === 'review_ready' && pending?.cancelled) return { analysis_status: 'cancelled', review_id: row.id };
            const changed = await query("UPDATE video_reviews SET phase='review_ready', pending_options_json=? WHERE id=? AND phase='awaiting'",
                [JSON.stringify({ ...options, cancelled: true }), row.id]);
            if (!changed.affectedRows) throw flowError('This attempt is already running or is no longer awaiting confirmation.', 409, 'PROCESSING_BUSY');
            return { analysis_status: 'cancelled', review_id: row.id };
        }
        // A bounded worker timeout makes an abandoned lease retryable after 15 minutes.
        if (['reviewing', 'analyzing'].includes(row.phase) && Date.now() - new Date(row.updated_at).getTime() < 15 * 60 * 1000)
            throw flowError('Processing is already running. Please wait.', 409, 'PROCESSING_BUSY');
        progress('Checking the community guideline review.');
        let review = decode(row.review_json);
        if (action === 'proceed' && review?.state !== 'flagged') throw flowError('This review cannot be acknowledged.');
        if (!review || review.state === 'review_failed') {
            const lock = await query("UPDATE video_reviews SET phase='reviewing', updated_at=NOW() WHERE id=? AND phase=? AND (phase NOT IN ('reviewing','analyzing') OR updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))", [row.id, row.phase]);
            if (!lock.affectedRows) throw flowError('Processing is already running.', 409, 'PROCESSING_BUSY');
            try {
                review = await reusableReview(user, row, options);
                if (review) {
                    progress('Using recorded guideline findings for this identical video and analysis setup.');
                } else {
                    progress('Reviewing community guidelines');
                    const result = await run(file.absolutePath, { mode: 'review' }, progress);
                    review = result.community_standards;
                }
                if (!['passed', 'flagged'].includes(review?.state) ||
                    (review.state === 'flagged' && (!review.violation_details?.length || review.violation_details.some(d => !d.category || !d.reason))))
                    throw flowError('The guideline review was incomplete. Please retry.', 502, 'REVIEW_FAILED');
                review.review_metadata = { guideline_version: analysisConfig.guideline_version, model: analysisConfig.model,
                    generation_settings: analysisConfig.generation_settings, preprocessing_version: analysisConfig.preprocessing_version };
                await query('UPDATE video_reviews SET review_json=?, phase=?, guideline_version=?, acknowledged_at=NULL WHERE id=?', [JSON.stringify(review), 'awaiting', analysisConfig.guideline_version, row.id]);
                row.guideline_version = analysisConfig.guideline_version;
                row.acknowledged_at = null;
                row.phase = 'awaiting';
            } catch (e) {
                await query("UPDATE video_reviews SET phase='review_failed', review_json=? WHERE id=?", [JSON.stringify({ state: 'review_failed', violations: [], violation_details: [] }), row.id]);
                if (e.code !== 'PROVIDER_LIMITATION') {
                    e.message = `Community guideline review could not be completed. ${e.message} Please retry.`;
                    e.code = 'REVIEW_FAILED'; e.status = 502;
                }
                throw Object.assign(e, { review_state: 'review_failed' });
            }
        }
        progress('Guideline findings checked.');
        const identityHash = analysisIdentity(row.file_hash, options, row.guideline_version, review.review_metadata).hash;
        let ack = review.state === 'flagged' ? await requestAcknowledgement(user, row, options.requestId, identityHash) : null;
        if (review.state === 'flagged' && !ack && action !== 'proceed') {
            const waiting = await query(`UPDATE video_reviews SET pending_options_json=?, phase='awaiting',
                expires_at=DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id=? AND phase=?`, [JSON.stringify(options), row.id, row.phase]);
            if (!waiting.affectedRows) throw flowError('The processing state changed. Please retry.', 409, 'PROCESSING_BUSY');
            return { review_id: row.id, request_id: options.requestId, community_standards: review, analysis_status: 'awaiting_acknowledgement' };
        }
        const lock = await query("UPDATE video_reviews SET phase='analyzing', updated_at=NOW() WHERE id=? AND phase=? AND (phase NOT IN ('reviewing','analyzing') OR updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))", [row.id, row.phase]);
        if (!lock.affectedRows) throw flowError('Processing is already running.', 409, 'PROCESSING_BUSY');
        try {
            if (review.state === 'flagged' && !ack) {
                if (action !== 'proceed') throw flowError('Confirm the guideline findings for this attempt first.', 422, 'ACKNOWLEDGEMENT_REQUIRED');
                await query(`INSERT IGNORE INTO video_review_acknowledgements
                    (user_id,review_id,request_key,identity_hash,acknowledged_at) VALUES (?,?,?,?,?)`,
                    [user, row.id, options.requestId, identityHash, new Date().toISOString()]);
                ack = await requestAcknowledgement(user, row, options.requestId, identityHash);
                if (!ack) throw flowError('Could not record this confirmation. Please retry.', 500, 'PROCESSING_ERROR');
            }
            // Keep the earliest review acknowledgement for historical saved records.
            await query('UPDATE video_reviews SET acknowledged_at=COALESCE(acknowledged_at, ?) WHERE id=?', [ack, row.id]);
            if (ack) progress('Guideline acknowledgement recorded. Continuing effectiveness and audio analysis.');
            row.review_json = JSON.stringify(review);
            row.acknowledged_at = ack;
            row.absolutePath = file.absolutePath;
            progress('Processing the analysis request.');
            const output = await analyses.execute(user, row, options, progress);
            if (output.analysis_metadata?.execution_kind === 'reused')
                progress('Matching completed analysis found. Transcript, scores and findings are retained.');
            progress('Preparing and recording the results for this request.');
            await query("UPDATE video_reviews SET phase='completed', result_json=? WHERE id=?", [JSON.stringify(output), row.id]);
            progress('Video processing complete. Results are ready.');
            return output;
        } catch (e) {
            const limited = e.code === 'PROVIDER_LIMITATION';
            await query('UPDATE video_reviews SET phase=? WHERE id=?', [limited ? 'provider_limited' : 'analysis_failed', row.id]);
            throw Object.assign(e, {
                analysis_status: limited ? 'provider_limited' : 'analysis_failed',
                community_standards: review, review_id: row.id, guideline_acknowledged_at: ack,
            });
        }
    }
    async function savedResult(user, file, runId) {
        const row = await load(user, file, undefined, Boolean(runId));
        const review = decode(row.review_json);
        if ((!runId && row.phase !== 'completed') || !['passed', 'flagged'].includes(review?.state) || (review.state === 'flagged' && !row.acknowledged_at))
            throw flowError('Complete the analysis and acknowledge any guideline flags before saving.', 422);
        const result = await withRunAcknowledgement(user, row, runId ? await analyses.get(user, row, runId) : decode(row.result_json));
        return { result, size: Number(row.file_size) };
    }
    async function listRuns(user, file) {
        const row = await load(user, file, undefined, true);
        const rows = await query("SELECT id FROM analysis_runs WHERE user_id=? AND review_id=? AND status='completed' ORDER BY created_at DESC, id DESC LIMIT 50", [user, row.id]);
        return Promise.all(rows.map(async record => withRunAcknowledgement(user, row, await analyses.get(user, row, record.id))));
    }
    return { register, process, savedResult, listRuns };
}
