import { useState, useRef, useEffect, useCallback } from "react";
import { PALETTE, BOARD, iconUrl } from "../lib/palette.js";
import { saveProgress } from "../lib/store.js";

// ===== On-screen assembly instructions =====
// Row-by-row building guide that replaces the printed PDF on a phone:
// pick a board, advance row after row; progress is stored with the project.
export default function AssemblyView({ project, mode, textures, onClose }) {
  const { grid, W, boardsW, boardsH } = project;
  const nBoards = boardsW * boardsH;
  const [b, setB] = useState(Math.min(project.progress?.b || 0, nBoards - 1));
  const [row, setRow] = useState(Math.min(project.progress?.row || 0, BOARD - 1));
  const boardCvRef = useRef(null);
  const stripCvRef = useRef(null);

  useEffect(() => { saveProgress(mode, { b, row }); }, [b, row, mode]);

  // cell value inside board `bi` at (x, y)
  const cellVal = useCallback((bi, x, y) => {
    const bx = bi % boardsW, by = Math.floor(bi / boardsW);
    return grid[(by * BOARD + y) * W + bx * BOARD + x];
  }, [grid, W, boardsW]);

  // ---- board canvas: full board, done rows dimmed, current row highlighted ----
  useEffect(() => {
    const cv = boardCvRef.current;
    if (!cv) return;
    const css = Math.min(420, cv.parentElement.clientWidth);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cell = Math.floor((css * dpr) / BOARD);
    cv.width = cell * BOARD; cv.height = cell * BOARD;
    cv.style.width = cv.width / dpr + "px";
    cv.style.height = cv.height / dpr + "px";
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (let y = 0; y < BOARD; y++) {
      for (let x = 0; x < BOARD; x++) {
        const v = cellVal(b, x, y);
        if (textures) ctx.drawImage(textures[v], x * cell, y * cell, cell + 0.5, cell + 0.5);
        else { ctx.fillStyle = PALETTE[v].hex; ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5); }
      }
    }
    // dim rows already built
    if (row > 0) {
      ctx.fillStyle = "rgba(10,11,13,0.72)";
      ctx.fillRect(0, 0, cv.width, row * cell);
    }
    // veil rows not built yet
    if (row < BOARD - 1) {
      ctx.fillStyle = "rgba(10,11,13,0.35)";
      ctx.fillRect(0, (row + 1) * cell, cv.width, cv.height - (row + 1) * cell);
    }
    // current row highlight
    ctx.strokeStyle = "#FF6600";
    ctx.lineWidth = Math.max(2, cell / 5);
    ctx.strokeRect(ctx.lineWidth / 2, row * cell + ctx.lineWidth / 2, cv.width - ctx.lineWidth, cell - ctx.lineWidth);
  }, [b, row, cellVal, textures]);

  // ---- current-row strip: enlarged cells ----
  useEffect(() => {
    const cv = stripCvRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cell = 30 * dpr;
    cv.width = cell * BOARD; cv.height = cell;
    cv.style.width = 30 * BOARD + "px";
    cv.style.height = "30px";
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (let x = 0; x < BOARD; x++) {
      const v = cellVal(b, x, row);
      if (textures) ctx.drawImage(textures[v], x * cell, 0, cell + 0.5, cell);
      else { ctx.fillStyle = PALETTE[v].hex; ctx.fillRect(x * cell, 0, cell + 0.5, cell); }
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x * cell + 0.5, 0.5, cell - 1, cell - 1);
    }
  }, [b, row, cellVal, textures]);

  // per-color counts of the current row
  const rowCounts = {};
  for (let x = 0; x < BOARD; x++) {
    const v = cellVal(b, x, row);
    rowCounts[v] = (rowCounts[v] || 0) + 1;
  }

  const next = () => {
    if (row < BOARD - 1) setRow(row + 1);
    else if (b < nBoards - 1) { setB(b + 1); setRow(0); }
  };
  const prev = () => {
    if (row > 0) setRow(row - 1);
    else if (b > 0) { setB(b - 1); setRow(BOARD - 1); }
  };
  const done = b === nBoards - 1 && row === BOARD - 1;

  return (
    <div className="px-assembly" dir="rtl">
      <div className="px-assembly-head">
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>הוראות הרכבה</div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            לוח {b + 1} מתוך {nBoards} · שורה {row + 1} מתוך {BOARD} · נשמר אוטומטית במכשיר
          </div>
        </div>
        <button className="px-btn-ghost px-compact" onClick={onClose}>סגירה</button>
      </div>

      {nBoards > 1 && (
        <div className="px-boardmap" style={{ gridTemplateColumns: `repeat(${boardsW}, 34px)` }} dir="ltr">
          {Array.from({ length: nBoards }, (_, i) => (
            <button key={i} className={"px-boardcell" + (i === b ? " is-cur" : i < b ? " is-done" : "")}
              onClick={() => { setB(i); setRow(0); }}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="px-assembly-strip-wrap">
        <div className="px-label" style={{ marginBottom: 4 }}>השורה הנוכחית ({row + 1}) — משמאל לימין כמו בתמונה:</div>
        <div className="px-assembly-strip" dir="ltr"><canvas ref={stripCvRef} /></div>
        <div className="px-row" style={{ marginTop: 8, gap: 6 }}>
          {Object.entries(rowCounts).sort((a, c) => c[1] - a[1]).map(([v, n]) => (
            <span key={v} className="px-chip" style={{ cursor: "default" }}>
              <img src={iconUrl(+v)} alt="" /><span>×{n}</span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <canvas ref={boardCvRef} style={{ borderRadius: 10, border: "1px solid var(--border)" }} />
      </div>

      <div className="px-assembly-nav">
        <button className="px-btn-ghost" onClick={prev} disabled={b === 0 && row === 0}>שורה קודמת</button>
        {done ? (
          <button className="px-btn" style={{ "--btn-bg": "var(--bx-green)" }} onClick={onClose}>סיימתם — כל הכבוד! 🧱</button>
        ) : (
          <button className="px-btn" onClick={next}>השורה הבאה</button>
        )}
      </div>
    </div>
  );
}
