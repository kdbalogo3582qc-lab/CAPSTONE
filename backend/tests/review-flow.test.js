import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewFlow } from '../review-flow.js';
import { createVideoProcessor } from '../video-processor.js';

const file = { key: 'uploads/exact.mp4', absolutePath: '/fixture/exact.mp4' };
const flagged = { state: 'flagged', decision: 'rejected', violations: ['smoking_vaping_or_tobacco', 'illegal_drugs_or_drug_use'],
    violation_details: [{ category: 'smoking_vaping_or_tobacco', reason: 'The presenter promotes a cigarette.', timestamp: '00:04' },
        { category: 'illegal_drugs_or_drug_use', reason: 'The spoken message encourages drug use.' }] };
const passed = { state: 'passed', decision: 'approved', violations: [], violation_details: [] };
const analysis = { summary: { summary: { content: 'Effectiveness findings' } }, audio_analysis: { tempo_bpm: 90 } };
// Persistent repository double: independent flow instances share these rows, as after a restart.
function harness(review = flagged) {
    const rows = new Map(); const calls = []; let hash = 'original'; let worker;
    const query = async (sql, args = []) => {
        if (sql.startsWith('INSERT')) {
            const [id, user_id, video_path, file_hash, file_size] = args;
            rows.set(id, { id, user_id, video_path, file_hash, file_size, phase: 'uploaded', review_json: null,
                acknowledged_at: null, expires_at: new Date(Date.now() + 86400000), updated_at: new Date() });
            return { affectedRows: 1 };
        }
        if (sql.startsWith('SELECT')) return [...rows.values()].filter(r => r.user_id === args[0] && r.video_path === args[1]).map(r => ({ ...r }));
        const [id, expected] = args.slice(sql.includes('AND phase=?') ? 0 : -1);
        const row = rows.get(id);
        assert.ok(row, sql);
        if (sql.includes('AND phase=?') && row.phase !== expected) return { affectedRows: 0 };
        if (sql.includes("SET phase='cancelled'")) {
            if (['reviewing','analyzing','completed'].includes(row.phase)) return { affectedRows: 0 };
            row.phase = 'cancelled';
        } else if (sql.includes("SET phase='reviewing'") || sql.includes("SET phase='analyzing'")) {
            if (['reviewing','analyzing'].includes(row.phase) && Date.now() - new Date(row.updated_at) < 900000) return { affectedRows: 0 };
            row.phase = sql.includes("SET phase='reviewing'") ? 'reviewing' : 'analyzing';
        } else if (sql.includes('SET review_json=')) { row.review_json = args[0]; row.phase = args[1]; }
        else if (sql.includes("SET phase='review_failed'")) { row.phase = 'review_failed'; row.review_json = args[0]; }
        else if (sql.includes('SET acknowledged_at=')) row.acknowledged_at = args[0];
        else if (sql.includes("SET phase='completed'")) { row.phase = 'completed'; row.result_json = args[0]; }
        else if (sql.includes("SET phase='analysis_failed'")) row.phase = 'analysis_failed';
        else throw new Error(`Unhandled SQL: ${sql}`);
        row.updated_at = new Date(); return { affectedRows: 1 };
    };
    const deps = { query, identify: async () => ({ hash, size: 123 }), run: async (_file, job) => {
        calls.push(job); return worker ? worker(job) : job.mode === 'review' ? { community_standards: review } : analysis;
    } };
    return { flow: createReviewFlow(deps), restart: () => createReviewFlow(deps), rows, calls,
        changeHash: () => { hash = 'changed'; }, setWorker: f => { worker = f; } };
}

test('passing review continues automatically and saves authoritative completed output', async () => {
    const h = harness(passed); await h.flow.register(1, file);
    const result = await h.flow.process(1, file);
    assert.equal(result.analysis_status, 'completed');
    assert.equal(result.guideline_acknowledged_at, null);
    assert.deepEqual(h.calls.map(c => c.mode), ['review','analyze']);
    assert.deepEqual((await h.flow.savedResult(1, file)).result, result);
});
test('multiple flags pause; proceed preserves evidence and persists acknowledgement through restart/save/reopen', async () => {
    const h = harness(); const id = await h.flow.register(1, file);
    const pending = await h.flow.process(1, file);
    assert.equal(pending.analysis_status, 'awaiting_acknowledgement');
    assert.deepEqual(pending.community_standards, flagged);
    assert.equal(h.calls.length, 1);
    await assert.rejects(h.flow.savedResult(1, file));
    const result = await h.restart().process(1, file, { action: 'proceed', reviewId: id });
    assert.equal(result.analysis_status, 'completed_flagged');
    assert.ok(Date.parse(result.guideline_acknowledged_at));
    assert.deepEqual(result.community_standards, flagged);
    assert.equal(h.calls.length, 2);
    const reopened = JSON.parse(JSON.stringify((await h.restart().savedResult(1, file)).result));
    assert.deepEqual(reopened, result);
    assert.deepEqual(await h.flow.process(1, file, { action: 'proceed', reviewId: id }), result);
    assert.equal(h.calls.length, 2);
});
test('cancel prevents analysis and future processing/save', async () => {
    const h = harness(); const id = await h.flow.register(1, file); await h.flow.process(1, file);
    assert.equal((await h.flow.process(1, file, { action: 'cancel', reviewId: id })).analysis_status, 'cancelled');
    await assert.rejects(h.flow.process(1, file, { action: 'proceed', reviewId: id }));
    await assert.rejects(h.flow.savedResult(1, file)); assert.equal(h.calls.length, 1);
});
test('failed, empty, malformed and failed API reviews remain retryable and cannot be acknowledged', async () => {
    for (const response of [{}, { community_standards: { state: 'review_failed' } }, null, new Error('API unavailable')]) {
        const h = harness(); const id = await h.flow.register(1, file);
        h.setWorker(() => { if (response instanceof Error) throw response; return response; });
        await assert.rejects(h.flow.process(1, file), e => e.review_state === 'review_failed');
        assert.equal(JSON.parse(h.rows.get(id).review_json).state, 'review_failed');
        await assert.rejects(h.flow.process(1, file, { action: 'proceed', reviewId: id }));
        h.setWorker(() => ({ community_standards: passed }));
        // Change to a complete worker for the retry.
        h.setWorker(job => job.mode === 'review' ? { community_standards: passed } : analysis);
        assert.equal((await h.flow.process(1, file)).analysis_status, 'completed');
    }
});
test('frontend bypass, other user, missing/invalid reference, changed file and expiry are rejected', async () => {
    const h = harness(); const id = await h.flow.register(1, file);
    await assert.rejects(h.flow.process(1, file, { action: 'proceed', reviewId: id }));
    await h.flow.process(1, file);
    assert.equal((await h.flow.process(1, file, { acknowledged: true, bypass: true })).analysis_status, 'awaiting_acknowledgement');
    for (const options of [{ action: 'proceed' }, { action: 'proceed', reviewId: 'forged' }]) await assert.rejects(h.flow.process(1, file, options));
    await assert.rejects(h.flow.process(2, file, { action: 'proceed', reviewId: id }));
    h.rows.get(id).expires_at = new Date(0);
    await assert.rejects(h.flow.process(1, file, { action: 'proceed', reviewId: id }), e => e.code === 'REVIEW_EXPIRED');
    h.rows.get(id).expires_at = new Date(Date.now() + 86400000); h.changeHash();
    await assert.rejects(h.flow.process(1, file, { action: 'proceed', reviewId: id }), /changed/);
});
test('duplicate proceed starts one worker; analysis failure retries the recorded review', async () => {
    const h = harness(); const id = await h.flow.register(1, file); await h.flow.process(1, file);
    let release; const block = new Promise(resolve => { release = resolve; });
    h.setWorker(async () => { await block; throw new Error('Provider unavailable'); });
    const attempts = [h.flow.process(1, file, { action: 'proceed', reviewId: id }), h.flow.process(1, file, { action: 'proceed', reviewId: id })];
    const settled = Promise.allSettled(attempts);
    await new Promise(resolve => setImmediate(resolve)); release();
    const outcomes = await settled;
    assert.equal(h.calls.length, 2);
    assert.ok(outcomes.some(o => o.reason?.code === 'PROCESSING_BUSY'));
    h.setWorker(() => analysis);
    assert.equal((await h.restart().process(1, file)).analysis_status, 'completed_flagged');
    assert.equal(h.calls.filter(c => c.mode === 'review').length, 1);
});
test('provider refusal cannot become completed or saveable', async () => {
    const h = harness(); const id = await h.flow.register(1, file); await h.flow.process(1, file);
    h.setWorker(() => { throw Object.assign(new Error('The AI provider declined to process this video under its safety restrictions.'), { code: 'PROVIDER_LIMITATION' }); });
    await assert.rejects(h.flow.process(1, file, { action: 'proceed', reviewId: id }), e => e.code === 'PROVIDER_LIMITATION');
    await assert.rejects(h.flow.savedResult(1, file));
});

function response() {
    return { destroyed: false, headers: {}, events: '', statusCode: 200,
        setHeader(k,v) { this.headers[k] = v; }, flushHeaders() {}, write(s) { this.events += s; },
        status(s) { this.statusCode = s; return this; }, json(s) { this.body = s; return this; }, end() { this.ended = true; } };
}
test('streaming/non-streaming adapters share review, completion and processing error behavior', async () => {
    for (const streaming of [false, true]) {
        const h = harness(); const id = await h.flow.register(1, file);
        const handler = createVideoProcessor(h.flow, () => file);
        const input = { videoPath: file.key };
        const pending = response(); await handler({ acc_id: 1, body: input, query: input }, pending, streaming);
        if (streaming) assert.match(pending.events, /event: review/);
        else assert.equal(pending.body.analysis_status, 'awaiting_acknowledgement');
        const proceed = { ...input, action: 'proceed', reviewId: id };
        const done = response(); await handler({ acc_id: 1, body: proceed, query: proceed }, done, streaming);
        if (streaming) assert.match(done.events, /event: result[\s\S]*completed_flagged/);
        else assert.equal(done.body.analysis_status, 'completed_flagged');
        const bad = response(); await handler({ acc_id: 2, body: input, query: input }, bad, streaming);
        if (streaming) assert.match(bad.events, /event: error/);
        else assert.equal(bad.statusCode, 404);
    }
});
