import { useState, useRef, useEffect, useCallback } from "react";
import { PALETTE, BOARD, iconUrl } from "../lib/palette.js";
import { saveProgress, saveProject, loadProject } from "../lib/store.js";
import { boardShareUrl } from "../lib/share.js";

// ===== On-screen assembly instructions =====
// Row-by-row building guide that replaces the printed PDF on a phone:
// pick a board, advance row after row; progress is stored with the project.
// Each board can be shared as a WhatsApp link so the family builds together.
export default function AssemblyView({ project, mode, onClose }) {
  const { grid, W, boardsW, boardsH, boardLabel } = project;
  const nBoards = boardsW * boardsH;
  const [b, setB] = useState(Math.min(project.progress?.b || 0, nBoards - 1));
  const [row, setRow] = useState(Math.min(project.progress?.row || 0, BOARD - 1));
  const [shared, setShared] = useState(""); // transient feedback after share/copy
  const [shortMap, setShortMap] = useState({}); // board index -> shortened url
  const [icons, setIcons] = useState(null);  // the numbered color icons (like the PDF)
  const [strip, setStrip] = useState({ canL: false, canR: true, from: 1, to: 1 });
  const boardCvRef = useRef(null);
  const stripCvRef = useRef(null);
  const stripScrollRef = useRef(null);
  const STRIP_CELL = 44; // css px per stud in the row strip

  // assembly reads ICONS, not brick textures — identical colors are told apart
  // by their icon, exactly like the printed PDF
  useEffect(() => {
    let alive = true;
    Promise.all(
      PALETTE.map((_, i) => new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = iconUrl(i);
      }))
    ).then((imgs) => { if (alive) setIcons(imgs); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => { saveProgress(mode, { b, row }); }, [b, row, mode]);

  // display label: a shared single board keeps its number in the full picture
  const labelCur = boardLabel ? boardLabel.i + 1 : b + 1;
  const labelTotal = boardLabel ? boardLabel.n : nBoards;

  const longUrl = (bi) => boardShareUrl(project, bi, boardLabel ? { bi: boardLabel.i, n: boardLabel.n } : undefined);

  // pre-warm a short link for the current board so sharing is instant (calling
  // the shortener inside the click would break the share/popup user-gesture).
  useEffect(() => {
    if (shortMap[b] !== undefined) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/shorten?url=" + encodeURIComponent(longUrl(b)));
        if (r.ok) { const { short } = await r.json(); if (alive && short) setShortMap((m) => ({ ...m, [b]: short })); }
      } catch { /* leave undefined -> long link used */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b]);

  const shareBoard = async () => {
    const url = shortMap[b] || longUrl(b);
    const text = `🧱 הלוח שלך להרכבה (לוח ${labelCur} מתוך ${labelTotal}) — פתחו את הקישור והתחילו לבנות:`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "PicToBrix — הוראות הרכבה", text, url });
        setShared("נשלח ✓");
      } else {
        window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank");
        setShared("");
      }
    } catch (e) {
      if (e.name !== "AbortError") setShared("");
    }
    setTimeout(() => setShared(""), 2500);
  };
  const copyBoardLink = async () => {
    const url = shortMap[b] || longUrl(b);
    try {
      await navigator.clipboard.writeText(url);
      setShared("הקישור הועתק ✓");
    } catch { setShared(""); }
    setTimeout(() => setShared(""), 2500);
  };

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
        if (icons) ctx.drawImage(icons[v], x * cell, y * cell, cell + 0.5, cell + 0.5);
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
  }, [b, row, cellVal, icons]);

  // ---- current-row strip: large icon cells + position numbers (PDF style) ----
  const NUM_H = 16; // css px for the position-number band under the cells
  useEffect(() => {
    const cv = stripCvRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cell = STRIP_CELL * dpr, numH = NUM_H * dpr;
    cv.width = cell * BOARD; cv.height = cell + numH;
    cv.style.width = STRIP_CELL * BOARD + "px";
    cv.style.height = (STRIP_CELL + NUM_H) + "px";
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (let x = 0; x < BOARD; x++) {
      const v = cellVal(b, x, row);
      if (icons) ctx.drawImage(icons[v], x * cell, 0, cell + 0.5, cell);
      else { ctx.fillStyle = PALETTE[v].hex; ctx.fillRect(x * cell, 0, cell + 0.5, cell); }
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x * cell + 0.5, 0.5, cell - 1, cell - 1);
      // position number under every stud so builders never lose their place
      ctx.fillStyle = x % 5 === 4 ? "#FF6600" : "rgba(160,164,172,0.9)";
      ctx.font = `${x % 5 === 4 ? "bold " : ""}${10 * dpr}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(x + 1), x * cell + cell / 2, cell + numH * 0.72);
    }
  }, [b, row, cellVal, icons]);

  // ---- strip scroll affordance: arrows + edge fades + live position ----
  const updateStrip = useCallback(() => {
    const el = stripScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = el.scrollLeft;
    const from = Math.min(BOARD, Math.floor(x / STRIP_CELL) + 1);
    const to = Math.max(from, Math.min(BOARD, Math.ceil((x + el.clientWidth) / STRIP_CELL)));
    setStrip({ canL: x > 4, canR: x < max - 4, from, to });
  }, []);
  useEffect(() => {
    stripScrollRef.current?.scrollTo({ left: 0 }); // each row starts at stud 1
    updateStrip();
  }, [b, row, icons, updateStrip]);
  useEffect(() => {
    window.addEventListener("resize", updateStrip);
    return () => window.removeEventListener("resize", updateStrip);
  }, [updateStrip]);
  const nudgeStrip = (dir) => {
    const el = stripScrollRef.current;
    el?.scrollBy({ left: dir * Math.max(STRIP_CELL * 4, el.clientWidth * 0.6), behavior: "smooth" });
  };

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
            לוח {labelCur} מתוך {labelTotal} · שורה {row + 1} מתוך {BOARD} · נשמר אוטומטית במכשיר
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

      <div className="px-share-row">
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>
          {nBoards > 1
            ? <>מרכיבים ביחד? 👨‍👩‍👧‍👦 שלחו לכל בונה את הלוח שלו — בחרו לוח למעלה ושתפו:</>
            : <>אפשר לשלוח את ההוראות לטלפון אחר — הקישור הוא ההוראות:</>}
        </div>
        <div className="px-row" style={{ gap: 8 }}>
          <button className="px-btn px-compact-btn" style={{ "--btn-bg": "#25D366" }} onClick={shareBoard}>
            שיתוף לוח {labelCur} בוואטסאפ
          </button>
          <button className="px-btn-ghost px-compact" onClick={copyBoardLink}>העתקת קישור</button>
          {shared && <span style={{ fontSize: 12.5, color: "var(--bx-lgreen)", fontWeight: 700 }}>{shared}</span>}
        </div>
      </div>

      <div className="px-assembly-strip-wrap">
        <div className="px-label" style={{ marginBottom: 6 }}>השורה הנוכחית ({row + 1}) — מרכיבים משמאל לימין:</div>
        <div className="px-strip-outer" dir="ltr">
          <button className="px-strip-nav" onClick={() => nudgeStrip(-1)} disabled={!strip.canL} aria-label="אחורה בשורה">‹</button>
          <div className="px-strip-viewport">
            <div className="px-strip-scroll" ref={stripScrollRef} onScroll={updateStrip}>
              <canvas ref={stripCvRef} />
            </div>
            <div className={"px-strip-fade left" + (strip.canL ? " show" : "")} />
            <div className={"px-strip-fade right" + (strip.canR ? " show" : "")} />
          </div>
          <button className="px-strip-nav" onClick={() => nudgeStrip(1)} disabled={!strip.canR} aria-label="קדימה בשורה">›</button>
        </div>
        <div className="px-strip-count">
          {strip.canR || strip.canL
            ? <>מציג בריקסים <b>{strip.from}–{strip.to}</b> מתוך {BOARD} · לחצו על החצים או החליקו לצפייה בהמשך ⇄</>
            : <>כל {BOARD} הבריקסים של השורה מוצגים</>}
        </div>
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

// ===== recipient side of a shared-board link (#bld=...) =====
// The link IS the instructions: decode, keep progress on this device, and go
// straight into the assembly screen. Nothing else to learn.
export function SharedBuild({ shared }) {
  const mode = "shared-" + shared.key;
  const [open, setOpen] = useState(true);
  const [project, setProject] = useState(() => {
    const existing = loadProject(mode);
    if (existing) return { ...existing, boardLabel: shared.boardLabel };
    saveProject(mode, shared);
    return { ...shared, progress: { b: 0, row: 0 } };
  });

  if (open) {
    return (
      <AssemblyView
        project={project}
        mode={mode}
        onClose={() => { setProject({ ...(loadProject(mode) || project), boardLabel: shared.boardLabel }); setOpen(false); }}
      />
    );
  }
  return (
    <div className="px-page" dir="rtl" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, padding: 20, textAlign: "center" }}>
      <img src="/assets/logo-white.png" alt="PicToBrix" style={{ height: 44 }} />
      <div style={{ fontSize: 18, fontWeight: 800 }}>הלוח שלך מחכה 🧱</div>
      <div style={{ fontSize: 13.5, color: "var(--text-2)", maxWidth: 300, lineHeight: 1.7 }}>
        ההתקדמות נשמרת במכשיר הזה. שמרו את ההודעה עם הקישור בוואטסאפ — הקישור הוא ההוראות שלכם.
      </div>
      <button className="px-btn" onClick={() => setOpen(true)}>המשך הרכבה — לוח {shared.boardLabel.i + 1}</button>
    </div>
  );
}
