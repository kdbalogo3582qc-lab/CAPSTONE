import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import multer from "multer";
import mysql from "mysql";
import bcrypt from "bcryptjs";
import trainRouter from "./train_routes.js";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const app  = express();
const port = process.env.PORT;

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(cookieParser());
app.use("/train", trainRouter);

// ─── JWT helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET         = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const signAccessToken  = (acc_id) => jwt.sign({ acc_id }, JWT_SECRET,         { expiresIn: "15m" });
const signRefreshToken = (acc_id) => jwt.sign({ acc_id }, JWT_REFRESH_SECRET, { expiresIn: "7d"  });

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",  // false on localhost dev
    sameSite: "lax",    // "lax" works better than "strict" on Windows localhost
    path:     "/",
};

const verifyToken = (req, res, next) => {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "Unauthorized. Please log in." });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === "TokenExpiredError")
                return res.status(401).json({ error: "Token expired.", code: "TOKEN_EXPIRED" });
            return res.status(403).json({ error: "Invalid token." });
        }
        req.acc_id = decoded.acc_id;
        next();
    });
};

// ─── Database ─────────────────────────────────────────────────────────────────
const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect((err) => {
    if (err) console.error("❌ DB connection failed:", err.message);
    else     console.log("✅ Database connected");
});

// ─── Static file serving ──────────────────────────────────────────────────────
import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, "uploads/"); },
    filename:    (req, file, cb) => { cb(null, `${Date.now()}-${file.originalname}`); },
});
const upload = multer({ storage });

// ─── Utility: parse Python output using sentinel marker ───────────────────────
// python_script.py writes:  __RESULT__{ ...json... }
// This is robust against library warnings leaking onto stdout on Windows.
function parsePythonOutput(raw) {
    const marker = "__RESULT__";
    const idx    = raw.indexOf(marker);

    if (idx !== -1) {
        // Clean path — sentinel found
        const jsonStr = raw.substring(idx + marker.length).trim();
        return JSON.parse(jsonStr);
    }

    // Fallback: extract outermost JSON object (handles scripts without sentinel)
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}") + 1;
    if (start !== -1 && end > start) {
        return JSON.parse(raw.substring(start, end));
    }

    throw new Error("No JSON found in Python output");
}

function spawnPython(args) {
    const isWin = process.platform === "win32";
    const cmd = isWin ? "py" : "python3";
    return spawn(cmd, args, { shell: false });
}

// ─── Upload video ─────────────────────────────────────────────────────────────
app.post("/upload-video", upload.single("video"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({
        success:   true,
        videoPath: req.file.path,
        filename:  req.file.filename,
    });
});

// ─── Process video (non-streaming) ───────────────────────────────────────────
app.post("/process-video", (req, res) => {
    const { videoPath } = req.body;
    if (!videoPath) return res.status(400).json({ error: "Video path is required" });

    const pythonProcess = spawnPython(["./python_script.py", videoPath]);
    let pythonOutput    = "";

    pythonProcess.stdout.on("data", (data) => { pythonOutput += data.toString(); });
    pythonProcess.stderr.on("data", (data) => { console.error(`[Python stderr]: ${data}`); });

    pythonProcess.on("close", () => {
        try {
            const parsed = parsePythonOutput(pythonOutput);
            if (parsed.error) return res.status(500).json({ error: parsed.error });
            return res.json(parsed);
        } catch (err) {
            console.error("Failed to parse Python output:", err.message);
            console.error("Raw output snippet:", pythonOutput.substring(0, 500));
            return res.status(500).json({ error: "Invalid response from Python script" });
        }
    });
});

// ─── Process video — SSE streaming ───────────────────────────────────────────
// GET /process-video-stream?videoPath=uploads/xxx.mp4
app.get("/process-video-stream", (req, res) => {
    const { videoPath } = req.query;
    if (!videoPath) { res.status(400).end(); return; }

    res.setHeader("Content-Type",      "text/event-stream");
    res.setHeader("Cache-Control",     "no-cache");
    res.setHeader("Connection",        "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (event, data) =>
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    // Map Python INFO log substrings → friendly progress labels (null = suppress)
    const STEP_MAP = [
        { match: "audio extracted",                   label: "Audio extracted and saved"    },
        { match: "transcription completed",           label: "Transcription completed"       },
        { match: "translated",                        label: "Translation completed"         },
        { match: "audio feature analysis",            label: "Audio analysis completed"      },
        { match: "voice emotion detection completed", label: "Emotion detection completed"   },
        { match: "speech clarity score computed",     label: "Speech clarity score computed" },
        { match: "summary generated",                 label: "Summary generated"             },
        { match: "gemini api configured",             label: null },
        { match: "api key",                           label: null },
        { match: "configured successfully",           label: null },
    ];

    const pythonProcess = spawnPython(["./python_script.py", videoPath]);
    let pythonOutput = "";
    let stderrBuf    = "";

    pythonProcess.stdout.on("data", (d) => { pythonOutput += d.toString(); });

    pythonProcess.stderr.on("data", (d) => {
        stderrBuf += d.toString();
        const lines = stderrBuf.split("\n");
        stderrBuf   = lines.pop(); // keep incomplete last line in buffer

        for (const line of lines) {
            if (!line.includes(" - INFO - ")) continue;
            const msg   = line.split(" - INFO - ")[1]?.trim() || "";
            if (!msg) continue;
            const lower   = msg.toLowerCase();
            const matched = STEP_MAP.find(s => lower.includes(s.match));
            if (matched) {
                if (matched.label !== null) send("progress", { message: matched.label });
            } else {
                send("progress", { message: msg });
            }
        }
    });

    pythonProcess.on("close", () => {
        try {
            const parsed = parsePythonOutput(pythonOutput);
            if (parsed.error) {
                send("error", { message: parsed.error });
            } else {
                send("result", { success: true, data: parsed });
            }
        } catch (err) {
            console.error("SSE parse error:", err.message);
            console.error("Raw stdout snippet:", pythonOutput.substring(0, 500));
            send("error", { message: "Failed to parse analysis result. Please try again." });
        }
        res.end();
    });

    req.on("close", () => pythonProcess.kill());
});

// ─── Process prompt / chat ────────────────────────────────────────────────────
app.post("/processPrompt", (req, res) => {
    const { title, description, analysisResult, userPrompt } = req.body;

    const runPrompt = (proc) => {
        let out = "";
        proc.stdout.on("data", (d) => { out += d.toString(); });
        proc.stderr.on("data", (d) => { console.error(`[Python stderr]: ${d}`); });
        proc.on("close", () => {
            try {
                return res.json(parsePythonOutput(out));
            } catch {
                return res.status(500).json({ error: "Invalid JSON response from Python" });
            }
        });
    };

    if (userPrompt) {
        if (!analysisResult) return res.status(400).json({ error: "Analysis result is required" });
        const proc = spawnPython(["./python_script.py", "--prompt", JSON.stringify(analysisResult)]);
        proc.stdin.write(userPrompt + "\n");
        proc.stdin.end();
        runPrompt(proc);
    } else {
        if (!title || !description || !analysisResult)
            return res.status(400).json({ error: "Missing parameters" });
        runPrompt(spawnPython(["./python_script.py", title, description, JSON.stringify(analysisResult)]));
    }
});

// ─── Auth: Sign Up ────────────────────────────────────────────────────────────
const insertAccount = async (email, password) => {
    const hash = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
        db.query(
            "INSERT INTO tbl_account (acc_email, acc_password) VALUES (?, ?)",
            [email, hash],
            (err, result) => { if (err) return reject(err); resolve(result); }
        );
    });
};

app.post("/signup", async (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM tbl_account WHERE acc_email = ?", [email], async (err, result) => {
        if (err)               return res.status(500).json({ error: "Error checking email" });
        if (result.length > 0) return res.status(409).json({ error: "Email already exists" });
        try {
            await insertAccount(email, password);
            return res.status(201).json({ message: "Account created successfully" });
        } catch (insertErr) {
            console.error("Error inserting account:", insertErr);
            return res.status(500).json({ error: "Error inserting account" });
        }
    });
});

// ─── Auth: Login ──────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM tbl_account WHERE acc_email = ?", [email], async (err, result) => {
        if (err)               return res.status(500).json({ error: "Error checking email" });
        if (result.length === 0) return res.status(401).json({ error: "Invalid credentials" });

        const user = result[0];
        if (!bcrypt.compareSync(password, user.acc_password))
            return res.status(401).json({ error: "Invalid credentials" });

        const accessToken  = signAccessToken(user.acc_id);
        const refreshToken = signRefreshToken(user.acc_id);

        db.query("UPDATE tbl_account SET refresh_token = ? WHERE acc_id = ?",
            [refreshToken, user.acc_id]);

        res.cookie("access_token",  accessToken,  { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
        res.cookie("refresh_token", refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

        return res.status(200).json({
            message: "Login successful",
            acc_id:  user.acc_id,
            email:   user.acc_email,
        });
    });
});

// ─── Auth: Refresh token ──────────────────────────────────────────────────────
app.post("/refresh", (req, res) => {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ error: "No refresh token" });

    jwt.verify(token, JWT_REFRESH_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid refresh token" });

        db.query(
            "SELECT acc_id FROM tbl_account WHERE acc_id = ? AND refresh_token = ?",
            [decoded.acc_id, token],
            (dbErr, result) => {
                if (dbErr || result.length === 0)
                    return res.status(403).json({ error: "Refresh token revoked" });

                const newAccessToken = signAccessToken(decoded.acc_id);
                res.cookie("access_token", newAccessToken, {
                    ...COOKIE_OPTIONS,
                    maxAge: 15 * 60 * 1000,
                });
                return res.status(200).json({ message: "Token refreshed" });
            }
        );
    });
});

// ─── Auth: Logout ─────────────────────────────────────────────────────────────
app.post("/logout", verifyToken, (req, res) => {
    db.query("UPDATE tbl_account SET refresh_token = NULL WHERE acc_id = ?", [req.acc_id]);
    res.clearCookie("access_token",  COOKIE_OPTIONS);
    res.clearCookie("refresh_token", COOKIE_OPTIONS);
    return res.status(200).json({ message: "Logged out successfully" });
});

// ─── User: current user ───────────────────────────────────────────────────────
app.get("/user/me", verifyToken, (req, res) => {
    db.query(
        "SELECT acc_id, acc_email FROM tbl_account WHERE acc_id = ?",
        [req.acc_id],
        (err, result) => {
            if (err)               return res.status(500).json({ error: "Error fetching user" });
            if (result.length === 0) return res.status(404).json({ error: "User not found" });
            return res.json(result[0]);
        }
    );
});

// ─── User: by ID ─────────────────────────────────────────────────────────────
app.get("/user/:acc_id", verifyToken, (req, res) => {
    const { acc_id } = req.params;
    if (parseInt(acc_id) !== req.acc_id)
        return res.status(403).json({ error: "Forbidden" });

    db.query(
        "SELECT acc_id, acc_email FROM tbl_account WHERE acc_id = ?",
        [acc_id],
        (err, result) => {
            if (err)               return res.status(500).json({ error: "Error checking account" });
            if (result.length === 0) return res.status(404).json({ error: "Account does not exist" });
            return res.json(result[0]);
        }
    );
});

// ─── Videos: save ─────────────────────────────────────────────────────────────
app.post("/save-video", verifyToken, (req, res) => {
    const { video_path, summary, analysis, extra_results, file_size } = req.body;
    if (!video_path || !analysis)
        return res.status(400).json({ error: "video_path and analysis are required" });

    const MAX_STORAGE = 5 * 1024 * 1024 * 1024;

    db.query(
        "SELECT COALESCE(SUM(file_size), 0) AS total FROM saved_videos WHERE user_id = ?",
        [req.acc_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Failed to check storage" });

            const used     = Number(rows[0].total);
            const incoming = Number(file_size) || 0;
            if (used + incoming > MAX_STORAGE)
                return res.status(413).json({ error: "Storage limit reached. Maximum 5 GB allowed." });

            db.query(
                `INSERT INTO saved_videos (user_id, video_path, summary, analysis, extra_results, file_size)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    req.acc_id,
                    video_path,
                    summary || null,
                    JSON.stringify(analysis),
                    extra_results ? JSON.stringify(extra_results) : null,
                    incoming,
                ],
                (err2, result) => {
                    if (err2) {
                        console.error("Error saving video:", err2);
                        return res.status(500).json({ error: "Failed to save video" });
                    }
                    return res.status(201).json({ message: "Video saved successfully", id: result.insertId });
                }
            );
        }
    );
});

// ─── Videos: list ─────────────────────────────────────────────────────────────
app.get("/saved-videos", verifyToken, (req, res) => {
    db.query(
        "SELECT * FROM saved_videos WHERE user_id = ? ORDER BY created_at DESC",
        [req.acc_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: "Failed to fetch saved videos" });
            return res.json(results);
        }
    );
});

// ─── Videos: storage usage ────────────────────────────────────────────────────
app.get("/saved-videos/storage", verifyToken, (req, res) => {
    db.query(
        "SELECT COALESCE(SUM(file_size), 0) AS used, COUNT(*) AS count FROM saved_videos WHERE user_id = ?",
        [req.acc_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Failed to get storage info" });
            const MAX = 5 * 1024 * 1024 * 1024;
            return res.json({ used: Number(rows[0].used), max: MAX, count: rows[0].count });
        }
    );
});

// ─── Videos: delete ───────────────────────────────────────────────────────────
app.delete("/saved-videos/:id", verifyToken, (req, res) => {
    const { id } = req.params;
    db.query(
        "DELETE FROM saved_videos WHERE id = ? AND user_id = ?",
        [id, req.acc_id],
        (err, result) => {
            if (err)                       return res.status(500).json({ error: "Failed to delete video" });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Not found" });
            return res.json({ message: "Deleted successfully" });
        }
    );
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});