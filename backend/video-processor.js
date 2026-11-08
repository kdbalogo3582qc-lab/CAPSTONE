export const createVideoProcessor = (reviewFlow, getUploadedVideoPath) => async (req, res, streaming) => {
    const input = streaming ? req.query : req.body;
    const file = getUploadedVideoPath(input.videoPath);
    if (!file) return res.status(400).json({ error: "Invalid uploaded video path" });
    if (streaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
    }
    const send = (event, data) => { if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    const heartbeat = streaming ? setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n'); }, 15000) : null;
    try {
        const result = await reviewFlow.process(req.acc_id, file, input, message => streaming && send('progress', { message }));
        if (streaming) send(result.analysis_status === 'awaiting_acknowledgement' ? 'review' : 'result', { success: true, data: result });
        else res.json(result);
    } catch (err) {
        const payload = { error: err.message, message: err.message, code: err.code || 'PROCESSING_ERROR',
            review_state: err.review_state, retryable: !['INVALID_REVIEW', 'REVIEW_EXPIRED'].includes(err.code) };
        if (streaming) send('error', payload);
        else res.status(err.status || 500).json(payload);
    } finally {
        if (heartbeat) clearInterval(heartbeat);
        if (streaming) res.end();
    }
};
