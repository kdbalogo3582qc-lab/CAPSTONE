import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { createReviewFlow } from '../review-flow.js';

test('standalone migration and persisted acknowledgement/save/reopen on MySQL', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
    dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
    const connection = mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, connectTimeout: 3000,
        ...(process.env.TEST_DB_SOCKET ? { socketPath: process.env.TEST_DB_SOCKET } : {}) });
    const query = (sql, args = []) => new Promise((resolve, reject) => connection.query(sql, args, (err, result) => err ? reject(err) : resolve(result)));
    const database = `capstone_revision1_test_${randomUUID().replaceAll('-', '')}`;
    let created = false;
    try {
        await query(`CREATE DATABASE \`${database}\``); created = true;
        await query(`USE \`${database}\``);
        const schema = await readFile(new URL('../py_project.sql', import.meta.url), 'utf8');
        const savedDDL = schema.match(/CREATE TABLE `saved_videos`[\s\S]*?;/)[0];
        await query(savedDDL);
        await query("INSERT INTO saved_videos (id,user_id,video_path,analysis,file_size) VALUES (1,1,'legacy.mp4',?,42)", [JSON.stringify({ summary: 'Legacy record' })]);
        const before = await query('SELECT * FROM saved_videos');
        await query(await readFile(new URL('../migrations/001_guideline_review.sql', import.meta.url), 'utf8'));
        assert.deepEqual(await query('SELECT * FROM saved_videos'), before);
        const review = { state: 'flagged', violations: ['smoking_vaping_or_tobacco'], violation_details: [{ category: 'smoking_vaping_or_tobacco', reason: 'Presenter promotes smoking.' }] };
        const jobs = [];
        const dependencies = { query, identify: async () => ({ hash: 'a'.repeat(64), size: 123 }), run: async (_file, job) => {
            jobs.push(job.mode);
            return job.mode === 'review' ? { community_standards: review } : { summary: { content: 'Summary' }, audio_analysis: { tempo: 100 } };
        } };
        const file = { absolutePath: '/fixture/video.mp4', key: 'uploads/new.mp4' };
        const flow = createReviewFlow(dependencies);
        const id = await flow.register(1, file);
        assert.equal((await flow.process(1, file)).analysis_status, 'awaiting_acknowledgement');
        await assert.rejects(flow.savedResult(1, file));
        await assert.rejects(flow.process(2, file, { action: 'proceed', reviewId: id }));
        const attempts = await Promise.allSettled([flow.process(1, file, { action: 'proceed', reviewId: id }), flow.process(1, file, { action: 'proceed', reviewId: id })]);
        assert.ok(attempts.some(a => a.status === 'fulfilled'));
        assert.deepEqual(jobs, ['review', 'analyze']);
        const restarted = createReviewFlow(dependencies);
        const saved = await restarted.savedResult(1, file);
        await query('INSERT INTO saved_videos (id,user_id,video_path,analysis,file_size) VALUES (2,1,?,?,?)', [file.key, JSON.stringify(saved.result), saved.size]);
        const reopened = JSON.parse((await query('SELECT analysis FROM saved_videos WHERE id=2'))[0].analysis);
        assert.equal(reopened.analysis_status, 'completed_flagged');
        assert.ok(reopened.guideline_acknowledged_at);
        assert.deepEqual(reopened.community_standards, review);
        assert.deepEqual((await query('SELECT * FROM saved_videos WHERE id=1')), before);
        assert.deepEqual(await restarted.process(1, file, { action: 'proceed', reviewId: id }), reopened);
        const second = { ...file, key: 'uploads/cancel.mp4' };
        const secondId = await flow.register(1, second); await flow.process(1, second);
        await flow.process(1, second, { action: 'cancel', reviewId: secondId });
        await assert.rejects(flow.process(1, second, { action: 'proceed', reviewId: secondId }));
        const third = { ...file, key: 'uploads/expired.mp4' };
        const thirdId = await flow.register(1, third);
        await query('UPDATE video_reviews SET expires_at=DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id=?', [thirdId]);
        await assert.rejects(flow.process(1, third), e => e.code === 'REVIEW_EXPIRED');
    } finally {
        if (created) await query(`DROP DATABASE \`${database}\``);
        connection.destroy();
    }
});
