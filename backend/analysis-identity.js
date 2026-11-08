import { analysisRuntime } from './analysis-runtime.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
export const analysisConfig = JSON.parse(readFileSync(new URL('./analysis-config.json', import.meta.url), 'utf8'));
const config = analysisConfig;
const sha256 = value => createHash('sha256').update(value).digest('hex');
// Source digests invalidate reuse even if a version label was accidentally not bumped.
const implementation = sha256(['python_script.py', 'analysis-config.json', 'analysis-identity.js', 'analysis-runs.js', 'analysis-runtime.js', 'requirements.txt']
    .map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n'));
export const stableJSON = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const invalid = message => Object.assign(new Error(message), { status: 400, code: 'INVALID_ANALYSIS_OPTIONS' });
export function normalizeOptions(input = {}) {
    let comments = input.comments ?? [];
    if (typeof comments === 'string') { try { comments = JSON.parse(comments); } catch { comments = [comments]; } }
    if (!Array.isArray(comments) || comments.length > 300) throw invalid('Provide at most 300 comments.');
    comments = comments.map(item => {
        const value = typeof item === 'string' ? item : item?.text ?? item?.comment ?? item?.body;
        if (typeof value !== 'string') throw invalid('Each comment must contain text.');
        return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
    }).filter(Boolean);
    if (comments.join('').length > 100000) throw invalid('Comments are too long.');
    let settings = input.settings ?? {};
    if (typeof settings === 'string') { try { settings = JSON.parse(settings); } catch { throw invalid('Invalid generation settings.'); } }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).some(k => !['temperature', 'top_p'].includes(k)))
        throw invalid('Only temperature and top_p can be customized.');
    const generation = { ...config.generation_settings, ...settings };
    if (!Number.isFinite(generation.temperature) || generation.temperature < 0 || generation.temperature > 2 ||
        !Number.isFinite(generation.top_p) || generation.top_p <= 0 || generation.top_p > 1) throw invalid('Invalid temperature or top_p.');
    if (input.forceFresh !== undefined && ![true, false, 'true', 'false'].includes(input.forceFresh)) throw invalid('Invalid fresh-run option.');
    const forceFresh = input.forceFresh === true || input.forceFresh === 'true';
    const requestId = input.requestId;
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId))) throw invalid('Invalid analysis request reference.');
    if (forceFresh && !requestId) throw invalid('Fresh analysis requires a unique requestId for duplicate-click protection.');
    return { comments, settings: generation, forceFresh, requestId };
}
export function analysisIdentity(fileHash, options, guidelineVersion, reviewMetadata) {
    const identity = { ...config, runtime: analysisRuntime, implementation_sha256: implementation, file_hash: fileHash,
        guideline_version: guidelineVersion || 'unknown', guideline_generation_settings: reviewMetadata?.generation_settings || 'unknown', guideline_model: reviewMetadata?.model || 'unknown', guideline_preprocessing_version: reviewMetadata?.preprocessing_version || 'unknown', comments: options.comments, generation_settings: options.settings };
    return { hash: sha256(stableJSON(identity)), metadata: { ...identity,
        comments: undefined, comments_sha256: sha256(stableJSON(options.comments)), comment_count: options.comments.length } };
}
const numberIn = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high ? value : null;
const clamp = value => Math.min(100, Math.max(0, value));
export function finalizeAnalysis(result) {
    const audio = { ...result.audio_analysis };
    const measured = result.measured_audio || {};
    const sc = { ...result.speech_clarity };
    const words = numberIn(result.transcript_word_count, 1, 1000000);
    const measurable = measured.status === 'measured' && measured.silence_ratio !== 1;
    const duration = measurable ? numberIn(measured.duration_seconds, 0.001, 86400) : null;
    const pace = words !== null && duration !== null ? Math.round(words / duration * 60 * 10) / 10 : null;
    const filler = measurable && words !== null && Number.isInteger(sc.filler_words) ? numberIn(sc.filler_words, 0, words ?? 0) : null;
    const stability = measurable ? numberIn(sc.tone_stability, 0, 100) : null;
    const quality = measurable ? numberIn(sc.audio_quality, 0, 100) : null;
    const paceScore = pace === null ? null : clamp(pace < 120 ? pace / 120 * 100 : pace <= 180 ? 100 : 100 - (pace - 180) / 180 * 100);
    const fillerScore = filler === null || words === null ? null : clamp(100 - 10 * filler / words * 100);
    const components = { pace: paceScore, filler: fillerScore, tone_stability: stability, audio_quality: quality };
    const score = Object.values(components).every(v => v !== null) ? Math.round(Object.values(components).reduce((sum, v) => sum + v, 0) / 4) : null;
    Object.assign(sc, { ai_overall_score: numberIn(sc.overall_score, 0, 100), overall_score: score,
        speech_pace_wpm: pace, filler_words: filler, tone_stability: stability, audio_quality: quality,
        pace_rating: pace === null ? 'Unavailable' : pace < 120 ? 'Too Slow' : pace <= 180 ? 'Ideal' : pace <= 240 ? 'Fast' : 'Too Fast',
        score_components: components, scoring_version: config.scoring_version,
        score_source: 'server_formula_with_AI_estimated_components',
        pace_source: 'AI_transcript_words_per_full_measured_minute',
        component_sources: { filler_words: 'AI_estimate', tone_stability: 'AI_estimate', audio_quality: 'AI_estimate' } });
    audio.estimated_speaking_rate_wpm = pace;
    audio.feature_sources = { ...audio.feature_sources, estimated_speaking_rate_wpm: sc.pace_source };
    const emotion = { ...result.emotion_analysis };
    const keys = ['happy', 'neutral', 'nervous', 'angry', 'sad'];
    for (const key of keys) emotion[key] = numberIn(emotion[key], 0, 1);
    const validEmotion = measurable && keys.every(key => emotion[key] !== null) && Math.abs(keys.reduce((sum, key) => sum + emotion[key], 0) - 1) <= 0.02;
    if (!validEmotion) { for (const key of keys) emotion[key] = null; emotion.dominant_emotion = null; }
    emotion.source = 'AI_estimate';
    return { ...result, speech_clarity: sc, audio_analysis: audio, emotion_analysis: emotion };
}
