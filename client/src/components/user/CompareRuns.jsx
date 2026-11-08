import { provenanceLabel } from './AnalysisProvenance';
import { GuidelineBadge } from './GuidelineReview';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { HiMenuAlt3 } from 'react-icons/hi';
import Navbar from './Navbar';
import Leftbar from './Leftbar';
import ApiUrl from '../config/LocalConfigApi';
import { useAuth } from './Login';
import { useNavigate } from 'react-router-dom';

const safeJsonParse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } };
const getDeep = (value, path) => path.split('.').reduce((item, key) => item?.[key], value);
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const known = value => value !== undefined && value !== null && value !== 'unknown';
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const compareMetadata = (left, right) => !known(left) || !known(right) ? 'Unknown' : canonical(left) === canonical(right) ? 'Same' : 'Different';
const formatDate = value => {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
    }) : 'Unknown date';
};
const formatVideoName = videoPath => String(videoPath || 'Untitled recording').split('/').pop()
    .replace(/^\d+-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)?/i, '');
const getMetric = (analysis, key) => {
    const value = {
        clarity: analysis?.speech_clarity?.overall_score,
        pace: analysis?.speech_clarity?.speech_pace_wpm ?? analysis?.audio_analysis?.estimated_speaking_rate_wpm,
        tone: analysis?.audio_analysis?.inferred_tone,
        emotion: analysis?.emotion_analysis?.dominant_emotion,
    }[key];
    if (key === 'clarity' || key === 'pace') {
        if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }
    return text(value);
};
const metrics = [
    { key: 'clarity', label: 'Clarity score', unit: ' / 100', differenceUnit: ' points' },
    { key: 'pace', label: 'Speaking pace', unit: ' WPM', differenceUnit: ' WPM' },
    { key: 'tone', label: 'Detected tone' },
    { key: 'emotion', label: 'Dominant emotion' },
];
const difference = (left, right, row) => {
    if (left === null || right === null) return 'Unavailable';
    if (typeof left !== 'number' || typeof right !== 'number')
        return left.toLowerCase() === right.toLowerCase() ? 'Same' : 'Changed';
    const delta = Number((right - left).toPrecision(12));
    return delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta}${row.differenceUnit}`;
};
const displayMetric = (value, row) => value === null ? 'Unavailable' : typeof value === 'number'
    ? `${value}${row.unit || ''}` : value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
const audienceText = analysis => {
    const audience = analysis?.summary?.predicted_target_audience;
    const primary = audience?.primary_segment;
    const secondary = Array.isArray(audience?.secondary_segments) ? audience.secondary_segments.map(segment => text(segment?.label)).filter(Boolean) : [];
    return [text(primary?.label), text(primary?.evidence), secondary.length ? `Other possible audiences: ${secondary.join(', ')}.` : null].filter(Boolean).join('\n\n') || null;
};
const settingsText = value => value && typeof value === 'object'
    ? [`Temperature: ${value.temperature ?? 'unknown'}`, `Top-p: ${value.top_p ?? 'unknown'}`].join(' · ') : 'Unknown';
const setupFields = [
    ['model', 'Model'], ['prompt_version', 'Analysis version'], ['guideline_version', 'Guideline version'],
    ['guideline_model', 'Guideline model'], ['preprocessing_version', 'Audio/video preparation'],
    ['guideline_preprocessing_version', 'Guideline video preparation'], ['scoring_version', 'Scoring method'],
    ['generation_settings', 'Analysis settings', settingsText], ['guideline_generation_settings', 'Guideline settings', settingsText],
    ['runtime', 'Processing environment', () => 'Changed'], ['implementation_sha256', 'Processing implementation', () => 'Changed'],
    ['identity_version', 'Input matching version'],
];

function TextComparison({ title, left, right, transcript = false }) {
    const a = text(left); const b = text(right);
    if (!a && !b) return null;
    const shared = a !== null && a === b;
    return <ContentSection>
        <SectionHeader><h2>{title}</h2>{shared && <SmallLabel>Same in both runs</SmallLabel>}</SectionHeader>
        {transcript ? <TranscriptDetails>
            <summary><span>{shared ? 'Shared transcript' : 'Run A and Run B transcripts'}</span><DisclosureToggle aria-hidden="true"><span className="show">Show transcript</span><span className="hide">Hide transcript</span></DisclosureToggle></summary>
            <ContentColumns $shared={shared}>
                <TextBlock $shared={shared}>{!shared && <h3>Run A</h3>}<p>{a || 'Unavailable for this run.'}</p></TextBlock>
                {!shared && <TextBlock><h3>Run B</h3><p>{b || 'Unavailable for this run.'}</p></TextBlock>}
            </ContentColumns>
        </TranscriptDetails> : <ContentColumns $shared={shared}>
            <TextBlock $shared={shared}>{!shared && <h3>Run A</h3>}<p>{a || 'Unavailable for this run.'}</p></TextBlock>
            {!shared && <TextBlock><h3>Run B</h3><p>{b || 'Unavailable for this run.'}</p></TextBlock>}
        </ContentColumns>}
    </ContentSection>;
}

function CompareRuns() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [runs, setRuns] = useState([]);
    const [isFetching, setIsFetching] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [firstRunId, setFirstRunId] = useState('');
    const [secondRunId, setSecondRunId] = useState('');

    useEffect(() => { if (!loading && !user) navigate('/'); }, [loading, user, navigate]);
    useEffect(() => {
        if (!user) return;
        let active = true;
        setIsFetching(true);
        setFetchError('');
        axios.get(`${ApiUrl.apiURL}/saved-videos`, { withCredentials: true })
            .then(({ data }) => {
                if (!active) return;
                const prepared = (Array.isArray(data) ? data : []).map(item => ({ ...item, parsedAnalysis: safeJsonParse(item.analysis) }));
                setRuns(prepared);
                setFirstRunId(prepared[0] ? String(prepared[0].id) : '');
                setSecondRunId(prepared[1] ? String(prepared[1].id) : '');
            })
            .catch(() => { if (active) { setRuns([]); setFetchError('Could not load saved analyses. Refresh this page to try again.'); } })
            .finally(() => { if (active) setIsFetching(false); });
        return () => { active = false; };
    }, [user]);

    const firstRun = useMemo(() => runs.find(item => String(item.id) === firstRunId) || null, [runs, firstRunId]);
    const secondRun = useMemo(() => runs.find(item => String(item.id) === secondRunId) || null, [runs, secondRunId]);
    const first = firstRun?.parsedAnalysis; const second = secondRun?.parsedAnalysis;
    const aMeta = first?.analysis_metadata; const bMeta = second?.analysis_metadata;
    const sameVideo = aMeta?.file_hash && bMeta?.file_hash ? aMeta.file_hash === bMeta.file_hash : null;
    const aId = first?.run_id || aMeta?.run_id; const bId = second?.run_id || bMeta?.run_id;
    const sameRun = aId && bId ? aId === bId : false;
    const sameSource = aId && bId && (aMeta?.source_run_id || aId) === (bMeta?.source_run_id || bId);
    const metricValues = metrics.map(row => ({ row, left: getMetric(first, row.key), right: getMetric(second, row.key) }));
    const availablePairs = metricValues.filter(({ left, right }) => left !== null && right !== null);
    const hasDifferences = availablePairs.some(({ left, right }) => typeof left === 'string' && typeof right === 'string'
        ? left.toLowerCase() !== right.toLowerCase() : left !== right);
    const setup = setupFields.map(([key, label, format]) => ({ key, label, format, left: aMeta?.[key], right: bMeta?.[key], state: compareMetadata(aMeta?.[key], bMeta?.[key]) }));
    const changedSetup = setup.filter(item => item.state === 'Different');
    const unknownSetup = setup.some(item => item.state === 'Unknown');
    const commentsState = compareMetadata(aMeta?.comments_sha256, bMeta?.comments_sha256);
    const setupLabel = changedSetup.length ? 'Different analysis setup' : unknownSetup ? 'Setup partly unknown' : 'Same analysis setup';

    return <PageWrapper>
        <Navbar user={user} activePath="/compare-runs" />
        <Leftbar isMobileMenuOpen={isMobileSidebarOpen} closeMobileMenu={() => setIsMobileSidebarOpen(false)} />
        <MobileMenuButton onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open navigation"><HiMenuAlt3 size={24} /></MobileMenuButton>
        <MainContent><ContentWrapper>
            <PageHeader>
                <div><h1>Compare Runs</h1><p>Choose two saved analyses to compare their results.</p></div>
                {!isFetching && <SavedCount>{runs.length} saved {runs.length === 1 ? 'analysis' : 'analyses'}</SavedCount>}
            </PageHeader>
            <SelectorCard><SelectorGrid>
                {[{ label: 'Run A', value: firstRunId, other: secondRunId, set: setFirstRunId, run: firstRun, analysis: first },
                    { label: 'Run B', value: secondRunId, other: firstRunId, set: setSecondRunId, run: secondRun, analysis: second }].map(field =>
                    <SelectorField key={field.label}>
                        <RunLabelRow>
                            <label htmlFor={`compare-${field.label.replace(' ', '-').toLowerCase()}`}>{field.label}</label>
                            {field.run && <SourceTag>{provenanceLabel(field.analysis)}</SourceTag>}
                        </RunLabelRow>
                        <select id={`compare-${field.label.replace(' ', '-').toLowerCase()}`} value={field.value} disabled={isFetching}
                            onChange={event => field.set(event.target.value)}>
                            <option value="">Select a saved analysis</option>
                            {runs.map(run => <option key={run.id} value={run.id} disabled={String(run.id) === field.other}>
                                {formatVideoName(run.video_path)} · {formatDate(run.created_at)}
                            </option>)}
                        </select>
                        {field.run && <RunMeta><span>Saved {formatDate(field.run.created_at)}</span><GuidelineBadge analysis={field.analysis} /></RunMeta>}
                    </SelectorField>)}
            </SelectorGrid></SelectorCard>

            {loading || isFetching ? <EmptyState>Loading saved analyses…</EmptyState>
                : fetchError ? <EmptyState>{fetchError}</EmptyState>
                : !firstRun || !secondRun ? <EmptyState>{runs.length < 2 ? 'Save at least two analyses to compare their results.' : 'Select a saved analysis for each run.'}</EmptyState>
                : <>
                    <MetricsCard>
                        <ComparisonHeading>
                            <ComparisonTitleRow><h2>{sameRun ? 'Same analysis saved twice' : sameVideo === true ? 'Same video, two saved results' : sameVideo === false ? 'Results comparison' : 'Saved results comparison'}</h2><SmallLabel>Run B compared with Run A</SmallLabel></ComparisonTitleRow>
                            <p>{sameRun ? 'Both recordings refer to the same analysis run.'
                                : sameSource ? 'Both results use the same source analysis.'
                                : sameVideo === true ? 'These runs analyze the same video. Differences reflect analysis variation.'
                                : sameVideo === false ? 'These runs analyze different videos.' : 'Video identity is unknown for one or both older recordings.'}</p>
                            <ResultNote>{availablePairs.length === 0 ? 'No comparable metrics are available.'
                                : hasDifferences ? 'The differences are shown below.' : 'No differences in the available metrics.'}</ResultNote>
                        </ComparisonHeading>
                        <TableScroll><MetricTable><thead><tr><th scope="col">Metric</th>
                            <th scope="col">Run A<ColumnFileName title={formatVideoName(firstRun.video_path)}>{formatVideoName(firstRun.video_path)}</ColumnFileName></th>
                            <th scope="col">Run B<ColumnFileName title={formatVideoName(secondRun.video_path)}>{formatVideoName(secondRun.video_path)}</ColumnFileName></th>
                            <th scope="col">Difference</th></tr></thead>
                            <tbody>{metricValues.map(({ row, left, right }) => <tr key={row.key}>
                                <td>{row.label}</td><td>{displayMetric(left, row)}</td><td>{displayMetric(right, row)}</td>
                                <td><DifferenceLabel $same={['Same', 'No change'].includes(difference(left, right, row))}>{difference(left, right, row)}</DifferenceLabel></td>
                            </tr>)}</tbody>
                        </MetricTable></TableScroll>
                        <TableNote>Numerical differences are Run B minus Run A. A higher value alone does not mean better performance.</TableNote>
                    </MetricsCard>

                    <SetupDetails><summary><DisclosureHeading><strong>Comparison details</strong><SmallLabel>{setupLabel}</SmallLabel></DisclosureHeading>
                        <DisclosureToggle aria-hidden="true"><span className="show">Show details</span><span className="hide">Hide details</span></DisclosureToggle></summary>
                        <SetupBody>
                            <ContextRow><span>Video</span><strong>{sameVideo === null ? 'Unknown' : sameVideo ? 'Same video' : 'Different videos'}</strong></ContextRow>
                            <ContextRow><span>Viewer comments</span><strong>{commentsState}</strong></ContextRow>
                            <ContextRow><span>Analysis setup</span><strong>{setupLabel}</strong></ContextRow>
                            {unknownSetup && <MutedText>Some version or settings information is unavailable for these recordings.</MutedText>}
                            {changedSetup.length > 0 && <TableScroll><MetricTable><thead><tr><th>Changed setting</th><th>Run A</th><th>Run B</th></tr></thead>
                                <tbody>{changedSetup.map(item => <tr key={item.key}><td>{item.label}</td>
                                    {item.key === 'runtime' || item.key === 'implementation_sha256'
                                        ? <td colSpan={2}>Different between these runs</td>
                                        : <><td>{item.format ? item.format(item.left) : String(item.left)}</td><td>{item.format ? item.format(item.right) : String(item.right)}</td></>}
                                </tr>)}</tbody></MetricTable></TableScroll>}
                            <MutedText>Current pace uses transcript words per full measured video minute. Older methods may differ.</MutedText>
                        </SetupBody>
                    </SetupDetails>

                    <TextComparison title="Summary" left={getDeep(first, 'summary.summary.content')} right={getDeep(second, 'summary.summary.content')} />
                    <TextComparison title="Predicted target audience" left={audienceText(first)} right={audienceText(second)} />
                    <TextComparison title="Audience impact" left={getDeep(first, 'summary.impact.content')} right={getDeep(second, 'summary.impact.content')} />
                    <TextComparison title="Transcript" left={first?.transcript} right={second?.transcript} transcript />
                </>}
        </ContentWrapper></MainContent>
    </PageWrapper>;
}
export default CompareRuns;

const PageWrapper = styled.div`min-height: 100vh; background: #f9fafb;`;
const MainContent = styled.main`
    margin-left: 230px; margin-top: 68px; min-height: calc(100vh - 68px); padding: 28px 24px;
    @media (max-width: 1024px) { margin-left: 0; margin-top: 64px; padding: 24px 16px; }
`;
const ContentWrapper = styled.div`width: 100%; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px;`;
const PageHeader = styled.header`
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
    padding: 8px 0 10px;
    h1 { margin: 0; color: #1d2939; font-size: 25px; font-weight: 600; letter-spacing: -.025em; line-height: 1.4; }
    p { margin: 6px 0 0; color: #667085; font-size: 13px; line-height: 1.7; }
    @media (max-width: 1024px) { padding-left: 50px; min-height: 44px; }
`;
const SavedCount = styled.span`color: #667085; font-size: 12px; line-height: 1.6; white-space: nowrap;`;
const MobileMenuButton = styled.button`
    display: none;
    @media (max-width: 1024px) {
        display: grid; place-items: center; position: fixed; top: 82px; left: 16px;
        width: 38px; height: 38px; border-radius: 8px; border: 1px solid #d0d5dd;
        background: #fff; color: #344054; z-index: 60;
    }
`;
const SelectorCard = styled.section`
    background: #fff; border: 1px solid #e4e9f0; border-radius: 12px; padding: 24px;
    @media (max-width: 640px) { padding: 18px; }
`;
const RunLabelRow = styled.div`display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; min-height: 24px;`;
const SourceTag = styled.span`padding: 3px 8px; border-radius: 5px; background: #f2f4f7; color: #667085; font-size: 11px; line-height: 1.5;`;
const ColumnFileName = styled.span`display: block; max-width: 210px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #98a2b3; font-size: 11px; font-weight: 400;`;
const ComparisonTitleRow = styled.div`display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 20px;`;

const SelectorGrid = styled.div`
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px;
    @media (max-width: 700px) { grid-template-columns: 1fr; gap: 20px; }
`;
const SelectorField = styled.div`
    display: flex; flex-direction: column; gap: 9px; min-width: 0;
    label { font-size: 12px; color: #475467; font-weight: 600; }
    select { width: 100%; min-width: 0; min-height: 46px; border-radius: 8px; border: 1px solid #d0d5dd;
        background: #fff; color: #344054; padding: 10px 30px 10px 12px; font-family: inherit; font-size: 12px; text-overflow: ellipsis; cursor: pointer; }
    select:focus-visible { outline: 2px solid #2c6edb; outline-offset: 2px; }
    select:disabled { opacity: .6; cursor: not-allowed; }
`;
const RunMeta = styled.div`display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; color: #667085; font-size: 12px; line-height: 1.5;`;
const MetricsCard = styled.section`background: #fff; border: 1px solid #e4e9f0; border-radius: 12px; overflow: hidden;`;
const ComparisonHeading = styled.div`
    padding: 20px;
    h2 { margin: 0; color: #1d2939; font-size: 15px; font-weight: 600; line-height: 1.5; }
    p { margin: 6px 0 0; color: #667085; font-size: 13px; line-height: 1.7; }
`;
const ResultNote = styled.div`
    display: inline-block; margin-top: 14px; padding: 7px 10px; border-radius: 6px;
    background: #f8f9fb; color: #475467; font-size: 12px; font-weight: 500; line-height: 1.6;
`;
const TableScroll = styled.div`overflow-x: auto;`;
const MetricTable = styled.table`
    width: 100%; min-width: 520px; border-collapse: collapse; font-variant-numeric: tabular-nums;
    th, td { text-align: left; padding: 16px 20px; border-bottom: 1px solid #edf0f4; font-size: 13px; line-height: 1.6; }
    th { color: #667085; font-size: 12px; font-weight: 500; background: #f9fafb; white-space: nowrap; }
    td { color: #344054; overflow-wrap: anywhere; }
    td:first-child { font-weight: 500; color: #475467; }
    td:not(:first-child) { min-width: 115px; }
    tbody tr:last-child td { border-bottom: 0; }
`;
const DifferenceLabel = styled.span`
    display: inline-block; padding: 3px 8px; border-radius: 5px; background: #f2f4f7;
    color: ${p => p.$same ? '#667085' : '#344054'}; font-size: 12px; white-space: nowrap;
`;
const TableNote = styled.p`margin: 0; padding: 13px 20px; border-top: 1px solid #edf0f4; color: #667085; font-size: 12px; line-height: 1.7;`;
const SmallLabel = styled.span`color: #667085; font-size: 12px; font-weight: 400; line-height: 1.6;`;
const DisclosureHeading = styled.span`
    display: flex; flex-direction: column; gap: 4px;
    strong { font-weight: 500; }
`;
const DisclosureToggle = styled.span`
    flex-shrink: 0; color: #667085; font-size: 12px; font-weight: 400;
    .hide { display: none; }
    details[open] > summary & .show { display: none; }
    details[open] > summary & .hide { display: inline; }
`;
const SetupDetails = styled.details`
    border: 1px solid #e4e9f0; border-radius: 12px; background: #fff; overflow: hidden;
    > summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px;
        list-style: none; color: #344054; font-size: 13px; cursor: pointer; }
    > summary::-webkit-details-marker { display: none; }
    > summary:focus-visible { outline: 2px solid #2c6edb; outline-offset: -3px; }
    &[open] > summary { border-bottom: 1px solid #edf0f4; }
`;
const SetupBody = styled.div`padding: 4px 20px 12px;`;
const ContextRow = styled.div`
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 0;
    border-bottom: 1px solid #edf0f4; font-size: 12px; line-height: 1.7;
    span { color: #667085; } strong { color: #344054; font-weight: 500; }
`;
const MutedText = styled.p`margin: 12px 0 0; color: #667085; font-size: 12px; line-height: 1.7;`;
const ContentSection = styled.section`border: 1px solid #e4e9f0; border-radius: 12px; overflow: hidden; background: #fff;`;
const SectionHeader = styled.div`
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
    padding: 16px 20px; border-bottom: 1px solid #edf0f4;
    h2 { margin: 0; color: #344054; font-size: 14px; font-weight: 600; line-height: 1.5; }
`;
const ContentColumns = styled.div`
    display: grid; grid-template-columns: ${p => p.$shared ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))'}; gap: 20px;
    padding: 18px 20px;
    @media (max-width: 700px) { grid-template-columns: 1fr; }
`;
const TextBlock = styled.div`
    min-width: 0; padding: ${p => p.$shared ? '0' : '16px'};
    border-radius: 8px; background: ${p => p.$shared ? 'transparent' : '#f9fafb'};
    h3 { margin: 0 0 8px; color: #475467; font-size: 12px; font-weight: 600; }
    p { max-width: 90ch; margin: 0; color: #475467; font-size: 13px; line-height: 1.85; white-space: pre-wrap; overflow-wrap: anywhere; }
`;
const TranscriptDetails = styled.details`
    > summary { display: flex; align-items: center; justify-content: space-between; gap: 16px;
        padding: 17px 20px; list-style: none; color: #475467; font-size: 12px; cursor: pointer; }
    > summary::-webkit-details-marker { display: none; }
    > summary:focus-visible { outline: 2px solid #2c6edb; outline-offset: -3px; }
`;
const EmptyState = styled.div`background: #fff; border: 1px solid #e4e9f0; border-radius: 12px; padding: 28px; text-align: center; color: #667085; font-size: 13px; line-height: 1.7;`;
