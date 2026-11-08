import { createAnalysisRuns } from './analysis-runs.js';
import { normalizeOptions, analysisConfig } from './analysis-identity.js';
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
        const row = await load(user, file, reviewId);
        if (row.phase === 'cancelled' && action === 'cancel') return { analysis_status: 'cancelled', review_id: row.id };
        if (row.phase === 'cancelled') throw flowError('Processing was cancelled. Upload again to start a new review.');
        // Completed uploads can create additional immutable analysis runs.
        let options = action === 'proceed' && row.pending_options_json
            ? decode(row.pending_options_json) : normalizeOptions(input);
        if (action === 'proceed' && input.requestId && options.requestId && input.requestId !== options.requestId)
            throw flowError('The pending review options changed in another request. Refresh the review before proceeding.', 409, 'REVIEW_OPTIONS_CHANGED');
        if (action === 'cancel') {
            const changed = await query("UPDATE video_reviews SET phase='cancelled' WHERE id=? AND phase=? AND phase NOT IN ('reviewing','analyzing','completed')", [row.id, row.phase]);
            if (!changed.affectedRows) throw flowError('Processing is already running. Please wait.', 409, 'PROCESSING_BUSY');
            return { analysis_status: 'cancelled', review_id: row.id };
        }
        // A bounded worker timeout makes an abandoned lease retryable after 15 minutes.
        if (['reviewing', 'analyzing'].includes(row.phase) && Date.now() - new Date(row.updated_at).getTime() < 15 * 60 * 1000)
            throw flowError('Processing is already running. Please wait.', 409, 'PROCESSING_BUSY');
        let review = decode(row.review_json);
        if (action === 'proceed' && review?.state !== 'flagged') throw flowError('This review cannot be acknowledged.');
        if (!review || review.state === 'review_failed') {
            const lock = await query("UPDATE video_reviews SET phase='reviewing', updated_at=NOW() WHERE id=? AND phase=? AND (phase NOT IN ('reviewing','analyzing') OR updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))", [row.id, row.phase]);
            if (!lock.affectedRows) throw flowError('Processing is already running.', 409, 'PROCESSING_BUSY');
            try {
                progress('Reviewing community guidelines');
                const result = await run(file.absolutePath, { mode: 'review' }, progress);
                review = result.community_standards;
                if (!['passed', 'flagged'].includes(review?.state) ||
                    (review.state === 'flagged' && (!review.violation_details?.length || review.violation_details.some(d => !d.category || !d.reason))))
                    throw flowError('The guideline review was incomplete. Please retry.', 502, 'REVIEW_FAILED');
                review.review_metadata = { guideline_version: analysisConfig.guideline_version, model: analysisConfig.model,
                    generation_settings: analysisConfig.generation_settings, preprocessing_version: analysisConfig.preprocessing_version };
                await query('UPDATE video_reviews SET review_json=?, phase=?, guideline_version=? WHERE id=?', [JSON.stringify(review), 'awaiting', analysisConfig.guideline_version, row.id]);
                row.guideline_version = analysisConfig.guideline_version;
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
        if (review.state === 'flagged' && !row.acknowledged_at && action !== 'proceed') {
            await query('UPDATE video_reviews SET pending_options_json=? WHERE id=?', [JSON.stringify(options), row.id]);
            return { review_id: row.id, community_standards: review, analysis_status: 'awaiting_acknowledgement' };
        }
        const lock = await query("UPDATE video_reviews SET phase='analyzing', updated_at=NOW() WHERE id=? AND phase=? AND (phase NOT IN ('reviewing','analyzing') OR updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))", [row.id, row.phase]);
        if (!lock.affectedRows) throw flowError('Processing is already running.', 409, 'PROCESSING_BUSY');
        const ack = row.acknowledged_at || (review.state === 'flagged' && action === 'proceed' ? new Date().toISOString() : null);
        try {
            await query('UPDATE video_reviews SET acknowledged_at=? WHERE id=?', [ack, row.id]);
            row.review_json = JSON.stringify(review);
            row.acknowledged_at = ack;
            row.absolutePath = file.absolutePath;
            const output = await analyses.execute(user, row, options, progress);
            await query("UPDATE video_reviews SET phase='completed', result_json=? WHERE id=?", [JSON.stringify(output), row.id]);
            return output;
        } catch (e) {
            await query("UPDATE video_reviews SET phase='analysis_failed' WHERE id=?", [row.id]);
            throw e;
        }
    }
    async function savedResult(user, file, runId) {
        const row = await load(user, file, undefined, Boolean(runId));
        const review = decode(row.review_json);
        if ((!runId && row.phase !== 'completed') || !['passed', 'flagged'].includes(review?.state) || (review.state === 'flagged' && !row.acknowledged_at))
            throw flowError('Complete the analysis and acknowledge any guideline flags before saving.', 422);
        const result = runId ? await analyses.get(user, row, runId) : decode(row.result_json);
        return { result, size: Number(row.file_size) };
    }
    async function listRuns(user, file) {
        const row = await load(user, file, undefined, true);
        const rows = await query("SELECT id FROM analysis_runs WHERE user_id=? AND review_id=? AND status='completed' ORDER BY created_at DESC, id DESC LIMIT 50", [user, row.id]);
        return Promise.all(rows.map(record => analyses.get(user, row, record.id)));
    }
    return { register, process, savedResult, listRuns };
}
