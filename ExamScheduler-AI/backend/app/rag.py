"""Small, local BM25 retrieval layer used for retrieval-augmented generation.

Documents and text chunks are stored in SQLite. Retrieval is keyword-based BM25,
so it works locally without downloading an embedding model or calling a second API.
"""
from __future__ import annotations
import hashlib
import math
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import DATABASE_PATH

TOKEN_RE = re.compile(r"[a-z0-9_]+", re.IGNORECASE)


def connect() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db() -> None:
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            content_type TEXT,
            char_count INTEGER NOT NULL,
            chunk_count INTEGER NOT NULL,
            uploaded_at TEXT NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            text TEXT NOT NULL
        )""")
        db.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id)")


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text) if len(t) > 1]


def split_chunks(text: str, chunk_size: int = 1050, overlap: int = 160) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        if end < len(text):
            # Prefer cutting at a sentence or word boundary.
            boundary = max(text.rfind(". ", start, end), text.rfind("; ", start, end), text.rfind(" ", start, end))
            if boundary > start + chunk_size * 0.55:
                end = boundary + 1
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return chunks


def add_document(filename: str, content_type: str, text: str) -> dict[str, Any]:
    cleaned = re.sub(r"\x00", "", text).strip()
    if len(cleaned) < 20:
        raise ValueError("No readable text was found in this file.")
    digest = hashlib.sha256((filename + "\0" + cleaned).encode("utf-8", "ignore")).hexdigest()[:20]
    chunks = split_chunks(cleaned)
    if not chunks:
        raise ValueError("This document did not contain indexable text.")
    uploaded_at = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        db.execute(
            "INSERT OR REPLACE INTO documents(id, filename, content_type, char_count, chunk_count, uploaded_at) VALUES(?,?,?,?,?,?)",
            (digest, filename, content_type, len(cleaned), len(chunks), uploaded_at),
        )
        db.execute("DELETE FROM chunks WHERE doc_id = ?", (digest,))
        db.executemany(
            "INSERT INTO chunks(doc_id, chunk_index, text) VALUES(?,?,?)",
            [(digest, i + 1, chunk) for i, chunk in enumerate(chunks)],
        )
    return {"id": digest, "filename": filename, "char_count": len(cleaned), "chunk_count": len(chunks), "uploaded_at": uploaded_at}


def list_documents() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute("SELECT id, filename, content_type, char_count, chunk_count, uploaded_at FROM documents ORDER BY uploaded_at DESC").fetchall()
    return [dict(row) for row in rows]


def delete_document(doc_id: str) -> bool:
    with connect() as db:
        cur = db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        return cur.rowcount > 0


def retrieve(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    q_terms = tokenize(query)
    if not q_terms:
        return []
    with connect() as db:
        rows = db.execute("""SELECT chunks.id, chunks.doc_id, chunks.chunk_index, chunks.text, documents.filename
            FROM chunks JOIN documents ON documents.id = chunks.doc_id""").fetchall()
    if not rows:
        return []
    docs: list[dict[str, Any]] = []
    df: dict[str, int] = {}
    lengths: list[int] = []
    for row in rows:
        terms = tokenize(row["text"])
        freq: dict[str, int] = {}
        for term in terms:
            freq[term] = freq.get(term, 0) + 1
        for term in freq:
            df[term] = df.get(term, 0) + 1
        docs.append({**dict(row), "freq": freq, "length": len(terms)})
        lengths.append(len(terms))
    avgdl = sum(lengths) / max(1, len(lengths))
    n = len(docs)
    k1, b = 1.5, 0.75
    unique_q = set(q_terms)
    ranked = []
    for doc in docs:
        score = 0.0
        for term in unique_q:
            tf = doc["freq"].get(term, 0)
            if not tf:
                continue
            idf = math.log(1 + (n - df.get(term, 0) + 0.5) / (df.get(term, 0) + 0.5))
            denom = tf + k1 * (1 - b + b * doc["length"] / max(avgdl, 1))
            score += idf * (tf * (k1 + 1)) / denom
        if score > 0:
            ranked.append((score, doc))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "source_id": d["doc_id"],
            "filename": d["filename"],
            "chunk_index": d["chunk_index"],
            "text": d["text"],
            "score": round(score, 4),
        }
        for score, d in ranked[: max(1, min(int(top_k), 8))]
    ]


def get_counts() -> dict[str, int]:
    with connect() as db:
        docs = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        chunks = db.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    return {"document_count": docs, "chunk_count": chunks}
