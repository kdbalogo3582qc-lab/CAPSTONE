import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import ApiUrl from "../config/LocalConfigApi"
import styled, { keyframes } from 'styled-components';
import { useAuth } from "./Login";
import { GoTag } from "react-icons/go";
import { FaShareAlt, FaSmile } from "react-icons/fa";
import { FiDownload, FiBookmark, FiRotateCcw, FiCheckCircle, FiLoader } from "react-icons/fi";
import { MdOutlineFormatLineSpacing, MdOutlineAssessment, MdLockOutline } from "react-icons/md";
import { FaStreetView } from "react-icons/fa6";
import { BsStars, BsLightbulbFill } from "react-icons/bs";
import { FaWaveSquare } from "react-icons/fa";
import Rightbar from "./Rightbar.jsx";
import { CiSearch } from "react-icons/ci";
import { RiEmotionFill, RiEmotionNormalFill } from "react-icons/ri";
import { PiSmileySadFill } from "react-icons/pi";
import { HiMenuAlt3 } from "react-icons/hi";
import { GiMicrophone } from "react-icons/gi";
import { TbMoodCrazyHappyFilled, TbActivityHeartbeat } from "react-icons/tb";
import Swal from "sweetalert2";
import { Link, useNavigate } from 'react-router-dom';

// ─── FIX: Set withCredentials globally so ALL axios requests send cookies ─────
axios.defaults.withCredentials = true;

function Home() {
    const { user, loading } = useAuth();

    const [videoFile, setVideoFile] = useState(null);

    const [uploadedVideoPath, setUploadedVideoPathState] = useState(() => {
        try { return localStorage.getItem("home_uploadedVideoPath") || null; } catch { return null; }
    });
    const setUploadedVideoPath = (val) => {
        setUploadedVideoPathState(val);
        try {
            if (val === null) localStorage.removeItem("home_uploadedVideoPath");
            else localStorage.setItem("home_uploadedVideoPath", val);
        } catch {}
    };

    const [uploadedVideoName, setUploadedVideoNameState] = useState(() => {
        try { return localStorage.getItem("home_uploadedVideoName") || null; } catch { return null; }
    });
    const setUploadedVideoName = (val) => {
        setUploadedVideoNameState(val);
        try {
            if (val === null) localStorage.removeItem("home_uploadedVideoName");
            else localStorage.setItem("home_uploadedVideoName", val);
        } catch {}
    };

    const [uploadedFileSize, setUploadedFileSizeState] = useState(() => {
        try { return parseInt(localStorage.getItem("home_uploadedFileSize"), 10) || 0; } catch { return 0; }
    });
    const setUploadedFileSize = (val) => {
        setUploadedFileSizeState(val);
        try {
            if (!val) localStorage.removeItem("home_uploadedFileSize");
            else localStorage.setItem("home_uploadedFileSize", String(val));
        } catch {}
    };

    const [previewURL, setPreviewURL] = useState(() => {
        try {
            const path = localStorage.getItem("home_uploadedVideoPath");
            if (path) {
                const base = ApiUrl.apiURL.replace(/\/api\/?$/, '').replace(/\/$/, '');
                return `${base}/${path}`;
            }
        } catch {}
        return "";
    });
    const [renderLoading, setLoading] = useState(false);
    const [viewVideo, setViewVideo] = useState(() => {
        try { return !!localStorage.getItem("home_uploadedVideoPath"); } catch { return false; }
    });
    const [error, setError] = useState("");

    const [analysisResult, setAnalysisResultState] = useState(() => {
        try {
            const stored = localStorage.getItem("home_analysisResult");
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });
    const setAnalysisResult = (val) => {
        setAnalysisResultState(val);
        try {
            if (val === null) localStorage.removeItem("home_analysisResult");
            else localStorage.setItem("home_analysisResult", JSON.stringify(val));
        } catch {}
    };

    const [date, setDate] = useState(new Date());
    const [formattedDate, setFormattedDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isRightbarCollapsed, setIsRightbarCollapsed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [resetKey, setResetKey] = useState(0);

    const [progressLogs, setProgressLogs] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        if (progressPanelRef.current) {
            progressPanelRef.current.scrollTop = progressPanelRef.current.scrollHeight;
        }
    }, [progressLogs]);

    const navigate = useNavigate();
    const progressPanelRef = useRef(null);

    // ─── FIX: Check loading state before redirecting ──────────────────────────
    useEffect(() => {
        if (!loading && !user) {
            navigate('/');
        }
    }, [user, loading, navigate]);

    const items_nav = [
        { id: 1, name: "Summary", icon: <MdOutlineFormatLineSpacing /> },
        { id: 2, name: "Impact on Audience", icon: <FaStreetView /> },
        { id: 3, name: "Effective Analysis", icon: <BsStars /> },
        { id: 4, name: "Assessment", icon: <MdOutlineAssessment /> },
        { id: 5, name: "Audience Emotion", icon: <RiEmotionFill /> },
        { id: 6, name: "Suggestions", icon: <BsLightbulbFill /> },
        { id: 7, name: "Analytics", icon: <TbActivityHeartbeat /> },
    ];
    const [current_nav, setCurrentNav] = useState(items_nav[0]);

    useEffect(() => {
        setFormattedDate(date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        }));
    }, [date]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVideoFile(file);
            setViewVideo(true);
            setPreviewURL(URL.createObjectURL(file));
            setAnalysisResult(null);
            setUploadedVideoPath(null);
            setUploadedVideoName(null);
            setUploadedFileSize(file.size);
            setError("");
        }
    };

    const handleReset = () => {
        setVideoFile(null);
        setPreviewURL("");
        setViewVideo(false);
        setAnalysisResult(null);
        setUploadedVideoPath(null);
        setUploadedVideoName(null);
        setUploadedFileSize(0);
        setError("");
        setProgressLogs([]);
        setIsStreaming(false);
        setResetKey(k => k + 1);
    };

    const handleSubmit = async () => {
        if (!videoFile) {
            Swal.fire({
                icon: 'warning',
                title: 'No Video Selected',
                text: 'Please select a video file first',
                confirmButtonColor: '#0284c7'
            });
            return;
        }

        setLoading(true);
        setError("");
        setAnalysisResult(null);
        setProgressLogs([]);
        setIsStreaming(true);

        try {
            // ─── Step 1: Upload video ─────────────────────────────────────────
            // FIX: added credentials: "include" to fetch call
            const formData = new FormData();
            formData.append("video", videoFile);
            const uploadRes = await fetch(`${ApiUrl.apiURL}/upload-video`, {
                method: "POST",
                body: formData,
                credentials: "include",  // ← FIX
            });
            const uploadData = await uploadRes.json();
            const videoPath = uploadData.videoPath || uploadData.data?.videoPath;
            if (!videoPath) throw new Error(uploadData.error || "Upload failed");

            setUploadedVideoPath(videoPath);
            setUploadedVideoName(videoFile.name);

            // ─── Step 2: Stream progress via SSE ─────────────────────────────
            // NOTE: EventSource doesn't support credentials, but /process-video-stream
            // doesn't use verifyToken so this is fine as-is.
            await new Promise((resolve, reject) => {
                const url = `${ApiUrl.apiURL}/process-video-stream?videoPath=${encodeURIComponent(videoPath)}`;
                const es = new EventSource(url);

                es.addEventListener("progress", (e) => {
                    const { message } = JSON.parse(e.data);
                    setProgressLogs((prev) => [...prev, message]);
                });

                es.addEventListener("result", (e) => {
                    es.close();
                    const { success, data } = JSON.parse(e.data);
                    if (success && data) {
                        setAnalysisResult(data);
                        resolve(data);
                    } else {
                        reject(new Error("Processing failed"));
                    }
                });

                es.addEventListener("error", (e) => {
                    es.close();
                    try {
                        const { message } = JSON.parse(e.data);
                        reject(new Error(message));
                    } catch {
                        reject(new Error("Processing error. Please try again."));
                    }
                });

                es.onerror = () => {
                    es.close();
                    reject(new Error("Connection lost during processing."));
                };
            });

            Swal.fire({
                icon: 'success',
                title: 'Analysis Complete!',
                text: 'Your video has been analyzed successfully.',
                confirmButtonColor: '#0284c7',
                timer: 2000
            });

        } catch (err) {
            setError(err.message);
            Swal.fire({
                icon: 'error',
                title: 'Processing Failed',
                text: err.message,
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setLoading(false);
            setIsStreaming(false);
        }
    };

    const highlightText = (text, searchQuery) => {
        if (!searchQuery || !text) return text;
        const regex = new RegExp(`(${searchQuery})`, "gi");
        return text.split(regex).map((part, index) =>
            regex.test(part) ? (
                <span key={index} className="bg-yellow-200">{part}</span>
            ) : part
        );
    };

    const getSafeContent = (obj, path, defaultValue = "Content not available") => {
        try {
            const keys = path.split('.');
            let value = obj;
            for (const key of keys) { value = value?.[key]; }
            return value || defaultValue;
        } catch { return defaultValue; }
    };

    // ─── FIX: withCredentials already set globally via axios.defaults ─────────
    const handleSaveVideo = async () => {
        if (!analysisResult || !uploadedVideoPath) return;
        setIsSaving(true);
        try {
            const summary = analysisResult?.summary?.summary?.content || "";
            const response = await axios.post(
                `${ApiUrl.apiURL}/save-video`,
                {
                    video_path: uploadedVideoPath,
                    summary,
                    analysis: analysisResult,
                    extra_results: {
                        tone: analysisResult?.audio_analysis?.inferred_tone || null,
                        speaking_rate: analysisResult?.audio_analysis?.estimated_speaking_rate_wpm || null,
                        audience_emotion: analysisResult?.audience_emotion || null,
                    },
                    file_size: uploadedFileSize || videoFile?.size || 0,
                }
                // withCredentials comes from axios.defaults now — no need to repeat
            );
            if (response.status === 201) {
                Swal.fire({
                    icon: "success",
                    title: "Saved!",
                    text: "Video analysis saved to your recordings.",
                    confirmButtonColor: "#0284c7",
                    timer: 2000,
                });
            }
        } catch (err) {
            Swal.fire({
                icon: "error",
                title: "Save Failed",
                text: err.response?.data?.error || "Could not save the video.",
                confirmButtonColor: "#ef4444",
            });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Show loading spinner while auth state resolves ───────────────────────
    if (loading) {
        return (
            <LoadingScreen>
                <LoadingSpinner />
            </LoadingScreen>
        );
    }

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

            <MainContent $isRightbarCollapsed={isRightbarCollapsed}>
                <ContentWrapper>
                    {!viewVideo ? (
                        <VideoUploadSection>
                            <UploadBox>
                                <input
                                    className="upload-input"
                                    accept="video/*"
                                    name="file"
                                    type="file"
                                    onChange={handleFileChange}
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" strokeLinejoin="round" strokeLinecap="round" viewBox="0 0 24 24" strokeWidth={2} fill="none" stroke="currentColor" className="upload-icon">
                                    <polyline points="16 16 12 12 8 16" />
                                    <line y2={21} x2={12} y1={12} x1={12} />
                                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                                    <polyline points="16 16 12 12 8 16" />
                                </svg>
                            </UploadBox>
                        </VideoUploadSection>
                    ) : (
                        <VideoSection>
                            <VideoPlayer src={previewURL} controls />
                            <VideoInfoCard>
                                <VideoFileName>Selected Video: {videoFile?.name || uploadedVideoName || "video"}</VideoFileName>
                                <ButtonGroup>
                                    <SecondaryButton
                                        onClick={() => {
                                            setViewVideo(false);
                                            setVideoFile(null);
                                            setAnalysisResult(null);
                                            setUploadedVideoPath(null);
                                            setUploadedVideoName(null);
                                            setUploadedFileSize(0);
                                            setError("");
                                        }}
                                        disabled={isStreaming}
                                    >
                                        Remove
                                    </SecondaryButton>
                                    <PrimaryButton
                                        onClick={handleSubmit}
                                        disabled={renderLoading || isStreaming || !videoFile}
                                        title={!videoFile ? "Re-upload your video to analyze again" : ""}
                                    >
                                        {isStreaming ? "Processing..." : renderLoading ? "Uploading..." : "Analyze Video"}
                                    </PrimaryButton>
                                </ButtonGroup>
                            </VideoInfoCard>
                        </VideoSection>
                    )}

                    {error && (
                        <ErrorMessage>
                            <strong>Error:</strong> {error}
                        </ErrorMessage>
                    )}

                    {(isStreaming || progressLogs.length > 0) && !analysisResult && (
                        <ProgressPanel>
                            <ProgressHeader>
                                <ProgressTitle>
                                    {isStreaming ? (
                                        <>
                                            <SpinIcon><FiLoader size={16} /></SpinIcon>
                                            Analyzing your video…
                                        </>
                                    ) : (
                                        <>
                                            <FiCheckCircle size={16} style={{ color: '#22c55e' }} />
                                            Processing complete
                                        </>
                                    )}
                                </ProgressTitle>
                            </ProgressHeader>
                            <ProgressSteps ref={progressPanelRef}>
                                {progressLogs.map((msg, i) => (
                                    <ProgressStep key={i} $done={true}>
                                        <StepDot $done={true} />
                                        <StepText>{msg}</StepText>
                                    </ProgressStep>
                                ))}
                                {isStreaming && (
                                    <ProgressStep $done={false}>
                                        <StepDotPulse />
                                        <StepText $muted>Processing…</StepText>
                                    </ProgressStep>
                                )}
                            </ProgressSteps>
                        </ProgressPanel>
                    )}

                    {analysisResult && (
                        <ResultsSection>
                            <ResultsHeader>
                                <SearchBar>
                                    <CiSearch className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search in results..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </SearchBar>
                                <ActionButtons>
                                    <ActionButton title="Tag"><GoTag size={18} /></ActionButton>
                                    <ActionButton title="Share"><FaShareAlt size={16} /></ActionButton>
                                    <ActionButton title="Download"><FiDownload size={18} /></ActionButton>
                                    <SaveButton
                                        title="Save to Recordings"
                                        onClick={handleSaveVideo}
                                        disabled={isSaving}
                                    >
                                        <FiBookmark size={18} />
                                        {isSaving ? "Saving..." : "Save"}
                                    </SaveButton>
                                    <ResetButton title="Reset" onClick={handleReset}>
                                        <FiRotateCcw size={15} />
                                        Reset
                                    </ResetButton>
                                </ActionButtons>
                            </ResultsHeader>

                            <TabsContainer>
                                <TabsScrollWrapper>
                                    {items_nav.map((item) => (
                                        <Tab
                                            key={item.id}
                                            $isActive={current_nav.id === item.id}
                                            onClick={() => setCurrentNav(item)}
                                        >
                                            <TabIcon>{item.icon}</TabIcon>
                                            <TabText>{item.name}</TabText>
                                        </Tab>
                                    ))}
                                </TabsScrollWrapper>
                            </TabsContainer>

                            <ContentCard>
                                {/* ── Tab 1: Summary ── */}
                                {current_nav.id === 1 && (
                                    <ContentSection>
                                        <ContentTitle>
                                            {highlightText(getSafeContent(analysisResult, 'summary.summary.title', 'Summary'), searchQuery)}
                                        </ContentTitle>
                                        <ContentText>
                                            {highlightText(getSafeContent(analysisResult, 'summary.summary.content', 'No summary available'), searchQuery)}
                                        </ContentText>

                                        <ContentTitle style={{ marginTop: '32px' }}>
                                            {highlightText('Original Transcript', searchQuery)}
                                        </ContentTitle>
                                        <ContentText>
                                            {highlightText(analysisResult.transcript || 'No transcript available', searchQuery)}
                                        </ContentText>

                                        {analysisResult.translated_transcript &&
                                            analysisResult.translated_transcript !== analysisResult.transcript && (
                                                <>
                                                    <ContentTitle style={{ marginTop: '32px' }}>
                                                        {highlightText('Translated Transcript (English)', searchQuery)}
                                                    </ContentTitle>
                                                    <ContentText>
                                                        {highlightText(analysisResult.translated_transcript, searchQuery)}
                                                    </ContentText>
                                                </>
                                            )}
                                    </ContentSection>
                                )}

                                {/* ── Tab 2: Impact on Audience ── */}
                                {current_nav.id === 2 && (
                                    <ContentSection>
                                        <ContentTitle>
                                            {highlightText(getSafeContent(analysisResult, 'summary.impact.title', 'Impact on Audience'), searchQuery)}
                                        </ContentTitle>
                                        <ContentText>
                                            {highlightText(getSafeContent(analysisResult, 'summary.impact.content', 'No impact analysis available'), searchQuery)}
                                        </ContentText>
                                    </ContentSection>
                                )}

                                {/* ── Tab 3: Advertisement Effectiveness ── */}
                                {current_nav.id === 3 && (
                                    <ContentSection>
                                        <ContentTitle>
                                            {highlightText(getSafeContent(analysisResult, 'summary.advertisement_effectiveness.title', 'Advertisement Effectiveness'), searchQuery)}
                                        </ContentTitle>
                                        <ContentText>
                                            {highlightText(getSafeContent(analysisResult, 'summary.advertisement_effectiveness.content', 'No effectiveness analysis available'), searchQuery)}
                                        </ContentText>

                                        <ContentTitle style={{ marginTop: '32px' }}>
                                            {highlightText(getSafeContent(analysisResult, 'summary.audio_appeal.title', 'Audio Appeal'), searchQuery)}
                                        </ContentTitle>
                                        <ContentText>
                                            {highlightText(getSafeContent(analysisResult, 'summary.audio_appeal.content', 'No audio analysis available'), searchQuery)}
                                        </ContentText>

                                        {analysisResult.audio_analysis && (
                                            <>
                                                <AudioMetricsBadge>
                                                    <FaWaveSquare style={{ marginRight: 6 }} /> Audio Signal Metrics
                                                </AudioMetricsBadge>
                                                <VisualMetricsGrid>
                                                    <MetricCard>
                                                        <MetricLabel>Avg Pitch</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.avg_pitch_hz ?? 'N/A'} <MetricUnit>Hz</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Pitch Variability</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.pitch_variability ?? 'N/A'} <MetricUnit>Hz</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Avg Energy</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.avg_energy_db ?? 'N/A'} <MetricUnit>dBFS</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Speaking Rate</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.estimated_speaking_rate_wpm ?? 'N/A'} <MetricUnit>WPM</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Tempo</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.tempo_bpm ?? 'N/A'} <MetricUnit>BPM</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Inferred Tone</MetricLabel>
                                                        <ToneBadge>{analysisResult.audio_analysis.inferred_tone ?? 'N/A'}</ToneBadge>
                                                    </MetricCard>
                                                </VisualMetricsGrid>
                                            </>
                                        )}
                                    </ContentSection>
                                )}

                                {/* ── Tab 4: Overall Assessment ── */}
                                {current_nav.id === 4 && (
                                    <ContentSection>
                                        <ContentTitle>
                                            {highlightText(getSafeContent(analysisResult, 'summary.overall_assessment.title', 'Overall Assessment'), searchQuery)}
                                        </ContentTitle>
                                        <ContentText>
                                            {highlightText(getSafeContent(analysisResult, 'summary.overall_assessment.content', 'No assessment available'), searchQuery)}
                                        </ContentText>

                                        <ContentTitle style={{ marginTop: '32px' }}>
                                            {highlightText(getSafeContent(analysisResult, 'summary.emotional_tone.title', 'Emotional Tone'), searchQuery)}
                                        </ContentTitle>
                                        <ContentText>
                                            {highlightText(getSafeContent(analysisResult, 'summary.emotional_tone.content', 'No emotional analysis available'), searchQuery)}
                                        </ContentText>

                                        {analysisResult.audio_analysis && (
                                            <>
                                                <ContentTitle style={{ marginTop: '32px' }}>Audio Metrics</ContentTitle>
                                                <VisualMetricsGrid>
                                                    <MetricCard>
                                                        <MetricLabel>Avg Pitch</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.avg_pitch_hz ?? 'N/A'} <MetricUnit>Hz</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Energy</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.avg_energy_db ?? 'N/A'} <MetricUnit>dBFS</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Speaking Rate</MetricLabel>
                                                        <MetricValue>{analysisResult.audio_analysis.estimated_speaking_rate_wpm ?? 'N/A'} <MetricUnit>WPM</MetricUnit></MetricValue>
                                                    </MetricCard>
                                                    <MetricCard>
                                                        <MetricLabel>Silence Ratio</MetricLabel>
                                                        <MetricValue>
                                                            {analysisResult.audio_analysis.silence_ratio != null
                                                                ? (analysisResult.audio_analysis.silence_ratio * 100).toFixed(1) + '%'
                                                                : 'N/A'}
                                                        </MetricValue>
                                                    </MetricCard>
                                                </VisualMetricsGrid>
                                            </>
                                        )}
                                    </ContentSection>
                                )}

                                {/* ── Tab 5: Audience Emotions ── */}
                                {current_nav.id === 5 && (
                                    <ContentSection>
                                        <ContentTitle>
                                            {highlightText(
                                                getSafeContent(analysisResult, 'summary.viewer_emotions.title', '') ||
                                                getSafeContent(analysisResult, 'summary.listener_emotions.title', 'Listener Emotions'),
                                                searchQuery
                                            )}
                                        </ContentTitle>

                                        {(() => {
                                            const emotionsData =
                                                analysisResult.summary?.viewer_emotions ||
                                                analysisResult.summary?.listener_emotions;
                                            const raw = emotionsData?.content;

                                            if (typeof raw === 'string') {
                                                return <ContentText>{highlightText(raw, searchQuery)}</ContentText>;
                                            }

                                            if (raw && typeof raw === 'object') {
                                                const normalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
                                                const emotionIcons = {
                                                    'Happy':   <FaSmile className="emotion-icon happy" />,
                                                    'Neutral': <RiEmotionNormalFill className="emotion-icon neutral" />,
                                                    'Excited': <TbMoodCrazyHappyFilled className="emotion-icon excited" />,
                                                    'Sad':     <PiSmileySadFill className="emotion-icon sad" />,
                                                };
                                                const defaultEmotions = { Happy: '0%', Sad: '0%', Excited: '0%', Neutral: '0%' };
                                                const normalized = Object.fromEntries(
                                                    Object.entries(raw).map(([k, v]) => [normalize(k), v])
                                                );
                                                const merged = { ...defaultEmotions, ...normalized };
                                                return (
                                                    <EmotionsGrid>
                                                        {Object.entries(merged).map(([emotion, percentage]) => (
                                                            <EmotionCard key={emotion}>
                                                                {emotionIcons[emotion] || <RiEmotionFill className="emotion-icon" />}
                                                                <EmotionLabel>{emotion}</EmotionLabel>
                                                                <EmotionValue>{percentage}</EmotionValue>
                                                            </EmotionCard>
                                                        ))}
                                                    </EmotionsGrid>
                                                );
                                            }

                                            return (
                                                <EmotionsGrid>
                                                    {['Happy', 'Excited', 'Neutral', 'Sad'].map((emotion) => {
                                                        const emotionIcons = {
                                                            'Happy':   <FaSmile className="emotion-icon happy" />,
                                                            'Neutral': <RiEmotionNormalFill className="emotion-icon neutral" />,
                                                            'Excited': <TbMoodCrazyHappyFilled className="emotion-icon excited" />,
                                                            'Sad':     <PiSmileySadFill className="emotion-icon sad" />,
                                                        };
                                                        return (
                                                            <EmotionCard key={emotion}>
                                                                {emotionIcons[emotion]}
                                                                <EmotionLabel>{emotion}</EmotionLabel>
                                                                <EmotionValue>—</EmotionValue>
                                                            </EmotionCard>
                                                        );
                                                    })}
                                                </EmotionsGrid>
                                            );
                                        })()}

                                        {(() => {
                                            const emotionsData =
                                                analysisResult.summary?.viewer_emotions ||
                                                analysisResult.summary?.listener_emotions;
                                            const reason = emotionsData?.reason;
                                            if (!reason) return null;
                                            return (
                                                <ReasoningSection>
                                                    <ContentTitle>Emotion Analysis</ContentTitle>
                                                    {Object.entries(reason).map(([emotion, text]) => {
                                                        const label = emotion.charAt(0).toUpperCase() + emotion.slice(1).toLowerCase();
                                                        return (
                                                            <ReasonItem key={emotion}>
                                                                <strong>{label}:</strong> {highlightText(
                                                                    typeof text === 'string' ? text : JSON.stringify(text),
                                                                    searchQuery
                                                                )}
                                                            </ReasonItem>
                                                        );
                                                    })}
                                                </ReasoningSection>
                                            );
                                        })()}
                                    </ContentSection>
                                )}

                                {/* ── Tab 6: Suggestions ── */}
                                {current_nav.id === 6 && (
                                    <ContentSection>
                                        <AnalyticsHeader>
                                            <AnalyticsHeaderTitle>Content & Delivery Recommendations</AnalyticsHeaderTitle>
                                            <AnalyticsHeaderSub>Derived from transcript analysis · Audio metrics · Message evaluation</AnalyticsHeaderSub>
                                        </AnalyticsHeader>

                                        <AnalyticsPanel>
                                            <AnalyticsPanelLabel>
                                                <BsLightbulbFill size={11} style={{ opacity: 0.55 }} />
                                                CONTENT FINDINGS — 5 ITEMS
                                            </AnalyticsPanelLabel>
                                            <SuggestionTable>
                                                <tbody>
                                                    {[
                                                        { num: '01', category: 'Message Clarity',          tag: 'Summary',       content: getSafeContent(analysisResult, 'summary.summary.content', 'No summary available') },
                                                        { num: '02', category: 'Audience Impact',           tag: 'Impact',        content: getSafeContent(analysisResult, 'summary.impact.content', 'No impact analysis available') },
                                                        { num: '03', category: 'Effectiveness Improvements',tag: 'Effectiveness', content: getSafeContent(analysisResult, 'summary.advertisement_effectiveness.content', 'No effectiveness analysis available') },
                                                        { num: '04', category: 'Emotional Tone',            tag: 'Tone',          content: getSafeContent(analysisResult, 'summary.emotional_tone.content', 'No emotional analysis available') },
                                                        { num: '05', category: 'Strengths & Weaknesses',    tag: 'Assessment',    content: getSafeContent(analysisResult, 'summary.overall_assessment.content', 'No assessment available') },
                                                    ].map(({ num, category, tag, content }) => (
                                                        <SuggestionTr key={num}>
                                                            <SuggestionNumTd>{num}</SuggestionNumTd>
                                                            <SuggestionCategoryTd>
                                                                <SuggestionCategoryName>{category}</SuggestionCategoryName>
                                                                <SuggestionTag>{tag}</SuggestionTag>
                                                            </SuggestionCategoryTd>
                                                            <SuggestionContentTd>{highlightText(content, searchQuery)}</SuggestionContentTd>
                                                        </SuggestionTr>
                                                    ))}
                                                </tbody>
                                            </SuggestionTable>
                                        </AnalyticsPanel>

                                        {analysisResult.audio_analysis && (
                                            <AnalyticsPanel>
                                                <AnalyticsPanelLabel>
                                                    <FaWaveSquare size={11} style={{ opacity: 0.55 }} />
                                                    SUPPLEMENTARY — AUDIO DELIVERY
                                                </AnalyticsPanelLabel>
                                                <AudioDeliveryRow>
                                                    <AudioDeliveryItem>
                                                        <AudioDeliveryLabel>Inferred Tone</AudioDeliveryLabel>
                                                        <AudioDeliveryValue>{analysisResult.audio_analysis.inferred_tone ?? 'N/A'}</AudioDeliveryValue>
                                                    </AudioDeliveryItem>
                                                    <AudioDeliveryDivider />
                                                    <AudioDeliveryItem>
                                                        <AudioDeliveryLabel>Speaking Rate</AudioDeliveryLabel>
                                                        <AudioDeliveryValue>{analysisResult.audio_analysis.estimated_speaking_rate_wpm ?? 'N/A'} <AudioDeliveryUnit>WPM</AudioDeliveryUnit></AudioDeliveryValue>
                                                    </AudioDeliveryItem>
                                                    <AudioDeliveryDivider />
                                                    <AudioDeliveryItem>
                                                        <AudioDeliveryLabel>Pitch Variability</AudioDeliveryLabel>
                                                        <AudioDeliveryValue>
                                                            {analysisResult.audio_analysis.pitch_variability > 60 ? 'High — expressive' : 'Steady — controlled'}
                                                        </AudioDeliveryValue>
                                                    </AudioDeliveryItem>
                                                </AudioDeliveryRow>
                                            </AnalyticsPanel>
                                        )}
                                    </ContentSection>
                                )}

                                {/* ── Tab 7: Analytics ── */}
                                {current_nav.id === 7 && (
                                    <ContentSection>
                                        <AnalyticsHeader>
                                            <AnalyticsHeaderTitle>Voice Analytics Report</AnalyticsHeaderTitle>
                                            <AnalyticsHeaderSub>Acoustic analysis · Emotion classification · Speech quality assessment</AnalyticsHeaderSub>
                                        </AnalyticsHeader>

                                        {/* Emotion Detection */}
                                        <AnalyticsPanel>
                                            <AnalyticsPanelLabel>
                                                <GiMicrophone size={13} style={{ opacity: 0.55 }} />
                                                SECTION 01 — EMOTION DETECTION
                                            </AnalyticsPanelLabel>

                                            {analysisResult.emotion_analysis ? (() => {
                                                const ea = analysisResult.emotion_analysis;
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
                                                        <EmotionTable>
                                                            <EmotionTableHead>
                                                                <tr>
                                                                    <EmotionTh>Emotion</EmotionTh>
                                                                    <EmotionTh>Distribution</EmotionTh>
                                                                    <EmotionTh $right>Score</EmotionTh>
                                                                    <EmotionTh $right>Status</EmotionTh>
                                                                </tr>
                                                            </EmotionTableHead>
                                                            <tbody>
                                                                {emotions.map(({ key, label }) => {
                                                                    const val = ea[key] ?? 0;
                                                                    const pct = Math.round(val * 100);
                                                                    const isDominant = key === dominant;
                                                                    return (
                                                                        <EmotionTr key={key} $isDominant={isDominant}>
                                                                            <EmotionTd>
                                                                                <EmotionLabelCell $isDominant={isDominant}>{label}</EmotionLabelCell>
                                                                            </EmotionTd>
                                                                            <EmotionTd $wide>
                                                                                <EmotionBarTrack>
                                                                                    <EmotionBarFill $pct={pct} $isDominant={isDominant} />
                                                                                </EmotionBarTrack>
                                                                            </EmotionTd>
                                                                            <EmotionTd $right>
                                                                                <EmotionPct $isDominant={isDominant}>{pct}%</EmotionPct>
                                                                            </EmotionTd>
                                                                            <EmotionTd $right>
                                                                                {isDominant
                                                                                    ? <EmotionDominantTag>Dominant</EmotionDominantTag>
                                                                                    : <EmotionNullTag>—</EmotionNullTag>}
                                                                            </EmotionTd>
                                                                        </EmotionTr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </EmotionTable>
                                                        <AnalyticsFootnote>
                                                            Dominant emotion classified as <strong style={{ color: '#1d2939', textTransform: 'capitalize' }}>{dominant || 'N/A'}</strong> based on MFCC, pitch, energy, and spectral contrast features.
                                                        </AnalyticsFootnote>
                                                    </>
                                                );
                                            })() : (
                                                <AnalyticsEmpty>No emotion data available.</AnalyticsEmpty>
                                            )}
                                        </AnalyticsPanel>

                                        {/* Speech Clarity */}
                                        <AnalyticsPanel>
                                            <AnalyticsPanelLabel>
                                                <FaWaveSquare size={11} style={{ opacity: 0.55 }} />
                                                SECTION 02 — SPEECH CLARITY ASSESSMENT
                                            </AnalyticsPanelLabel>

                                            {analysisResult.speech_clarity ? (() => {
                                                const sc = analysisResult.speech_clarity;
                                                const score = sc.overall_score ?? 0;
                                                const scoreColor  = score >= 80 ? '#166534' : score >= 60 ? '#92400e' : '#991b1b';
                                                const scoreBg     = score >= 80 ? 'rgba(22,101,52,0.08)' : score >= 60 ? 'rgba(146,64,14,0.08)' : 'rgba(153,27,27,0.08)';
                                                const scoreBorder = score >= 80 ? 'rgba(22,101,52,0.2)' : score >= 60 ? 'rgba(146,64,14,0.2)' : 'rgba(153,27,27,0.2)';
                                                const scoreLabel  = score >= 80 ? 'Excellent' : score >= 60 ? 'Satisfactory' : 'Below Standard';
                                                return (
                                                    <>
                                                        <OverallScoreRow>
                                                            <OverallScoreBlock $bg={scoreBg} $border={scoreBorder}>
                                                                <OverallScoreNum $color={scoreColor}>{score}<OverallScoreDenom>/100</OverallScoreDenom></OverallScoreNum>
                                                                <OverallScoreLabel $color={scoreColor}>{scoreLabel}</OverallScoreLabel>
                                                            </OverallScoreBlock>
                                                            <OverallScoreBar>
                                                                <OverallScoreBarLabel>Overall Clarity Score</OverallScoreBarLabel>
                                                                <OverallScoreBarTrack>
                                                                    <OverallScoreBarFill $pct={score} $color={scoreColor} />
                                                                </OverallScoreBarTrack>
                                                                <OverallScoreBarLegend>
                                                                    <span>0</span>
                                                                    <span>Below Standard · &lt;60</span>
                                                                    <span>Satisfactory · 60–79</span>
                                                                    <span>Excellent · 80+</span>
                                                                </OverallScoreBarLegend>
                                                            </OverallScoreBar>
                                                        </OverallScoreRow>

                                                        <ClarityTable>
                                                            <ClarityTableHead>
                                                                <tr>
                                                                    <ClarityTh>Metric</ClarityTh>
                                                                    <ClarityTh>Value</ClarityTh>
                                                                    <ClarityTh>Indicator</ClarityTh>
                                                                    <ClarityTh $right>Rating</ClarityTh>
                                                                </tr>
                                                            </ClarityTableHead>
                                                            <tbody>
                                                                <ClarityTr>
                                                                    <ClarityTd><ClarityMetricName>Speech Pace</ClarityMetricName></ClarityTd>
                                                                    <ClarityTd><ClarityMetricVal>{sc.speech_pace_wpm ?? 'N/A'} <ClarityUnit>WPM</ClarityUnit></ClarityMetricVal></ClarityTd>
                                                                    <ClarityTd $wide><ClarityBarTrack><ClarityBarFill $pct={Math.min((sc.speech_pace_wpm ?? 0) / 200 * 100, 100)} /></ClarityBarTrack></ClarityTd>
                                                                    <ClarityTd $right><ClarityRatingTag $rating={sc.pace_rating}>{sc.pace_rating ?? 'N/A'}</ClarityRatingTag></ClarityTd>
                                                                </ClarityTr>
                                                                <ClarityTr>
                                                                    <ClarityTd><ClarityMetricName>Filler Words</ClarityMetricName></ClarityTd>
                                                                    <ClarityTd><ClarityMetricVal>{sc.filler_words ?? 0} <ClarityUnit>detected</ClarityUnit></ClarityMetricVal></ClarityTd>
                                                                    <ClarityTd $wide><ClarityBarTrack><ClarityBarFill $pct={Math.max(0, 100 - (sc.filler_words ?? 0) * 8)} /></ClarityBarTrack></ClarityTd>
                                                                    <ClarityTd $right>
                                                                        <ClarityRatingTag $rating={(sc.filler_words ?? 0) <= 3 ? 'Ideal' : (sc.filler_words ?? 0) <= 8 ? 'Fast' : 'Too Fast'}>
                                                                            {(sc.filler_words ?? 0) <= 3 ? 'Low' : (sc.filler_words ?? 0) <= 8 ? 'Moderate' : 'High'}
                                                                        </ClarityRatingTag>
                                                                    </ClarityTd>
                                                                </ClarityTr>
                                                                <ClarityTr>
                                                                    <ClarityTd><ClarityMetricName>Tone Stability</ClarityMetricName></ClarityTd>
                                                                    <ClarityTd><ClarityMetricVal>{sc.tone_stability ?? 'N/A'} <ClarityUnit>/ 100</ClarityUnit></ClarityMetricVal></ClarityTd>
                                                                    <ClarityTd $wide><ClarityBarTrack><ClarityBarFill $pct={sc.tone_stability ?? 0} /></ClarityBarTrack></ClarityTd>
                                                                    <ClarityTd $right>
                                                                        <ClarityRatingTag $rating={(sc.tone_stability ?? 0) >= 75 ? 'Ideal' : (sc.tone_stability ?? 0) >= 50 ? 'Fast' : 'Too Fast'}>
                                                                            {(sc.tone_stability ?? 0) >= 75 ? 'Stable' : (sc.tone_stability ?? 0) >= 50 ? 'Variable' : 'Unstable'}
                                                                        </ClarityRatingTag>
                                                                    </ClarityTd>
                                                                </ClarityTr>
                                                                <ClarityTr>
                                                                    <ClarityTd><ClarityMetricName>Audio Quality</ClarityMetricName></ClarityTd>
                                                                    <ClarityTd><ClarityMetricVal>{sc.audio_quality ?? 'N/A'} <ClarityUnit>/ 100</ClarityUnit></ClarityMetricVal></ClarityTd>
                                                                    <ClarityTd $wide><ClarityBarTrack><ClarityBarFill $pct={sc.audio_quality ?? 0} /></ClarityBarTrack></ClarityTd>
                                                                    <ClarityTd $right>
                                                                        <ClarityRatingTag $rating={(sc.audio_quality ?? 0) >= 75 ? 'Ideal' : (sc.audio_quality ?? 0) >= 50 ? 'Fast' : 'Too Fast'}>
                                                                            {(sc.audio_quality ?? 0) >= 75 ? 'Clear' : (sc.audio_quality ?? 0) >= 50 ? 'Acceptable' : 'Poor'}
                                                                        </ClarityRatingTag>
                                                                    </ClarityTd>
                                                                </ClarityTr>
                                                            </tbody>
                                                        </ClarityTable>
                                                        <AnalyticsFootnote>
                                                            Score computed from speech pace, filler word frequency, pitch/energy variance, and spectral signal quality.
                                                        </AnalyticsFootnote>
                                                    </>
                                                );
                                            })() : (
                                                <AnalyticsEmpty>No speech clarity data available.</AnalyticsEmpty>
                                            )}
                                        </AnalyticsPanel>
                                    </ContentSection>
                                )}
                            </ContentCard>
                        </ResultsSection>
                    )}
                </ContentWrapper>
            </MainContent>

            <Rightbar
                user={user}
                analysisResult={analysisResult}
                onCollapseChange={setIsRightbarCollapsed}
                isStreaming={isStreaming}
                resetKey={resetKey}
            />
        </PageWrapper>
    );
}

// ─── Styled Components ────────────────────────────────────────────────────────

const spinAnim = keyframes`
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
`;

const dotPulse = keyframes`
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(1.4); opacity: 0.5; }
`;

const fadeSlide = keyframes`
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
`;

const LoadingScreen = styled.div`
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
`;

const LoadingSpinner = styled.div`
    width: 36px;
    height: 36px;
    border: 3px solid #e5e7eb;
    border-top-color: #0284c7;
    border-radius: 50%;
    animation: ${spinAnim} 0.8s linear infinite;
`;

const PageWrapper = styled.div`
    width: 100%;
    min-height: 100vh;
    background: #f9fafb;
    display: flex;
    flex-direction: column;
`;

const MainContent = styled.main`
    flex: 1;
    margin-top: 80px;
    margin-left: 230px;
    margin-right: ${props => props.$isRightbarCollapsed ? '60px' : '400px'};
    padding: 24px;
    min-height: calc(100vh - 80px);
    transition: margin-right 0.3s ease;

    @media (max-width: 1280px) { margin-right: 0; }
    @media (max-width: 768px)  { margin-left: 0; padding: 16px; }
`;

const MobileMenuButton = styled.button`
    display: none;
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 999;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: white;
    border: 1px solid #e5e7eb;
    color: #1f2937;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: all 0.2s;

    &:hover { background: #f9fafb; }
    @media (max-width: 768px) { display: flex; }
`;

const ContentWrapper = styled.div`
    max-width: 1200px;
    margin: 0 auto;
`;

const VideoUploadSection = styled.section`
    margin-bottom: 32px;
`;

const UploadBox = styled.label`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 400px;
    background: white;
    border: 2px dashed #d1d5db;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;

    &:hover { border-color: #0284c7; background: #f0f9ff; }

    .upload-input { position: absolute; width: 0; height: 0; opacity: 0; }
    .upload-icon  { width: 64px; height: 64px; color: #0284c7; margin-bottom: 16px; }

    &::after {
        content: 'Click or drag video file here';
        font-size: 1rem;
        color: #6b7280;
        margin-top: 16px;
    }

    @media (max-width: 640px) {
        min-height: 300px;
        .upload-icon { width: 48px; height: 48px; }
    }
`;

const VideoSection = styled.section`
    margin-bottom: 32px;
`;

const VideoPlayer = styled.video`
    width: 100%;
    max-height: 500px;
    border-radius: 16px;
    background: #000;
    object-fit: contain;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const VideoInfoCard = styled.div`
    margin-top: 16px;
    padding: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;

const VideoFileName = styled.p`
    font-size: 0.9375rem;
    color: #374151;
    margin: 0 0 16px 0;
    font-weight: 500;
`;

const ButtonGroup = styled.div`
    display: flex;
    gap: 12px;
    @media (max-width: 640px) { flex-direction: column; }
`;

const PrimaryButton = styled.button`
    flex: 1;
    padding: 12px 24px;
    background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(2,132,199,0.3);

    &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(2,132,199,0.4); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const SecondaryButton = styled.button`
    flex: 1;
    padding: 12px 24px;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover { background: #f9fafb; border-color: #9ca3af; }
`;

const ErrorMessage = styled.div`
    color: #ef4444;
    margin: 16px 0;
    font-size: 0.875rem;
    padding: 16px;
    background: #fef2f2;
    border-radius: 12px;
    border: 1px solid #fecaca;
    display: flex;
    align-items: center;
    gap: 8px;
    strong { font-weight: 600; }
`;

const ProgressPanel = styled.div`
    margin: 20px 0;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 1px 6px rgba(0,0,0,0.04);
`;

const ProgressHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
    background: #f9fafb;
`;

const ProgressTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1f2937;
`;

const SpinIcon = styled.span`
    display: flex;
    align-items: center;
    color: #0284c7;
    animation: ${spinAnim} 1s linear infinite;
`;

const ProgressSteps = styled.div`
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 200px;
    overflow-y: auto;
    scroll-behavior: smooth;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
`;

const ProgressStep = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    animation: ${fadeSlide} 0.3s ease;
`;

const StepDot = styled.div`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: ${p => p.$done ? '#0284c7' : '#d1d5db'};
`;

const StepDotPulse = styled.div`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #0284c7;
    animation: ${dotPulse} 1s ease-in-out infinite;
`;

const StepText = styled.span`
    font-size: 0.875rem;
    color: ${p => p.$muted ? '#9ca3af' : '#374151'};
    font-weight: ${p => p.$muted ? '400' : '500'};
`;

const ResultsSection = styled.section`
    margin-top: 32px;
`;

const ResultsHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    @media (max-width: 640px) { flex-direction: column; }
`;

const SearchBar = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.04);

    .search-icon { font-size: 1.25rem; color: #9ca3af; flex-shrink: 0; }

    input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 0.875rem;
        color: #1f2937;
        background: transparent;
        &::placeholder { color: #9ca3af; }
    }
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 8px;
    @media (max-width: 640px) { width: 100%; justify-content: flex-end; }
`;

const ActionButton = styled.button`
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;

    &:hover { background: #f9fafb; border-color: #0284c7; color: #0284c7; }
`;

const SaveButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #0284c7;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) { background: #0369a1; }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const ResetButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: white;
    color: #6b7280;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover { background: #fef2f2; color: #ef4444; border-color: #fecaca; }
`;

const TabsContainer = styled.div`
    margin-bottom: 24px;
    background: white;
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    overflow-x: auto;

    &::-webkit-scrollbar { height: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
`;

const TabsScrollWrapper = styled.div`
    display: flex;
    gap: 8px;
    min-width: max-content;
    @media (max-width: 768px) { gap: 6px; }
`;

const Tab = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: ${props => props.$isActive ? 'linear-gradient(135deg, #075985 0%, #0284c7 100%)' : 'transparent'};
    color: ${props => props.$isActive ? 'white' : '#6b7280'};
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover { background: ${props => props.$isActive ? 'linear-gradient(135deg, #075985 0%, #0284c7 100%)' : '#f3f4f6'}; }
    @media (max-width: 768px) { padding: 8px 12px; font-size: 0.8125rem; }
`;

const TabIcon = styled.span`
    display: flex;
    align-items: center;
    font-size: 1.125rem;
    @media (max-width: 768px) { font-size: 1rem; }
`;

const TabText = styled.span`
    @media (max-width: 640px) { display: none; }
`;

const ContentCard = styled.div`
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    @media (min-width: 768px) { padding: 32px; }
`;

const ContentSection = styled.div`width: 100%;`;

const ContentTitle = styled.h2`
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 16px 0;
    @media (min-width: 768px) { font-size: 1.25rem; margin-bottom: 20px; }
`;

const ContentText = styled.p`
    font-size: 0.9375rem;
    font-weight: 300;
    line-height: 1.7;
    color: #6b7280;
    margin: 0 0 24px 0;
    white-space: pre-wrap;
    @media (min-width: 768px) { font-size: 1rem; }
`;

const EmotionsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin: 32px 0;
    @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); gap: 12px; }
`;

const EmotionCard = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
    background: #f9fafb;
    border-radius: 12px;
    text-align: center;
    transition: all 0.2s;

    &:hover { background: #f3f4f6; transform: translateY(-2px); }

    .emotion-icon {
        font-size: 3rem;
        &.happy   { color: #22c55e; }
        &.neutral { color: #eab308; }
        &.excited { color: #3b82f6; }
        &.sad     { color: #ef4444; }
    }

    @media (max-width: 640px) {
        padding: 16px 12px;
        .emotion-icon { font-size: 2.5rem; }
    }
`;

const EmotionLabel = styled.p`
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin: 0;
`;

const EmotionValue = styled.p`
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0;
`;

const ReasoningSection = styled.div`margin-top: 32px;`;

const ReasonItem = styled.p`
    font-size: 0.9375rem;
    font-weight: 300;
    line-height: 1.7;
    color: #6b7280;
    margin: 0 0 16px 0;
    strong { color: #374151; font-weight: 500; }
`;

const VisualMetricsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin: 24px 0;
    @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); gap: 12px; }
`;

const MetricCard = styled.div`
    padding: 20px;
    background: #f9fafb;
    border-radius: 12px;
    text-align: center;
    border: 1px solid #e5e7eb;
    transition: all 0.2s;
    &:hover { border-color: #0284c7; background: #f0f9ff; }
`;

const MetricLabel = styled.p`
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0 0 8px 0;
    font-weight: 500;
`;

const MetricValue = styled.p`
    font-size: 1.5rem;
    color: #0284c7;
    margin: 0;
    font-weight: 600;
`;

const MetricUnit = styled.span`
    font-size: 0.75rem;
    font-weight: 400;
    color: #6b7280;
`;

const ToneBadge = styled.p`
    font-size: 0.9rem;
    font-weight: 600;
    color: #0284c7;
    margin: 0;
    text-transform: capitalize;
`;

const AudioMetricsBadge = styled.div`
    display: inline-flex;
    align-items: center;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #6366f1;
    background: #eef2ff;
    border-radius: 8px;
    padding: 6px 12px;
    margin: 20px 0 12px;
    gap: 4px;
`;

const AnalyticsHeader = styled.div`
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid rgba(0,0,0,0.08);
`;

const AnalyticsHeaderTitle = styled.h2`
    font-size: 1rem;
    font-weight: 700;
    color: #1a2332;
    margin: 0 0 4px 0;
    letter-spacing: 0.01em;
`;

const AnalyticsHeaderSub = styled.p`
    font-size: 0.8125rem;
    color: rgba(55,65,81,0.55);
    margin: 0;
    font-weight: 400;
`;

const AnalyticsPanel = styled.div`
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 6px;
    margin-bottom: 16px;
    overflow: hidden;
`;

const AnalyticsPanelLabel = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(0,0,0,0.025);
    border-bottom: 1px solid rgba(0,0,0,0.08);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(30,40,55,0.6);
    text-transform: uppercase;
`;

const AnalyticsEmpty = styled.p`
    padding: 24px 20px;
    font-size: 0.875rem;
    color: rgba(107,114,128,0.7);
    margin: 0;
`;

const AnalyticsFootnote = styled.p`
    font-size: 0.75rem;
    color: rgba(107,114,128,0.65);
    margin: 0;
    padding: 10px 16px 14px;
    border-top: 1px solid rgba(0,0,0,0.06);
    line-height: 1.5;
`;

const SuggestionTable = styled.table`width: 100%; border-collapse: collapse;`;

const SuggestionTr = styled.tr`
    vertical-align: top;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    transition: background 0.12s;
    &:last-child { border-bottom: none; }
    &:hover { background: rgba(0,0,0,0.015); }
`;

const SuggestionNumTd = styled.td`
    padding: 16px 16px 16px 20px;
    width: 36px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: rgba(107,114,128,0.45);
    white-space: nowrap;
    vertical-align: top;
    padding-top: 18px;
`;

const SuggestionCategoryTd = styled.td`
    padding: 16px 16px 16px 0;
    width: 180px;
    vertical-align: top;
`;

const SuggestionCategoryName = styled.p`
    font-size: 0.875rem;
    font-weight: 650;
    color: #1a2332;
    margin: 0 0 5px 0;
`;

const SuggestionTag = styled.span`
    display: inline-block;
    font-size: 0.6375rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(30,64,175,0.7);
    background: rgba(30,64,175,0.07);
    border: 1px solid rgba(30,64,175,0.15);
    border-radius: 3px;
    padding: 1px 6px;
`;

const SuggestionContentTd = styled.td`
    padding: 16px 20px 16px 0;
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.65;
    vertical-align: top;
`;

const AudioDeliveryRow = styled.div`
    display: flex;
    align-items: stretch;
    padding: 16px 20px;
    gap: 0;
`;

const AudioDeliveryItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    padding: 0 16px;
    &:first-child { padding-left: 0; }
`;

const AudioDeliveryDivider = styled.div`
    width: 1px;
    background: rgba(0,0,0,0.08);
    flex-shrink: 0;
`;

const AudioDeliveryLabel = styled.span`
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(107,114,128,0.55);
`;

const AudioDeliveryValue = styled.span`
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1a2332;
    text-transform: capitalize;
`;

const AudioDeliveryUnit = styled.span`
    font-size: 0.75rem;
    font-weight: 400;
    color: rgba(107,114,128,0.6);
`;

const EmotionTable = styled.table`width: 100%; border-collapse: collapse;`;
const EmotionTableHead = styled.thead`background: rgba(0,0,0,0.02);`;

const EmotionTh = styled.th`
    padding: 8px 16px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(55,65,81,0.5);
    text-align: ${p => p.$right ? 'right' : 'left'};
    border-bottom: 1px solid rgba(0,0,0,0.07);
    white-space: nowrap;
`;

const EmotionTr = styled.tr`
    background: ${p => p.$isDominant ? 'rgba(2,132,199,0.04)' : 'transparent'};
    border-left: ${p => p.$isDominant ? '3px solid rgba(2,132,199,0.5)' : '3px solid transparent'};
    transition: background 0.15s;
    &:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.05); }
    &:hover { background: rgba(0,0,0,0.02); }
`;

const EmotionTd = styled.td`
    padding: 11px 16px;
    vertical-align: middle;
    text-align: ${p => p.$right ? 'right' : 'left'};
    width: ${p => p.$wide ? '40%' : 'auto'};
`;

const EmotionLabelCell = styled.span`
    font-size: 0.875rem;
    font-weight: ${p => p.$isDominant ? '650' : '500'};
    color: ${p => p.$isDominant ? '#1a2332' : '#374151'};
`;

const EmotionBarTrack = styled.div`
    height: 6px;
    background: rgba(0,0,0,0.07);
    border-radius: 2px;
    overflow: hidden;
`;

const EmotionBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: ${p => p.$isDominant ? 'rgba(2,132,199,0.75)' : 'rgba(100,116,139,0.45)'};
    border-radius: 2px;
    transition: width 0.5s ease;
`;

const EmotionPct = styled.span`
    font-size: 0.875rem;
    font-weight: ${p => p.$isDominant ? '700' : '500'};
    color: ${p => p.$isDominant ? '#0369a1' : '#6b7280'};
    font-variant-numeric: tabular-nums;
`;

const EmotionDominantTag = styled.span`
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(2,132,199,0.85);
    background: rgba(2,132,199,0.1);
    border: 1px solid rgba(2,132,199,0.2);
    border-radius: 3px;
    padding: 2px 7px;
`;

const EmotionNullTag = styled.span`
    font-size: 0.875rem;
    color: rgba(156,163,175,0.6);
`;

const OverallScoreRow = styled.div`
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0,0,0,0.07);
`;

const OverallScoreBlock = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 90px;
    padding: 14px 16px;
    background: ${p => p.$bg || 'rgba(22,101,52,0.08)'};
    border: 1px solid ${p => p.$border || 'rgba(22,101,52,0.2)'};
    border-radius: 4px;
    flex-shrink: 0;
`;

const OverallScoreNum = styled.span`
    font-size: 24px;
    font-weight: 500;
    color: ${p => p.$color || '#166534'};
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
`;

const OverallScoreDenom = styled.span`
    font-size: 0.875rem;
    font-weight: 400;
    color: rgba(0,0,0,0.3);
    margin-left: 2px;
`;

const OverallScoreLabel = styled.span`
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${p => p.$color || '#166534'};
    margin-top: 4px;
    opacity: 0.8;
`;

const OverallScoreBar = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const OverallScoreBarLabel = styled.span`
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(55,65,81,0.6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
`;

const OverallScoreBarTrack = styled.div`
    height: 8px;
    background: rgba(0,0,0,0.07);
    border-radius: 2px;
    overflow: hidden;
`;

const OverallScoreBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: ${p => p.$color || '#166534'};
    opacity: 0.7;
    border-radius: 2px;
    transition: width 0.6s ease;
`;

const OverallScoreBarLegend = styled.div`
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: rgba(107,114,128,0.55);
    font-weight: 500;
`;

const ClarityTable = styled.table`width: 100%; border-collapse: collapse;`;
const ClarityTableHead = styled.thead`background: rgba(0,0,0,0.02);`;

const ClarityTh = styled.th`
    padding: 8px 16px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(55,65,81,0.5);
    text-align: ${p => p.$right ? 'right' : 'left'};
    border-bottom: 1px solid rgba(0,0,0,0.07);
    white-space: nowrap;
`;

const ClarityTr = styled.tr`
    &:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.05); }
    &:hover { background: rgba(0,0,0,0.015); }
`;

const ClarityTd = styled.td`
    padding: 11px 16px;
    vertical-align: middle;
    text-align: ${p => p.$right ? 'right' : 'left'};
    width: ${p => p.$wide ? '38%' : 'auto'};
`;

const ClarityMetricName = styled.span`font-size: 0.875rem; font-weight: 500; color: #374151;`;
const ClarityMetricVal  = styled.span`font-size: 0.9375rem; font-weight: 700; color: #1a2332; font-variant-numeric: tabular-nums;`;
const ClarityUnit       = styled.span`font-size: 0.75rem; font-weight: 400; color: rgba(107,114,128,0.7); margin-left: 2px;`;

const ClarityBarTrack = styled.div`height: 6px; background: rgba(0,0,0,0.07); border-radius: 2px; overflow: hidden;`;
const ClarityBarFill  = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: rgba(30,64,175,0.45);
    border-radius: 2px;
    transition: width 0.5s ease;
`;

const ClarityRatingTag = styled.span`
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 3px;
    padding: 2px 8px;
    color: ${p =>
        p.$rating === 'Ideal'    ? 'rgba(22,101,52,0.9)'  :
        p.$rating === 'Fast'     ? 'rgba(146,64,14,0.9)'  :
        p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.9)'  :
                                   'rgba(55,65,81,0.7)'};
    background: ${p =>
        p.$rating === 'Ideal'    ? 'rgba(22,101,52,0.1)'  :
        p.$rating === 'Fast'     ? 'rgba(146,64,14,0.1)'  :
        p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.1)'  :
                                   'rgba(0,0,0,0.05)'};
    border: 1px solid ${p =>
        p.$rating === 'Ideal'    ? 'rgba(22,101,52,0.2)'  :
        p.$rating === 'Fast'     ? 'rgba(146,64,14,0.2)'  :
        p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.2)'  :
                                   'rgba(0,0,0,0.1)'};
`;

export default Home;