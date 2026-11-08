import React from 'react';
import styled from 'styled-components';

const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } };
const categoryLabels = {
    nudity_or_sexual_content: 'Nudity or sexual content',
    illegal_drugs_or_drug_use: 'Illegal drugs or drug use',
    smoking_vaping_or_tobacco: 'Smoking, vaping, or tobacco',
    violence_gore_or_disturbing_content: 'Violence, gore, or disturbing content',
    hate_harassment_or_discrimination: 'Hate, harassment, or discrimination',
    illegal_activities_or_dangerous_behavior: 'Illegal activities or dangerous behavior',
    sexual_content_involving_minors: 'Sexual content involving minors',
    other_general_audience_unsuitability: 'General audience suitability',
};

export function GuidelineBadge({ analysis }) {
    const result = parse(analysis);
    return result?.analysis_status === 'completed_flagged'
        ? <WarningBadge role="status">Analyzed with guideline flags</WarningBadge>
        : null;
}

export function GuidelineFindings({ analysis }) {
    const result = parse(analysis);
    if (result?.community_standards?.state !== 'flagged') return null;
    const findings = Array.isArray(result.community_standards.violation_details) ? result.community_standards.violation_details : [];
    const acknowledged = result.guideline_acknowledged_at ? new Date(result.guideline_acknowledged_at) : null;
    const validDate = acknowledged && !Number.isNaN(acknowledged.getTime());

    return <Panel open>
        <PanelSummary>
            <Heading>
                <PanelTitle>Guideline findings and acknowledgement</PanelTitle>
                <PanelSubtitle>{findings.length} {findings.length === 1 ? 'guideline flagged' : 'guidelines flagged'} during review</PanelSubtitle>
            </Heading>
            <ToggleLabel aria-hidden="true"><span className="show">Show details</span><span className="hide">Hide details</span></ToggleLabel>
        </PanelSummary>
        <PanelBody>
            <GuidelineBadge analysis={result} />
            <FindingsList>
                {findings.map((detail, index) => <Finding key={`${detail.category}-${index}`}>
                    <FindingHeader>
                        <FindingTitle>{categoryLabels[detail.category] || String(detail.category || 'Guideline finding').replace(/_/g, ' ')}</FindingTitle>
                        {detail.timestamp && <Timestamp>Time: {detail.timestamp}</Timestamp>}
                    </FindingHeader>
                    <FindingReason>{detail.reason}</FindingReason>
                    {detail.transcript_excerpt && <Excerpt><ExcerptLabel>Transcript excerpt</ExcerptLabel>{detail.transcript_excerpt}</Excerpt>}
                </Finding>)}
            </FindingsList>
            <Acknowledgement>
                <span>Acknowledged: {validDate
                    ? <time dateTime={acknowledged.toISOString()}>{acknowledged.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                    : 'Not recorded'}</span>
            </Acknowledgement>
        </PanelBody>
    </Panel>;
}

const WarningBadge = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border: 1px solid #f3dfae;
    border-radius: 6px;
    background: #fffbeb;
    color: #925d12;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
`;
const Panel = styled.details`
    margin: 20px 24px 0;
    overflow: hidden;
    border: 1px solid #e4e9f0;
    border-radius: 12px;
    background: #fff;
    &[open] > summary { border-bottom: 1px solid #edf0f4; }
    @media (max-width: 640px) { margin: 16px 12px 0; }
`;
const PanelSummary = styled.summary`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 20px;
    list-style: none;
    cursor: pointer;
    background: #fbfcfe;
    &::-webkit-details-marker { display: none; }
    &:focus-visible { outline: 2px solid #2c6edb; outline-offset: -3px; }
    @media (max-width: 640px) { padding: 16px; gap: 10px; }
`;
const Heading = styled.span`flex: 1; min-width: 0;`;
const PanelTitle = styled.span`
    display: block;
    color: #1d2939;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
`;
const PanelSubtitle = styled.span`
    display: block;
    margin-top: 3px;
    color: #667085;
    font-size: 12px;
    line-height: 1.5;
`;
const ToggleLabel = styled.span`
    flex-shrink: 0;
    color: #667085;
    font-size: 12px;
    .hide { display: none; }
    details[open] > summary & .show { display: none; }
    details[open] > summary & .hide { display: inline; }
`;
const PanelBody = styled.div`
    padding: 18px 20px 0;
    @media (max-width: 640px) { padding: 16px 16px 0; }
`;
const FindingsList = styled.ul`
    display: grid;
    gap: 12px;
    margin: 16px 0 18px;
    padding: 0;
    list-style: none;
`;
const Finding = styled.li`
    padding: 15px 16px;
    border: 1px solid #edf0f4;
    border-radius: 8px;
    background: #fcfcfd;
`;
const FindingHeader = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px 14px;
`;
const FindingTitle = styled.h4`
    flex: 1 1 220px;
    margin: 0;
    color: #344054;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.6;
`;
const Timestamp = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    border: 1px solid #e4e9f0;
    border-radius: 5px;
    background: #fff;
    color: #667085;
    font-size: 11px;
    line-height: 1.5;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
`;
const FindingReason = styled.p`
    margin: 7px 0 0;
    color: #667085;
    font-size: 13px;
    line-height: 1.75;
    overflow-wrap: anywhere;
`;
const Excerpt = styled.blockquote`
    margin: 12px 0 0;
    padding: 10px 12px;
    border: 0;
    background: #f2f4f7;
    color: #475467;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;
const ExcerptLabel = styled.span`
    display: block;
    margin-bottom: 4px;
    color: #667085;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .04em;
    text-transform: uppercase;
`;
const Acknowledgement = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 13px 0;
    border-top: 1px solid #edf0f4;
    color: #667085;
    font-size: 12px;
    line-height: 1.6;
    time { color: #475467; font-weight: 500; }
`;
