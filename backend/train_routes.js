// ═══════════════════════════════════════════════════════════════════════════════
// train_routes.js  —  Standalone training feature (DO NOT modify index.js)
//
// HOW TO PLUG IN:
//   In index.js, add these two lines anywhere after `const app = express();`:
//
//     import trainRouter from "./train_routes.js";
//     app.use("/train", trainRouter);
//
// That's it. All new routes live under /train/* and touch nothing existing.
// ═══════════════════════════════════════════════════════════════════════════════

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const router = express.Router();

// ── ANSI colour helpers (VS Code terminal supports these) ─────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  blue:   "\x1b[34m",
  red:    "\x1b[31m",
  gray:   "\x1b[90m",
  white:  "\x1b[97m",
};

// ── Terminal printer ──────────────────────────────────────────────────────────
// Everything here goes to process.stdout so it appears in the VS Code terminal.
function terminalLog(msg) {
  process.stdout.write(`${C.gray}[train]${C.reset} ${msg}\n`);
}

function terminalEpoch(epoch, totalEpochs, loss, accuracy) {
  const bar = buildBar(epoch, totalEpochs, 20);
  const pct = Math.round((epoch / totalEpochs) * 100).toString().padStart(3);

  process.stdout.write(
    `${C.cyan}${C.bold}[EPOCH ${String(epoch).padStart(2)}/${totalEpochs}]${C.reset}` +
    `  ${C.blue}${bar}${C.reset} ${C.white}${pct}%${C.reset}` +
    `  loss=${C.yellow}${loss.toFixed(4)}${C.reset}` +
    `  acc=${C.green}${(accuracy * 100).toFixed(2)}%${C.reset}\n`
  );
}

function terminalDone(result) {
  const line = "─".repeat(52);
  process.stdout.write(
    `\n${C.green}${C.bold}╔${line}╗${C.reset}\n` +
    `${C.green}${C.bold}║${C.reset}  ✅  Training Complete` +
      " ".repeat(30) +
    `${C.green}${C.bold}║${C.reset}\n` +
    `${C.green}${C.bold}╠${line}╣${C.reset}\n` +
    fmtRow("Accuracy",  pct(result.accuracy))  +
    fmtRow("Precision", pct(result.precision)) +
    fmtRow("Recall",    pct(result.recall))    +
    fmtRow("F1 Score",  pct(result.f1))        +
    fmtRow("Duration",  `${result.duration_seconds}s`) +
    fmtRow("Dataset",   `${result.dataset_size} rows`) +
    `${C.green}${C.bold}╚${line}╝${C.reset}\n\n`
  );
}

function terminalError(msg) {
  process.stderr.write(`${C.red}${C.bold}[train ERROR]${C.reset} ${msg}\n`);
}

function terminalSection(label) {
  process.stdout.write(
    `\n${C.cyan}${"─".repeat(10)} ${C.bold}${label}${C.reset}${C.cyan} ${"─".repeat(10)}${C.reset}\n`
  );
}

// Helpers
function buildBar(current, total, width) {
  const filled = Math.round((current / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
function pct(v) {
  return v != null ? `${(v * 100).toFixed(2)}%` : "N/A";
}
function fmtRow(label, value) {
  const pad = " ".repeat(Math.max(0, 14 - label.length));
  return (
    `${C.green}${C.bold}║${C.reset}  ` +
    `${C.white}${label}${C.reset}${pad}` +
    `${C.yellow}${value}${C.reset}` +
    "\n"
  );
}

// ── 1. Multer config for CSV uploads ─────────────────────────────────────────
const datasetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/datasets/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const datasetUpload = multer({
  storage: datasetStorage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      path.extname(file.originalname).toLowerCase() === ".csv"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv files are allowed"), false);
    }
  },
});

// ── 2. In-memory session store ────────────────────────────────────────────────
const sessions = new Map();

function makeSession() {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessions.set(id, {
    clients: new Set(),
    logs: [],
    done: false,
    result: null,
    error: null,
  });
  return id;
}

// Broadcast SSE event AND print to VS Code terminal
function broadcast(sessionId, eventName, payload) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  session.logs.push({ event: eventName, payload });

  for (const client of session.clients) {
    try {
      client.write(data);
    } catch (_) {
      session.clients.delete(client);
    }
  }
}

// ── 3. POST /train/upload-dataset ────────────────────────────────────────────
router.post("/upload-dataset", datasetUpload.single("dataset"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded" });
  }

  const filePath = req.file.path;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const datasetSize = Math.max(0, lines.length - 1);

  terminalLog(`📂 Dataset uploaded: ${C.white}${req.file.originalname}${C.reset}  (${datasetSize} rows)`);

  return res.json({ filePath, datasetSize });
});

// ── 4. POST /train/start ─────────────────────────────────────────────────────
router.post("/start", (req, res) => {
  const { filePath } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: "Invalid or missing filePath" });
  }

  const sessionId = makeSession();
  res.json({ sessionId });

  terminalSection("ML Training Started");
  terminalLog(`Session : ${C.white}${sessionId}${C.reset}`);
  terminalLog(`File    : ${C.white}${filePath}${C.reset}`);

  // ── Spawn Python ──────────────────────────────────────────────────────────
  const pyProcess = spawn("../venv/bin/python", ["./train_model.py", filePath]);

  let lineBuffer = "";

  pyProcess.stdout.on("data", (chunk) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop(); // keep incomplete last line

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch (_) {
        // Non-JSON output — print as-is and forward as log
        terminalLog(line);
        broadcast(sessionId, "log", line);
        continue;
      }

      switch (msg.type) {
        case "epoch":
          // ── Pretty epoch row in terminal ──────────────────────────────────
          terminalEpoch(msg.epoch, msg.total_epochs, msg.loss, msg.accuracy);
          broadcast(sessionId, "epoch", msg);
          break;

        case "log":
          // ── Info lines from Python ────────────────────────────────────────
          terminalLog(msg.message);
          broadcast(sessionId, "log", msg.message);
          break;

        case "done":
          // ── Training finished ─────────────────────────────────────────────
          terminalDone(msg);
          broadcast(sessionId, "done", msg);
          const session = sessions.get(sessionId);
          if (session) {
            session.done = true;
            session.result = msg;
          }
          setTimeout(() => sessions.delete(sessionId), 5 * 60 * 1000);
          break;

        case "error":
          // ── Python-reported error ─────────────────────────────────────────
          terminalError(msg.message);
          broadcast(sessionId, "error_event", { message: msg.message });
          const sess = sessions.get(sessionId);
          if (sess) sess.error = msg.message;
          break;

        default:
          terminalLog(`[unknown type] ${line}`);
          broadcast(sessionId, "log", line);
      }
    }
  });

  pyProcess.stderr.on("data", (data) => {
    // ALL stderr goes to the terminal so nothing is hidden from the developer
    const raw = data.toString().trimEnd();
    if (!raw) return;

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      process.stderr.write(`${C.red}[train_model.py]${C.reset} ${line}\n`);

      // Only surface actual errors (not sklearn convergence warnings) to the UI
      if (
        line.toLowerCase().includes("error") ||
        line.toLowerCase().includes("traceback")
      ) {
        broadcast(sessionId, "log", `[stderr] ${line}`);
      }
    }
  });

  pyProcess.on("close", (code) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    // Flush remaining buffer
    if (lineBuffer.trim()) {
      terminalLog(lineBuffer.trim());
      broadcast(sessionId, "log", lineBuffer.trim());
    }

    if (!session.done) {
      const msg = `Training process exited with code ${code}`;
      terminalError(msg);
      broadcast(sessionId, "error_event", { message: msg });
    } else {
      terminalLog(`Process exited cleanly (code ${code})`);
    }
  });
});

// ── 5. GET /train/stream/:sessionId ──────────────────────────────────────────
router.get("/stream/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // If already finished, replay all cached events and close
  if (session.done || session.error) {
    for (const cached of session.logs) {
      res.write(
        `event: ${cached.event}\ndata: ${JSON.stringify(cached.payload)}\n\n`
      );
    }
    res.end();
    return;
  }

  // Register client and replay anything that happened before connect
  session.clients.add(res);
  for (const cached of session.logs) {
    res.write(
      `event: ${cached.event}\ndata: ${JSON.stringify(cached.payload)}\n\n`
    );
  }

  // Heartbeat every 15 s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (_) {
      clearInterval(heartbeat);
    }
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    session.clients.delete(res);
  });
});

export default router;