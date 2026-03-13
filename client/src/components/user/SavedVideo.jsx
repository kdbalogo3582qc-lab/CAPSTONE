import React, { useState, useEffect } from "react";
import axios from "axios";
import styled, { keyframes } from "styled-components";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import ApiUrl from "../config/LocalConfigApi";
import { useAuth } from "./Login";
import { useNavigate } from "react-router-dom";
import { MdOutlineFormatLineSpacing, MdOutlineAssessment } from "react-icons/md";
import { FaStreetView } from "react-icons/fa6";
import { BsStars, BsLightbulbFill } from "react-icons/bs";
import { RiEmotionFill } from "react-icons/ri";
import { TbActivityHeartbeat } from "react-icons/tb";
import { FaWaveSquare } from "react-icons/fa";
import { GiMicrophone } from "react-icons/gi";
import {
    FiTrash2, FiChevronDown, FiChevronUp, FiVideo,
    FiHardDrive, FiPlay, FiX, FiClock, FiFilm
} from "react-icons/fi";
import { HiMenuAlt3 } from "react-icons/hi";
import { CiVideoOn } from "react-icons/ci";
import Swal from "sweetalert2";

const MAX_STORAGE = 5 * 1024 * 1024 * 1024;

const TAB_KEYS = [
    { id: 1, name: "Summary",          icon: <MdOutlineFormatLineSpacing />, path: "summary.summary.content" },
    { id: 2, name: "Impact",           icon: <FaStreetView />,               path: "summary.impact.content" },
    { id: 3, name: "Effectiveness",    icon: <BsStars />,                    path: "summary.advertisement_effectiveness.content" },
    { id: 4, name: "Assessment",       icon: <MdOutlineAssessment />,        path: "summary.overall_assessment.content" },
    { id: 5, name: "Audience Emotion", icon: <RiEmotionFill />,              path: "summary.emotional_tone.content" },
    { id: 6, name: "Suggestions",      icon: <BsLightbulbFill />,            path: null },
    { id: 7, name: "Analytics",        icon: <TbActivityHeartbeat />,        path: null },
];

const getDeep = (obj, path) => {
    try { return path.split(".").reduce((o, k) => o?.[k], obj) ?? null; }
    catch { return null; }
};

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });


const buildVideoUrl = (videoPath) => {
    if (!videoPath) return null;
    const base = ApiUrl.apiURL.replace(/\/api\/?$/, "").replace(/\/$/, "");
    return `${base}/${videoPath}`;
};

export default function SavedVideos() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [videos, setVideos]             = useState([]);
    const [fetching, setFetching]         = useState(true);
    const [expandedId, setExpandedId]     = useState(null);
    const [activeTab, setActiveTab]       = useState({});
    const [storage, setStorage]           = useState({ used: 0, max: MAX_STORAGE, count: 0 });
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [playingVideo, setPlayingVideo] = useState(null);

    useEffect(() => { if (!loading && !user) navigate("/"); }, [user, loading, navigate]);

    useEffect(() => {
        if (!user) return;
        Promise.all([
            axios.get(`${ApiUrl.apiURL}/saved-videos`, { withCredentials: true }),
            axios.get(`${ApiUrl.apiURL}/saved-videos/storage`, { withCredentials: true }),
        ])
            .then(([vRes, sRes]) => {
                setVideos(vRes.data);
                setStorage(sRes.data);
            })
            .catch(() => {})
            .finally(() => setFetching(false));
    }, [user]);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        const result = await Swal.fire({
            title: "Delete this recording?",
            text: "This action cannot be undone.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Delete",
        });
        if (!result.isConfirmed) return;

        try {
            await axios.delete(`${ApiUrl.apiURL}/saved-videos/${id}`, { withCredentials: true });
            const removed = videos.find((v) => v.id === id);
            setVideos((prev) => prev.filter((v) => v.id !== id));
            setStorage((prev) => ({
                ...prev,
                used: Math.max(0, prev.used - (removed?.file_size || 0)),
                count: prev.count - 1,
            }));
            if (playingVideo?.id === id) setPlayingVideo(null);
            Swal.fire({ icon: "success", title: "Deleted", timer: 1500, showConfirmButton: false });
        } catch {
            Swal.fire({ icon: "error", title: "Failed to delete", confirmButtonColor: "#ef4444" });
        }
    };

    const toggleExpand = (id) => {
        setExpandedId((prev) => (prev === id ? null : id));
        setActiveTab((prev) => ({ ...prev, [id]: prev[id] ?? 1 }));
    };

    const getTabContent = (analysis, tabId) => {
        const tab = TAB_KEYS.find((t) => t.id === tabId);
        if (!tab || !analysis) return "Not available";

        // Suggestions tab: composed from multiple fields
        if (tabId === 6) {
            const s = analysis?.summary || {};
            const parts = [
                s.summary?.content                         && `Message Clarity:\n${s.summary.content}`,
                s.impact?.content                          && `Audience Impact:\n${s.impact.content}`,
                s.advertisement_effectiveness?.content     && `Effectiveness Improvements:\n${s.advertisement_effectiveness.content}`,
                s.emotional_tone?.content                  && `Emotional Tone Guidance:\n${s.emotional_tone.content}`,
                s.overall_assessment?.content              && `Strengths & Weaknesses:\n${s.overall_assessment.content}`,
            ].filter(Boolean);
            return parts.length > 0 ? parts.join("\n\n") : "Not available";
        }

        // Analytics tab: rendered as structured JSX — return sentinel
        if (tabId === 7) return "__ANALYTICS__";

        if (!tab.path) return "Not available";
        const val = getDeep(analysis, tab.path);
        if (!val) return "Not available";
        if (typeof val === "object") return JSON.stringify(val, null, 2);
        return val;
    };

    const usedPct = Math.min(100, (storage.used / MAX_STORAGE) * 100);
    const storageColor = usedPct > 90 ? "#ef4444" : usedPct > 70 ? "#f97316" : "#0284c7";

    return (
        <PageWrapper>
            <Navbar user={user} />
            <Leftbar
                isMobileMenuOpen={isMobileSidebarOpen}
                closeMobileMenu={() => setIsMobileSidebarOpen(false)}
            />
            <MobileMenuButton onClick={() => setIsMobileSidebarOpen(true)}>
                <HiMenuAlt3 size={24} />
            </MobileMenuButton>

            {/* ── Video Lightbox ── */}
            {playingVideo && (
                <Lightbox onClick={() => setPlayingVideo(null)}>
                    <LightboxInner onClick={(e) => e.stopPropagation()}>
                        <LightboxHeader>
                            <LightboxTitle>
                                <FiFilm size={16} />
                                {playingVideo.name}
                            </LightboxTitle>
                            <CloseBtn onClick={() => setPlayingVideo(null)}>
                                <FiX size={20} />
                            </CloseBtn>
                        </LightboxHeader>
                        <VideoEl src={playingVideo.url} controls autoPlay />
                    </LightboxInner>
                </Lightbox>
            )}

            <MainContent>
                {/* ── Top Row ── */}
                <TopRow>
                    <HeaderBlock>
                        <PageTitle>My Recordings</PageTitle>
                        <PageSubtitle>
                            {storage.count} saved {storage.count === 1 ? "recording" : "recordings"} · click any card to expand analysis
                        </PageSubtitle>
                    </HeaderBlock>

                    {/* ── Storage Widget ── */}
                    <StorageWidget>
                        <StorageTop>
                            <StorageIconWrap>
                                <FiHardDrive size={18} />
                            </StorageIconWrap>
                            <StorageInfo>
                                <StorageLabel>Storage</StorageLabel>
                                <StorageNumbers $color={storageColor}>
                                    {formatBytes(storage.used)}
                                    <span> / 5 GB</span>
                                </StorageNumbers>
                            </StorageInfo>
                        </StorageTop>
                        <StorageBarTrack>
                            <StorageBarFill $pct={usedPct} $color={storageColor} />
                        </StorageBarTrack>
                        <StorageFooter>
                            <span>{formatBytes(MAX_STORAGE - storage.used)} free</span>
                            <span>{usedPct.toFixed(1)}% used</span>
                        </StorageFooter>
                    </StorageWidget>
                </TopRow>

                {/* ── Content ── */}
                {fetching ? (
                    <LoadingGrid>
                        {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
                    </LoadingGrid>
                ) : videos.length === 0 ? (
                    <EmptyState>
                        <EmptyIconRing>
                            <CiVideoOn size={36} />
                        </EmptyIconRing>
                        <EmptyTitle>No recordings yet</EmptyTitle>
                        <EmptyText>
                            Analyze a video on the Home page and click <strong>Save</strong> to store it here.
                        </EmptyText>
                    </EmptyState>
                ) : (
                    <VideoList>
                        {videos.map((video) => {
                            const analysis = (() => { try { return JSON.parse(video.analysis); } catch { return null; } })();
                            const extra    = (() => { try { return JSON.parse(video.extra_results); } catch { return null; } })();
                            const isOpen   = expandedId === video.id;
                            const currTab  = activeTab[video.id] ?? 1;

                            const videoUrl = buildVideoUrl(video.video_path);

                            return (
                                <VideoCard key={video.id} $isOpen={isOpen}>
                                    <CardHeader onClick={() => toggleExpand(video.id)}>
                                        <ThumbIconWrap>
                                            <FiVideo size={22} />
                                        </ThumbIconWrap>

                                        <CardMeta>
                                            <CardTitle>{video.video_path || "Untitled recording"}</CardTitle>
                                            <CardDateRow>
                                                <FiClock size={11} />
                                                {formatDate(video.created_at)}
                                                {video.file_size > 0 && (
                                                    <FileSizeChip>{formatBytes(video.file_size)}</FileSizeChip>
                                                )}
                                            </CardDateRow>
                                        </CardMeta>

                                        <CardActions>
                                            {extra?.tone && <ToneBadge>{extra.tone}</ToneBadge>}
                                            {videoUrl && (
                                                <PlayBtn
                                                    title="Play video"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPlayingVideo({ id: video.id, url: videoUrl, name: video.video_path });
                                                    }}
                                                >
                                                    <FiPlay size={13} />
                                                    <span>Play</span>
                                                </PlayBtn>
                                            )}
                                            <DeleteBtn title="Delete" onClick={(e) => handleDelete(video.id, e)}>
                                                <FiTrash2 size={15} />
                                            </DeleteBtn>
                                            <ChevronWrap>
                                                {isOpen ? <FiChevronUp size={17} /> : <FiChevronDown size={17} />}
                                            </ChevronWrap>
                                        </CardActions>
                                    </CardHeader>

                                    {/* Summary preview when collapsed */}
                                    {!isOpen && video.summary && (
                                        <SummaryPreview>{video.summary}</SummaryPreview>
                                    )}

                                    {/* ── Expanded Analysis ── */}
                                    {isOpen && (
                                        <ExpandedArea>
                                            <ExpandDivider />

                                            {/* Inline video player */}
                                            {videoUrl && (
                                                <InlineVideoWrap>
                                                    <InlineVideo src={videoUrl} controls />
                                                </InlineVideoWrap>
                                            )}

                                            {analysis ? (
                                                <>
                                                    <TabsScroll>
                                                        {TAB_KEYS.map((tab) => (
                                                            <TabPill
                                                                key={tab.id}
                                                                $isActive={currTab === tab.id}
                                                                onClick={() =>
                                                                    setActiveTab((p) => ({ ...p, [video.id]: tab.id }))
                                                                }
                                                            >
                                                                <TabIcon>{tab.icon}</TabIcon>
                                                                {tab.name}
                                                            </TabPill>
                                                        ))}
                                                    </TabsScroll>

                                                    {currTab === 7 ? (
                                                        <AnalyticsBox>
                                                            {/* ── Emotion Detection ── */}
                                                            <AnalyticsPanelLabel>
                                                                <GiMicrophone size={12} style={{ opacity: 0.55 }} />
                                                                SECTION 01 — EMOTION DETECTION
                                                            </AnalyticsPanelLabel>

                                                            {analysis.emotion_analysis ? (() => {
                                                                const ea = analysis.emotion_analysis;
                                                                const emotions = [
                                                                    { key: 'happy',   label: 'Happy'   },
                                                                    { key: 'neutral', label: 'Neutral' },
                                                                    { key: 'nervous', label: 'Nervous' },
                                                                    { key: 'angry',   label: 'Angry'   },
                                                                    { key: 'sad',     label: 'Sad'     },
                                                                ];
                                                                const dominant = ea.dominant_emotion ?? '';
                                                                return (
                                                                    <>
                                                                        <SVEmotionTable>
                                                                            <SVEmotionHead>
                                                                                <tr>
                                                                                    <SVTh>Emotion</SVTh>
                                                                                    <SVTh>Distribution</SVTh>
                                                                                    <SVTh $right>Score</SVTh>
                                                                                    <SVTh $right>Status</SVTh>
                                                                                </tr>
                                                                            </SVEmotionHead>
                                                                            <tbody>
                                                                                {emotions.map(({ key, label }) => {
                                                                                    const pct = Math.round((ea[key] ?? 0) * 100);
                                                                                    const isDom = key === dominant;
                                                                                    return (
                                                                                        <SVEmotionTr key={key} $isDominant={isDom}>
                                                                                            <SVTd><SVEmotionLabel $isDominant={isDom}>{label}</SVEmotionLabel></SVTd>
                                                                                            <SVTd $wide>
                                                                                                <SVBarTrack>
                                                                                                    <SVBarFill $pct={pct} $isDominant={isDom} />
                                                                                                </SVBarTrack>
                                                                                            </SVTd>
                                                                                            <SVTd $right><SVPct $isDominant={isDom}>{pct}%</SVPct></SVTd>
                                                                                            <SVTd $right>
                                                                                                {isDom
                                                                                                    ? <SVDominantTag>Dominant</SVDominantTag>
                                                                                                    : <SVNullTag>—</SVNullTag>
                                                                                                }
                                                                                            </SVTd>
                                                                                        </SVEmotionTr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </SVEmotionTable>
                                                                        <SVFootnote>
                                                                            Dominant emotion: <strong style={{ color: '#1a2332', textTransform: 'capitalize' }}>{dominant || 'N/A'}</strong> · Classified via MFCC, pitch, energy &amp; spectral contrast.
                                                                        </SVFootnote>
                                                                    </>
                                                                );
                                                            })() : (
                                                                <SVNoData>No emotion data recorded for this entry.</SVNoData>
                                                            )}

                                                            {/* ── Speech Clarity ── */}
                                                            <AnalyticsPanelLabel style={{ marginTop: 16 }}>
                                                                <FaWaveSquare size={11} style={{ opacity: 0.55 }} />
                                                                SECTION 02 — SPEECH CLARITY ASSESSMENT
                                                            </AnalyticsPanelLabel>

                                                            {analysis.speech_clarity ? (() => {
                                                                const sc = analysis.speech_clarity;
                                                                const score = sc.overall_score ?? 0;
                                                                const scoreColor  = score >= 80 ? '#166534' : score >= 60 ? '#92400e' : '#991b1b';
                                                                const scoreBg     = score >= 80 ? 'rgba(22,101,52,0.08)'  : score >= 60 ? 'rgba(146,64,14,0.08)'  : 'rgba(153,27,27,0.08)';
                                                                const scoreBorder = score >= 80 ? 'rgba(22,101,52,0.2)'   : score >= 60 ? 'rgba(146,64,14,0.2)'   : 'rgba(153,27,27,0.2)';
                                                                const scoreLabel  = score >= 80 ? 'Excellent' : score >= 60 ? 'Satisfactory' : 'Below Standard';
                                                                return (
                                                                    <>
                                                                        <SVScoreRow>
                                                                            <SVScoreBlock $bg={scoreBg} $border={scoreBorder}>
                                                                                <SVScoreNum $color={scoreColor}>{score}<SVScoreDenom>/100</SVScoreDenom></SVScoreNum>
                                                                                <SVScoreLabel $color={scoreColor}>{scoreLabel}</SVScoreLabel>
                                                                            </SVScoreBlock>
                                                                            <SVScoreBarWrap>
                                                                                <SVScoreBarLabel>Overall Clarity Score</SVScoreBarLabel>
                                                                                <SVScoreBarTrack>
                                                                                    <SVScoreBarFill $pct={score} $color={scoreColor} />
                                                                                </SVScoreBarTrack>
                                                                                <SVScoreBarLegend>
                                                                                    <span>0</span>
                                                                                    <span>Below Standard · &lt;60</span>
                                                                                    <span>Satisfactory · 60–79</span>
                                                                                    <span>Excellent · 80+</span>
                                                                                </SVScoreBarLegend>
                                                                            </SVScoreBarWrap>
                                                                        </SVScoreRow>

                                                                        <SVClarityTable>
                                                                            <SVClarityHead>
                                                                                <tr>
                                                                                    <SVTh>Metric</SVTh>
                                                                                    <SVTh>Value</SVTh>
                                                                                    <SVTh>Indicator</SVTh>
                                                                                    <SVTh $right>Rating</SVTh>
                                                                                </tr>
                                                                            </SVClarityHead>
                                                                            <tbody>
                                                                                {[
                                                                                    {
                                                                                        name: 'Speech Pace',
                                                                                        val: `${sc.speech_pace_wpm ?? 'N/A'}`,
                                                                                        unit: 'WPM',
                                                                                        pct: Math.min((sc.speech_pace_wpm ?? 0) / 200 * 100, 100),
                                                                                        rating: sc.pace_rating,
                                                                                        ratingLabel: sc.pace_rating ?? 'N/A',
                                                                                    },
                                                                                    {
                                                                                        name: 'Filler Words',
                                                                                        val: `${sc.filler_words ?? 0}`,
                                                                                        unit: 'detected',
                                                                                        pct: Math.max(0, 100 - (sc.filler_words ?? 0) * 8),
                                                                                        rating: (sc.filler_words ?? 0) <= 3 ? 'Ideal' : (sc.filler_words ?? 0) <= 8 ? 'Fast' : 'Too Fast',
                                                                                        ratingLabel: (sc.filler_words ?? 0) <= 3 ? 'Low' : (sc.filler_words ?? 0) <= 8 ? 'Moderate' : 'High',
                                                                                    },
                                                                                    {
                                                                                        name: 'Tone Stability',
                                                                                        val: `${sc.tone_stability ?? 'N/A'}`,
                                                                                        unit: '/ 100',
                                                                                        pct: sc.tone_stability ?? 0,
                                                                                        rating: (sc.tone_stability ?? 0) >= 75 ? 'Ideal' : (sc.tone_stability ?? 0) >= 50 ? 'Fast' : 'Too Fast',
                                                                                        ratingLabel: (sc.tone_stability ?? 0) >= 75 ? 'Stable' : (sc.tone_stability ?? 0) >= 50 ? 'Variable' : 'Unstable',
                                                                                    },
                                                                                    {
                                                                                        name: 'Audio Quality',
                                                                                        val: `${sc.audio_quality ?? 'N/A'}`,
                                                                                        unit: '/ 100',
                                                                                        pct: sc.audio_quality ?? 0,
                                                                                        rating: (sc.audio_quality ?? 0) >= 75 ? 'Ideal' : (sc.audio_quality ?? 0) >= 50 ? 'Fast' : 'Too Fast',
                                                                                        ratingLabel: (sc.audio_quality ?? 0) >= 75 ? 'Clear' : (sc.audio_quality ?? 0) >= 50 ? 'Acceptable' : 'Poor',
                                                                                    },
                                                                                ].map(({ name, val, unit, pct, rating, ratingLabel }) => (
                                                                                    <SVClarityTr key={name}>
                                                                                        <SVTd><SVMetricName>{name}</SVMetricName></SVTd>
                                                                                        <SVTd><SVMetricVal>{val} <SVUnit>{unit}</SVUnit></SVMetricVal></SVTd>
                                                                                        <SVTd $wide><SVBarTrack><SVClarityBarFill $pct={pct} /></SVBarTrack></SVTd>
                                                                                        <SVTd $right><SVRatingTag $rating={rating}>{ratingLabel}</SVRatingTag></SVTd>
                                                                                    </SVClarityTr>
                                                                                ))}
                                                                            </tbody>
                                                                        </SVClarityTable>
                                                                        <SVFootnote>
                                                                            Score computed from speech pace, filler word frequency, pitch/energy variance, and spectral signal quality.
                                                                        </SVFootnote>
                                                                    </>
                                                                );
                                                            })() : (
                                                                <SVNoData>No speech clarity data recorded for this entry.</SVNoData>
                                                            )}
                                                        </AnalyticsBox>
                                                    ) : (
                                                        <ContentBox>
                                                            {getTabContent(analysis, currTab)}
                                                        </ContentBox>
                                                    )}

                                                    {extra && (extra.tone || extra.speaking_rate) && (
                                                        <MetricsStrip>
                                                            {extra.tone && (
                                                                <MetricChip>
                                                                    <MetricChipLabel>Tone</MetricChipLabel>
                                                                    <MetricChipValue>{extra.tone}</MetricChipValue>
                                                                </MetricChip>
                                                            )}
                                                            {extra.speaking_rate && (
                                                                <MetricChip>
                                                                    <MetricChipLabel>Speaking Rate</MetricChipLabel>
                                                                    <MetricChipValue>{extra.speaking_rate} WPM</MetricChipValue>
                                                                </MetricChip>
                                                            )}
                                                        </MetricsStrip>
                                                    )}
                                                </>
                                            ) : (
                                                <NoAnalysis>Analysis data is unavailable for this recording.</NoAnalysis>
                                            )}
                                        </ExpandedArea>
                                    )}
                                </VideoCard>
                            );
                        })}
                    </VideoList>
                )}
            </MainContent>
        </PageWrapper>
    );
}

/* ─────────────── Animations ─────────────── */
const fadeIn  = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`;
const shimmer = keyframes`0% { background-position: -600px 0; } 100% { background-position: 600px 0; }`;

/* ─────────────── Layout ─────────────── */
const PageWrapper = styled.div`
    min-height: 100vh;
    background: #f1f5f9;
`;

const MobileMenuButton = styled.button`
    position: fixed; top: 20px; left: 16px; z-index: 50;
    background: white; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 8px; cursor: pointer; display: none; align-items: center; color: #374151;
    @media (max-width: 1024px) { display: flex; }
`;

const MainContent = styled.div`
    margin-left: 256px;
    padding: 96px 36px 60px;
    animation: ${fadeIn} 0.3s ease;
    @media (max-width: 1024px) { margin-left: 0; padding: 86px 16px 48px; }
`;

/* ─────────────── Top Row ─────────────── */
const TopRow = styled.div`
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 24px; margin-bottom: 32px; flex-wrap: wrap;
`;

const HeaderBlock = styled.div`flex: 1; min-width: 200px;`;

const PageTitle = styled.h1`
    font-size: 1.75rem; font-weight: 700; color: #0f172a; margin: 0 0 6px;
    letter-spacing: -0.02em;
`;

const PageSubtitle = styled.p`font-size: 0.875rem; color: #64748b; margin: 0;`;

/* ─────────────── Storage Widget ─────────────── */
const StorageWidget = styled.div`
    background: white; border: 1px solid #e2e8f0;
    border-radius: 16px; padding: 18px 20px;
    min-width: 240px; max-width: 280px; flex-shrink: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
`;

const StorageTop = styled.div`display: flex; align-items: center; gap: 12px; margin-bottom: 12px;`;

const StorageIconWrap = styled.div`
    width: 36px; height: 36px; border-radius: 10px;
    background: #eff6ff; display: flex; align-items: center;
    justify-content: center; color: #0284c7; flex-shrink: 0;
`;

const StorageInfo = styled.div`flex: 1;`;

const StorageLabel = styled.p`
    font-size: 0.7rem; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 2px;
`;

const StorageNumbers = styled.p`
    font-size: 0.9375rem; font-weight: 700; color: ${(p) => p.$color}; margin: 0;
    span { font-weight: 400; color: #94a3b8; font-size: 0.85rem; }
`;

const StorageBarTrack = styled.div`
    height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden;
`;

const StorageBarFill = styled.div`
    height: 100%;
    width: ${(p) => p.$pct}%;
    background: ${(p) => p.$color};
    border-radius: 99px;
    transition: width 0.8s ease, background 0.3s;
`;

const StorageFooter = styled.div`
    display: flex; justify-content: space-between;
    font-size: 0.72rem; color: #94a3b8; margin-top: 8px;
`;

/* ─────────────── Empty / Loading ─────────────── */
const EmptyState = styled.div`
    display: flex; flex-direction: column; align-items: center;
    padding: 80px 24px; background: white; border-radius: 20px;
    border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
`;

const EmptyIconRing = styled.div`
    width: 72px; height: 72px; border-radius: 50%;
    background: #f8fafc; border: 2px dashed #cbd5e1;
    display: flex; align-items: center; justify-content: center;
    color: #94a3b8; margin-bottom: 20px;
`;

const EmptyTitle = styled.p`font-size: 1.0625rem; font-weight: 600; color: #334155; margin: 0 0 8px;`;

const EmptyText = styled.p`
    font-size: 0.875rem; color: #94a3b8; margin: 0;
    text-align: center; max-width: 300px; line-height: 1.6;
    strong { color: #0284c7; font-weight: 600; }
`;

const LoadingGrid = styled.div`display: flex; flex-direction: column; gap: 14px;`;

const SkeletonCard = styled.div`
    height: 84px; border-radius: 16px;
    background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%);
    background-size: 800px 100%;
    animation: ${shimmer} 1.5s infinite;
`;

/* ─────────────── Video List ─────────────── */
const VideoList = styled.div`display: flex; flex-direction: column; gap: 12px;`;

const VideoCard = styled.div`
    background: white;
    border-radius: 16px;
    border: 1px solid ${(p) => (p.$isOpen ? "#bfdbfe" : "#e2e8f0")};
    overflow: hidden;
    padding-bottom: ${(p) => (p.$isOpen ? "0" : "16px")};
    box-shadow: ${(p) => (p.$isOpen ? "0 4px 20px rgba(2,132,199,0.07)" : "0 1px 3px rgba(0,0,0,0.04)")};
    transition: box-shadow 0.2s, border-color 0.2s;
    &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-color: #bfdbfe; }
`;

const CardHeader = styled.div`
    display: flex; align-items: center; gap: 14px;
    padding: 16px 20px; cursor: pointer; user-select: none;
`;

const ThumbIconWrap = styled.div`
    width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
    background: #eff6ff; display: flex; align-items: center;
    justify-content: center; color: #0284c7;
`;

const CardMeta = styled.div`flex: 1; min-width: 0;`;

const CardTitle = styled.p`
    font-size: 0.9375rem; font-weight: 600; color: #0f172a;
    margin: 0 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const CardDateRow = styled.div`
    font-size: 0.78rem; color: #94a3b8;
    display: flex; align-items: center; gap: 5px;
`;

const FileSizeChip = styled.span`
    background: #f1f5f9; border-radius: 4px; padding: 1px 6px;
    font-size: 0.72rem; color: #64748b; font-weight: 500;
`;

const CardActions = styled.div`display: flex; align-items: center; gap: 8px; flex-shrink: 0;`;

const ToneBadge = styled.span`
    font-size: 0.72rem; font-weight: 600; color: #0369a1;
    background: #e0f2fe; padding: 3px 10px; border-radius: 20px;
    text-transform: capitalize;
    @media (max-width: 640px) { display: none; }
`;

const PlayBtn = styled.button`
    display: flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 8px;
    background: #0284c7; color: white;
    border: none; cursor: pointer; font-size: 0.8rem; font-weight: 500;
    transition: background 0.2s;
    &:hover { background: #0369a1; }
    span { @media (max-width: 640px) { display: none; } }
`;

const DeleteBtn = styled.button`
    background: none; border: none; cursor: pointer; color: #94a3b8;
    padding: 7px; border-radius: 8px; display: flex; align-items: center;
    transition: all 0.2s;
    &:hover { color: #ef4444; background: #fef2f2; }
`;

const ChevronWrap = styled.div`color: #94a3b8; display: flex; align-items: center;`;

const SummaryPreview = styled.p`
    font-size: 0.8375rem; color: #64748b; line-height: 1.65;
    padding: 0 20px 16px 80px; margin: 0;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
    @media (max-width: 640px) { padding-left: 20px; }
`;

/* ─────────────── Expanded Area ─────────────── */
const ExpandedArea = styled.div`animation: ${fadeIn} 0.22s ease; padding-bottom: 24px;`;

const ExpandDivider = styled.div`height: 1px; background: #f1f5f9; margin-bottom: 20px;`;

const InlineVideoWrap = styled.div`
    margin: 0 20px 20px;
    border-radius: 12px; overflow: hidden;
    border: 1px solid #e2e8f0; background: #0f172a;
`;

/* ✅ FIX: max-height changed from 360px → 500px */
const InlineVideo = styled.video`width: 100%; max-height: 500px; display: block;`;

const TabsScroll = styled.div`
    display: flex; gap: 8px; padding: 0 20px 16px;
    overflow-x: auto; scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
`;

const TabPill = styled.button`
    display: flex; align-items: center; gap: 6px;
    white-space: nowrap; padding: 7px 14px; border-radius: 8px;
    border: 1px solid ${(p) => (p.$isActive ? "#0284c7" : "#e2e8f0")};
    background: ${(p) => (p.$isActive ? "#eff6ff" : "white")};
    color: ${(p) => (p.$isActive ? "#0284c7" : "#64748b")};
    font-size: 0.8rem;
    font-weight: ${(p) => (p.$isActive ? "600" : "400")};
    cursor: pointer; transition: all 0.18s;
    &:hover { border-color: #0284c7; color: #0284c7; }
`;

const TabIcon = styled.span`display: flex; align-items: center; font-size: 0.9rem;`;

const ContentBox = styled.p`
    margin: 0 20px 20px; padding: 18px 20px;
    font-size: 0.9375rem; font-weight: 300; line-height: 1.8;
    color: #475569; white-space: pre-wrap;
    background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;
`;

const NoAnalysis = styled.p`
    margin: 0 20px; padding: 16px 20px;
    background: #f8fafc; border-radius: 12px;
    font-size: 0.875rem; color: #94a3b8; border: 1px dashed #e2e8f0;
`;

const MetricsStrip = styled.div`display: flex; gap: 10px; flex-wrap: wrap; padding: 0 20px;`;

const MetricChip = styled.div`
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 10px; padding: 10px 16px;
`;

const MetricChipLabel = styled.p`
    font-size: 0.68rem; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 3px;
`;

const MetricChipValue = styled.p`font-size: 0.9375rem; font-weight: 600; color: #0284c7; margin: 0;`;

/* ─────────────── Lightbox ─────────────── */
const Lightbox = styled.div`
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    z-index: 100; display: flex; align-items: center; justify-content: center;
    padding: 24px; animation: ${fadeIn} 0.2s ease;
`;

const LightboxInner = styled.div`
    background: #0f172a; border-radius: 16px; overflow: hidden;
    width: 100%; max-width: 860px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
`;

const LightboxHeader = styled.div`
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.07);
`;

const LightboxTitle = styled.div`
    display: flex; align-items: center; gap: 8px;
    font-size: 0.875rem; font-weight: 500; color: #cbd5e1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: calc(100% - 40px);
`;

const CloseBtn = styled.button`
    background: none; border: none; cursor: pointer; color: #64748b;
    display: flex; align-items: center; padding: 4px; border-radius: 6px;
    transition: color 0.2s; &:hover { color: white; }
`;

const VideoEl = styled.video`width: 100%; max-height: 500px; display: block; background: #000;`;

/* ─────────────── Analytics Tab ─────────────── */

const AnalyticsBox = styled.div`
    margin: 0 20px 20px;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.09);
    border-radius: 10px;
    overflow: hidden;
`;

const AnalyticsPanelLabel = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    background: rgba(0,0,0,0.025);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    font-size: 0.6375rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(30,40,55,0.55);
    text-transform: uppercase;
`;

const SVNoData = styled.p`
    padding: 14px 16px;
    font-size: 0.8125rem;
    color: rgba(107,114,128,0.65);
    margin: 0;
`;

const SVFootnote = styled.p`
    font-size: 0.72rem;
    color: rgba(107,114,128,0.6);
    margin: 0;
    padding: 8px 16px 12px;
    border-top: 1px solid rgba(0,0,0,0.05);
    line-height: 1.5;
`;

/* shared table primitives */
const SVTh = styled.th`
    padding: 7px 14px;
    font-size: 0.6375rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(55,65,81,0.45);
    text-align: ${p => p.$right ? 'right' : 'left'};
    border-bottom: 1px solid rgba(0,0,0,0.06);
    white-space: nowrap;
`;

const SVTd = styled.td`
    padding: 10px 14px;
    vertical-align: middle;
    text-align: ${p => p.$right ? 'right' : 'left'};
    width: ${p => p.$wide ? '38%' : 'auto'};
`;

const SVBarTrack = styled.div`
    height: 5px;
    background: rgba(0,0,0,0.07);
    border-radius: 2px;
    overflow: hidden;
`;

const SVBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: ${p => p.$isDominant ? 'rgba(2,132,199,0.7)' : 'rgba(100,116,139,0.4)'};
    border-radius: 2px;
    transition: width 0.5s ease;
`;

/* emotion table */
const SVEmotionTable = styled.table`width: 100%; border-collapse: collapse;`;
const SVEmotionHead  = styled.thead`background: rgba(0,0,0,0.015);`;

const SVEmotionTr = styled.tr`
    background: ${p => p.$isDominant ? 'rgba(2,132,199,0.04)' : 'transparent'};
    border-left: ${p => p.$isDominant ? '3px solid rgba(2,132,199,0.45)' : '3px solid transparent'};
    &:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.05); }
    &:hover { background: rgba(0,0,0,0.015); }
`;

const SVEmotionLabel = styled.span`
    font-size: 0.8375rem;
    font-weight: ${p => p.$isDominant ? '650' : '500'};
    color: ${p => p.$isDominant ? '#1a2332' : '#374151'};
`;

const SVPct = styled.span`
    font-size: 0.8375rem;
    font-weight: ${p => p.$isDominant ? '700' : '500'};
    color: ${p => p.$isDominant ? '#0369a1' : '#6b7280'};
    font-variant-numeric: tabular-nums;
`;

const SVDominantTag = styled.span`
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(2,132,199,0.85);
    background: rgba(2,132,199,0.1);
    border: 1px solid rgba(2,132,199,0.2);
    border-radius: 3px;
    padding: 2px 6px;
`;

const SVNullTag = styled.span`font-size: 0.875rem; color: rgba(156,163,175,0.55);`;

/* score banner */
const SVScoreRow = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
`;

const SVScoreBlock = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 80px;
    padding: 12px 14px;
    background: ${p => p.$bg || 'rgba(22,101,52,0.08)'};
    border: 1px solid ${p => p.$border || 'rgba(22,101,52,0.2)'};
    border-radius: 4px;
    flex-shrink: 0;
`;

const SVScoreNum = styled.span`
    font-size: 22px;
    font-weight: 500;
    color: ${p => p.$color || '#166534'};
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
`;

const SVScoreDenom = styled.span`
    font-size: 0.8125rem;
    font-weight: 400;
    color: rgba(0,0,0,0.28);
    margin-left: 2px;
`;

const SVScoreLabel = styled.span`
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${p => p.$color || '#166534'};
    margin-top: 4px;
    opacity: 0.8;
`;

const SVScoreBarWrap = styled.div`flex: 1; display: flex; flex-direction: column; gap: 5px;`;

const SVScoreBarLabel = styled.span`
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgba(55,65,81,0.55);
    text-transform: uppercase;
    letter-spacing: 0.05em;
`;

const SVScoreBarTrack = styled.div`
    height: 7px;
    background: rgba(0,0,0,0.07);
    border-radius: 2px;
    overflow: hidden;
`;

const SVScoreBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: ${p => p.$color || '#166534'};
    opacity: 0.7;
    border-radius: 2px;
    transition: width 0.6s ease;
`;

const SVScoreBarLegend = styled.div`
    display: flex;
    justify-content: space-between;
    font-size: 0.625rem;
    color: rgba(107,114,128,0.5);
    font-weight: 500;
`;

/* clarity table */
const SVClarityTable = styled.table`width: 100%; border-collapse: collapse;`;
const SVClarityHead  = styled.thead`background: rgba(0,0,0,0.015);`;

const SVClarityTr = styled.tr`
    &:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.05); }
    &:hover { background: rgba(0,0,0,0.015); }
`;

const SVMetricName = styled.span`font-size: 0.8375rem; font-weight: 500; color: #374151;`;

const SVMetricVal = styled.span`
    font-size: 0.9rem;
    font-weight: 700;
    color: #1a2332;
    font-variant-numeric: tabular-nums;
`;

const SVUnit = styled.span`
    font-size: 0.72rem;
    font-weight: 400;
    color: rgba(107,114,128,0.65);
    margin-left: 2px;
`;

const SVClarityBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: rgba(30,64,175,0.42);
    border-radius: 2px;
    transition: width 0.5s ease;
`;

const SVRatingTag = styled.span`
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 3px;
    padding: 2px 7px;
    color: ${p =>
        p.$rating === 'Ideal'    ? 'rgba(22,101,52,0.9)'  :
        p.$rating === 'Fast'     ? 'rgba(146,64,14,0.9)'  :
        p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.9)'  :
                                   'rgba(55,65,81,0.65)'};
    background: ${p =>
        p.$rating === 'Ideal'    ? 'rgba(22,101,52,0.1)'  :
        p.$rating === 'Fast'     ? 'rgba(146,64,14,0.1)'  :
        p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.1)'  :
                                   'rgba(0,0,0,0.05)'};
    border: 1px solid ${p =>
        p.$rating === 'Ideal'    ? 'rgba(22,101,52,0.2)'  :
        p.$rating === 'Fast'     ? 'rgba(146,64,14,0.2)'  :
        p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.2)'  :
                                   'rgba(0,0,0,0.09)'};
`;