import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styled from "styled-components";
import { HiMenuAlt3 } from "react-icons/hi";
import { MdCompareArrows } from "react-icons/md";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import ApiUrl from "../config/LocalConfigApi";
import { useAuth } from "./Login";
import { useNavigate } from "react-router-dom";

const safeJsonParse = (value) => {
    try {
        return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
        return null;
    }
};

const getDeep = (obj, path) => {
    try {
        return path.split(".").reduce((acc, key) => acc?.[key], obj);
    } catch {
        return null;
    }
};

const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const formatVideoName = (videoPath) => {
    if (!videoPath) return "Untitled recording";
    const fileName = String(videoPath).split("/").pop() || videoPath;
    return fileName.replace(/^\d+-/, "");
};

const getMetric = (analysis, key) => {
    const map = {
        clarity: getDeep(analysis, "speech_clarity.overall_score"),
        pace:
            getDeep(analysis, "speech_clarity.speech_pace_wpm") ||
            getDeep(analysis, "audio_analysis.estimated_speaking_rate_wpm"),
        tone: getDeep(analysis, "audio_analysis.inferred_tone"),
        emotion: getDeep(analysis, "emotion_analysis.dominant_emotion"),
    };
    return map[key] ?? null;
};

function CompareRuns() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [runs, setRuns] = useState([]);
    const [isFetching, setIsFetching] = useState(true);
    const [firstRunId, setFirstRunId] = useState("");
    const [secondRunId, setSecondRunId] = useState("");

    useEffect(() => {
        if (!loading && !user) {
            navigate("/");
        }
    }, [loading, user, navigate]);

    useEffect(() => {
        if (!user) return;

        axios
            .get(`${ApiUrl.apiURL}/saved-videos`, { withCredentials: true })
            .then((res) => {
                const prepared = (res.data || []).map((item) => ({
                    ...item,
                    parsedAnalysis: safeJsonParse(item.analysis),
                }));
                setRuns(prepared);

                if (prepared.length > 0) setFirstRunId(String(prepared[0].id));
                if (prepared.length > 1) setSecondRunId(String(prepared[1].id));
            })
            .catch(() => {
                setRuns([]);
            })
            .finally(() => setIsFetching(false));
    }, [user]);

    const firstRun = useMemo(
        () => runs.find((item) => String(item.id) === firstRunId) || null,
        [runs, firstRunId]
    );

    const secondRun = useMemo(
        () => runs.find((item) => String(item.id) === secondRunId) || null,
        [runs, secondRunId]
    );

    const firstAnalysis = firstRun?.parsedAnalysis || null;
    const secondAnalysis = secondRun?.parsedAnalysis || null;

    const metricRows = [
        { key: "clarity", label: "Clarity Score", unit: " / 100" },
        { key: "pace", label: "Speaking Pace", unit: " WPM" },
        { key: "tone", label: "Detected Tone", unit: "" },
        { key: "emotion", label: "Dominant Emotion", unit: "" },
    ];

    const getSummaryText = (analysis, path) => getDeep(analysis, path) || "Not available";

    const getDeltaLabel = (left, right) => {
        if (typeof left !== "number" || typeof right !== "number") return "-";
        const diff = right - left;
        if (diff === 0) return "No change";
        return `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;
    };

    return (
        <PageWrapper>
            <Navbar user={user} activePath="/compare-runs" />
            <Leftbar
                isMobileMenuOpen={isMobileSidebarOpen}
                closeMobileMenu={() => setIsMobileSidebarOpen(false)}
            />

            <MobileMenuButton onClick={() => setIsMobileSidebarOpen(true)}>
                <HiMenuAlt3 size={24} />
            </MobileMenuButton>

            <MainContent>
                <ContentWrapper>
                    <HeaderCard>
                        <TitleBlock>
                            <HeaderTitle>Compare Runs</HeaderTitle>
                            <HeaderSubtitle>
                                Compare two saved analyses to see how delivery quality and outcomes changed.
                            </HeaderSubtitle>
                        </TitleBlock>
                        <HeaderIconWrap>
                            <MdCompareArrows size={28} />
                        </HeaderIconWrap>
                    </HeaderCard>

                    <SelectorCard>
                        <SelectorGrid>
                            <SelectorField>
                                <label>Run A</label>
                                <select
                                    value={firstRunId}
                                    onChange={(e) => setFirstRunId(e.target.value)}
                                >
                                    <option value="">Select a run</option>
                                    {runs.map((run) => (
                                        <option key={run.id} value={run.id}>
                                            {formatVideoName(run.video_path)} ({formatDate(run.created_at)})
                                        </option>
                                    ))}
                                </select>
                            </SelectorField>

                            <SelectorField>
                                <label>Run B</label>
                                <select
                                    value={secondRunId}
                                    onChange={(e) => setSecondRunId(e.target.value)}
                                >
                                    <option value="">Select a run</option>
                                    {runs.map((run) => (
                                        <option key={run.id} value={run.id}>
                                            {formatVideoName(run.video_path)} ({formatDate(run.created_at)})
                                        </option>
                                    ))}
                                </select>
                            </SelectorField>
                        </SelectorGrid>
                    </SelectorCard>

                    {isFetching ? (
                        <EmptyState>Loading saved runs...</EmptyState>
                    ) : !firstRun || !secondRun ? (
                        <EmptyState>
                            Select two saved runs to start comparison.
                        </EmptyState>
                    ) : (
                        <>
                            <MetricsCard>
                                <CardHeading>Performance Comparison</CardHeading>
                                <MetricTable>
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            <th>Run A</th>
                                            <th>Run B</th>
                                            <th>Delta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metricRows.map((row) => {
                                            const left = getMetric(firstAnalysis, row.key);
                                            const right = getMetric(secondAnalysis, row.key);
                                            return (
                                                <tr key={row.key}>
                                                    <td>{row.label}</td>
                                                    <td>{left ?? "N/A"}{typeof left === "number" ? row.unit : ""}</td>
                                                    <td>{right ?? "N/A"}{typeof right === "number" ? row.unit : ""}</td>
                                                    <td>{getDeltaLabel(left, right)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </MetricTable>
                            </MetricsCard>

                            <TextCompareGrid>
                                <TextCard>
                                    <h3>Summary</h3>
                                    <p>{getSummaryText(firstAnalysis, "summary.summary.content")}</p>
                                </TextCard>
                                <TextCard>
                                    <h3>Summary</h3>
                                    <p>{getSummaryText(secondAnalysis, "summary.summary.content")}</p>
                                </TextCard>
                                <TextCard>
                                    <h3>Audience Impact</h3>
                                    <p>{getSummaryText(firstAnalysis, "summary.impact.content")}</p>
                                </TextCard>
                                <TextCard>
                                    <h3>Audience Impact</h3>
                                    <p>{getSummaryText(secondAnalysis, "summary.impact.content")}</p>
                                </TextCard>
                            </TextCompareGrid>
                        </>
                    )}
                </ContentWrapper>
            </MainContent>
        </PageWrapper>
    );
}

export default CompareRuns;

const PageWrapper = styled.div`
    min-height: 100vh;
    background: #f9fafb;
`;

const MainContent = styled.main`
    margin-left: 230px;
    margin-top: 68px;
    min-height: calc(100vh - 68px);
    padding: 24px;

    @media (max-width: 1024px) {
        margin-left: 0;
        margin-top: 64px;
        padding: 16px;
    }
`;

const MobileMenuButton = styled.button`
    display: none;

    @media (max-width: 1024px) {
        display: grid;
        place-items: center;
        position: fixed;
        top: 78px;
        left: 16px;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: white;
        color: #1f2937;
        z-index: 60;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    }
`;

const ContentWrapper = styled.div`
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const HeaderCard = styled.section`
    background: linear-gradient(145deg, #ffffff 0%, #f0f9ff 100%);
    border: 1px solid #dbeafe;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const TitleBlock = styled.div``;

const HeaderTitle = styled.h1`
    color: #0f172a;
    font-size: clamp(1.35rem, 2.2vw, 1.75rem);
`;

const HeaderSubtitle = styled.p`
    margin-top: 6px;
    color: #64748b;
    font-size: 0.92rem;
`;

const HeaderIconWrap = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: #0369a1;
    background: #e0f2fe;
`;

const SelectorCard = styled.section`
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 16px;
`;

const SelectorGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 760px) {
        grid-template-columns: 1fr;
    }
`;

const SelectorField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 7px;

    label {
        font-size: 0.82rem;
        color: #334155;
        font-weight: 600;
    }

    select {
        height: 40px;
        border-radius: 10px;
        border: 1px solid #d1d5db;
        background: white;
        color: #0f172a;
        padding: 0 10px;
    }
`;

const MetricsCard = styled.section`
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    overflow: hidden;
`;

const CardHeading = styled.h2`
    padding: 14px 16px;
    border-bottom: 1px solid #eef2f7;
    color: #0f172a;
    font-size: 1rem;
`;

const MetricTable = styled.table`
    width: 100%;
    border-collapse: collapse;

    th,
    td {
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.86rem;
    }

    th {
        color: #64748b;
        font-weight: 600;
        background: #f8fafc;
    }

    td {
        color: #0f172a;
    }
`;

const TextCompareGrid = styled.section`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const TextCard = styled.article`
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 14px;

    h3 {
        color: #0f172a;
        font-size: 0.95rem;
    }

    p {
        margin-top: 8px;
        color: #64748b;
        line-height: 1.6;
        font-size: 0.88rem;
    }
`;

const EmptyState = styled.div`
    background: white;
    border: 1px dashed #cbd5e1;
    border-radius: 14px;
    padding: 28px;
    text-align: center;
    color: #64748b;
`;
