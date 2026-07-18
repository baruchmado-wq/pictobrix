import { useState, useRef, useEffect, useCallback } from "react";
import { PALETTE, BOARD, BOARD_CM, iconUrl, textureUrl } from "../lib/palette.js";
import { renderGrid } from "../lib/bricks.js";
import { KIT_COLORS, KIT_QTY, KIT_DITHER_DEFAULT, kitLayouts, autoLevelsStretch, quantizeKit, quantizeMinCount } from "../lib/kit.js";
import { saveProject, loadProject, clearProject } from "../lib/store.js";
import { buildInstructionsPdf, bytesToDataUrl } from "../lib/pdf.js";
import RoomScene, { ROOMS } from "./RoomScene.jsx";
import AssemblyView from "./AssemblyView.jsx";

const TEX_PX = 192;
const REVEAL_PER = 380;    // ms each brick takes to land
const REVEAL_SPREAD = 1100; // ms between first and last brick start

// ---------- inline SVG icons (no icon library) ----------
const ic = (d, extra) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />{extra}
  </svg>
);
const IcSize = () => ic("M2 2h10v10H2z M7 2v10 M2 7h10");
const IcCrop = () => ic("M4 1v8a1 1 0 0 0 1 1h8 M1 4h8a1 1 0 0 1 1 1v8");
const IcAdjust = () => ic("M2 4h10 M2 10h10", <><circle cx="5" cy="4" r="1.8" fill="var(--surface)" /><circle cx="9" cy="10" r="1.8" fill="var(--surface)" /></>);
const IcColors = () => ic("M7 1.5a5.5 5.5 0 1 0 0 11c1 0 1.4-.7 1-1.5-.5-1 .2-2 1.3-2h1.4c.9 0 1.8-.7 1.8-2A5.7 5.7 0 0 0 7 1.5z",
  <><circle cx="4.7" cy="5" r="0.9" fill="currentColor" stroke="none" /><circle cx="8.3" cy="4.2" r="0.9" fill="currentColor" stroke="none" /><circle cx="4.9" cy="8.6" r="0.9" fill="currentColor" stroke="none" /></>);
const IcFiles = () => ic("M7 2v6.5 M4.2 6.2 7 9l2.8-2.8 M2.5 12h9");
const IcUpload = () => ic("M7 12V5.5 M4.2 8.3 7 5.5l2.8 2.8 M2.5 2h9");
const IcEdit = () => ic("M9.7 1.8l2.5 2.5L4.5 12H2v-2.5z");
const IcWall = () => ic("M1.5 2.5h11v9h-11z M4 11.5v-4l2.5 2 3-3 3 3");
const IcBrush = () => ic("M12.2 1.8c-2.8.7-5 2.6-6.3 4.7l1.6 1.6c2.1-1.3 4-3.5 4.7-6.3z M5 7.5c-1.6.2-2.4 1.4-2.5 3.4-.6.6-1.3.9-1.3.9s2.7 1 4.3-.4c.9-.8 1-2 .5-2.9z");
const IcList = () => ic("M4.5 3.5h8 M4.5 7h8 M4.5 10.5h8 M1.8 3.5h.4 M1.8 7h.4 M1.8 10.5h.4");
const IcShare = () => ic("M7 9V1.8 M4.2 4.4 7 1.6l2.8 2.8 M2.5 7.5v4.5h9V7.5");
const IcKit = () => ic("M1.5 5h11v6.5h-11z M1.5 5l1.2-2.5h8.6L12.5 5 M5.5 7.5h3", <circle cx="4.5" cy="3.8" r="0.01" />);

// the brand brick strip as an empty-state hero: five studs in brick colors
const BRICK_STRIP = ["#F5AD39", "#F03A42", "#6845A4", "#28914F", "#2564B5"];
const BrickHero = () => (
  <svg width="180" height="44" viewBox="0 0 180 44" fill="none" className="px-drop-icon" aria-hidden="true">
    {BRICK_STRIP.map((c, i) => (
      <g key={c} transform={`translate(${i * 36},4)`}>
        <rect width="36" height="36" fill={c} />
        <circle cx="18" cy="19.5" r="11" fill="rgba(0,0,0,.18)" />
        <circle cx="18" cy="18" r="11" fill={c} stroke="rgba(255,255,255,.45)" strokeWidth="1.5" />
        <circle cx="14.5" cy="14.5" r="4.5" fill="rgba(255,255,255,.18)" />
      </g>
    ))}
  </svg>
);

function Slider({ min, max, value, onChange, disabled, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const style = { "--fill": pct + "%" };
  if (color) style["--sc"] = color;
  return (
    <input type="range" className="px-slider" min={min} max={max} value={value}
      onChange={onChange} disabled={disabled} style={style} />
  );
}

export default function Editor({ kit = false }) {
  const [img, setImg] = useState(null);
  const [boardsW, setBoardsW] = useState(kit ? 1 : 3);
  const [boardsH, setBoardsH] = useState(kit ? 1 : 3);
  const [kits, setKits] = useState(0); // kit mode: number of kits the customer bought (0 = not chosen yet)
  const [autoLevel, setAutoLevel] = useState(true);
  const [kitDither, setKitDither] = useState(KIT_DITHER_DEFAULT);
  const [minCount, setMinCount] = useState(10);
  const [autoOff, setAutoOff] = useState(() => new Set());
  const [editOn, setEditOn] = useState(false);
  const [editColor, setEditColor] = useState(kit ? KIT_COLORS[0] : 3);
  const [editsVer, setEditsVer] = useState(0);
  const editsRef = useRef(new Map());   // cell index -> palette index (manual fixes)
  const undoRef = useRef([]);
  const lastPaintRef = useRef(-1);
  const countsRef = useRef(null);
  const [paintBlocked, setPaintBlocked] = useState(null); // palette idx whose stock just ran out
  const [showAssembly, setShowAssembly] = useState(false);
  const [savedProject, setSavedProject] = useState(() => loadProject(kit ? "kit" : "classic"));
  const mode = kit ? "kit" : "classic";
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(kit ? 8 : 0);
  // kit palette is small, so unboosted photos come out flat — start livelier
  const [saturation, setSaturation] = useState(kit ? 20 : 0);
  const [dither, setDither] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [offX, setOffX] = useState(50);
  const [offY, setOffY] = useState(50);
  const [enabled, setEnabled] = useState(PALETTE.map(() => true));
  const [counts, setCounts] = useState(null);
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState("edit");
  const [tool, setTool] = useState("size"); // mobile tool tab
  const [room, setRoom] = useState("living");
  const [snapshot, setSnapshot] = useState(null);
  const [busyPdf, setBusyPdf] = useState(false);
  const [textures, setTextures] = useState(null);
  const [pZoom, setPZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const vpRef = useRef({ cx: 0, cy: 0 });
  const pointers = useRef(new Map());
  const pinchDist = useRef(0);
  const rafRef = useRef(0);
  const stageRef = useRef(null);
  const revealRef = useRef(null);        // { t0, delays, per, end } while the falling-bricks reveal runs
  const pendingRevealRef = useRef(false); // set only on new image / board-count change
  const reducedMotionRef = useRef(false);
  const [stageW, setStageW] = useState(760);

  useEffect(() => {
    let alive = true;
    Promise.all(
      PALETTE.map((_, i) => new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = textureUrl(i);
      }))
    ).then((imgs) => { if (alive) setTextures(imgs); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reducedMotionRef.current = mq.matches; };
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        pendingRevealRef.current = true;
        setImg(image); setZoom(1); setOffX(50); setOffY(50); setView("edit"); setPZoom(1);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const setBoards = (w, h) => {
    if (w === boardsW && h === boardsH) return;
    pendingRevealRef.current = true;
    setBoardsW(w); setBoardsH(h);
  };

  // ---- viewport-rendered preview: only visible studs, full texture sharpness ----
  const previewCssSize = () => {
    const g = gridRef.current;
    const availW = stageRef.current ? stageRef.current.clientWidth : 760;
    if (!g) return { w: Math.min(760, availW), h: Math.min(760, availW) };
    const maxH = isMobile ? Math.round(window.innerHeight * 0.42) : 760;
    const w = Math.min(760, availW, (maxH * g.W) / g.H);
    return { w, h: (w * g.H) / g.W };
  };

  const maxPZoom = () => {
    const g = gridRef.current;
    if (!g) return 8;
    const { w } = previewCssSize();
    return Math.max(4, Math.min(30, TEX_PX / (w / g.W)));
  };

  const drawPreview = useCallback(() => {
    const g = gridRef.current;
    const cv = canvasRef.current;
    if (!g || !cv) return;
    const { grid, W, H } = g;
    const z = Math.max(1, pZoom);
    const { w: cssW, h: cssH } = previewCssSize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    const ctx = cv.getContext("2d");
    const cell = (cv.width / W) * z;
    const viewW = W / z, viewH = H / z;
    const vp = vpRef.current;
    if (z <= 1) { vp.cx = W / 2; vp.cy = H / 2; }
    else {
      vp.cx = Math.max(viewW / 2, Math.min(W - viewW / 2, vp.cx || W / 2));
      vp.cy = Math.max(viewH / 2, Math.min(H - viewH / 2, vp.cy || H / 2));
    }
    const x0 = vp.cx - viewW / 2, y0 = vp.cy - viewH / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const xi0 = Math.max(0, Math.floor(x0)), yi0 = Math.max(0, Math.floor(y0));
    const xi1 = Math.min(W - 1, Math.ceil(x0 + viewW)), yi1 = Math.min(H - 1, Math.ceil(y0 + viewH));
    for (let y = yi0; y <= yi1; y++) {
      for (let x = xi0; x <= xi1; x++) {
        const px = (x - x0) * cell, py = (y - y0) * cell;
        const v = grid[y * W + x];
        if (textures) ctx.drawImage(textures[v], px, py, cell + 0.5, cell + 0.5);
        else { ctx.fillStyle = PALETTE[v].hex; ctx.fillRect(px, py, cell + 0.5, cell + 0.5); }
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1.5, cell / 30);
    for (let bx = BOARD; bx < W; bx += BOARD) {
      const px = (bx - x0) * cell;
      if (px >= 0 && px <= cv.width) { ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, cv.height); ctx.stroke(); }
    }
    for (let by = BOARD; by < H; by += BOARD) {
      const py = (by - y0) * cell;
      if (py >= 0 && py <= cv.height) { ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(cv.width, py); ctx.stroke(); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pZoom, textures, isMobile]);

  const schedulePreview = useCallback(() => {
    if (revealRef.current) return; // the reveal loop is already redrawing every frame
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawPreview());
  }, [drawPreview]);

  useEffect(() => {
    const measure = () => {
      setIsMobile(window.innerWidth < 760);
      if (stageRef.current) setStageW(Math.min(760, stageRef.current.clientWidth));
      schedulePreview();
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, schedulePreview]);

  // ---- falling-bricks reveal ----
  // Bricks land in diagonal waves with random jitter, each fading in (and, when
  // the studs are big enough for it to be visible, scaling 1.15 -> 1).
  // Perf: the finished picture is prerendered ONCE, then every frame is a single
  // blit masked by a 1-pixel-per-brick alpha mask (nearest-neighbor upscaled via
  // destination-in) — a handful of draw calls per frame instead of thousands.
  const startReveal = () => {
    const g = gridRef.current;
    const cv = canvasRef.current;
    if (!g || !cv || reducedMotionRef.current) { schedulePreview(); return; }
    const { grid, W, H } = g;

    // same viewport math as drawPreview (gestures are blocked, so it is static)
    const z = Math.max(1, pZoom);
    const { w: cssW, h: cssH } = previewCssSize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    const cell = (cv.width / W) * z;
    const viewW = W / z, viewH = H / z;
    const vp = vpRef.current;
    if (z <= 1) { vp.cx = W / 2; vp.cy = H / 2; }
    else {
      vp.cx = Math.max(viewW / 2, Math.min(W - viewW / 2, vp.cx || W / 2));
      vp.cy = Math.max(viewH / 2, Math.min(H - viewH / 2, vp.cy || H / 2));
    }
    const x0 = vp.cx - viewW / 2, y0 = vp.cy - viewH / 2;
    const xi0 = Math.max(0, Math.floor(x0)), yi0 = Math.max(0, Math.floor(y0));
    const xi1 = Math.min(W - 1, Math.ceil(x0 + viewW)), yi1 = Math.min(H - 1, Math.ceil(y0 + viewH));

    // prerender the finished picture (visible cells only)
    const fin = document.createElement("canvas");
    fin.width = cv.width; fin.height = cv.height;
    const fctx = fin.getContext("2d");
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = "high";
    for (let y = yi0; y <= yi1; y++) {
      for (let x = xi0; x <= xi1; x++) {
        const px = (x - x0) * cell, py = (y - y0) * cell;
        const v = grid[y * W + x];
        if (textures) fctx.drawImage(textures[v], px, py, cell + 0.5, cell + 0.5);
        else { fctx.fillStyle = PALETTE[v].hex; fctx.fillRect(px, py, cell + 0.5, cell + 0.5); }
      }
    }

    // per-brick landing delays: diagonal wave + random jitter
    const delays = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        delays[y * W + x] = ((x + y) / (W + H)) * REVEAL_SPREAD * 0.7 + Math.random() * REVEAL_SPREAD * 0.3;
      }
    }

    // 1px-per-brick alpha mask
    const mask = document.createElement("canvas");
    mask.width = W; mask.height = H;
    const mctx = mask.getContext("2d");
    const mid = mctx.createImageData(W, H);

    // scale-pop is only drawn per-brick where a 15% overshoot is actually
    // visible (big studs) and cheap (few visible cells)
    const visCells = (xi1 - xi0 + 1) * (yi1 - yi0 + 1);
    const pop = cell >= 14 && visCells <= 4200 && textures;
    let minis = null;
    if (pop) {
      const ms = Math.ceil(cell * 1.16);
      minis = textures.map((t) => {
        const c = document.createElement("canvas");
        c.width = ms; c.height = ms;
        const x = c.getContext("2d");
        x.imageSmoothingQuality = "high";
        x.drawImage(t, 0, 0, ms, ms);
        return c;
      });
    }

    // block zoom/pan gestures for the duration
    pointers.current.clear();
    pinchDist.current = 0;
    revealRef.current = { t0: performance.now() };
    setRevealing(true);
    cancelAnimationFrame(rafRef.current);

    const per = REVEAL_PER, end = REVEAL_SPREAD + REVEAL_PER;
    const ctx = cv.getContext("2d");
    const frame = () => {
      const rv = revealRef.current;
      if (!rv) return;
      const now = performance.now() - rv.t0;
      if (now >= end) {
        revealRef.current = null;
        setRevealing(false);
        drawPreview(); // hand back to the regular renderer
        return;
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fin, 0, 0);
      const d = mid.data;
      for (let i = 0; i < W * H; i++) {
        const p = (now - delays[i]) / per;
        if (p <= 0) { d[i * 4 + 3] = 0; continue; }
        if (p >= 1) { d[i * 4 + 3] = 255; continue; }
        const e = 1 - (1 - p) * (1 - p) * (1 - p); // easeOutCubic fade
        d[i * 4 + 3] = (e * 255) | 0;
      }
      mctx.putImageData(mid, 0, 0);
      ctx.imageSmoothingEnabled = false; // hard per-brick mask edges
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0, W, H, -x0 * cell, -y0 * cell, W * cell, H * cell);
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#141519";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      if (pop) {
        for (let y = yi0; y <= yi1; y++) {
          for (let x = xi0; x <= xi1; x++) {
            const p = (now - delays[y * W + x]) / per;
            if (p <= 0 || p >= 1) continue;
            const e = 1 - (1 - p) * (1 - p) * (1 - p);
            const cs = cell * (1.15 - 0.15 * e);
            ctx.globalAlpha = e;
            ctx.drawImage(minis[grid[y * W + x]],
              (x - x0) * cell - (cs - cell) / 2, (y - y0) * cell - (cs - cell) / 2, cs, cs);
          }
        }
        ctx.globalAlpha = 1;
      }
      // board separator lines fade in with the reveal
      ctx.globalAlpha = Math.min(1, now / end);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = Math.max(1.5, cell / 30);
      for (let bx = BOARD; bx < W; bx += BOARD) {
        const px = (bx - x0) * cell;
        if (px >= 0 && px <= cv.width) { ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, cv.height); ctx.stroke(); }
      }
      for (let by = BOARD; by < H; by += BOARD) {
        const py = (by - y0) * cell;
        if (py >= 0 && py <= cv.height) { ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(cv.width, py); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  };
  const startRevealRef = useRef(startReveal);
  startRevealRef.current = startReveal;

  const compute = useCallback(() => {
    if (!img || view !== "edit") return;
    if (kit && kits === 0) return;
    const W = boardsW * BOARD, H = boardsH * BOARD;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    const ta = W / H;
    let cw = img.width, ch = img.height;
    if (cw / ch > ta) cw = ch * ta; else ch = cw / ta;
    cw /= zoom; ch /= zoom;
    const sx = (img.width - cw) * (offX / 100);
    const sy = (img.height - ch) * (offY / 100);
    octx.drawImage(img, sx, sy, cw, ch, 0, 0, W, H);
    const id = octx.getImageData(0, 0, W, H);
    const d = id.data;
    if (autoLevel || kit) autoLevelsStretch(d);
    const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < d.length; i += 4) {
      let r = cf * (d[i] - 128) + 128 + brightness;
      let g = cf * (d[i + 1] - 128) + 128 + brightness;
      let b = cf * (d[i + 2] - 128) + 128 + brightness;
      if (saturation !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const s = 1 + saturation / 100;
        r = gray + (r - gray) * s; g = gray + (g - gray) * s; b = gray + (b - gray) * s;
      }
      d[i] = Math.max(0, Math.min(255, r));
      d[i + 1] = Math.max(0, Math.min(255, g));
      d[i + 2] = Math.max(0, Math.min(255, b));
    }
    let grid, aOff = new Set();
    if (kit) {
      const allowed = KIT_COLORS.filter((i) => enabled[i]);
      const budgets = {};
      for (const i of allowed) budgets[i] = KIT_QTY[i] * kits;
      grid = quantizeKit(d, W, H, allowed.length >= 2 ? allowed : KIT_COLORS, budgets, kitDither).grid;
    } else {
      const res = quantizeMinCount(d, W, H, enabled, dither, minCount);
      grid = res.grid;
      aOff = res.autoOff;
    }
    // manual single-stud fixes (pupils, lips, stray bricks)
    for (const [i, ci] of editsRef.current) if (i < grid.length) grid[i] = ci;
    gridRef.current = { grid, W, H };
    setAutoOff(aOff);
    const c = new Array(PALETTE.length).fill(0);
    for (let i = 0; i < grid.length; i++) c[grid[i]]++;
    countsRef.current = c;
    setCounts(c);
    if (pendingRevealRef.current) {
      pendingRevealRef.current = false;
      startRevealRef.current();
      return;
    }
    schedulePreview();
  }, [img, view, boardsW, boardsH, brightness, contrast, saturation, dither, zoom, offX, offY, enabled, schedulePreview, kit, kits, autoLevel, minCount, editsVer, kitDither]);

  // manual fixes are positional — drop them when the underlying crop/size changes
  useEffect(() => {
    editsRef.current.clear();
    undoRef.current = [];
  }, [img, boardsW, boardsH, zoom, offX, offY]);

  useEffect(() => { compute(); }, [compute]);
  useEffect(() => { schedulePreview(); }, [pZoom, textures, schedulePreview]);

  const renderFull = (cell) => {
    const g = gridRef.current;
    if (!g) return null;
    const { grid, W, H } = g;
    const cv = document.createElement("canvas");
    cv.width = W * cell; cv.height = H * cell;
    const ctx = cv.getContext("2d");
    renderGrid(ctx, grid, W, H, cell, textures);
    return cv;
  };

  const setPZoomClamped = (z) => setPZoom(Math.max(1, Math.min(maxPZoom(), z)));
  const cssCell = () => {
    const g = gridRef.current;
    if (!g) return 8;
    return (previewCssSize().w / g.W) * pZoom;
  };
  // ---- manual stud fixing (pupils, lips, stray bricks) ----
  const cellAt = (e) => {
    const g = gridRef.current, cv = canvasRef.current;
    if (!g || !cv) return -1;
    const rect = cv.getBoundingClientRect();
    if (!rect.width) return -1;
    const z = Math.max(1, pZoom);
    const cellCss = (rect.width / g.W) * z;
    const viewW = g.W / z, viewH = g.H / z;
    const vp = vpRef.current;
    const cx = z <= 1 ? g.W / 2 : Math.max(viewW / 2, Math.min(g.W - viewW / 2, vp.cx || g.W / 2));
    const cy = z <= 1 ? g.H / 2 : Math.max(viewH / 2, Math.min(g.H - viewH / 2, vp.cy || g.H / 2));
    const x = Math.floor(cx - viewW / 2 + (e.clientX - rect.left) / cellCss);
    const y = Math.floor(cy - viewH / 2 + (e.clientY - rect.top) / cellCss);
    if (x < 0 || x >= g.W || y < 0 || y >= g.H) return -1;
    return y * g.W + x;
  };
  const recount = () => {
    const g = gridRef.current;
    const c = new Array(PALETTE.length).fill(0);
    for (let i = 0; i < g.grid.length; i++) c[g.grid[i]]++;
    countsRef.current = c;
    setCounts(c);
  };
  const paintAt = (e) => {
    const g = gridRef.current;
    const i = cellAt(e);
    if (i < 0 || i === lastPaintRef.current) return;
    lastPaintRef.current = i;
    if (g.grid[i] === editColor) return;
    // kit mode: hard inventory limit — a color at its cap cannot be painted
    if (kit && countsRef.current && countsRef.current[editColor] >= KIT_QTY[editColor] * kits) {
      setPaintBlocked(editColor);
      return;
    }
    setPaintBlocked(null);
    undoRef.current.push({ i, prevEdit: editsRef.current.has(i) ? editsRef.current.get(i) : null, prevVal: g.grid[i] });
    editsRef.current.set(i, editColor);
    g.grid[i] = editColor;
    recount();
    schedulePreview();
  };
  const undoEdit = () => {
    const u = undoRef.current.pop();
    if (!u || !gridRef.current) return;
    if (u.prevEdit === null) editsRef.current.delete(u.i);
    else editsRef.current.set(u.i, u.prevEdit);
    gridRef.current.grid[u.i] = u.prevVal;
    recount();
    schedulePreview();
  };
  const clearEdits = () => {
    if (!editsRef.current.size) return;
    editsRef.current.clear();
    undoRef.current = [];
    setEditsVer((v) => v + 1); // recompute from scratch
  };

  const onPtrDown = (e) => {
    if (revealRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    } else if (editOn) {
      paintAt(e);
    }
  };
  const onPtrMove = (e) => {
    if (revealRef.current) return;
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) setPZoomClamped(pZoom * (d / pinchDist.current));
      pinchDist.current = d;
    } else if (editOn) {
      paintAt(e);
    } else if (pZoom > 1) {
      const c = cssCell();
      vpRef.current.cx -= (e.clientX - prev.x) / c;
      vpRef.current.cy -= (e.clientY - prev.y) / c;
      schedulePreview();
    }
  };
  const onPtrUp = (e) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
    lastPaintRef.current = -1;
  };
  const onWheel = (e) => { if (!revealRef.current) setPZoomClamped(pZoom * (1 - e.deltaY * 0.0015)); };

  const toggleColor = (i) => {
    const next = [...enabled];
    const on = next.filter(Boolean).length;
    if (next[i] && on <= 2) return;
    next[i] = !next[i];
    setEnabled(next);
  };

  const downloadPNG = () => {
    const cv = renderFull(24);
    if (!cv) return;
    const a = document.createElement("a");
    a.download = "pictobrix-preview.png";
    a.href = cv.toDataURL("image/png");
    a.click();
  };

  const makePdf = async () => {
    if (!gridRef.current || busyPdf) return;
    setBusyPdf(true);
    try {
      persistProject();
      const bytes = await buildInstructionsPdf(gridRef.current, boardsW, boardsH, "PictoBrix Project");
      const a = document.createElement("a");
      a.download = "pictobrix-instructions-A3.pdf";
      a.href = bytesToDataUrl(bytes, "application/pdf");
      a.click();
    } catch (e) {
      console.error(e);
      alert("שגיאה ביצירת ה-PDF: " + e.message);
    } finally {
      setBusyPdf(false);
    }
  };

  const persistProject = () => {
    const g = gridRef.current;
    if (!g) return null;
    const p = { grid: g.grid, W: g.W, H: g.H, boardsW, boardsH, kits, progress: savedProject?.progress };
    saveProject(mode, p);
    const loaded = loadProject(mode);
    setSavedProject(loaded);
    return loaded;
  };

  const openAssembly = () => {
    const p = persistProject();
    if (p) setShowAssembly(true);
  };

  const resumeAssembly = () => {
    if (savedProject) setShowAssembly(true);
  };

  const sharePdf = async () => {
    if (!gridRef.current || busyPdf) return;
    setBusyPdf(true);
    try {
      persistProject();
      const bytes = await buildInstructionsPdf(gridRef.current, boardsW, boardsH, "PictoBrix Project");
      const file = new File([bytes], "pictobrix-instructions-A3.pdf", { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "PicToBrix — הוראות הרכבה" });
      } else {
        // no native share on this device — regular download instead
        const a = document.createElement("a");
        a.download = file.name;
        a.href = bytesToDataUrl(bytes, "application/pdf");
        a.click();
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    } finally {
      setBusyPdf(false);
    }
  };

  const goWall = () => {
    if (img && gridRef.current) {
      const cv = renderFull(12);
      if (cv) setSnapshot(cv.toDataURL("image/jpeg", 0.85));
    }
    setView("wall");
  };

  const totalBrix = boardsW * boardsH * BOARD * BOARD;
  const usedColors = counts ? counts.filter((c) => c > 0).length : 0;
  const sorted = counts
    ? counts.map((c, i) => ({ c, i })).filter((o) => o.c > 0).sort((a, b) => b.c - a.c)
    : [];
  const picW = boardsW * BOARD_CM, picH = boardsH * BOARD_CM;

  const roomCfg = ROOMS[room];

  // ---------- shared control blocks ----------
  const sizeControls = (
    <div>
      <div className="px-label">גודל התמונה (לוחות של 32×32)</div>
      <div className="px-row">
        {[[2, 2], [3, 3], [4, 4]].map(([w, h]) => (
          <button key={w} className={"px-seg" + (boardsW === w && boardsH === h ? " is-active" : "")}
            onClick={() => setBoards(w, h)}>
            {w}×{h}
          </button>
        ))}
      </div>
      <div className="px-row" style={{ marginTop: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>מותאם:</span>
        {["רוחב", "גובה"].map((t, k) => (
          <select key={t} className="px-select" value={k === 0 ? boardsW : boardsH}
            onChange={(e) => (k === 0 ? setBoards(+e.target.value, boardsH) : setBoards(boardsW, +e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((v) => <option key={v} value={v}>{t} {v}</option>)}
          </select>
        ))}
      </div>
      <div className="px-hint">
        גודל פיזי: {picW.toFixed(1)} × {picH.toFixed(1)} ס״מ
      </div>
      {counts && (
        <div className="px-row" style={{ marginTop: 10 }}>
          <div className="px-stat"><div className="px-stat-n" style={{ "--stat-c": "var(--bx-cyan)" }}>{boardsW * boardsH}</div><div className="px-stat-l">לוחות</div></div>
          <div className="px-stat"><div className="px-stat-n" style={{ "--stat-c": "var(--bx-amber)" }}>{totalBrix.toLocaleString()}</div><div className="px-stat-l">בריקס</div></div>
          <div className="px-stat"><div className="px-stat-n" style={{ "--stat-c": "var(--bx-lgreen)" }}>{usedColors}</div><div className="px-stat-l">צבעים</div></div>
        </div>
      )}
    </div>
  );

  const cropControls = img && (
    <div>
      <div className="px-label">חיתוך — זום {zoom.toFixed(1)}×</div>
      <Slider min={10} max={40} value={zoom * 10} onChange={(e) => setZoom(+e.target.value / 10)} color="var(--bx-lgreen)" />
      <div className="px-label">מיקום אופקי</div>
      <Slider min={0} max={100} value={offX} onChange={(e) => setOffX(+e.target.value)} color="var(--bx-cyan)" />
      <div className="px-label">מיקום אנכי</div>
      <Slider min={0} max={100} value={offY} onChange={(e) => setOffY(+e.target.value)} color="var(--bx-purple-lt)" />
      <div className="px-hint">זום פנימה + הזזה = פיקסול של אזור הפנים בלבד</div>
    </div>
  );

  const adjustControls = (
    <div>
      <div className="px-label">בהירות {brightness}</div>
      <Slider min={-80} max={80} value={brightness} onChange={(e) => setBrightness(+e.target.value)} color="var(--bx-amber)" />
      <div className="px-label">ניגודיות {contrast}</div>
      <Slider min={-80} max={80} value={contrast} onChange={(e) => setContrast(+e.target.value)} color="var(--bx-cyan)" />
      <div className="px-label">רוויה {saturation}</div>
      <Slider min={-80} max={80} value={saturation} onChange={(e) => setSaturation(+e.target.value)} color="var(--bx-red-lt)" />
      <label className="px-switch" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={autoLevel} onChange={(e) => setAutoLevel(e.target.checked)} disabled={kit} />
        <span className="px-track" />
        כיוון בהירות אוטומטי
      </label>
      {!kit && (
        <label className="px-switch" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} />
          <span className="px-track" />
          דיטרינג (מעברי צבע חלקים)
        </label>
      )}
      {kit && (
        <div style={{ marginTop: 12 }}>
          <div className="px-label">
            עוצמת דיטרינג {Math.round(kitDither * 100)}%
            <span style={{ color: "var(--text-3)", fontWeight: 400 }}> — {kitDither <= 0.1 ? "חד וברור" : kitDither >= 0.55 ? "חלק (עלול לנמר)" : "מאוזן"}</span>
          </div>
          <Slider min={0} max={70} value={Math.round(kitDither * 100)} onChange={(e) => setKitDither(+e.target.value / 100)} color="var(--bx-cyan)" />
          <div className="px-hint">נמוך = בריקסים נקיים וחדים · גבוה = מעברים חלקים אך יותר "רעש". התוצאה הכי ברורה בדרך כלל בצד הנמוך.</div>
        </div>
      )}
    </div>
  );

  const fixControls = img && (
    <div>
      <label className="px-switch">
        <input type="checkbox" checked={editOn} onChange={(e) => setEditOn(e.target.checked)} />
        <span className="px-track" />
        מצב תיקון — לחיצה על התמונה צובעת בריק
      </label>
      {editOn && (
        <>
          <div className="px-label" style={{ marginTop: 12 }}>צבע לצביעה</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(kit ? KIT_COLORS : PALETTE.map((_, i) => i).filter((i) => enabled[i])).map((i) => {
              const left = kit && counts ? KIT_QTY[i] * kits - counts[i] : null;
              const depleted = kit && left !== null && left <= 0;
              return (
                <div key={i} style={{ textAlign: "center" }}>
                  <button className={"px-paint" + (editColor === i ? " is-active" : "") + (depleted ? " is-depleted" : "")}
                    onClick={() => { if (!depleted) { setEditColor(i); setPaintBlocked(null); } }}
                    title={depleted ? "הצבע נגמר במלאי הערכה" : PALETTE[i].hex}>
                    <img src={iconUrl(i)} alt={PALETTE[i].hex} />
                  </button>
                  {kit && (
                    <div style={{ fontSize: 10, color: depleted ? "var(--bx-red-lt)" : "var(--text-3)", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
                      {depleted ? "נגמר" : left}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {kit && paintBlocked !== null && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--bx-red-lt)", fontWeight: 600 }}>
              ⚠ הצבע הזה נגמר במלאי — כדי להשתמש בו כאן, שחררו בריק שלו במקום אחר (צבעו אותו בצבע שונה).
            </div>
          )}
          <div className="px-row" style={{ marginTop: 12 }}>
            <button className="px-btn-ghost px-compact" onClick={undoEdit}>ביטול אחרון</button>
            <button className="px-btn-ghost px-compact" onClick={clearEdits}>ניקוי כל התיקונים ({editsRef.current.size})</button>
          </div>
          <div className="px-hint">מקרבים עם זום, לוחצים על בריק — והוא מוחלף. מושלם לאישונים, שפתיים ופינות שיצאו בצבע לא נכון.</div>
        </>
      )}
    </div>
  );

  const kitControls = kit && kits > 0 && (
    <div>
      <div className="px-label">פריסת {kits} הערכות</div>
      <div className="px-row">
        {kitLayouts(kits).map(([w, h]) => (
          <button key={w + "x" + h} className={"px-seg" + (boardsW === w && boardsH === h ? " is-active" : "")}
            onClick={() => setBoards(w, h)}>
            {w}×{h}
          </button>
        ))}
      </div>
      <div className="px-hint">גודל פיזי: {picW.toFixed(1)} × {picH.toFixed(1)} ס״מ</div>
      {counts && (
        <div className="px-row" style={{ marginTop: 10 }}>
          <div className="px-stat"><div className="px-stat-n" style={{ "--stat-c": "var(--bx-cyan)" }}>{kits}</div><div className="px-stat-l">ערכות</div></div>
          <div className="px-stat"><div className="px-stat-n" style={{ "--stat-c": "var(--bx-amber)" }}>{totalBrix.toLocaleString()}</div><div className="px-stat-l">בריקסים</div></div>
          <div className="px-stat"><div className="px-stat-n" style={{ "--stat-c": "var(--bx-lgreen)" }}>{usedColors}</div><div className="px-stat-l">צבעים</div></div>
        </div>
      )}
      <button className="px-btn-ghost px-compact" style={{ marginTop: 10 }} onClick={() => setKits(0)}>שינוי מספר ערכות</button>
    </div>
  );

  const kitInventory = kit && counts && (
    <div>
      <div className="px-label">מלאי הבריקסים שלך ({kits} ערכות)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {KIT_COLORS.map((i) => {
          const used = counts[i], total = KIT_QTY[i] * kits;
          const over = used > total;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={iconUrl(i)} alt="" style={{ width: 20, height: 20, borderRadius: 5, border: "1px solid rgba(255,255,255,.25)" }} />
              <div style={{ flex: 1, height: 8, background: "var(--inset)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: Math.min(100, (used / total) * 100) + "%", height: "100%", borderRadius: 999, background: over ? "var(--bx-red)" : PALETTE[i].hex }} />
              </div>
              <span style={{ fontSize: 11.5, color: over ? "var(--bx-red-lt)" : "var(--text-3)", minWidth: 62, textAlign: "left", direction: "ltr", fontVariantNumeric: "tabular-nums" }}>
                {used} / {total}
              </span>
            </div>
          );
        })}
      </div>
      <div className="px-hint">ההדמיה כבר מותאמת למלאי — מה שרואים על המסך זה בדיוק מה שבונים.</div>
    </div>
  );

  const colorLegend = counts && (
    <div className="px-anim">
      <div style={{
        display: "flex", gap: 6,
        flexWrap: isMobile ? "nowrap" : "wrap",
        overflowX: isMobile ? "auto" : "visible",
        justifyContent: isMobile ? "flex-start" : "center",
        paddingBottom: isMobile ? 6 : 0,
        WebkitOverflowScrolling: "touch",
      }}>
        {sorted.map(({ c, i }) => (
          <div key={i} className={"px-chip" + (enabled[i] ? "" : " is-off")} onClick={() => toggleColor(i)}>
            <img src={iconUrl(i)} alt="" />
            <span>{c.toLocaleString()}</span>
          </div>
        ))}
        {[...autoOff].map((i) => (
          <div key={"auto" + i} className="px-chip is-off" title="הוסר אוטומטית — כמות זניחה שלא משנה את התמונה">
            <img src={iconUrl(i)} alt="" />
            <span>אוטו</span>
          </div>
        ))}
        {PALETTE.map((p, i) => !enabled[i] && (
          <div key={"off" + i} className="px-chip is-off" onClick={() => toggleColor(i)}>
            <img src={iconUrl(i)} alt="" />
            <span>כבוי</span>
          </div>
        ))}
      </div>
      <div className="px-hint">לחיצה על אייקון מבטלת את הצבע</div>
      <div className="px-row" style={{ marginTop: 10 }}>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>ביטול צבעים שוליים:</span>
        <select className="px-select" value={minCount} onChange={(e) => setMinCount(+e.target.value)}>
          <option value={0}>כבוי</option>
          <option value={10}>פחות מ-10 בריקסים</option>
          <option value={25}>פחות מ-25 בריקסים</option>
          <option value={50}>פחות מ-50 בריקסים</option>
          <option value={100}>פחות מ-100 בריקסים</option>
        </select>
      </div>
    </div>
  );

  const actionButtons = (
    <div className="px-row">
      <label htmlFor="pbx-file" className="px-btn"><IcUpload />העלאת תמונה</label>
      {img && <button className="px-btn-ghost" onClick={downloadPNG}><IcFiles />הורדת PNG</button>}
      {img && (
        <button className="px-btn" style={{ width: "100%", "--btn-bg": "var(--bx-green)" }} onClick={openAssembly}>
          <IcList />הוראות הרכבה במסך — בלי מדפסת
        </button>
      )}
      {img && (
        <button className="px-btn" style={{ width: "100%", "--btn-bg": "var(--bx-blue)" }} onClick={makePdf} disabled={busyPdf}>
          <IcFiles />{busyPdf ? "מייצר PDF..." : "הורדת PDF הוראות A3"}
        </button>
      )}
      {img && (
        <button className="px-btn-ghost" style={{ width: "100%" }} onClick={sharePdf} disabled={busyPdf}>
          <IcShare />שליחת ה-PDF לוואטסאפ / מייל — כדי שלא ילך לאיבוד
        </button>
      )}
      {img && <div className="px-hint">ההוראות נשמרות אוטומטית גם במכשיר הזה — אפשר לחזור אליהן מדף הפתיחה.</div>}
    </div>
  );

  const previewBlock = (
    <>
      <div style={{ position: "relative", width: "fit-content", maxWidth: "100%" }}>
        <div
          ref={containerRef}
          onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp}
          onPointerCancel={onPtrUp} onWheel={onWheel}
          className="px-canvas-frame"
          style={{ cursor: revealing ? "default" : editOn ? "crosshair" : pZoom > 1 ? "grab" : "zoom-in" }}
        >
          <canvas ref={canvasRef} style={{ display: "block" }} />
        </div>
        <label htmlFor="pbx-file" className="px-swap-btn"><IcUpload />החלף תמונה</label>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", maxWidth: 760 }}>
        <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>זום {pZoom.toFixed(1)}×</span>
        <Slider min={10} max={Math.round(maxPZoom() * 10)}
          value={Math.min(pZoom, maxPZoom()) * 10} onChange={(e) => setPZoomClamped(+e.target.value / 10)}
          disabled={revealing} />
        {pZoom > 1 && <button className="px-btn-ghost px-compact" onClick={() => setPZoomClamped(1)}>איפוס</button>}
      </div>
    </>
  );

  const TOOLS = [
    kit ? ["kits", "ערכות", IcKit, "var(--bx-blue-lt)"] : ["size", "גודל", IcSize, "var(--bx-blue-lt)"],
    ["crop", "חיתוך", IcCrop, "var(--bx-lgreen)"],
    ["adjust", "כוונון", IcAdjust, "var(--bx-amber)"],
    ["fix", "תיקון", IcBrush, "var(--bx-cyan)"],
    kit ? ["colors", "מלאי", IcColors, "var(--bx-red-lt)"] : ["colors", "צבעים", IcColors, "var(--bx-red-lt)"],
    ["actions", "קבצים", IcFiles, "var(--bx-purple-lt)"],
  ];

  const kitLanding = (
    <div className="px-card px-anim" style={{ maxWidth: 520, margin: "28px auto 0", textAlign: "center", padding: "30px 22px" }}>
      <BrickHero />
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>כמה ערכות יש לכם?</div>
      <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.7, margin: "8px 0 18px" }}>
        כל ערכה = לוח אחד ({BOARD_CM.toFixed(1)} ס״מ) + 1,300 בריקסים ב-37 צבעים.<br />
        ככל שמחברים יותר ערכות — התמונה גדולה וחדה יותר.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxWidth: 320, margin: "0 auto" }}>
        {[1, 2, 3, 4, 6, 8, 9, 12].map((n) => (
          <button key={n} className="px-seg" style={{ minHeight: 52, fontSize: 17, fontWeight: 700 }}
            onClick={() => {
              const [w, h] = kitLayouts(n)[0];
              pendingRevealRef.current = true;
              setKits(n); setBoardsW(w); setBoardsH(h);
            }}>
            {n}
          </button>
        ))}
      </div>
      <div className="px-hint" style={{ marginTop: 14 }}>אפשר לשנות את מספר הערכות ואת הפריסה בכל שלב</div>
    </div>
  );

  const resumeCard = savedProject && !img && (
    <div className="px-card px-anim" style={{ maxWidth: 760, width: "100%", margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 170 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>יש לכם הוראות הרכבה שמורות במכשיר הזה</div>
        <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          {savedProject.boardsW}×{savedProject.boardsH} לוחות · נשמר ב-{new Date(savedProject.ts).toLocaleDateString("he-IL")}
        </div>
      </div>
      <button className="px-btn" style={{ "--btn-bg": "var(--bx-green)" }} onClick={resumeAssembly}><IcList />המשך הרכבה</button>
      <button className="px-btn-ghost px-compact" onClick={() => { clearProject(mode); setSavedProject(null); }}>מחיקה</button>
    </div>
  );

  const emptyState = (dropProps = {}) => (
    <label className={"px-drop" + (drag ? " is-drag" : "")} {...dropProps}>
      <img src="/assets/brixi.png" alt="Brixi" className="px-brixi" width="423" height="460" fetchpriority="high" draggable="false" />
      <span className="px-drop-cta"><IcUpload />העלאת תמונה</span>
      <div className="px-drop-sub">
        {isMobile ? "בריקסי יהפוך את התמונה שלכם לבריקס חי" : "או גררו תמונה לכאן — ובריקסי יהפוך אותה לבריקס חי"}
      </div>
      <div className="px-drop-badge">JPG · PNG · כל תמונה</div>
      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />
    </label>
  );

  return (
    <div className="px-page">
      <div className={"px-header" + (isMobile ? " is-mobile" : "")}>
        <img src="/assets/logo-white.png" alt="PicToBrix" className="px-logo" style={{ height: isMobile ? 36 : 48 }} />
        {kit && <span className="px-kit-badge">ערכות</span>}
        <div style={{ display: "flex", gap: 8, marginInlineStart: "auto", alignItems: "center" }}>
          {/* classic mode only: jump to the retail-kit flow. Kit mode has no way back — one-way by design. */}
          {!kit && <a href="/kit" className="px-mode-link"><IcKit />ערכות בריקס</a>}
          <button className={"px-tab" + (view === "edit" ? " is-active" : "")} onClick={() => setView("edit")}><IcEdit />עריכה</button>
          <button className={"px-tab" + (view === "wall" ? " is-active" : "")} style={{ "--tab-bg": "var(--bx-green)" }} onClick={goWall}><IcWall />הדמיה על קיר</button>
        </div>
      </div>
      <div className="px-brickstrip" />

      <input id="pbx-file" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />

      {showAssembly && savedProject && (
        <AssemblyView
          project={savedProject}
          mode={mode}
          textures={textures}
          onClose={() => { setShowAssembly(false); setSavedProject(loadProject(mode)); }}
        />
      )}

      {/* ============== MOBILE: image first, tools below ============== */}
      {isMobile && view === "edit" && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }} ref={stageRef}>
          {kit && kits === 0 ? <>{resumeCard}{kitLanding}</> : !img ? <>{resumeCard}{emptyState()}</> : (
            <>
              {previewBlock}
              <div className="px-tooltabs">
                {TOOLS.map(([k, l, Ic, c]) => (
                  <button key={k} className={"px-tooltab" + (tool === k ? " is-active" : "")}
                    style={{ "--tab-c": c }} onClick={() => setTool(k)}>
                    <Ic />{l}
                  </button>
                ))}
              </div>
              <div key={tool} className="px-card px-anim">
                {tool === "size" && sizeControls}
                {tool === "kits" && kitControls}
                {tool === "crop" && cropControls}
                {tool === "adjust" && adjustControls}
                {tool === "fix" && fixControls}
                {tool === "colors" && (kit ? kitInventory : colorLegend)}
                {tool === "actions" && actionButtons}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============== DESKTOP edit / wall + MOBILE wall ============== */}
      {(!isMobile || view === "wall") && (
        <div className={"px-main" + (isMobile ? " is-mobile" : "")}>
          {view === "edit" && !isMobile && !(kit && kits === 0) && (
            <div className="px-panel">
              {actionButtons}
              {kit ? kitControls : sizeControls}
              {cropControls}
              {adjustControls}
              {fixControls}
            </div>
          )}

          {view === "wall" && (
            <div className="px-panel" style={{ width: isMobile ? "100%" : 320 }}>
              <div>
                <div className="px-label">בחירת חדר</div>
                <div style={{
                  display: "flex",
                  flexDirection: isMobile ? "row" : "column",
                  overflowX: isMobile ? "auto" : "visible",
                  gap: 8, WebkitOverflowScrolling: "touch",
                }}>
                  {Object.entries(ROOMS).map(([k, r]) => (
                    <button key={k} className={"px-seg" + (room === k ? " is-active" : "")}
                      style={{ whiteSpace: "nowrap", padding: "8px 12px", flex: isMobile ? "0 0 auto" : 1 }}
                      onClick={() => setRoom(k)}>{r.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                {!img && <div style={{ color: "#FFA745", marginBottom: 6 }}>העלו תמונה בלשונית עריכה כדי לראות אותה כאן</div>}
                התמונה שלך: <b style={{ color: "var(--text)" }}>{picW.toFixed(0)} × {picH.toFixed(0)} ס״מ</b> ({boardsW}×{boardsH} לוחות)
                <br />ההדמיה על צילום אמיתי, בקנה מידה אמיתי לפי הריהוט בחדר.
              </div>
              <button className="px-btn-ghost" onClick={() => setView("edit")}>חזרה לעריכה ושינוי גודל</button>
            </div>
          )}

          <div className="px-stage" ref={view === "wall" || !isMobile ? stageRef : undefined}>
            {view === "edit" && !isMobile && (kit && kits === 0 ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>{resumeCard}{kitLanding}</div>
            ) : !img ? (
              <>
              {resumeCard}
              {emptyState({
                onDragOver: (e) => { e.preventDefault(); setDrag(true); },
                onDragLeave: () => setDrag(false),
                onDrop: (e) => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files[0]); },
              })}
              </>
            ) : (
              <>
                {previewBlock}
                <div style={{ maxWidth: 780, width: "100%" }}>{kit ? kitInventory : colorLegend}</div>
              </>
            ))}
            {view === "wall" && (
              <div className="px-anim-pop" style={{ width: stageW, borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-2)", position: "relative" }}>
                <RoomScene room={room} stageW={stageW} snapshot={snapshot} picWcm={picW} picHcm={picH} />
                <div style={{ position: "absolute", bottom: 8, insetInlineStart: 10, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "4px 10px", borderRadius: 8 }}>
                  {roomCfg.label} • תמונה {picW.toFixed(0)}×{picH.toFixed(0)} ס״מ
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
