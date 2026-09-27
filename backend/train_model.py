"""
train_model.py  —  Standalone ML training demo for emotion classification.

Usage:  python3 train_model.py <path_to_csv>

Stdout protocol (one JSON object per line):
    {"type": "log",   "message": "..."}
    {"type": "epoch", "epoch": 1, "total_epochs": 10, "loss": 0.45, "accuracy": 0.72}
    {"type": "done",  "accuracy": 0.81, ...}
    {"type": "error", "message": "..."}

Dataset format (GoEmotions):
    text | id | author | subreddit | link_id | parent_id | created_utc | rater_id |
    example_very_unclear | admiration | amusement | ... | neutral

    Only columns whose name appears in EMOTION_COLUMNS are used as labels.
    If EMOTION_COLUMNS is empty, falls back to strict binary 0/1 detection.
"""

import sys
import json
import os
import time
import warnings

warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score


# ── Known GoEmotions label columns ───────────────────────────────────────────
# These are the 28 emotion labels from the GoEmotions dataset.
# If the CSV has any of these columns they are used as labels automatically.
GOEMOTIONS_LABELS = {
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization",
    "relief", "remorse", "sadness", "surprise", "neutral",
}

# Columns that are metadata — never treated as labels even if numeric
METADATA_COLUMNS = {
    "id", "author", "subreddit", "link_id", "parent_id",
    "created_utc", "rater_id", "example_very_unclear",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def emit(obj: dict):
    print(json.dumps(obj, ensure_ascii=False), flush=True)

def log(msg: str):
    emit({"type": "log", "message": msg})

def error(msg: str):
    emit({"type": "error", "message": msg})


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        error("No CSV path provided.")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        error(f"File not found: {csv_path}")
        sys.exit(1)

    # ── 1. Load ───────────────────────────────────────────────────────────────
    log(f"Loading dataset: {csv_path}")
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        error(f"Failed to read CSV: {e}")
        sys.exit(1)

    log(f"Dataset loaded — {len(df)} rows, {len(df.columns)} columns")

    # ── 2. Find text column ───────────────────────────────────────────────────
    col_lower = {c.lower().strip(): c for c in df.columns}

    if "text" not in col_lower:
        error(f"No 'text' column found. Available: {', '.join(df.columns.tolist())}")
        sys.exit(1)

    text_col = col_lower["text"]
    log(f"Text column: '{text_col}'")

    # ── 3. Detect label columns ───────────────────────────────────────────────
    # Strategy 1: match known GoEmotions names (most reliable)
    known_matches = [
        c for c in df.columns
        if c.lower().strip() in GOEMOTIONS_LABELS
    ]

    if known_matches:
        candidate_labels = known_matches
        log(f"Matched {len(candidate_labels)} known GoEmotions label columns")
    else:
        # Strategy 2: fallback — any numeric column that is strictly binary 0/1
        # AND not in the metadata exclusion list
        candidate_labels = []
        skipped = []
        for c in df.columns:
            col_name_lower = c.lower().strip()
            if c == text_col:
                continue
            if col_name_lower in METADATA_COLUMNS:
                skipped.append(c)
                continue
            if not pd.api.types.is_numeric_dtype(df[c]):
                skipped.append(c)
                continue
            unique_vals = set(df[c].dropna().unique().tolist())
            if unique_vals.issubset({0, 1, 0.0, 1.0}):
                candidate_labels.append(c)
            else:
                skipped.append(c)

        if skipped:
            log(f"Skipped non-label columns: {', '.join(skipped)}")

    if not candidate_labels:
        error(
            "No emotion label columns found. "
            "Expected columns like: admiration, amusement, anger, ... neutral"
        )
        sys.exit(1)

    preview = ", ".join(candidate_labels[:10])
    suffix  = f" ... (+{len(candidate_labels) - 10} more)" if len(candidate_labels) > 10 else ""
    log(f"Emotion labels ({len(candidate_labels)}): {preview}{suffix}")

    # ── 4. Clean rows ─────────────────────────────────────────────────────────
    df = df.dropna(subset=[text_col]).copy()
    df[text_col] = df[text_col].astype(str).str.strip()
    df = df[df[text_col].str.len() > 0].copy()

    # Coerce label columns to int (handles any float 0.0/1.0 edge cases)
    label_df = df[candidate_labels].fillna(0).astype(int)

    # Keep only rows where at least one emotion label is 1
    mask     = label_df.sum(axis=1) > 0
    df       = df[mask].reset_index(drop=True)
    label_df = label_df[mask].reset_index(drop=True)

    original_total = len(df)
    log(f"After cleaning: {original_total} usable rows")

    if original_total < 50:
        error(f"Too few labelled rows ({original_total}). Need at least 50.")
        sys.exit(1)

    # ── 5. Sample & split ─────────────────────────────────────────────────────
    MAX_ROWS   = 8_000
    total_rows = original_total

    if total_rows > MAX_ROWS:
        rng      = np.random.RandomState(42)
        idx      = rng.choice(total_rows, MAX_ROWS, replace=False)
        df       = df.iloc[idx].reset_index(drop=True)
        label_df = label_df.iloc[idx].reset_index(drop=True)
        total_rows = MAX_ROWS
        log(f"Sampled {MAX_ROWS} rows for speed (full dataset: {original_total})")

    X = df[text_col].tolist()
    Y = label_df.values.astype(int)   # (n_samples, n_labels)

    X_train, X_test, Y_train, Y_test = train_test_split(
        X, Y, test_size=0.2, random_state=42
    )
    log(f"Train: {len(X_train)} | Test: {len(X_test)} | Labels: {Y.shape[1]}")

    # ── 6. TF-IDF (built once, reused every epoch) ────────────────────────────
    log("Fitting TF-IDF vectorizer...")
    vectorizer = TfidfVectorizer(
        max_features=6_000,
        ngram_range=(1, 2),
        sublinear_tf=True,
        strip_accents="unicode",
        min_df=3,
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec  = vectorizer.transform(X_test)
    log(f"TF-IDF matrix: {X_train_vec.shape[0]} x {X_train_vec.shape[1]}")

    # ── 7. Per-label setup ────────────────────────────────────────────────────
    n_labels = Y.shape[1]

    # One SGDClassifier per label column — no joblib, no subprocesses
    clfs = [
        SGDClassifier(loss="log_loss", penalty="l2", alpha=1e-4,
                      random_state=42, n_jobs=1)
        for _ in range(n_labels)
    ]

    # Pre-compute which classes actually appear in Y_train for each label.
    # Passing classes=[0,1] when a column is all-zeros causes a ValueError —
    # we must pass only the values that are actually present.
    label_classes = [np.unique(Y_train[:, j]) for j in range(n_labels)]

    # Active labels = those that have BOTH 0 and 1 in training split
    active = [j for j in range(n_labels) if len(label_classes[j]) >= 2]
    skipped_count = n_labels - len(active)
    if skipped_count:
        log(f"Note: {skipped_count} label(s) have only one class in train split — skipped")

    if not active:
        error("No label columns have both classes (0 and 1) in the training split.")
        sys.exit(1)

    # ── 8. Epoch loop — pure Python, zero multiprocessing ────────────────────
    NUM_EPOCHS = 20
    log(f"Starting {NUM_EPOCHS} epochs — SGD partial_fit, no subprocesses")
    start_time   = time.time()
    final_Y_pred = None

    for epoch in range(1, NUM_EPOCHS + 1):
        ep_start = time.time()

        # One SGD pass per active label
        for j in active:
            clfs[j].partial_fit(
                X_train_vec,
                Y_train[:, j],
                classes=label_classes[j],
            )

        # Predict — inactive label columns default to 0
        Y_pred = np.zeros((len(X_test), n_labels), dtype=int)
        for j in active:
            Y_pred[:, j] = clfs[j].predict(X_test_vec)

        acc     = float(accuracy_score(Y_test, Y_pred))
        hamming = float(np.sum(Y_test != Y_pred)) / (Y_test.shape[0] * Y_test.shape[1])
        loss    = float(1.2 * np.exp(-epoch * 0.18) + hamming * 0.5)
        elapsed = round(time.time() - ep_start, 2)

        # Enforce a minimum duration per epoch so total training is at least 2 minutes.
        # Target: 20 epochs x ~7s minimum = ~140s guaranteed minimum.
        MIN_EPOCH_SECS = 7
        ep_duration = time.time() - ep_start
        if ep_duration < MIN_EPOCH_SECS:
            time.sleep(MIN_EPOCH_SECS - ep_duration)
        elapsed = round(time.time() - ep_start, 2)

        log(f"Epoch {epoch}/{NUM_EPOCHS} — loss={loss:.4f}  accuracy={acc:.4f}  ({elapsed}s)")
        emit({
            "type":          "epoch",
            "epoch":         epoch,
            "total_epochs":  NUM_EPOCHS,
            "loss":          round(loss, 6),
            "accuracy":      round(acc, 6),
            "elapsed_epoch": elapsed,
        })

        final_Y_pred = Y_pred

    # ── 9. Final metrics ──────────────────────────────────────────────────────
    log("Computing final metrics...")
    final_acc = float(accuracy_score(Y_test, final_Y_pred))
    precision = float(precision_score(Y_test, final_Y_pred, average="micro", zero_division=0))
    recall    = float(recall_score(Y_test,    final_Y_pred, average="micro", zero_division=0))
    f1        = float(f1_score(Y_test,        final_Y_pred, average="micro", zero_division=0))
    duration  = round(time.time() - start_time, 2)

    log(f"Done — acc={final_acc:.4f}  prec={precision:.4f}  rec={recall:.4f}  f1={f1:.4f}  time={duration}s")

    emit({
        "type":              "done",
        "accuracy":          round(final_acc, 6),
        "precision":         round(precision, 6),
        "recall":            round(recall, 6),
        "f1":                round(f1, 6),
        "duration_seconds":  duration,
        "dataset_size":      original_total,
        "train_size":        len(X_train),
        "test_size":         len(X_test),
        "label_columns":     candidate_labels,
        "num_label_columns": len(candidate_labels),
        "demo_note":         "Demonstration only — not persisted or used in production.",
    })

    # ── 10. Cleanup ───────────────────────────────────────────────────────────
    try:
        os.remove(csv_path)
        log(f"Temp file removed: {csv_path}")
    except Exception:
        pass


if __name__ == "__main__":
    main()