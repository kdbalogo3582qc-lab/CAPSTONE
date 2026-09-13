import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import styled, { keyframes } from "styled-components";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import ApiUrl from "../config/LocalConfigApi";
import { useAuth } from "./Login";
import { useNavigate } from "react-router-dom";
import {
    FiActivity, FiAlignLeft, FiBarChart2,
    FiClipboard, FiEye, FiFilm, FiHeart, FiMessageSquare, FiMic,
    FiMoreHorizontal, FiPlay, FiTrash2, FiUsers, FiVideo, FiX
} from "react-icons/fi";
import { HiMenuAlt3 } from "react-icons/hi";
import { CiVideoOn } from "react-icons/ci";
import { CiSearch } from "react-icons/ci";
import Swal from "sweetalert2";

const MAX_STORAGE = 5 * 1024 * 1024 * 1024;

const TAB_KEYS = [
    { id: 1, name: "Summary",          icon: <FiAlignLeft />,      path: "summary.summary.content" },
    { id: 2, name: "Impact",           icon: <FiUsers />,          path: "summary.impact.content" },
    { id: 3, name: "Effectiveness",    icon: <FiActivity />,       path: "summary.advertisement_effectiveness.content" },
    { id: 4, name: "Assessment",       icon: <FiClipboard />,      path: "summary.overall_assessment.content" },
    { id: 5, name: "Audience Emotion", icon: <FiHeart />,          path: "summary.emotional_tone.content" },
    { id: 6, name: "Suggestions",      icon: <FiMessageSquare />,  path: null },
    { id: 7, name: "Analytics",        icon: <FiBarChart2 />,      path: null },
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

const formatVideoName = (videoPath) => {
    if (!videoPath) return "Untitled recording";
    const fileName = String(videoPath).split("/").pop() || videoPath;
    return fileName.replace(/^\d+-/, "");
};

export default function SavedVideos() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [videos, setVideos]             = useState([]);
    const [fetching, setFetching]         = useState(true);
    const [expandedId]                    = useState(null);
    const [activeTab, setActiveTab]       = useState({});
    const [storage, setStorage]           = useState({ used: 0, max: MAX_STORAGE, count: 0 });
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [playingVideo, setPlayingVideo] = useState(null);
    const [searchQuery, setSearchQuery]   = useState("");
    const [sortBy, setSortBy]             = useState("newest");
    const [openMenuId, setOpenMenuId]     = useState(null);
    const [expandedSummaries, setExpandedSummaries] = useState({});

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
            confirmButtonColor: "#2c6edb",
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
            Swal.fire({ icon: "error", title: "Failed to delete", confirmButtonColor: "#2c6edb" });
        }
    };

    const playVideo = (video, videoUrl) => {
        setPlayingVideo({ id: video.id, url: videoUrl, name: formatVideoName(video.video_path) });
        setOpenMenuId(null);
    };

    const openDetails = (video) => {
        navigate(`/saved-videos/${video.id}`, { state: { video } });
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

    const filteredVideos = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const list = [...videos].filter((video) => {
            if (!query) return true;
            const cleanName = formatVideoName(video.video_path).toLowerCase();
            return cleanName.includes(query);
        });

        list.sort((a, b) => {
            if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
            if (sortBy === "largest") return (b.file_size || 0) - (a.file_size || 0);
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return list;
    }, [videos, searchQuery, sortBy]);

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
                <TopRow>
                    <HeaderBlock>
                        <PageTitle>My Recordings</PageTitle>
                        <PageSubtitle>
                            {storage.count} {storage.count === 1 ? "recording" : "recordings"}
                        </PageSubtitle>
                    </HeaderBlock>
                    <ControlsRow>
                        <SearchWrap>
                            <CiSearch size={18} />
                            <SearchInput
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search recordings..."
                            />
                        </SearchWrap>

                        <SortSelect
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="newest">Sort: Newest</option>
                            <option value="oldest">Sort: Oldest</option>
                            <option value="largest">Sort: Largest size</option>
                        </SortSelect>
                    </ControlsRow>
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
                ) : filteredVideos.length === 0 ? (
                    <EmptyState>
                        <EmptyIconRing>
                            <CiVideoOn size={36} />
                        </EmptyIconRing>
                        <EmptyTitle>No matches found</EmptyTitle>
                        <EmptyText>
                            No recording name matches <strong>{searchQuery}</strong>. Try a different keyword.
                        </EmptyText>
                    </EmptyState>
                ) : (
                    <VideoList>
                        {filteredVideos.map((video) => {
                            const analysis = (() => { try { return JSON.parse(video.analysis); } catch { return null; } })();
                            const extra    = (() => { try { return JSON.parse(video.extra_results); } catch { return null; } })();
                            const isOpen   = expandedId === video.id;
                            const currTab  = activeTab[video.id] ?? 1;
                            const currTabMeta = TAB_KEYS.find((tab) => tab.id === currTab);

                            const videoUrl = buildVideoUrl(video.video_path);

                            return (
                                <VideoCard key={video.id} $isOpen={isOpen}>
                                    <CardHeader onClick={() => openDetails(video)}>
                                        <ThumbIconWrap>
                                            <FiVideo size={22} />
                                        </ThumbIconWrap>

                                        <CardMeta>
                                            <CardTitle>{formatVideoName(video.video_path)}</CardTitle>
                                            <CardDateRow>
                                                {formatDate(video.created_at)}
                                                {video.file_size > 0 && (
                                                    <><MetaDot>·</MetaDot>{formatBytes(video.file_size)}</>
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
                                                        playVideo(video, videoUrl);
                                                    }}
                                                >
                                                    <FiPlay size={13} />
                                                    <span>Play</span>
                                                </PlayBtn>
                                            )}
                                            <MoreMenuWrap>
                                                <MoreButton
                                                    type="button"
                                                    aria-label={`More actions for ${formatVideoName(video.video_path)}`}
                                                    aria-expanded={openMenuId === video.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId((current) => current === video.id ? null : video.id);
                                                    }}
                                                >
                                                    <FiMoreHorizontal size={18} />
                                                </MoreButton>
                                                {openMenuId === video.id && (
                                                    <ActionMenu onClick={(e) => e.stopPropagation()}>
                                                        {videoUrl && (
                                                            <MenuAction onClick={() => playVideo(video, videoUrl)}>
                                                                <FiPlay size={15} /> Play
                                                            </MenuAction>
                                                        )}
                                                        <MenuAction onClick={() => openDetails(video)}>
                                                            <FiEye size={15} /> View details
                                                        </MenuAction>
                                                        <MenuAction onClick={(e) => handleDelete(video.id, e)}>
                                                            <FiTrash2 size={15} /> Delete
                                                        </MenuAction>
                                                    </ActionMenu>
                                                )}
                                            </MoreMenuWrap>
                                        </CardActions>
                                    </CardHeader>

                                    {/* Summary preview when collapsed */}
                                    {!isOpen && video.summary && (
                                        <SummaryArea>
                                            <SummaryPreview $expanded={expandedSummaries[video.id]}>{video.summary}</SummaryPreview>
                                            <SummaryToggle
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedSummaries((current) => ({
                                                        ...current,
                                                        [video.id]: !current[video.id],
                                                    }));
                                                }}
                                            >
                                                {expandedSummaries[video.id] ? "Show less" : "Show more"}
                                            </SummaryToggle>
                                        </SummaryArea>
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
                                                                <TabIcon $active={currTab === tab.id}>{tab.icon}</TabIcon>
                                                                {tab.name}
                                                            </TabPill>
                                                        ))}
                                                    </TabsScroll>

                                                    {currTab === 7 ? (
                                                        <AnalyticsBox>
                                                            {/* ── Emotion Detection ── */}
                                                            <AnalyticsPanelLabel>
                                                                <FiMic size={12} style={{ opacity: 0.55 }} />
                                                                Emotion detection
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
                                                                <FiActivity size={12} style={{ opacity: 0.55 }} />
                                                                Speech clarity assessment
                                                            </AnalyticsPanelLabel>

                                                            {analysis.speech_clarity ? (() => {
                                                                const sc = analysis.speech_clarity;
                                                                const score = sc.overall_score ?? 0;
                                                                const scoreColor  = '#2c6edb';
                                                                const scoreBg     = '#eaf2fb';
                                                                const scoreBorder = '#e4e9f0';
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
                                                        <ContentPanel>
                                                            <ContentPanelHeader>
                                                                <ContentPanelTitle>
                                                                    {currTabMeta?.icon}
                                                                    {currTabMeta?.name || "Insights"}
                                                                </ContentPanelTitle>
                                                                <ContentPanelHint>AI Generated Insight</ContentPanelHint>
                                                            </ContentPanelHeader>
                                                            <ContentBox>
                                                                {getTabContent(analysis, currTab)}
                                                            </ContentBox>
                                                        </ContentPanel>
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
const skeletonPulse = keyframes`0%, 100% { opacity: 0.55; } 50% { opacity: 1; }`;

/* ─────────────── Layout ─────────────── */
const PageWrapper = styled.div`
    min-height: 100vh;
    background: #ffffff;
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
    max-width: 1500px;
    animation: ${fadeIn} 0.3s ease;
    @media (max-width: 1024px) { margin-left: 0; padding: 86px 16px 48px; }
`;

/* ─────────────── Top Row ─────────────── */
const TopRow = styled.div`
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 28px; margin-bottom: 24px;
    padding-bottom: 24px; border-bottom: 1px solid #e4e9f0;
    @media (max-width: 760px) { align-items: stretch; flex-direction: column; gap: 18px; }
`;

const HeaderBlock = styled.div`flex: 1; min-width: 200px;`;

const PageTitle = styled.h1`
    font-size: 1.75rem; font-weight: 600; color: #14181f; margin: 0 0 6px;
    letter-spacing: -0.02em;
`;

const PageSubtitle = styled.p`font-size: 0.875rem; color: #6b7280; margin: 0;`;

const ControlsRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: nowrap;
    width: min(100%, 560px);
    @media (max-width: 760px) { width: 100%; }
    @media (max-width: 520px) { align-items: stretch; flex-direction: column; }
`;

const SearchWrap = styled.div`
    height: 40px;
    border: 1px solid #e4e9f0;
    border-radius: 10px;
    background: #ffffff;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #6b7280;
    padding: 0 10px;
    min-width: 220px;
    flex: 1;

    &:focus-within {
        border-color: #2c6edb;
    }
`;

const SearchInput = styled.input`
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: #14181f;
    font-size: 0.85rem;

    &::placeholder {
        color: #6b7280;
    }
`;

const SortSelect = styled.select`
    height: 40px;
    border-radius: 10px;
    border: 1px solid #e4e9f0;
    padding: 0 10px;
    background: #ffffff;
    color: #14181f;
    font-size: 0.82rem;
    min-width: 165px;
`;

/* ─────────────── Empty / Loading ─────────────── */
const EmptyState = styled.div`
    display: flex; flex-direction: column; align-items: center;
    padding: 80px 24px; background: #ffffff; border-radius: 12px;
    border: 1px solid #e4e9f0;
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
    height: 112px;
    background: #f6f9fc;
    border-bottom: 1px solid #e4e9f0;
    animation: ${skeletonPulse} 1.25s ease-in-out infinite;
`;

/* ─────────────── Video List ─────────────── */
const VideoList = styled.div`
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid #e4e9f0;
    border-radius: 12px;
`;

const VideoCard = styled.div`
    background: ${(p) => (p.$isOpen ? "#f6f9fc" : "#ffffff")};
    border-bottom: 1px solid #e4e9f0;
    position: relative;
    &:last-child { border-bottom: none; }
`;

const CardHeader = styled.div`
    display: flex; align-items: center; gap: 14px;
    padding: 20px 22px 8px; cursor: pointer; user-select: none;
`;

const ThumbIconWrap = styled.div`
    width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
    background: #eaf2fb; display: flex; align-items: center;
    justify-content: center; color: #2c6edb;
`;

const CardMeta = styled.div`flex: 1; min-width: 0;`;

const CardTitle = styled.p`
    font-size: 0.9375rem; font-weight: 600; color: #14181f;
    margin: 0 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const CardDateRow = styled.div`
    font-size: 0.78rem; color: #6b7280;
    display: flex; align-items: center; gap: 5px;
`;

const MetaDot = styled.span`color: #b4bbc5; padding: 0 2px;`;

const CardActions = styled.div`display: flex; align-items: center; gap: 8px; flex-shrink: 0;`;

const ToneBadge = styled.span`
    font-size: 0.72rem; font-weight: 500; color: #14181f;
    background: transparent; padding: 4px 10px; border-radius: 999px;
    border: 1px solid #e4e9f0;
    text-transform: capitalize;
    @media (max-width: 640px) { display: none; }
`;

const PlayBtn = styled.button`
    display: flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 8px;
    background: #2c6edb; color: white;
    border: none; cursor: pointer; font-size: 0.8rem; font-weight: 500;
    transition: background 0.2s;
    &:hover { background: #245ebc; }
    span { @media (max-width: 640px) { display: none; } }
`;

const MoreMenuWrap = styled.div`position: relative;`;

const MoreButton = styled.button`
    width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
    background: transparent; color: #6b7280; border: 1px solid transparent;
    border-radius: 8px; cursor: pointer;
    &:hover, &[aria-expanded="true"] { background: #eaf2fb; color: #2c6edb; }
`;

const ActionMenu = styled.div`
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 20;
    min-width: 150px; padding: 5px; background: #ffffff;
    border: 1px solid #e4e9f0; border-radius: 9px;
`;

const MenuAction = styled.button`
    width: 100%; display: flex; align-items: center; gap: 9px;
    padding: 9px 10px; border: none; border-radius: 6px;
    background: transparent; color: #14181f; font-size: 0.8rem;
    text-align: left; cursor: pointer;
    &:hover { background: #eaf2fb; color: #2c6edb; }
`;

const SummaryArea = styled.div`
    padding: 0 150px 20px 78px;
    @media (max-width: 760px) { padding: 4px 22px 20px; }
`;

const SummaryPreview = styled.p`
    font-size: 0.8375rem; color: #6b7280; line-height: 1.65;
    margin: 0; max-width: 760px;
    display: ${(p) => p.$expanded ? "block" : "-webkit-box"};
    -webkit-line-clamp: ${(p) => p.$expanded ? "unset" : "2"};
    -webkit-box-orient: vertical; overflow: hidden;
`;

const SummaryToggle = styled.button`
    border: none; padding: 3px 0 0; background: transparent;
    color: #2c6edb; font-size: 0.78rem; font-weight: 500; cursor: pointer;
    &:hover { text-decoration: underline; }
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
    display: flex; gap: 22px; padding: 0 20px;
    border-bottom: 1px solid #e4e9f0;
    overflow-x: auto; scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
`;

const TabPill = styled.button`
    display: flex; align-items: center; gap: 6px;
    white-space: nowrap; padding: 10px 0 11px; border-radius: 0;
    border: none;
    border-bottom: 2px solid ${(p) => (p.$isActive ? "#2c6edb" : "transparent")};
    background: transparent;
    color: ${(p) => (p.$isActive ? "#14181f" : "#6b7280")};
    font-size: 0.79rem;
    font-weight: ${(p) => (p.$isActive ? "600" : "400")};
    cursor: pointer; transition: all 0.18s;
    &:hover { color: #14181f; }
`;

const TabIcon = styled.span`
    display: flex;
    align-items: center;
    font-size: 0.9rem;
    opacity: ${(p) => (p.$active ? 1 : 0.85)};
`;

const ContentPanel = styled.div`
    margin: 0 20px 20px;
    border-radius: 14px;
    border: 1px solid #dbe3ec;
    background: #ffffff;
    overflow: hidden;
`;

const ContentPanelHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: #f6f9fc;
    border-bottom: 1px solid #e4e9f0;
`;

const ContentPanelTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0f172a;
    font-size: 0.86rem;
    font-weight: 650;
`;

const ContentPanelHint = styled.span`
    font-size: 0.72rem;
    color: #6b7280;
`;

const ContentBox = styled.p`
    margin: 0;
    padding: 16px 16px 18px;
    font-size: 0.93rem;
    font-weight: 380;
    line-height: 1.85;
    color: #334155;
    white-space: pre-wrap;
    background: #ffffff;
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
    font-size: 0.72rem; font-weight: 500; color: #6b7280;
    margin: 0 0 3px;
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
    background: ${p => p.$bg || '#eaf2fb'};
    border: 1px solid ${p => p.$border || '#e4e9f0'};
    border-radius: 4px;
    flex-shrink: 0;
`;

const SVScoreNum = styled.span`
    font-size: 22px;
    font-weight: 500;
    color: ${p => p.$color || '#2c6edb'};
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
    color: ${p => p.$color || '#2c6edb'};
    margin-top: 4px;
    opacity: 0.8;
`;

const SVScoreBarWrap = styled.div`flex: 1; display: flex; flex-direction: column; gap: 5px;`;

const SVScoreBarLabel = styled.span`
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgba(55,65,81,0.55);
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
    background: ${p => p.$color || '#2c6edb'};
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
    border-radius: 3px;
    padding: 2px 7px;
    color: #14181f;
    background: transparent;
    border: 1px solid #e4e9f0;
`;
