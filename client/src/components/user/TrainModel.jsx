import React, { useState, useRef, useEffect, useCallback } from "react";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import ApiUrl from "../config/LocalConfigApi";
import GetAccountId from "../config/LocalStorage.jsx";
import styled, { keyframes } from "styled-components";
import { HiMenuAlt3 } from "react-icons/hi";
import { MdOutlineCloudUpload, MdCheckCircleOutline, MdErrorOutline } from "react-icons/md";
import { BsDatabase, BsCpu, BsGraphUp } from "react-icons/bs";
import { FiClock, FiTarget, FiZap, FiAward } from "react-icons/fi";
import { GoUnlock } from "react-icons/go";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Status constants ───────────────────────────────────────────────────────
const STATUS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  TRAINING: "training",
  DONE: "done",
  ERROR: "error",
};

// ─── Animations ─────────────────────────────────────────────────────────────
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TrainModel() {
  const acc_id = GetAccountId();
  const [user, setUser] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // Upload state
  const [csvFile, setCsvFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Training state
  const [status, setStatus] = useState(STATUS.IDLE);
  const [epochLogs, setEpochLogs] = useState([]);    // [{epoch, loss, accuracy}]
  const [consoleLogs, setConsoleLogs] = useState([]); // raw text lines
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [datasetSize, setDatasetSize] = useState(null);
  const [totalEpochs, setTotalEpochs] = useState(10);

  const consoleEndRef = useRef(null);
  const timerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const startTimeRef = useRef(null);  // ref so interval always reads current value

  // Fetch user
  useEffect(() => {
    if (!acc_id) return;
    fetch(`${ApiUrl.apiURL}/user/${acc_id}`)
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => setUser({ acc_id, acc_email: "user@example.com" }));
  }, [acc_id]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  useEffect(() => {
    if (status === STATUS.TRAINING) {
      startTimeRef.current = Date.now();
      setStartTime(startTimeRef.current);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // ── File handlers ──────────────────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      setCsvFile(file);
      setError("");
    } else {
      setError("Please drop a valid .csv file.");
    }
  };
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFile(file);
      setError("");
    }
  };

  const handleStartTraining = useCallback(async () => {
    if (!csvFile) return;

    setStatus(STATUS.UPLOADING);
    setEpochLogs([]);
    setConsoleLogs([]);
    setSummary(null);
    setError("");
    setElapsed(0);

    try {
      const formData = new FormData();
      formData.append("dataset", csvFile);
      const uploadRes = await fetch(`${ApiUrl.apiURL}/train/upload-dataset`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { filePath, datasetSize: ds } = await uploadRes.json();
      setDatasetSize(ds);

      // 2. Kick off training + open SSE stream
      setStatus(STATUS.TRAINING);
      // startTimeRef is set inside the useEffect when status changes to TRAINING

      const trainRes = await fetch(`${ApiUrl.apiURL}/train/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      if (!trainRes.ok) throw new Error("Failed to start training");
      const { sessionId } = await trainRes.json();

      // 3. Subscribe to SSE
      const es = new EventSource(
        `${ApiUrl.apiURL}/train/stream/${sessionId}`
      );
      eventSourceRef.current = es;

      es.addEventListener("epoch", (e) => {
        const data = JSON.parse(e.data);
        setEpochLogs((prev) => [...prev, data]);
        setConsoleLogs((prev) => [
          ...prev,
          `Epoch ${data.epoch}/${data.total_epochs} — Loss: ${data.loss.toFixed(4)}  Accuracy: ${(data.accuracy * 100).toFixed(2)}%`,
        ]);
        setTotalEpochs(data.total_epochs);
      });

      es.addEventListener("log", (e) => {
        setConsoleLogs((prev) => [...prev, e.data]);
      });

      es.addEventListener("done", (e) => {
        const result = JSON.parse(e.data);
        setSummary(result);
        // Use duration_seconds from Python as ground truth for the summary card
        if (result.duration_seconds) {
          setElapsed(Math.round(result.duration_seconds));
        } else {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
        setStatus(STATUS.DONE);
        es.close();
      });

      es.addEventListener("error_event", (e) => {
        const data = JSON.parse(e.data);
        setError(data.message || "Training error");
        setStatus(STATUS.ERROR);
        es.close();
      });

      es.onerror = () => {
        setError("Connection to training stream lost.");
        setStatus(STATUS.ERROR);
        es.close();
      };
    } catch (err) {
      setError(err.message);
      setStatus(STATUS.ERROR);
    }
  }, [csvFile]);

  const handleReset = () => {
    eventSourceRef.current?.close();
    setCsvFile(null);
    setStatus(STATUS.IDLE);
    setEpochLogs([]);
    setConsoleLogs([]);
    setSummary(null);
    setError("");
    setElapsed(0);
    setDatasetSize(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentEpoch = epochLogs.length;
  const latestLog = epochLogs[epochLogs.length - 1];
  const progressPct =
    totalEpochs > 0 ? Math.round((currentEpoch / totalEpochs) * 100) : 0;

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = epochLogs.map((l) => ({
    epoch: l.epoch,
    Loss: parseFloat(l.loss.toFixed(4)),
    Accuracy: parseFloat((l.accuracy * 100).toFixed(2)),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
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

      <MainContent>
        <ContentWrapper>
          {/* ── Page Header ── */}
          <PageHeader>
            <HeaderLeft>
              <PageIconWrap>
                <GoUnlock size={22} />
              </PageIconWrap>
              <div>
                <PageTitle>Train Model</PageTitle>
                <PageSubtitle>
                  Upload a CSV dataset and simulate ML emotion classification training
                </PageSubtitle>
              </div>
            </HeaderLeft>
            {status !== STATUS.IDLE && (
              <ResetButton onClick={handleReset}>
                Reset
              </ResetButton>
            )}
          </PageHeader>

          {/* ── Step 1: Upload ── */}
          {(status === STATUS.IDLE || status === STATUS.ERROR) && (
            <SectionCard>
              <SectionTitle>
                <BsDatabase size={18} />
                Step 1 — Upload Dataset
              </SectionTitle>
              <SectionDesc>
                Upload your <code>goemotions.csv</code> (or any compatible CSV). The model
                will dynamically detect the <strong>text</strong> column and treat all
                remaining columns as emotion labels.
              </SectionDesc>

              <DropZone
                $isDragging={isDragging}
                $hasFile={!!csvFile}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !csvFile && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {csvFile ? (
                  <FilePreview>
                    <FileIconWrap>
                      <MdCheckCircleOutline size={32} color="#0284c7" />
                    </FileIconWrap>
                    <FileName>{csvFile.name}</FileName>
                    <FileSize>
                      {(csvFile.size / 1024).toFixed(1)} KB
                    </FileSize>
                    <ChangeFileBtn
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Change file
                    </ChangeFileBtn>
                  </FilePreview>
                ) : (
                  <DropZoneInner>
                    <UploadIconWrap>
                      <MdOutlineCloudUpload size={40} />
                    </UploadIconWrap>
                    <DropTitle>Drag &amp; drop your CSV here</DropTitle>
                    <DropOr>or</DropOr>
                    <BrowseBtn>Browse file</BrowseBtn>
                    <DropHint>Accepts .csv files only</DropHint>
                  </DropZoneInner>
                )}
              </DropZone>

              {error && (
                <ErrorBanner>
                  <MdErrorOutline size={18} />
                  {error}
                </ErrorBanner>
              )}

              <StartButton
                disabled={!csvFile || status === STATUS.UPLOADING}
                onClick={handleStartTraining}
              >
                {status === STATUS.UPLOADING ? (
                  <>
                    <Spinner /> Uploading…
                  </>
                ) : (
                  <>
                    <FiZap size={16} /> Start Training
                  </>
                )}
              </StartButton>
            </SectionCard>
          )}

          {/* ── Training in progress ── */}
          {(status === STATUS.TRAINING || status === STATUS.DONE) && (
            <>
              {/* Stats row */}
              <StatsRow>
                <StatCard>
                  <StatIcon><BsCpu size={20} /></StatIcon>
                  <StatBody>
                    <StatLabel>Epoch</StatLabel>
                    <StatValue>
                      {currentEpoch}
                      <StatSub>/ {totalEpochs}</StatSub>
                    </StatValue>
                  </StatBody>
                </StatCard>

                <StatCard>
                  <StatIcon><FiTarget size={20} /></StatIcon>
                  <StatBody>
                    <StatLabel>Loss</StatLabel>
                    <StatValue>
                      {latestLog ? latestLog.loss.toFixed(4) : "—"}
                    </StatValue>
                  </StatBody>
                </StatCard>

                <StatCard>
                  <StatIcon><BsGraphUp size={20} /></StatIcon>
                  <StatBody>
                    <StatLabel>Accuracy</StatLabel>
                    <StatValue>
                      {latestLog
                        ? `${(latestLog.accuracy * 100).toFixed(1)}%`
                        : "—"}
                    </StatValue>
                  </StatBody>
                </StatCard>

                <StatCard>
                  <StatIcon><FiClock size={20} /></StatIcon>
                  <StatBody>
                    <StatLabel>Elapsed</StatLabel>
                    <StatValue>{formatElapsed(elapsed)}</StatValue>
                  </StatBody>
                </StatCard>

                <StatCard>
                  <StatIcon><BsDatabase size={20} /></StatIcon>
                  <StatBody>
                    <StatLabel>Dataset Rows</StatLabel>
                    <StatValue>{datasetSize ?? "—"}</StatValue>
                  </StatBody>
                </StatCard>
              </StatsRow>

              {/* Progress bar */}
              {status === STATUS.TRAINING && (
                <SectionCard style={{ padding: "20px 24px" }}>
                  <ProgressHeader>
                    <ProgressLabel>
                      <PulsingDot /> Training in progress…
                    </ProgressLabel>
                    <ProgressPct>{progressPct}%</ProgressPct>
                  </ProgressHeader>
                  <ProgressTrack>
                    <ProgressFill $pct={progressPct} />
                  </ProgressTrack>
                </SectionCard>
              )}

              {/* Charts */}
              <ChartGrid>
                <SectionCard>
                  <SectionTitle>
                    <BsGraphUp size={18} /> Loss vs Epoch
                  </SectionTitle>
                  <ChartWrap>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="epoch"
                          tick={{ fontSize: 12, fill: "#9ca3af" }}
                          label={{
                            value: "Epoch",
                            position: "insideBottomRight",
                            offset: -4,
                            fontSize: 11,
                            fill: "#9ca3af",
                          }}
                        />
                        <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 13,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 13 }} />
                        <Line
                          type="monotone"
                          dataKey="Loss"
                          stroke="#0284c7"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartWrap>
                </SectionCard>

                <SectionCard>
                  <SectionTitle>
                    <FiTarget size={18} /> Accuracy vs Epoch
                  </SectionTitle>
                  <ChartWrap>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="epoch"
                          tick={{ fontSize: 12, fill: "#9ca3af" }}
                          label={{
                            value: "Epoch",
                            position: "insideBottomRight",
                            offset: -4,
                            fontSize: 11,
                            fill: "#9ca3af",
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#9ca3af" }}
                          unit="%"
                          domain={[0, 100]}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 13,
                          }}
                          formatter={(v) => `${v}%`}
                        />
                        <Legend wrapperStyle={{ fontSize: 13 }} />
                        <Line
                          type="monotone"
                          dataKey="Accuracy"
                          stroke="#075985"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartWrap>
                </SectionCard>
              </ChartGrid>

              {/* Console log */}
              <SectionCard>
                <SectionTitle>
                  <BsCpu size={18} /> Training Log
                </SectionTitle>
                <ConsoleBox>
                  {consoleLogs.length === 0 ? (
                    <ConsolePlaceholder>
                      Waiting for training output…
                    </ConsolePlaceholder>
                  ) : (
                    consoleLogs.map((line, i) => (
                      <ConsoleLine key={i}>{line}</ConsoleLine>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </ConsoleBox>
              </SectionCard>
            </>
          )}

          {/* ── Training Done: Summary ── */}
          {status === STATUS.DONE && summary && (
            <SectionCard $highlight>
              <SummaryHeader>
                <FiAward size={22} color="#0284c7" />
                <SectionTitle style={{ margin: 0 }}>
                  Training Complete — Results Summary
                </SectionTitle>
              </SummaryHeader>

              <MetricsGrid>
                <MetricCard>
                  <MetricLabel>Final Accuracy</MetricLabel>
                  <MetricValue>
                    {summary.accuracy != null
                      ? `${(summary.accuracy * 100).toFixed(2)}%`
                      : "N/A"}
                  </MetricValue>
                </MetricCard>
                <MetricCard>
                  <MetricLabel>Precision</MetricLabel>
                  <MetricValue>
                    {summary.precision != null
                      ? summary.precision.toFixed(4)
                      : "N/A"}
                  </MetricValue>
                </MetricCard>
                <MetricCard>
                  <MetricLabel>Recall</MetricLabel>
                  <MetricValue>
                    {summary.recall != null
                      ? summary.recall.toFixed(4)
                      : "N/A"}
                  </MetricValue>
                </MetricCard>
                <MetricCard>
                  <MetricLabel>F1 Score</MetricLabel>
                  <MetricValue>
                    {summary.f1 != null ? summary.f1.toFixed(4) : "N/A"}
                  </MetricValue>
                </MetricCard>
                <MetricCard>
                  <MetricLabel>Training Duration</MetricLabel>
                  <MetricValue>{formatElapsed(elapsed)}</MetricValue>
                </MetricCard>
                <MetricCard>
                  <MetricLabel>Dataset Size</MetricLabel>
                  <MetricValue>{datasetSize ?? "N/A"} rows</MetricValue>
                </MetricCard>
              </MetricsGrid>

              {summary.label_columns && (
                <LabelsSection>
                  <SectionLabel>Detected Emotion Labels</SectionLabel>
                  <LabelsList>
                    {summary.label_columns.map((lbl) => (
                      <LabelTag key={lbl}>{lbl}</LabelTag>
                    ))}
                  </LabelsList>
                </LabelsSection>
              )}

              

              <ResetButton
                onClick={handleReset}
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                Train Another Dataset
              </ResetButton>
            </SectionCard>
          )}

          {/* ── Error state ── */}
          {status === STATUS.ERROR && error && (
            <ErrorBanner style={{ marginTop: 0 }}>
              <MdErrorOutline size={18} />
              <strong>Error:</strong> {error}
            </ErrorBanner>
          )}
        </ContentWrapper>
      </MainContent>

    </PageWrapper>
  );
}

// ─── Styled Components ────────────────────────────────────────────────────────
// Layout mirrors Home.jsx exactly
const PageWrapper = styled.div`
  width: 100%;
  min-height: 100vh;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;

  &:hover {
    background: #f9fafb;
  }

  @media (max-width: 768px) {
    display: flex;
  }
`;

const MainContent = styled.main`
  flex: 1;
  margin-top: 80px;
  margin-left: 256px;
  margin-right: 0;
  padding: 24px;
  min-height: calc(100vh - 80px);

  @media (max-width: 1024px) {
    margin-left: 0;
    padding: 16px;
  }
`;

const ContentWrapper = styled.div`
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: ${fadeIn} 0.3s ease;
`;

// Page header
const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const PageIconWrap = styled.div`
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
`;

const PageTitle = styled.h1`
  font-size: 1.375rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
`;

const PageSubtitle = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
  margin: 2px 0 0 0;
`;

const ResetButton = styled.button`
  padding: 10px 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    border-color: #0284c7;
    color: #0284c7;
    background: #f0f9ff;
  }
`;

// Section card — mirrors Home's ContentCard
const SectionCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: ${(p) => (p.$highlight ? "1.5px solid #bae6fd" : "none")};
  animation: ${fadeIn} 0.3s ease;
  width: 100%;

  @media (min-width: 768px) {
    padding: 28px 32px;
  }
`;

const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
`;

const SectionDesc = styled.p`
  font-size: 0.9rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;

  code {
    background: #f1f5f9;
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 0.85em;
    color: #0284c7;
  }
`;

// Drop zone
const DropZone = styled.div`
  border: 2px dashed
    ${(p) => (p.$hasFile ? "#0284c7" : p.$isDragging ? "#075985" : "#d1d5db")};
  border-radius: 12px;
  background: ${(p) =>
    p.$hasFile ? "#f0f9ff" : p.$isDragging ? "#f0f9ff" : "#fafafa"};
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${(p) => (p.$hasFile ? "default" : "pointer")};
  transition: all 0.2s;
  min-height: 160px;

  &:hover {
    border-color: ${(p) => (p.$hasFile ? "#0284c7" : "#9ca3af")};
  }
`;

const DropZoneInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
`;

const UploadIconWrap = styled.div`
  color: #9ca3af;
  margin-bottom: 4px;
`;

const DropTitle = styled.p`
  font-size: 1rem;
  font-weight: 500;
  color: #374151;
  margin: 0;
`;

const DropOr = styled.p`
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
`;

const BrowseBtn = styled.span`
  font-size: 0.875rem;
  color: #0284c7;
  font-weight: 500;
  text-decoration: underline;
  cursor: pointer;
`;

const DropHint = styled.p`
  font-size: 0.8125rem;
  color: #9ca3af;
  margin: 4px 0 0 0;
`;

const FilePreview = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const FileIconWrap = styled.div``;

const FileName = styled.p`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
`;

const FileSize = styled.p`
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0;
`;

const ChangeFileBtn = styled.button`
  font-size: 0.8125rem;
  color: #0284c7;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  margin-top: 4px;
`;

const StartButton = styled.button`
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: ${(p) =>
    p.disabled
      ? "#e5e7eb"
      : "linear-gradient(135deg, #075985 0%, #0284c7 100%)"};
  color: ${(p) => (p.disabled ? "#9ca3af" : "white")};
  border: none;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
  transition: all 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
  }
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

// Stats
const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s;
  animation: ${fadeIn} 0.3s ease;

  &:hover {
    border-color: #0284c7;
    background: #f0f9ff;
  }
`;

const StatIcon = styled.div`
  color: #0284c7;
  display: flex;
  align-items: center;
`;

const StatBody = styled.div``;

const StatLabel = styled.p`
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  margin: 0 0 2px 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StatValue = styled.p`
  font-size: 1.375rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

const StatSub = styled.span`
  font-size: 0.875rem;
  font-weight: 400;
  color: #9ca3af;
`;

// Progress
const ProgressHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const ProgressLabel = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin: 0;
`;

const PulsingDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0284c7;
  display: inline-block;
  animation: ${pulse} 1.2s ease-in-out infinite;
`;

const ProgressPct = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: #0284c7;
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 99px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${(p) => p.$pct}%;
  background: linear-gradient(90deg, #075985, #0284c7);
  border-radius: 99px;
  transition: width 0.5s ease;
`;

// Charts
const ChartGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartWrap = styled.div`
  margin-top: 4px;
`;

// Console
const ConsoleBox = styled.div`
  background: #0f172a;
  border-radius: 10px;
  padding: 16px;
  height: 220px;
  overflow-y: auto;
  font-family: "Menlo", "Consolas", monospace;
  font-size: 0.8125rem;
  display: flex;
  flex-direction: column;
  gap: 3px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 2px;
  }
`;

const ConsoleLine = styled.p`
  color: #94a3b8;
  margin: 0;
  white-space: pre-wrap;

  &:last-child {
    color: #38bdf8;
  }
`;

const ConsolePlaceholder = styled.p`
  color: #475569;
  margin: auto;
  font-style: italic;
`;

// Summary
const SummaryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const MetricCard = styled.div`
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;

  &:hover {
    border-color: #0284c7;
    background: #f0f9ff;
  }
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
  font-weight: 700;
`;

const LabelsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionLabel = styled.p`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
`;

const LabelsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const LabelTag = styled.span`
  padding: 4px 10px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 99px;
  font-size: 0.8125rem;
  font-weight: 500;
`;

const DemoNotice = styled.p`
  font-size: 0.8125rem;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 14px;
  margin: 0;
`;

const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #ef4444;
  font-size: 0.875rem;
`;