import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import ApiUrl from "../config/LocalConfigApi"
import styled, { keyframes } from 'styled-components';
import { useAuth } from "./Login";
import { GoTag } from "react-icons/go";
import { FaShareAlt, FaSmile } from "react-icons/fa";
import {
    FiActivity,
    FiAlignLeft,
    FiArrowLeft,
    FiArrowRight,
    FiBarChart2,
    FiBookmark,
    FiCalendar,
    FiCheckCircle,
    FiChevronRight,
    FiClipboard,
    FiClock,
    FiDownload,
    FiFileText,
    FiFilm,
    FiGlobe,
    FiHeart,
    FiInfo,
    FiLoader,
    FiMessageSquare,
    FiMic,
    FiPlay,
    FiRotateCcw,
    FiShare2,
    FiSmile,
    FiTrendingUp,
    FiTrash2,
    FiUploadCloud,
    FiUsers,
} from "react-icons/fi";
import { BsStars, BsLightbulbFill } from "react-icons/bs";
import { FaWaveSquare } from "react-icons/fa";
import Rightbar from "./Rightbar.jsx";
import { CiSearch, CiVideoOn } from "react-icons/ci";
import { RiEmotionFill, RiEmotionNormalFill } from "react-icons/ri";
import { PiSmileySadFill } from "react-icons/pi";
import { HiMenuAlt3 } from "react-icons/hi";
import { GiMicrophone } from "react-icons/gi";
import { TbMoodCrazyHappyFilled } from "react-icons/tb";
import Swal from "sweetalert2";
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

// ─── FIX: Set withCredentials globally so ALL axios requests send cookies ─────
axios.defaults.withCredentials = true;

const buildSavedVideoUrl = (videoPath) => {
    if (!videoPath) return "";
    const base = ApiUrl.apiURL.replace(/\/api\/?$/, '').replace(/\/$/, '');
    return `${base}/${videoPath}`;
};

const formatSavedVideoName = (videoPath) => {
    if (!videoPath) return "Untitled recording";
    const fileName = String(videoPath).split("/").pop() || videoPath;
    return fileName.replace(/^\d+-/, "");
};

const formatSavedBytes = (bytes) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
};

const formatSavedDate = (dateValue) => new Date(dateValue).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const getSavedTone = (recording) => {
    try {
        const extra = typeof recording?.extra_results === 'string'
            ? JSON.parse(recording.extra_results)
            : recording?.extra_results;
        return extra?.tone || null;
    } catch { return null; }
};

function Home() {
    const { user, loading } = useAuth();
    const location = useLocation();
    const { id: savedVideoId } = useParams();
    const isSavedRecordingView = Boolean(savedVideoId);
    const routeSavedVideo = location.state?.video || null;

    const [videoFile, setVideoFile] = useState(null);

    const [uploadedVideoPath, setUploadedVideoPathState] = useState(() => {
        try { return localStorage.getItem("home_uploadedVideoPath") || null; } catch { return null; }
    });
    const setUploadedVideoPath = (val) => {
        setUploadedVideoPathState(val);
        try {
            if (val === null) localStorage.removeItem("home_uploadedVideoPath");
            else localStorage.setItem("home_uploadedVideoPath", val);
        } catch { }
    };

    const [uploadedVideoName, setUploadedVideoNameState] = useState(() => {
        try { return localStorage.getItem("home_uploadedVideoName") || null; } catch { return null; }
    });
    const setUploadedVideoName = (val) => {
        setUploadedVideoNameState(val);
        try {
            if (val === null) localStorage.removeItem("home_uploadedVideoName");
            else localStorage.setItem("home_uploadedVideoName", val);
        } catch { }
    };

    const [uploadedFileSize, setUploadedFileSizeState] = useState(() => {
        try { return parseInt(localStorage.getItem("home_uploadedFileSize"), 10) || 0; } catch { return 0; }
    });
    const setUploadedFileSize = (val) => {
        setUploadedFileSizeState(val);
        try {
            if (!val) localStorage.removeItem("home_uploadedFileSize");
            else localStorage.setItem("home_uploadedFileSize", String(val));
        } catch { }
    };

    const [previewURL, setPreviewURL] = useState(() => {
        try {
            const path = localStorage.getItem("home_uploadedVideoPath");
            if (path) {
                const base = ApiUrl.apiURL.replace(/\/api\/?$/, '').replace(/\/$/, '');
                return `${base}/${path}`;
            }
        } catch { }
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
        } catch { }
    };

    const [date] = useState(new Date());
    const [formattedDate, setFormattedDate] = useState("");

    const userFirstName = (() => {
        const raw = user?.name || user?.fullName || user?.username || user?.email || "";
        const first = String(raw).split("@")[0].split(" ")[0].trim();
        return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
    })();

    const getGreeting = () => {
        const hour = date.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };
    const [searchQuery, setSearchQuery] = useState("");
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isRightbarCollapsed, setIsRightbarCollapsed] = useState(false);
    const [showAnnouncement, setShowAnnouncement] = useState(() => {
        try { return localStorage.getItem("home_hideAnnouncement") !== "1"; } catch { return true; }
    });
    const dismissAnnouncement = () => {
        setShowAnnouncement(false);
        try { localStorage.setItem("home_hideAnnouncement", "1"); } catch { }
    };
    const [isSaving, setIsSaving] = useState(false);
    const [resetKey, setResetKey] = useState(0);
    const [savedRecording, setSavedRecording] = useState(routeSavedVideo);
    const [savedRecordingLoading, setSavedRecordingLoading] = useState(isSavedRecordingView);
    const [recordingsOverview, setRecordingsOverview] = useState({ items: [], count: 0 });
    const [recordingsOverviewLoading, setRecordingsOverviewLoading] = useState(false);

    const [progressLogs, setProgressLogs] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        if (progressPanelRef.current) {
            progressPanelRef.current.scrollTop = progressPanelRef.current.scrollHeight;
        }
    }, [progressLogs]);

    const navigate = useNavigate();
    const progressPanelRef = useRef(null);
    const videoPlayerRef = useRef(null);

    useEffect(() => {
        if (!isSavedRecordingView || !user) return;

        const applySavedRecording = (recording) => {
            let parsedAnalysis = null;
            try {
                parsedAnalysis = typeof recording.analysis === "string"
                    ? JSON.parse(recording.analysis)
                    : recording.analysis;
            } catch { }

            setSavedRecording(recording);
            setAnalysisResultState(parsedAnalysis);
            setUploadedVideoPathState(recording.video_path || null);
            setUploadedVideoNameState(formatSavedVideoName(recording.video_path));
            setUploadedFileSizeState(recording.file_size || 0);
            setPreviewURL(recording.video_path ? buildSavedVideoUrl(recording.video_path) : "");
            setViewVideo(true);
            setSavedRecordingLoading(false);
        };

        if (routeSavedVideo && String(routeSavedVideo.id) === String(savedVideoId)) {
            applySavedRecording(routeSavedVideo);
            return;
        }

        setSavedRecordingLoading(true);
        axios.get(`${ApiUrl.apiURL}/saved-videos`, { withCredentials: true })
            .then(({ data }) => {
                const recording = data.find((item) => String(item.id) === String(savedVideoId));
                if (!recording) {
                    navigate('/saved-videos', { replace: true });
                    return;
                }
                applySavedRecording(recording);
            })
            .catch(() => navigate('/saved-videos', { replace: true }))
            .finally(() => setSavedRecordingLoading(false));
    }, [isSavedRecordingView, navigate, routeSavedVideo, savedVideoId, user]);

    useEffect(() => {
        if (!user || isSavedRecordingView) return;

        setRecordingsOverviewLoading(true);
        axios.get(`${ApiUrl.apiURL}/saved-videos`, { withCredentials: true })
            .then(({ data }) => {
                const recordings = Array.isArray(data) ? data : [];
                setRecordingsOverview({ items: recordings.slice(0, 3), count: recordings.length });
            })
            .catch(() => setRecordingsOverview({ items: [], count: 0 }))
            .finally(() => setRecordingsOverviewLoading(false));
    }, [isSavedRecordingView, user]);

    // ─── Inactivity auto-logout (2 hours) ────────────────────────────────────────
    const INACTIVE_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours
    const inactivityTimerRef = useRef(null);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
            // Force logout after 2 hours of inactivity
            axios.post(`${ApiUrl.apiURL}/logout`).catch(() => { });
            navigate("/login");
        }, INACTIVE_LIMIT_MS);
    }, [navigate, INACTIVE_LIMIT_MS]);

    useEffect(() => {
        const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
        events.forEach(e => window.addEventListener(e, resetInactivityTimer));
        resetInactivityTimer(); // start the timer on mount

        return () => {
            events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [resetInactivityTimer]);

    // ─── Silent token refresh every 10 minutes while active ──────────────────────
    useEffect(() => {
        const refreshInterval = setInterval(async () => {
            try {
                await axios.post(`${ApiUrl.apiURL}/refresh`);
            } catch {
                // Refresh failed — user will be logged out on next API call

            }
        }, 10 * 60 * 1000); // every 10 minutes

        return () => clearInterval(refreshInterval);
    }, []);

    // ─── FIX: Check loading state before redirecting ──────────────────────────
    useEffect(() => {
        if (!loading && !user) {
            navigate('/');
        }
    }, [user, loading, navigate]);


    const items_nav = [
        { id: 1, name: "Summary", icon: <FiAlignLeft />, desc: "Transcript, translation, and a plain-language recap of the video" },
        { id: 2, name: "Predicted Target Audience", icon: <FiUsers />, desc: "AI-predicted audience segments, based on the video's content and any viewer feedback provided" },
        { id: 3, name: "Effective Analysis", icon: <FiActivity />, desc: "Advertisement effectiveness and audio appeal, backed by signal metrics" },
        { id: 4, name: "Assessment", icon: <FiClipboard />, desc: "Overall strengths, weaknesses, and emotional tone at a glance" },
        { id: 5, name: "Audience Emotion", icon: <FiHeart />, desc: "Predicted emotional response distribution across listeners" },
        { id: 6, name: "Suggestions", icon: <FiMessageSquare />, desc: "Consolidated findings and recommendations across every dimension" },
        { id: 7, name: "Analytics", icon: <FiBarChart2 />, desc: "Raw acoustic analysis, emotion scoring, and speech clarity breakdown" },
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

                es.onopen = () => {
                    console.log("SSE connection opened");
                };

                es.addEventListener("progress", (e) => {
                    const { message } = JSON.parse(e.data);
                    setProgressLogs((prev) => [...prev, message]);
                });

                es.addEventListener("result", (e) => {
                    es.close();
                    const { success, data } = JSON.parse(e.data);
                    if (success && data) {
                        // console.log("FULL RESULT:", JSON.stringify(data, null, 2));
                        setAnalysisResult(data);
                        resolve(data);
                    } else {
                        reject(new Error("Processing failed"));
                    }
                });

                es.addEventListener("error", (e) => {
                    console.log("SSE error event:", e.data);
                    es.close();
                    try {
                        const { message } = JSON.parse(e.data);
                        reject(new Error(message));
                    } catch {
                        reject(new Error("Processing error. Please try again."));
                    }
                });

                es.onerror = (e) => {
                    console.error("SSE connection error:", e);
                    console.log("SSE readyState:", es.readyState);
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

    const handleSavedShare = async () => {
        if (!savedRecording) return;
        const shareData = {
            title: formatSavedVideoName(savedRecording.video_path),
            text: `KATHA analysis for ${formatSavedVideoName(savedRecording.video_path)}`,
            url: window.location.href,
        };

        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                await navigator.clipboard.writeText(window.location.href);
                Swal.fire({ icon: 'success', title: 'Link copied', timer: 1400, showConfirmButton: false });
            }
        } catch (err) {
            if (err?.name !== 'AbortError') {
                Swal.fire({ icon: 'error', title: 'Unable to share', confirmButtonColor: '#2c6edb' });
            }
        }
    };

    const handleSavedDelete = async () => {
        if (!savedRecording) return;
        const result = await Swal.fire({
            title: 'Delete this recording?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2c6edb',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Delete',
        });
        if (!result.isConfirmed) return;

        try {
            await axios.delete(`${ApiUrl.apiURL}/saved-videos/${savedRecording.id}`, { withCredentials: true });
            navigate('/saved-videos', { replace: true });
        } catch {
            Swal.fire({ icon: 'error', title: 'Failed to delete', confirmButtonColor: '#2c6edb' });
        }
    };

    // ─── Show loading spinner while auth state resolves ───────────────────────
    if (loading || savedRecordingLoading) {
        return (
            <LoadingScreen>
                <LoadingSpinner />
            </LoadingScreen>
        );
    }

    const savedExtra = (() => {
        try {
            return typeof savedRecording?.extra_results === 'string'
                ? JSON.parse(savedRecording.extra_results)
                : savedRecording?.extra_results;
        } catch { return null; }
    })();

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
                    {isSavedRecordingView && savedRecording ? (
                        <SavedDetailHeader>
                            <BackLink to="/saved-videos">
                                <FiArrowLeft size={16} />
                                My Recordings
                            </BackLink>
                            <SavedIdentityRow>
                                <SavedFileIcon><FiFilm size={21} /></SavedFileIcon>
                                <SavedIdentity>
                                    <SavedTitle>{formatSavedVideoName(savedRecording.video_path)}</SavedTitle>
                                    <SavedMeta>
                                        <span>{formatSavedDate(savedRecording.created_at)}</span>
                                        <span>·</span>
                                        <span>{formatSavedBytes(savedRecording.file_size)}</span>
                                        {savedExtra?.tone && (
                                            <SavedTone>{savedExtra.tone}</SavedTone>
                                        )}
                                    </SavedMeta>
                                </SavedIdentity>
                            </SavedIdentityRow>
                            <SavedActions>
                                <SavedPlayButton type="button" onClick={() => videoPlayerRef.current?.play()}>
                                    <FiPlay size={15} /> Play
                                </SavedPlayButton>
                                <SavedTextAction
                                    as="a"
                                    href={previewURL}
                                    download={formatSavedVideoName(savedRecording.video_path)}
                                >
                                    <FiDownload size={16} /> Export
                                </SavedTextAction>
                                <SavedTextAction type="button" onClick={handleSavedShare}>
                                    <FiShare2 size={16} /> Share
                                </SavedTextAction>
                                <SavedTextAction type="button" onClick={handleSavedDelete}>
                                    <FiTrash2 size={16} /> Delete
                                </SavedTextAction>
                            </SavedActions>
                        </SavedDetailHeader>
                    ) : (
                    <>
                    <HeroSection>
                        <HeroTextCol>
                            <HeroEyebrow>{getGreeting()}{userFirstName ? `, ${userFirstName}` : ''}</HeroEyebrow>
                            <HeroGreeting>Video Analyzer</HeroGreeting>
                            <HeroSubtitle>
                                Upload a video to generate AI-powered insights on content, delivery, and predicted target audience.
                            </HeroSubtitle>
                        </HeroTextCol>
                        {formattedDate && (
                            <HeroDateChip>
                                <FiCalendar size={14} />
                                {formattedDate}
                            </HeroDateChip>
                        )}
                    </HeroSection>

                    <FeatureCardsRow>
                        <FeatureCard>
                            <FeatureIconWrap>
                                <FiFileText size={20} />
                            </FeatureIconWrap>
                            <FeatureBody>
                                <FeatureTitle>Transcript &amp; Translation</FeatureTitle>
                                <FeatureDesc>Every spoken line captured, labeled by speaker, and translated to English.</FeatureDesc>
                            </FeatureBody>
                        </FeatureCard>
                        <FeatureCard>
                            <FeatureIconWrap>
                                <FiSmile size={20} />
                            </FeatureIconWrap>
                            <FeatureBody>
                                <FeatureTitle>Emotion &amp; Tone Detection</FeatureTitle>
                                <FeatureDesc>Scores happiness, energy, and mood so you know how the ad actually feels.</FeatureDesc>
                            </FeatureBody>
                        </FeatureCard>
                        <FeatureCard>
                            <FeatureIconWrap>
                                <FiMic size={20} />
                            </FeatureIconWrap>
                            <FeatureBody>
                                <FeatureTitle>Speech Clarity Scoring</FeatureTitle>
                                <FeatureDesc>Pace, filler words, and audio quality rolled into one clarity score.</FeatureDesc>
                            </FeatureBody>
                        </FeatureCard>
                    </FeatureCardsRow>

                    {showAnnouncement && (
                        <AnnouncementBanner $tone="info">
                            <AnnouncementIcon><BsStars size={16} /></AnnouncementIcon>
                            <AnnouncementText>
                                <b>Tuned for Filipino &amp; Southeast Asian ads.</b> Transcription, tone, and emotion scoring work best with clear spoken audio in Tagalog, Taglish, or English.
                            </AnnouncementText>
                            <AnnouncementClose onClick={dismissAnnouncement} aria-label="Dismiss">×</AnnouncementClose>
                        </AnnouncementBanner>
                    )}

                    <RecordingOverview>
                        <RecordingOverviewHeader>
                            <div>
                                <RecordingOverviewTitle>Recent recordings</RecordingOverviewTitle>
                                <RecordingOverviewSubtitle>
                                    {recordingsOverview.count === 1
                                        ? '1 saved analysis'
                                        : `${recordingsOverview.count} saved analyses`}
                                </RecordingOverviewSubtitle>
                            </div>
                            <RecordingOverviewLink to="/saved-videos">
                                View all <FiArrowRight size={15} />
                            </RecordingOverviewLink>
                        </RecordingOverviewHeader>

                        {recordingsOverviewLoading ? (
                            <RecordingOverviewList aria-label="Loading recent recordings">
                                {[1, 2, 3].map((item) => <RecordingOverviewSkeleton key={item} />)}
                            </RecordingOverviewList>
                        ) : recordingsOverview.items.length > 0 ? (
                            <RecordingOverviewList>
                                {recordingsOverview.items.map((recording) => {
                                    const tone = getSavedTone(recording);
                                    return (
                                        <RecordingOverviewRow
                                            key={recording.id}
                                            to={`/saved-videos/${recording.id}`}
                                            state={{ video: recording }}
                                        >
                                            <RecordingOverviewIcon><FiFilm size={18} /></RecordingOverviewIcon>
                                            <RecordingOverviewBody>
                                                <RecordingOverviewName>{formatSavedVideoName(recording.video_path)}</RecordingOverviewName>
                                                <RecordingOverviewMeta>
                                                    {formatSavedDate(recording.created_at)} · {formatSavedBytes(recording.file_size)}
                                                    {tone && <RecordingOverviewTone>{tone}</RecordingOverviewTone>}
                                                </RecordingOverviewMeta>
                                                {recording.summary && (
                                                    <RecordingOverviewSummary>{recording.summary}</RecordingOverviewSummary>
                                                )}
                                            </RecordingOverviewBody>
                                            <FiChevronRight size={18} aria-hidden="true" />
                                        </RecordingOverviewRow>
                                    );
                                })}
                            </RecordingOverviewList>
                        ) : (
                            <RecordingOverviewEmpty>
                                Saved analyses will appear here after you analyze and save a video.
                            </RecordingOverviewEmpty>
                        )}
                    </RecordingOverview>
                    </>
                    )}

                    {isSavedRecordingView ? (
                        <SavedVideoSection>
                            <SavedVideoPlayer ref={videoPlayerRef} src={previewURL} controls />
                        </SavedVideoSection>
                    ) : !viewVideo ? (
                        <VideoUploadSection>
                            <UploadBox>
                                <input
                                    className="upload-input"
                                    accept="video/*"
                                    name="file"
                                    type="file"
                                    onChange={handleFileChange}
                                />
                                <UploadIconWrap>
                                    <FiUploadCloud className="upload-icon" />
                                </UploadIconWrap>
                                <UploadTitle>Upload your video</UploadTitle>
                                <UploadHint>Click or drag a video file here</UploadHint>
                                <UploadTagRow>
                                    <UploadTag>MP4 · MOV · WEBM</UploadTag>
                                    <UploadTag>AI-powered insights</UploadTag>
                                    <UploadTag>Ready in a couple of minutes</UploadTag>
                                </UploadTagRow>
                            </UploadBox>

                            <HowItWorksRow>
                                <HowItWorksStep>
                                    <HowItWorksNum>1</HowItWorksNum>
                                    <HowItWorksBody>
                                        <HowItWorksTitle>Upload</HowItWorksTitle>
                                        <HowItWorksText>Add your video ad — MP4, MOV, or WEBM.</HowItWorksText>
                                    </HowItWorksBody>
                                </HowItWorksStep>
                                <HowItWorksStep>
                                    <HowItWorksNum>2</HowItWorksNum>
                                    <HowItWorksBody>
                                        <HowItWorksTitle>Analyze</HowItWorksTitle>
                                        <HowItWorksText>Gemini transcribes speech and scores tone, clarity, and emotion.</HowItWorksText>
                                    </HowItWorksBody>
                                </HowItWorksStep>
                                <HowItWorksStep>
                                    <HowItWorksNum>3</HowItWorksNum>
                                    <HowItWorksBody>
                                        <HowItWorksTitle>Review</HowItWorksTitle>
                                        <HowItWorksText>Browse insights across seven tabs, then save what matters.</HowItWorksText>
                                    </HowItWorksBody>
                                </HowItWorksStep>
                            </HowItWorksRow>
                        </VideoUploadSection>
                    ) : (
                        <VideoSection>
                            <VideoPlayerWrap>
                                <VideoPlayer ref={videoPlayerRef} src={previewURL} controls />
                            </VideoPlayerWrap>
                            <VideoInfoCard>
                                <VideoFileNameRow>
                                    <VideoFileIcon>
                                        <CiVideoOn size={18} />
                                    </VideoFileIcon>
                                    <VideoFileName title={videoFile?.name || uploadedVideoName || "video"}>
                                        {videoFile?.name || uploadedVideoName || "video"}
                                    </VideoFileName>
                                </VideoFileNameRow>

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
                            {isStreaming && <ProgressBarIndeterminate />}
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
                                {!isSavedRecordingView && (
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
                                )}
                            </ResultsHeader>

                            {(() => {
                                const clarityScore = analysisResult?.speech_clarity?.overall_score;
                                const dominantEmotion = analysisResult?.emotion_analysis?.dominant_emotion;
                                const inferredTone = analysisResult?.audio_analysis?.inferred_tone;
                                const speakingRate = analysisResult?.audio_analysis?.estimated_speaking_rate_wpm;
                                const detectedLanguage = analysisResult?.detected_language;

                                const chips = [
                                    detectedLanguage && {
                                        icon: <FiGlobe size={18} />,
                                        label: 'Language',
                                        value: detectedLanguage,
                                    },
                                    clarityScore != null && {
                                        icon: <FiCheckCircle size={18} />,
                                        label: 'Clarity Score',
                                        value: `${clarityScore}/100`,
                                        $tone: clarityScore >= 80 ? 'good' : clarityScore >= 60 ? 'mid' : 'low',
                                    },
                                    dominantEmotion && {
                                        icon: <FiSmile size={18} />,
                                        label: 'Dominant Emotion',
                                        value: dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1),
                                    },
                                    inferredTone && {
                                        icon: <FiTrendingUp size={18} />,
                                        label: 'Inferred Tone',
                                        value: inferredTone.charAt(0).toUpperCase() + inferredTone.slice(1),
                                    },
                                    speakingRate != null && {
                                        icon: <FiClock size={18} />,
                                        label: 'Speaking Rate',
                                        value: `${speakingRate} WPM`,
                                    },
                                ].filter(Boolean);

                                if (chips.length === 0) return null;

                                return (
                                    <QuickStatsRow>
                                        {chips.map((chip, i) => (
                                            <QuickStatChip key={i} $tone={chip.$tone}>
                                                <QuickStatIcon $tone={chip.$tone}>{chip.icon}</QuickStatIcon>
                                                <QuickStatText>
                                                    <QuickStatLabel>{chip.label}</QuickStatLabel>
                                                    <QuickStatValue>{chip.value}</QuickStatValue>
                                                </QuickStatText>
                                            </QuickStatChip>
                                        ))}
                                    </QuickStatsRow>
                                );
                            })()}

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
                                <CardHeaderRow>
                                    <CardHeaderIcon>{current_nav.icon}</CardHeaderIcon>
                                    <CardHeaderTextCol>
                                        <CardHeaderName>{current_nav.name}</CardHeaderName>
                                        {current_nav.desc && <CardHeaderDesc>{current_nav.desc}</CardHeaderDesc>}
                                    </CardHeaderTextCol>
                                    {analysisResult.detected_language && (
                                        <LanguagePill title={`Language confidence: ${Math.round((analysisResult.language_confidence ?? 1) * 100)}%`}>
                                            <GoTag size={11} />
                                            {analysisResult.detected_language}
                                        </LanguagePill>
                                    )}
                                </CardHeaderRow>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    fontSize: '12px',
                                    color: '#64748b',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    margin: '4px 0 20px',
                                }}>
                                    <FiInfo size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                                    <span>
                                        These results are AI-generated by analyzing the video's content, audio, and speech —
                                        based on patterns the AI has learned. They are estimates and predictions, not
                                        guaranteed or verified facts, and should be reviewed before use.
                                    </span>
                                </div>

                                {/* ── Tab 1: Summary ── */}
                                {current_nav.id === 1 && (
                                    <ContentSection>
                                        {analysisResult.detected_language && (() => {
                                            const confidence = analysisResult.language_confidence ?? 1;
                                            const pct = Math.round(confidence * 100);
                                            const isLow = confidence < 0.6;
                                            return (
                                                <Banner $tone={isLow ? 'warning' : 'info'}>
                                                    <BannerIconWrap $tone={isLow ? 'warning' : 'info'}>
                                                        <GoTag size={15} />
                                                    </BannerIconWrap>
                                                    <BannerBody>
                                                        <BannerTitle $tone={isLow ? 'warning' : 'info'}>
                                                            Detected language: {analysisResult.detected_language} · {pct}% confidence
                                                        </BannerTitle>
                                                        <BannerDesc $tone={isLow ? 'warning' : 'info'}>
                                                            {isLow
                                                                ? "Confidence is on the lower side — background noise or code-switching may affect transcript accuracy. Double-check the transcript below against the original audio."
                                                                : "The transcript and translation below were generated automatically from the spoken audio in this video."}
                                                        </BannerDesc>
                                                    </BannerBody>
                                                </Banner>
                                            );
                                        })()}

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

                                {/* ── Tab 2: Predicted Target Audience ── */}
                                {current_nav.id === 2 && (
                                    <ContentSection>
                                        {(() => {
                                            const audience = analysisResult?.summary?.predicted_target_audience;

                                            // Backward compatibility: analyses saved before this change only
                                            // have summary.impact — fall back to it rather than showing nothing.
                                            if (!audience) {
                                                return (
                                                    <>
                                                        <ContentTitle>
                                                            {highlightText(getSafeContent(analysisResult, 'summary.impact.title', 'Predicted Target Audience'), searchQuery)}
                                                        </ContentTitle>
                                                        <ContentText>
                                                            {highlightText(getSafeContent(analysisResult, 'summary.impact.content', 'No target audience prediction available'), searchQuery)}
                                                        </ContentText>
                                                    </>
                                                );
                                            }

                                            const renderSegment = (segment, label, key) => {
                                                if (!segment) return null;
                                                const demo = segment.demographics || {};
                                                const demoEntries = Object.entries(demo).filter(([, v]) => {
                                                    if (v == null) return false;
                                                    if (Array.isArray(v)) return v.length > 0;
                                                    const s = String(v).trim().toLowerCase();
                                                    return s && s !== 'unknown' && s !== 'not enough evidence';
                                                });
                                                const confidenceColors = {
                                                    High:   { bg: '#dcfce7', fg: '#166534' },
                                                    Medium: { bg: '#fef9c3', fg: '#854d0e' },
                                                    Low:    { bg: '#fee2e2', fg: '#991b1b' },
                                                };
                                                const cColor = confidenceColors[segment.confidence] || { bg: '#f1f5f9', fg: '#475569' };

                                                return (
                                                    <div key={key} style={{ marginBottom: '24px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#0284c7' }}>
                                                                {label}
                                                            </span>
                                                            {segment.confidence && (
                                                                <span style={{
                                                                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
                                                                    background: cColor.bg, color: cColor.fg,
                                                                }}>
                                                                    {segment.confidence} confidence
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>
                                                            {highlightText(segment.label || 'Unlabeled segment', searchQuery)}
                                                        </div>
                                                        {demoEntries.length > 0 && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                                                {demoEntries.map(([dKey, value]) => (
                                                                    <span key={dKey} style={{ fontSize: '12px', background: '#f1f5f9', borderRadius: '6px', padding: '4px 8px' }}>
                                                                        <strong style={{ textTransform: 'capitalize' }}>{dKey.replace(/_/g, ' ')}:</strong>{' '}
                                                                        {Array.isArray(value) ? value.join(', ') : String(value)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {segment.evidence && (
                                                            <ContentText style={{ fontSize: '13px' }}>
                                                                {highlightText(segment.evidence, searchQuery)}
                                                            </ContentText>
                                                        )}
                                                    </div>
                                                );
                                            };

                                            const secondary = Array.isArray(audience.secondary_segments) ? audience.secondary_segments : [];

                                            return (
                                                <>
                                                    <ContentTitle>
                                                        {highlightText(audience.title || 'Predicted Target Audience', searchQuery)}
                                                    </ContentTitle>
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                                                        Predicted, not confirmed — ranked by how strongly the video content supports each segment.
                                                    </div>
                                                    {renderSegment(audience.primary_segment, 'Primary Target Audience', 'primary')}
                                                    {secondary.map((seg, i) =>
                                                        renderSegment(
                                                            seg,
                                                            secondary.length > 1 ? `Secondary Target Audience ${i + 1}` : 'Secondary Target Audience',
                                                            `secondary-${i}`
                                                        )
                                                    )}
                                                    {!audience.primary_segment && secondary.length === 0 && (
                                                        <ContentText>No target audience prediction available</ContentText>
                                                    )}
                                                </>
                                            );
                                        })()}
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
                                                    {(() => {
                                                        const aa = analysisResult.audio_analysis;
                                                        const hasData = aa && !aa.error;
                                                        return (
                                                            <>
                                                                <MetricCard>
                                                                    <MetricLabel>Avg Pitch</MetricLabel>
                                                                    <MetricValue>{hasData ? aa.avg_pitch_hz : 'N/A'} <MetricUnit>Hz</MetricUnit></MetricValue>
                                                                </MetricCard>
                                                                <MetricCard>
                                                                    <MetricLabel>Pitch Variability</MetricLabel>
                                                                    <MetricValue>{hasData ? aa.pitch_variability : 'N/A'} <MetricUnit>Hz</MetricUnit></MetricValue>
                                                                </MetricCard>
                                                                <MetricCard>
                                                                    <MetricLabel>Avg Energy</MetricLabel>
                                                                    <MetricValue>{hasData ? aa.avg_energy_db : 'N/A'} <MetricUnit>dBFS</MetricUnit></MetricValue>
                                                                </MetricCard>
                                                                <MetricCard>
                                                                    <MetricLabel>Speaking Rate</MetricLabel>
                                                                    <MetricValue>{hasData ? aa.estimated_speaking_rate_wpm : 'N/A'} <MetricUnit>WPM</MetricUnit></MetricValue>
                                                                </MetricCard>
                                                            </>
                                                        );
                                                    })()}
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
                                                    'Happy': <FaSmile className="emotion-icon happy" />,
                                                    'Neutral': <RiEmotionNormalFill className="emotion-icon neutral" />,
                                                    'Excited': <TbMoodCrazyHappyFilled className="emotion-icon excited" />,
                                                    'Sad': <PiSmileySadFill className="emotion-icon sad" />,
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
                                                            'Happy': <FaSmile className="emotion-icon happy" />,
                                                            'Neutral': <RiEmotionNormalFill className="emotion-icon neutral" />,
                                                            'Excited': <TbMoodCrazyHappyFilled className="emotion-icon excited" />,
                                                            'Sad': <PiSmileySadFill className="emotion-icon sad" />,
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
                                                        { num: '01', category: 'Message Clarity', tag: 'Summary', content: getSafeContent(analysisResult, 'summary.summary.content', 'No summary available') },
                                                        {
                                                            num: '02',
                                                            category: 'Predicted Target Audience',
                                                            tag: 'Audience',
                                                            content: (() => {
                                                                const primary = analysisResult?.summary?.predicted_target_audience?.primary_segment;
                                                                if (primary?.label) {
                                                                    return `${primary.label}${primary.evidence ? ` — ${primary.evidence}` : ''}`;
                                                                }
                                                                return getSafeContent(analysisResult, 'summary.impact.content', 'No target audience prediction available');
                                                            })(),
                                                        },
                                                        { num: '03', category: 'Effectiveness Improvements', tag: 'Effectiveness', content: getSafeContent(analysisResult, 'summary.advertisement_effectiveness.content', 'No effectiveness analysis available') },
                                                        { num: '04', category: 'Emotional Tone', tag: 'Tone', content: getSafeContent(analysisResult, 'summary.emotional_tone.content', 'No emotional analysis available') },
                                                        { num: '05', category: 'Strengths & Weaknesses', tag: 'Assessment', content: getSafeContent(analysisResult, 'summary.overall_assessment.content', 'No assessment available') },
                                                    ].map(({ num, category, tag, content }) => (
                                                        <SuggestionTr key={num}>
                                                            <SuggestionNumTd><SuggestionNumBadge>{num}</SuggestionNumBadge></SuggestionNumTd>
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

                                        {/* ── No-dialogue guard: hide speech-specific panels when no voice was detected ── */}
                                        {(() => {
                                            const transcript = analysisResult?.transcript ?? '';
                                            const hasNoDialogue =
                                                transcript.trim() === '' ||
                                                transcript.trim() === '[No spoken dialogue detected]';

                                            if (hasNoDialogue) {
                                                return (
                                                    <NoDialogueNotice>
                                                        <NoDialogueIcon>
                                                            <GiMicrophone size={32} style={{ opacity: 0.35 }} />
                                                        </NoDialogueIcon>
                                                        <NoDialogueTitle>No Voice Detected</NoDialogueTitle>
                                                        <NoDialogueText>
                                                            This video contains no spoken dialogue — it appears to be music,
                                                            sound effects, or a visual-only composition. Emotion classification
                                                            and speech clarity metrics require a voice signal and are not
                                                            applicable here.
                                                        </NoDialogueText>
                                                        {analysisResult.audio_analysis && (
                                                            <>
                                                                <NoDialogueSub>Audio signal metrics are still available below.</NoDialogueSub>
                                                                <VisualMetricsGrid style={{ marginTop: 16 }}>
                                                                    <MetricCard>
                                                                        <MetricLabel>Inferred Tone</MetricLabel>
                                                                        <ToneBadge>{analysisResult.audio_analysis.inferred_tone ?? 'N/A'}</ToneBadge>
                                                                    </MetricCard>
                                                                    <MetricCard>
                                                                        <MetricLabel>Avg Energy</MetricLabel>
                                                                        <MetricValue>{analysisResult.audio_analysis.avg_energy_db ?? 'N/A'} <MetricUnit>dBFS</MetricUnit></MetricValue>
                                                                    </MetricCard>
                                                                    <MetricCard>
                                                                        <MetricLabel>Tempo</MetricLabel>
                                                                        <MetricValue>{analysisResult.audio_analysis.tempo_bpm ?? 'N/A'} <MetricUnit>BPM</MetricUnit></MetricValue>
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
                                                    </NoDialogueNotice>
                                                );
                                            }

                                            return (
                                                <>
                                                    {/* Emotion Detection */}
                                                    <AnalyticsPanel>
                                                        <AnalyticsPanelLabel>
                                                            <GiMicrophone size={13} style={{ opacity: 0.55 }} />
                                                            SECTION 01 — EMOTION DETECTION
                                                        </AnalyticsPanelLabel>

                                                        {analysisResult.emotion_analysis ? (() => {
                                                            const ea = analysisResult.emotion_analysis;
                                                            const emotions = [
                                                                { key: 'happy', label: 'Happy' },
                                                                { key: 'neutral', label: 'Neutral' },
                                                                { key: 'nervous', label: 'Nervous' },
                                                                { key: 'angry', label: 'Angry' },
                                                                { key: 'sad', label: 'Sad' },
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
                                                                    {(ea.reasoning || ea.emotion_reasoning) && (
                                                                        <QuoteCallout>
                                                                            <QuoteCalloutIcon><BsLightbulbFill size={14} /></QuoteCalloutIcon>
                                                                            <QuoteCalloutBody>
                                                                                <QuoteCalloutLabel>AI Reasoning</QuoteCalloutLabel>
                                                                                <QuoteCalloutText>{highlightText(ea.reasoning || ea.emotion_reasoning, searchQuery)}</QuoteCalloutText>
                                                                            </QuoteCalloutBody>
                                                                        </QuoteCallout>
                                                                    )}
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
                                                            const scoreColor = score >= 80 ? '#166534' : score >= 60 ? '#92400e' : '#991b1b';
                                                            const scoreBg = score >= 80 ? 'rgba(22,101,52,0.08)' : score >= 60 ? 'rgba(146,64,14,0.08)' : 'rgba(153,27,27,0.08)';
                                                            const scoreBorder = score >= 80 ? 'rgba(22,101,52,0.2)' : score >= 60 ? 'rgba(146,64,14,0.2)' : 'rgba(153,27,27,0.2)';
                                                            const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Satisfactory' : 'Below Standard';
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
                                                                    {(sc.reasoning || sc.clarity_reasoning) && (
                                                                        <QuoteCallout>
                                                                            <QuoteCalloutIcon><BsLightbulbFill size={14} /></QuoteCalloutIcon>
                                                                            <QuoteCalloutBody>
                                                                                <QuoteCalloutLabel>AI Reasoning</QuoteCalloutLabel>
                                                                                <QuoteCalloutText>{highlightText(sc.reasoning || sc.clarity_reasoning, searchQuery)}</QuoteCalloutText>
                                                                            </QuoteCalloutBody>
                                                                        </QuoteCallout>
                                                                    )}
                                                                </>
                                                            );
                                                        })() : (
                                                            <AnalyticsEmpty>No speech clarity data available.</AnalyticsEmpty>
                                                        )}
                                                    </AnalyticsPanel>
                                                </>
                                            );
                                        })()}
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
    background: #f6f9fc;
`;

const LoadingSpinner = styled.div`
    width: 36px;
    height: 36px;
    border: 3px solid #e4e9f0;
    border-top-color: #2c6edb;
    border-radius: 50%;
    animation: ${spinAnim} 0.8s linear infinite;
`;

const PageWrapper = styled.div`
    width: 100%;
    min-height: 100vh;
    background: #ffffff;
    display: flex;
    flex-direction: column;
`;

const bannerTones = {
    info:    { fg: '#075985', bg: '#f0f9ff', border: '#bae6fd', iconBg: '#e0f2fe' },
    success: { fg: '#166534', bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#dcfce7' },
    warning: { fg: '#92400e', bg: '#fffbeb', border: '#fde68a', iconBg: '#fef3c7' },
    neutral: { fg: '#334155', bg: '#f8fafc', border: '#e2e8f0', iconBg: '#f1f5f9' },
};

const AnnouncementBanner = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: ${p => (bannerTones[p.$tone] || bannerTones.info).bg};
    border: 1px solid ${p => (bannerTones[p.$tone] || bannerTones.info).border};
    border-radius: 12px;
    color: ${p => (bannerTones[p.$tone] || bannerTones.info).fg};
    font-size: 0.8125rem;
    font-weight: 500;
    margin-bottom: 20px;
`;

const AnnouncementIcon = styled.span`
    display: flex;
    align-items: center;
    flex-shrink: 0;
`;

const AnnouncementText = styled.span`
    flex: 1;
    min-width: 0;
    b { font-weight: 700; }
`;

const AnnouncementClose = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    transition: opacity 0.15s, background 0.15s;

    &:hover { opacity: 1; background: rgba(0,0,0,0.06); }
`;

const Banner = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: ${p => (bannerTones[p.$tone] || bannerTones.info).bg};
    border: 1px solid ${p => (bannerTones[p.$tone] || bannerTones.info).border};
    border-radius: 12px;
    margin-bottom: 20px;
`;

const BannerIconWrap = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    flex-shrink: 0;
    color: ${p => (bannerTones[p.$tone] || bannerTones.info).fg};
    background: ${p => (bannerTones[p.$tone] || bannerTones.info).iconBg};
`;

const BannerBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
`;

const BannerTitle = styled.p`
    font-size: 0.875rem;
    font-weight: 700;
    color: ${p => (bannerTones[p.$tone] || bannerTones.info).fg};
    margin: 0;
`;

const BannerDesc = styled.p`
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.55;
    color: ${p => (bannerTones[p.$tone] || bannerTones.info).fg};
    opacity: 0.85;
    margin: 0;
`;

const QuoteCallout = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 14px;
    padding: 14px 16px;
    background: #f8fafc;
    border-left: 3px solid #7dd3fc;
    border-radius: 0 10px 10px 0;
`;

const QuoteCalloutIcon = styled.span`
    display: flex;
    align-items: flex-start;
    padding-top: 2px;
    color: #0284c7;
    flex-shrink: 0;
`;

const QuoteCalloutBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
`;

const QuoteCalloutLabel = styled.span`
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #0284c7;
    opacity: 0.75;
`;

const QuoteCalloutText = styled.p`
    font-size: 0.875rem;
    font-style: italic;
    line-height: 1.65;
    color: #475569;
    margin: 0;
`;

const MainContent = styled.main`
    flex: 1;
    margin-top: 80px;
    margin-left: 230px;
    margin-right: ${props => props.$isRightbarCollapsed ? '60px' : '400px'};
    padding: 32px 28px 48px;
    min-height: calc(100vh - 80px);
    transition: margin-right 0.3s ease;

    @media (max-width: 1280px) { margin-right: 0; }
    @media (max-width: 768px)  { margin-left: 0; padding: 20px 16px 40px; }
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
    border: 1px solid #e4e9f0;
    color: #14181f;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: none;
    transition: all 0.2s;

    &:hover { background: #f6f9fc; }
    @media (max-width: 768px) { display: flex; }
`;

const ContentWrapper = styled.div`
    max-width: 1200px;
    margin: 0 auto;
`;

const SavedDetailHeader = styled.header`
    padding: 2px 0 24px;
    margin-bottom: 24px;
    border-bottom: 1px solid #e4e9f0;
`;

const BackLink = styled(Link)`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 20px;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;

    &:hover { color: #14181f; }
`;

const SavedIdentityRow = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
`;

const SavedFileIcon = styled.span`
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 10px;
    color: #2c6edb;
    background: #eaf2fb;
`;

const SavedIdentity = styled.div`
    min-width: 0;
`;

const SavedTitle = styled.h1`
    margin: 0 0 5px;
    color: #14181f;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
`;

const SavedMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    color: #6b7280;
    font-size: 0.8rem;
`;

const SavedTone = styled.span`
    padding: 3px 9px;
    margin-left: 2px;
    border: 1px solid #e4e9f0;
    border-radius: 999px;
    color: #14181f;
    text-transform: capitalize;
`;

const SavedActions = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 20px;
`;

const SavedPlayButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 15px;
    border: 1px solid #2c6edb;
    border-radius: 8px;
    background: #2c6edb;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;

    &:hover { background: #245ebc; border-color: #245ebc; }
`;

const SavedTextAction = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #6b7280;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;

    &:hover { color: #14181f; background: #f6f9fc; }
`;

const SavedVideoSection = styled.section`
    margin-bottom: 24px;
    border: 1px solid #e4e9f0;
    background: #14181f;
    line-height: 0;
`;

const SavedVideoPlayer = styled.video`
    display: block;
    width: 100%;
    max-height: 520px;
    object-fit: contain;
    background: #14181f;
`;

const RecordingOverview = styled.section`
    margin: 0 0 24px;
    border-top: 1px solid #e4e9f0;
    border-bottom: 1px solid #e4e9f0;
`;

const RecordingOverviewHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 0;
`;

const RecordingOverviewTitle = styled.h2`
    margin: 0 0 3px;
    color: #14181f;
    font-size: 1rem;
    font-weight: 600;
`;

const RecordingOverviewSubtitle = styled.p`
    margin: 0;
    color: #6b7280;
    font-size: 0.78rem;
`;

const RecordingOverviewLink = styled(Link)`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    color: #2c6edb;
    font-size: 0.8125rem;
    font-weight: 500;

    &:hover { color: #14181f; }
`;

const RecordingOverviewList = styled.div`
    border-top: 1px solid #e4e9f0;
`;

const RecordingOverviewRow = styled(Link)`
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 15px 0;
    color: #6b7280;
    border-bottom: 1px solid #e4e9f0;

    &:last-child { border-bottom: none; }
    &:hover { color: #2c6edb; }
`;

const RecordingOverviewIcon = styled.span`
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 8px;
    background: #eaf2fb;
    color: #2c6edb;
`;

const RecordingOverviewBody = styled.div`
    flex: 1;
    min-width: 0;
`;

const RecordingOverviewName = styled.p`
    margin: 0 0 3px;
    color: #14181f;
    font-size: 0.875rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const RecordingOverviewMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    color: #6b7280;
    font-size: 0.75rem;
`;

const RecordingOverviewTone = styled.span`
    padding: 2px 7px;
    border: 1px solid #e4e9f0;
    border-radius: 999px;
    color: #14181f;
    text-transform: capitalize;
`;

const RecordingOverviewSummary = styled.p`
    display: -webkit-box;
    margin: 7px 0 0;
    max-width: 760px;
    overflow: hidden;
    color: #6b7280;
    font-size: 0.78rem;
    line-height: 1.55;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
`;

const RecordingOverviewSkeleton = styled.div`
    height: 74px;
    background: #f6f9fc;
    border-bottom: 1px solid #e4e9f0;

    &:last-child { border-bottom: none; }
`;

const RecordingOverviewEmpty = styled.p`
    margin: 0;
    padding: 18px 0;
    color: #6b7280;
    border-top: 1px solid #e4e9f0;
    font-size: 0.8125rem;
`;

const HeroSection = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 4px 0 28px;
    margin-bottom: 0;
    background: #ffffff;
    border-bottom: 1px solid #e4e9f0;
    position: relative;

    @media (max-width: 640px) { padding: 0 0 24px; }
`;

const HeroTextCol = styled.div`
    display: flex;
    flex-direction: column;
    gap: 7px;
    position: relative;
    z-index: 1;
`;

const HeroEyebrow = styled.span`
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
`;

const HeroGreeting = styled.h1`
    font-size: 1.75rem;
    font-weight: 600;
    color: #14181f;
    margin: 0;
    letter-spacing: -0.01em;

    @media (max-width: 640px) { font-size: 1.5rem; }
`;

const HeroSubtitle = styled.p`
    font-size: 0.875rem;
    font-weight: 400;
    color: #6b7280;
    margin: 2px 0 0 0;
    max-width: 640px;
    line-height: 1.6;
`;

const FeatureCardsRow = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 24px;
    border-bottom: 1px solid #e4e9f0;

    @media (max-width: 760px) {
        grid-template-columns: 1fr;
    }
`;

const FeatureCard = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 24px 24px 24px 0;
    background: #ffffff;
    border-right: 1px solid #e4e9f0;

    &:not(:first-child) { padding-left: 24px; }
    &:last-child { border-right: none; padding-right: 0; }

    @media (max-width: 760px) {
        padding: 18px 0;
        border-right: none;
        border-bottom: 1px solid #e4e9f0;

        &:not(:first-child) { padding-left: 0; }
        &:last-child { border-bottom: none; }
    }
`;

const FeatureIconWrap = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: #2c6edb;
`;

const FeatureBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
`;

const FeatureTitle = styled.span`
    font-size: 0.875rem;
    font-weight: 600;
    color: #14181f;
`;

const FeatureDesc = styled.span`
    font-size: 0.8125rem;
    color: #6b7280;
    line-height: 1.5;
`;

const HeroDateChip = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #6b7280;
    padding: 7px 11px;
    background: #ffffff;
    border: 1px solid #e4e9f0;
    border-radius: 999px;
    white-space: nowrap;
    position: relative;
    z-index: 1;

    svg { color: #2c6edb; }

    @media (max-width: 560px) { padding: 7px; span { display: none; } }
`;

const VideoUploadSection = styled.section`
    margin-bottom: 28px;
`;

const UploadBox = styled.label`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 340px;
    background: #f8fafc;
    border: 1.5px dashed #cbd5e1;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.25s ease;
    position: relative;
    overflow: hidden;

    &:hover {
        border-color: #0284c7;
        background: #f0f9ff;
    }

    .upload-input { position: absolute; width: 0; height: 0; opacity: 0; }

    @media (max-width: 640px) {
        min-height: 260px;
    }
`;

const UploadIconWrap = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #e0f2fe;
    color: #0284c7;
    margin-bottom: 20px;

    .upload-icon { width: 28px; height: 28px; }

    @media (max-width: 640px) {
        width: 52px;
        height: 52px;
        margin-bottom: 16px;
        .upload-icon { width: 24px; height: 24px; }
    }
`;

const UploadTitle = styled.p`
    font-size: 1.0625rem;
    font-weight: 650;
    color: #1e293b;
    margin: 0 0 6px 0;
    letter-spacing: -0.005em;
`;

const UploadHint = styled.p`
    font-size: 0.875rem;
    font-weight: 400;
    color: #94a3b8;
    margin: 0 0 20px 0;
`;

const UploadTagRow = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 0 20px;
`;

const UploadTag = styled.span`
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 5px 12px;
`;

const HowItWorksRow = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 16px;
`;

const HowItWorksStep = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
`;

const HowItWorksNum = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #0284c7;
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
`;

const HowItWorksBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
`;

const HowItWorksTitle = styled.span`
    font-size: 0.875rem;
    font-weight: 650;
    color: #1e293b;
`;

const HowItWorksText = styled.span`
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.5;
`;

const VideoSection = styled.section`
    margin-bottom: 28px;
`;

const VideoPlayerWrap = styled.div`
    border-radius: 16px 16px 0 0;
    overflow: hidden;
    background: #000;
    line-height: 0;
`;

const VideoPlayer = styled.video`
    width: 100%;
    max-height: 500px;
    display: block;
    background: #000;
    object-fit: contain;
`;

const VideoInfoCard = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    background: white;
    border: 1px solid #e4e9f0;
    border-top: none;
    border-radius: 0 0 16px 16px;
    box-shadow: none;

    @media (max-width: 640px) {
        flex-direction: column;
        align-items: stretch;
    }
`;

const VideoFileNameRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
`;

const VideoFileIcon = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: #eff6ff;
    color: #0284c7;
    flex-shrink: 0;
`;

const VideoFileName = styled.p`
    font-size: 0.9375rem;
    color: #1e293b;
    margin: 0;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
`;

const ButtonGroup = styled.div`
    display: flex;
    gap: 10px;
    flex-shrink: 0;
    @media (max-width: 640px) { flex-direction: column; }
`;

const PrimaryButton = styled.button`
    padding: 10px 22px;
    background: #2c6edb;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: none;
    white-space: nowrap;

    &:hover:not(:disabled) { background: #245ebc; }
    &:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

    @media (max-width: 640px) { width: 100%; padding: 12px 22px; }
`;

const SecondaryButton = styled.button`
    padding: 10px 20px;
    background: white;
    color: #475569;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
    &:disabled { opacity: 0.55; cursor: not-allowed; }

    @media (max-width: 640px) { width: 100%; padding: 12px 20px; }
`;

const ErrorMessage = styled.div`
    color: #b91c1c;
    margin: 20px 0 0 0;
    font-size: 0.875rem;
    padding: 14px 16px;
    background: #fef2f2;
    border-radius: 12px;
    border: 1px solid #fecaca;
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 1.5;
    strong { font-weight: 650; }
`;

const ProgressPanel = styled.div`
    position: relative;
    margin: 20px 0 0 0;
    background: white;
    border: 1px solid #e4e9f0;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: none;
`;

const indeterminateSlide = keyframes`
    0%   { left: -30%; }
    100% { left: 100%; }
`;

const ProgressBarIndeterminate = styled.div`
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: #eef2f7;
    overflow: hidden;

    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: -30%;
        width: 30%;
        height: 100%;
        background: #0284c7;
        opacity: 0.85;
        border-radius: 2px;
        animation: ${indeterminateSlide} 1.3s ease-in-out infinite;
    }
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
    margin-top: 8px;
`;

const ResultsHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    @media (max-width: 640px) { flex-direction: column; align-items: stretch; }
`;

const SearchBar = styled.div`
    flex: 1;
    min-width: 220px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    transition: border-color 0.15s;

    &:focus-within { border-color: #0284c7; }

    .search-icon { font-size: 1.125rem; color: #94a3b8; flex-shrink: 0; }

    input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 0.875rem;
        color: #1e293b;
        background: transparent;
        &::placeholder { color: #94a3b8; }
    }
`;

const ActionButtons = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: white;
    border: 1px solid #e4e9f0;
    border-radius: 12px;
    box-shadow: none;
    @media (max-width: 640px) { width: 100%; justify-content: space-between; }
`;

const ActionButton = styled.button`
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;

    &:hover { background: #f1f5f9; color: #0284c7; }
`;

const SaveButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #0284c7;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;

    &:hover:not(:disabled) { background: #0369a1; }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const ResetButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    color: #64748b;
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;

    &:hover { background: #fef2f2; color: #dc2626; }
`;

const TabsContainer = styled.div`
    margin-bottom: 20px;
    background: transparent;
    border-bottom: 1px solid #e4e9f0;
    padding: 0;
    overflow-x: auto;

    &::-webkit-scrollbar { height: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
`;

const TabsScrollWrapper = styled.div`
    display: flex;
    gap: 24px;
    min-width: max-content;
`;

const Tab = styled.button`
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 11px 0 12px;
    background: transparent;
    color: ${props => props.$isActive ? '#14181f' : '#6b7280'};
    border: none;
    border-bottom: 2px solid ${props => props.$isActive ? '#2c6edb' : 'transparent'};
    border-radius: 0;
    font-size: 0.8125rem;
    font-weight: 550;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover { color: #14181f; }
    @media (max-width: 768px) { padding: 10px 0 11px; }
`;

const TabIcon = styled.span`
    display: flex;
    align-items: center;
    font-size: 1.0625rem;
    @media (max-width: 768px) { font-size: 1rem; }
`;

const TabText = styled.span`
    @media (max-width: 560px) { display: none; }
`;

const QuickStatsRow = styled.div`
    display: flex;
    align-items: stretch;
    margin-bottom: 20px;
    padding: 16px 0;
    background: #f6f9fc;
    border-top: 1px solid #e4e9f0;
    border-bottom: 1px solid #e4e9f0;
    overflow-x: auto;

    @media (max-width: 760px) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        padding: 0 14px;
    }
`;

const QuickStatChip = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1 0 150px;
    padding: 0 18px;
    background: transparent;
    border-right: 1px solid #e4e9f0;

    &:last-child { border-right: none; }

    @media (max-width: 760px) {
        min-width: 0;
        padding: 16px 8px;
        border-right: none;
        border-bottom: 1px solid #e4e9f0;

        &:nth-last-child(-n + 2) { border-bottom: none; }
    }
`;

const QuickStatIcon = styled.span`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #2c6edb;
`;

const QuickStatText = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
`;

const QuickStatLabel = styled.span`
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: normal;
    text-transform: none;
    color: #6b7280;
`;

const QuickStatValue = styled.span`
    font-size: 0.9375rem;
    font-weight: 600;
    color: #14181f;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ContentCard = styled.div`
    position: relative;
    background: white;
    border: 1px solid #e4e9f0;
    border-radius: 14px;
    padding: 20px;
    overflow: hidden;

    @media (min-width: 768px) { padding: 32px; }
`;

const CardHeaderRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f1f5f9;
`;

const CardHeaderIcon = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: #eff6ff;
    color: #0284c7;
    font-size: 1.0625rem;
    flex-shrink: 0;
`;

const CardHeaderTextCol = styled.div`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
`;

const CardHeaderName = styled.span`
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #334155;
`;

const CardHeaderDesc = styled.span`
    font-size: 0.8125rem;
    font-weight: 400;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    @media (max-width: 640px) { white-space: normal; }
`;

const LanguagePill = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 650;
    color: #0369a1;
    background: #f0f9ff;
    border: 1px solid #e0f2fe;
    border-radius: 999px;
    padding: 5px 11px;
    text-transform: capitalize;
    white-space: nowrap;
`;

const contentFadeIn = keyframes`
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const ContentSection = styled.div`
    width: 100%;
    animation: ${contentFadeIn} 0.25s ease;
`;

const ContentTitle = styled.h2`
    font-size: 1.0625rem;
    font-weight: 650;
    color: #0f172a;
    letter-spacing: -0.005em;
    margin: 0 0 12px 0;
    @media (min-width: 768px) { font-size: 1.1875rem; margin-bottom: 14px; }
`;

const ContentText = styled.p`
    font-size: 0.9375rem;
    font-weight: 400;
    line-height: 1.75;
    color: #475569;
    margin: 0 0 24px 0;
    white-space: pre-wrap;
    @media (min-width: 768px) { font-size: 0.9375rem; }
`;

const EmotionsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin: 24px 0;
    @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); gap: 10px; }
`;

const EmotionCard = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
    background: #f8fafc;
    border: 1px solid #eef1f5;
    border-radius: 12px;
    text-align: center;
    transition: all 0.2s;

    &:hover { background: #f1f5f9; border-color: #e2e8f0; transform: translateY(-2px); }

    .emotion-icon {
        font-size: 2.5rem;
        &.happy   { color: #22c55e; }
        &.neutral { color: #eab308; }
        &.excited { color: #3b82f6; }
        &.sad     { color: #ef4444; }
    }

    @media (max-width: 640px) {
        padding: 16px 12px;
        .emotion-icon { font-size: 2.25rem; }
    }
`;

const EmotionLabel = styled.p`
    font-size: 0.8125rem;
    font-weight: 600;
    color: #334155;
    margin: 0;
`;

const EmotionValue = styled.p`
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
    font-variant-numeric: tabular-nums;
`;

const ReasoningSection = styled.div`margin-top: 28px;`;

const ReasonItem = styled.p`
    font-size: 0.9375rem;
    font-weight: 400;
    line-height: 1.7;
    color: #475569;
    margin: 0 0 14px 0;
    strong { color: #1e293b; font-weight: 600; }
`;

const VisualMetricsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin: 20px 0;
    @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); gap: 10px; }
`;

const MetricCard = styled.div`
    position: relative;
    padding: 16px 16px 16px 18px;
    background: #f8fafc;
    border-radius: 12px;
    text-align: center;
    border: 1px solid #eef1f5;
    transition: all 0.2s;

    &::before {
        content: '';
        position: absolute;
        top: 10px; bottom: 10px; left: 0;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: #7dd3fc;
        opacity: 0.7;
    }

    &:hover { border-color: #bae0f7; background: #f0f9ff; transform: translateY(-1px); }
`;

const MetricLabel = styled.p`
    font-size: 0.75rem;
    color: #64748b;
    margin: 0 0 6px 0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
`;

const MetricValue = styled.p`
    font-size: 1.375rem;
    color: #0369a1;
    margin: 0;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
`;

const MetricUnit = styled.span`
    font-size: 0.6875rem;
    font-weight: 500;
    color: #94a3b8;
`;

const ToneBadge = styled.p`
    font-size: 0.875rem;
    font-weight: 650;
    color: #0369a1;
    margin: 0;
    text-transform: capitalize;
`;

const AudioMetricsBadge = styled.div`
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 650;
    color: #6366f1;
    background: #eef2ff;
    border-radius: 8px;
    padding: 5px 10px;
    margin: 20px 0 12px;
    gap: 5px;
`;

const AnalyticsHeader = styled.div`
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid #e5e7eb;
`;

const AnalyticsHeaderTitle = styled.h2`
    font-size: 1.0625rem;
    font-weight: 650;
    color: #0f172a;
    margin: 0 0 3px 0;
    letter-spacing: -0.005em;
`;

const AnalyticsHeaderSub = styled.p`
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0;
    font-weight: 400;
`;

const AnalyticsPanel = styled.div`
    background: #ffffff;
    border: 1px solid #eef1f5;
    border-radius: 12px;
    margin-bottom: 14px;
    overflow: hidden;
`;

const AnalyticsPanelLabel = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #eef1f5;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #64748b;
    text-transform: uppercase;
`;

const AnalyticsEmpty = styled.p`
    padding: 24px 20px;
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0;
`;

const AnalyticsFootnote = styled.p`
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
    padding: 10px 16px 14px;
    border-top: 1px solid #f1f5f9;
    line-height: 1.5;
`;

const SuggestionTable = styled.table`width: 100%; border-collapse: collapse;`;

const SuggestionTr = styled.tr`
    vertical-align: top;
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.12s;
    &:last-child { border-bottom: none; }
    &:hover { background: #f8fafc; }
`;

const SuggestionNumTd = styled.td`
    padding: 16px 12px 16px 20px;
    width: 40px;
    vertical-align: top;
    padding-top: 16px;
`;

const SuggestionNumBadge = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #eff6ff;
    color: #0284c7;
    font-size: 0.6875rem;
    font-weight: 700;
`;

const SuggestionCategoryTd = styled.td`
    padding: 16px 16px 16px 0;
    width: 170px;
    vertical-align: top;
`;

const SuggestionCategoryName = styled.p`
    font-size: 0.875rem;
    font-weight: 650;
    color: #0f172a;
    margin: 0 0 6px 0;
`;

const SuggestionTag = styled.span`
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1d4ed8;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    border-radius: 4px;
    padding: 2px 6px;
`;

const SuggestionContentTd = styled.td`
    padding: 16px 20px 16px 0;
    font-size: 0.875rem;
    color: #475569;
    line-height: 1.65;
    vertical-align: top;
`;

const AudioDeliveryRow = styled.div`
    display: flex;
    align-items: stretch;
    padding: 16px 20px;
    gap: 0;
    flex-wrap: wrap;
`;

const AudioDeliveryItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 120px;
    padding: 0 16px;
    &:first-child { padding-left: 0; }
`;

const AudioDeliveryDivider = styled.div`
    width: 1px;
    background: #eef1f5;
    flex-shrink: 0;
    @media (max-width: 560px) { display: none; }
`;

const AudioDeliveryLabel = styled.span`
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #94a3b8;
`;

const AudioDeliveryValue = styled.span`
    font-size: 0.9375rem;
    font-weight: 650;
    color: #0f172a;
    text-transform: capitalize;
`;

const AudioDeliveryUnit = styled.span`
    font-size: 0.75rem;
    font-weight: 400;
    color: #94a3b8;
`;

const EmotionTable = styled.table`width: 100%; border-collapse: collapse;`;
const EmotionTableHead = styled.thead`background: #f8fafc;`;

const EmotionTh = styled.th`
    padding: 9px 16px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #94a3b8;
    text-align: ${p => p.$right ? 'right' : 'left'};
    border-bottom: 1px solid #eef1f5;
    white-space: nowrap;
`;

const EmotionTr = styled.tr`
    background: ${p => p.$isDominant ? 'rgba(2,132,199,0.04)' : 'transparent'};
    border-left: ${p => p.$isDominant ? '3px solid #0284c7' : '3px solid transparent'};
    transition: background 0.15s;
    &:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
    &:hover { background: #f8fafc; }
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
    color: ${p => p.$isDominant ? '#0f172a' : '#475569'};
`;

const EmotionBarTrack = styled.div`
    height: 6px;
    background: #f1f5f9;
    border-radius: 3px;
    overflow: hidden;
`;

const EmotionBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: ${p => p.$isDominant ? '#0284c7' : '#94a3b8'};
    border-radius: 3px;
    transition: width 0.5s ease;
`;

const EmotionPct = styled.span`
    font-size: 0.875rem;
    font-weight: ${p => p.$isDominant ? '700' : '500'};
    color: ${p => p.$isDominant ? '#0369a1' : '#64748b'};
    font-variant-numeric: tabular-nums;
`;

const EmotionDominantTag = styled.span`
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #0369a1;
    background: #e0f2fe;
    border: 1px solid #bae6fd;
    border-radius: 4px;
    padding: 2px 7px;
`;

const EmotionNullTag = styled.span`
    font-size: 0.875rem;
    color: #cbd5e1;
`;

const OverallScoreRow = styled.div`
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 18px 20px;
    border-bottom: 1px solid #eef1f5;
    flex-wrap: wrap;
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
    border-radius: 10px;
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
    font-weight: 650;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
`;

const OverallScoreBarTrack = styled.div`
    height: 8px;
    background: #f1f5f9;
    border-radius: 4px;
    overflow: hidden;
`;

const OverallScoreBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: ${p => p.$color || '#166534'};
    opacity: 0.8;
    border-radius: 4px;
    transition: width 0.6s ease;
`;

const OverallScoreBarLegend = styled.div`
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 0.6875rem;
    color: #94a3b8;
    font-weight: 500;
`;

const ClarityTable = styled.table`width: 100%; border-collapse: collapse;`;
const ClarityTableHead = styled.thead`background: #f8fafc;`;

const ClarityTh = styled.th`
    padding: 9px 16px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #94a3b8;
    text-align: ${p => p.$right ? 'right' : 'left'};
    border-bottom: 1px solid #eef1f5;
    white-space: nowrap;
`;

const ClarityTr = styled.tr`
    &:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
    &:hover { background: #f8fafc; }
`;

const ClarityTd = styled.td`
    padding: 11px 16px;
    vertical-align: middle;
    text-align: ${p => p.$right ? 'right' : 'left'};
    width: ${p => p.$wide ? '38%' : 'auto'};
`;

const ClarityMetricName = styled.span`font-size: 0.875rem; font-weight: 500; color: #475569;`;
const ClarityMetricVal = styled.span`font-size: 0.9375rem; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums;`;
const ClarityUnit = styled.span`font-size: 0.75rem; font-weight: 400; color: #94a3b8; margin-left: 2px;`;

const ClarityBarTrack = styled.div`height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;`;
const ClarityBarFill = styled.div`
    height: 100%;
    width: ${p => p.$pct ?? 0}%;
    background: #3b5fc4;
    opacity: 0.55;
    border-radius: 3px;
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
        p.$rating === 'Ideal' ? 'rgba(22,101,52,0.9)' :
            p.$rating === 'Fast' ? 'rgba(146,64,14,0.9)' :
                p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.9)' :
                    'rgba(55,65,81,0.7)'};
    background: ${p =>
        p.$rating === 'Ideal' ? 'rgba(22,101,52,0.1)' :
            p.$rating === 'Fast' ? 'rgba(146,64,14,0.1)' :
                p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.1)' :
                    'rgba(0,0,0,0.05)'};
    border: 1px solid ${p =>
        p.$rating === 'Ideal' ? 'rgba(22,101,52,0.2)' :
            p.$rating === 'Fast' ? 'rgba(146,64,14,0.2)' :
                p.$rating === 'Too Fast' ? 'rgba(153,27,27,0.2)' :
                    'rgba(0,0,0,0.1)'};
`;

const NoDialogueNotice = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 32px;
    background: #f8fafc;
    border: 1px dashed #e2e8f0;
    border-radius: 12px;
    gap: 10px;
`;

const NoDialogueIcon = styled.div`
    margin-bottom: 4px;
    color: #cbd5e1;
`;

const NoDialogueTitle = styled.div`
    font-size: 1rem;
    font-weight: 650;
    color: #334155;
    letter-spacing: -0.01em;
`;

const NoDialogueText = styled.div`
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.65;
    max-width: 460px;
`;

const NoDialogueSub = styled.div`
    font-size: 0.8125rem;
    font-weight: 650;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 8px;
`;

export default Home;
