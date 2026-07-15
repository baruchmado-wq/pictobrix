import { useState, useRef, useEffect, useCallback } from "react";
import { PALETTE, BOARD, BOARD_CM, iconUrl, textureUrl } from "../lib/palette.js";
import { quantize, renderGrid } from "../lib/bricks.js";
import { buildInstructionsPdf, bytesToDataUrl } from "../lib/pdf.js";
import RoomScene, { ROOMS } from "./RoomScene.jsx";

const TEX_PX = 192;

export default function Editor() {
  const [img, setImg] = useState(null);
  const [boardsW, setBoardsW] = useState(3);
  const [boardsH, setBoardsH] = useState(3);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
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
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const vpRef = useRef({ cx: 0, cy: 0 });
  const pointers = useRef(new Map());
  const pinchDist = useRef(0);
  const rafRef = useRef(0);
  const stageRef = useRef(null);
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
    const measure = () => {
      setIsMobile(window.innerWidth < 760);
      if (stageRef.current) setStageW(Math.min(760, stageRef.current.clientWidth));
      schedulePreview();
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => { setImg(image); setZoom(1); setOffX(50); setOffY(50); setView("edit"); setPZoom(1); };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
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
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawPreview());
  }, [drawPreview]);

  const compute = useCallback(() => {
    if (!img || view !== "edit") return;
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
    const grid = quantize(d, W, H, enabled, dither);
    gridRef.current = { grid, W, H };
    const c = new Array(PALETTE.length).fill(0);
    for (let i = 0; i < grid.length; i++) c[grid[i]]++;
    setCounts(c);
    schedulePreview();
  }, [img, view, boardsW, boardsH, brightness, contrast, saturation, dither, zoom, offX, offY, enabled, schedulePreview]);

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
  const onPtrDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPtrMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) setPZoomClamped(pZoom * (d / pinchDist.current));
      pinchDist.current = d;
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
  };
  const onWheel = (e) => setPZoomClamped(pZoom * (1 - e.deltaY * 0.0015));

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

  const S = {
    page: { direction: "rtl", minHeight: "100vh", background: "#1B1D22", color: "#EDEDEF" },
    header: { display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "10px 12px" : "14px 22px", borderBottom: "1px solid #2C2F36", flexWrap: "wrap" },
    main: { display: "flex", flexWrap: "wrap", gap: isMobile ? 12 : 22, padding: isMobile ? 12 : 22, alignItems: "flex-start" },
    panel: { width: 320, background: "#23262C", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 16 },
    stage: { flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14, alignItems: "center" },
    label: { fontSize: 13, color: "#A9ADB6", marginBottom: 6 },
    row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
    btn: { background: "#FF6600", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
    ghost: { background: "transparent", color: "#EDEDEF", border: "1px solid #3A3E46", borderRadius: 10, padding: "9px 16px", fontSize: 14, cursor: "pointer" },
    stat: { background: "#1B1D22", borderRadius: 10, padding: "8px 10px", flex: 1, textAlign: "center" },
    statN: { fontSize: 17, fontWeight: 800 },
    statL: { fontSize: 11, color: "#8B8F98" },
    slider: { width: "100%", accentColor: "#FF6600" },
    drop: { border: "2px dashed " + (drag ? "#FF6600" : "#3A3E46"), borderRadius: 16, width: "100%", maxWidth: 760, aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: "pointer", background: drag ? "#2A2216" : "#202329", transition: "all .15s" },
    sizeBtn: (on) => ({ flex: 1, padding: "8px 0", borderRadius: 8, border: on ? "1.5px solid #FF6600" : "1px solid #3A3E46", background: on ? "#33230F" : "transparent", color: "#EDEDEF", cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 400 }),
    chip: (on) => ({ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 10px", borderRadius: 8, background: "#1B1D22", cursor: "pointer", opacity: on ? 1 : 0.32, border: "1px solid #2C2F36", fontSize: 12, flexShrink: 0 }),
    tab: (on) => ({ padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 400, background: on ? "#FF6600" : "#2C2F36", color: "#fff" }),
    toolTab: (on) => ({ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: on ? 700 : 400, background: on ? "#33230F" : "transparent", color: on ? "#FF6600" : "#A9ADB6", borderBottom: on ? "2px solid #FF6600" : "2px solid transparent" }),
  };

  const roomCfg = ROOMS[room];

  // ---------- shared control blocks ----------
  const sizeControls = (
    <div>
      <div style={S.label}>גודל התמונה (לוחות של 32×32)</div>
      <div style={S.row}>
        {[[2, 2], [3, 3], [4, 4]].map(([w, h]) => (
          <button key={w} style={S.sizeBtn(boardsW === w && boardsH === h)} onClick={() => { setBoardsW(w); setBoardsH(h); }}>
            {w}×{h}
          </button>
        ))}
      </div>
      <div style={{ ...S.row, marginTop: 8 }}>
        <span style={{ fontSize: 12, color: "#8B8F98" }}>מותאם:</span>
        {["רוחב", "גובה"].map((t, k) => (
          <select key={t} value={k === 0 ? boardsW : boardsH}
            onChange={(e) => (k === 0 ? setBoardsW(+e.target.value) : setBoardsH(+e.target.value))}
            style={{ background: "#1B1D22", color: "#EDEDEF", border: "1px solid #3A3E46", borderRadius: 8, padding: "6px 8px" }}>
            {[1, 2, 3, 4, 5, 6].map((v) => <option key={v} value={v}>{t} {v}</option>)}
          </select>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#8B8F98", marginTop: 6 }}>
        גודל פיזי: {picW.toFixed(1)} × {picH.toFixed(1)} ס״מ
      </div>
      {counts && (
        <div style={{ ...S.row, marginTop: 10 }}>
          <div style={S.stat}><div style={S.statN}>{boardsW * boardsH}</div><div style={S.statL}>לוחות</div></div>
          <div style={S.stat}><div style={S.statN}>{totalBrix.toLocaleString()}</div><div style={S.statL}>בריקס</div></div>
          <div style={S.stat}><div style={S.statN}>{usedColors}</div><div style={S.statL}>צבעים</div></div>
        </div>
      )}
    </div>
  );

  const cropControls = img && (
    <div>
      <div style={S.label}>חיתוך — זום {zoom.toFixed(1)}×</div>
      <input style={S.slider} type="range" min={10} max={40} value={zoom * 10} onChange={(e) => setZoom(+e.target.value / 10)} />
      <div style={S.label}>מיקום אופקי</div>
      <input style={S.slider} type="range" min={0} max={100} value={offX} onChange={(e) => setOffX(+e.target.value)} />
      <div style={S.label}>מיקום אנכי</div>
      <input style={S.slider} type="range" min={0} max={100} value={offY} onChange={(e) => setOffY(+e.target.value)} />
      <div style={{ fontSize: 11, color: "#8B8F98", marginTop: 4 }}>זום פנימה + הזזה = פיקסול של אזור הפנים בלבד</div>
    </div>
  );

  const adjustControls = (
    <div>
      <div style={S.label}>בהירות {brightness}</div>
      <input style={S.slider} type="range" min={-80} max={80} value={brightness} onChange={(e) => setBrightness(+e.target.value)} />
      <div style={S.label}>ניגודיות {contrast}</div>
      <input style={S.slider} type="range" min={-80} max={80} value={contrast} onChange={(e) => setContrast(+e.target.value)} />
      <div style={S.label}>רוויה {saturation}</div>
      <input style={S.slider} type="range" min={-80} max={80} value={saturation} onChange={(e) => setSaturation(+e.target.value)} />
      <label style={{ ...S.row, marginTop: 8, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} style={{ accentColor: "#FF6600" }} />
        דיטרינג (מעברי צבע חלקים)
      </label>
    </div>
  );

  const colorLegend = counts && (
    <div>
      <div style={{
        display: "flex", gap: 6,
        flexWrap: isMobile ? "nowrap" : "wrap",
        overflowX: isMobile ? "auto" : "visible",
        justifyContent: isMobile ? "flex-start" : "center",
        paddingBottom: isMobile ? 6 : 0,
        WebkitOverflowScrolling: "touch",
      }}>
        {sorted.map(({ c, i }) => (
          <div key={i} style={S.chip(enabled[i])} onClick={() => toggleColor(i)}>
            <img src={iconUrl(i)} alt="" style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid rgba(255,255,255,.25)" }} />
            <span>{c.toLocaleString()}</span>
          </div>
        ))}
        {PALETTE.map((p, i) => !enabled[i] && (
          <div key={"off" + i} style={S.chip(false)} onClick={() => toggleColor(i)}>
            <img src={iconUrl(i)} alt="" style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid rgba(255,255,255,.25)" }} />
            <span>כבוי</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#8B8F98", marginTop: 4 }}>לחיצה על אייקון מבטלת את הצבע</div>
    </div>
  );

  const actionButtons = (
    <div style={S.row}>
      <label htmlFor="pbx-file" style={{ ...S.btn, display: "inline-block" }}>העלאת תמונה</label>
      {img && <button style={S.ghost} onClick={downloadPNG}>הורדת PNG</button>}
      {img && (
        <button style={{ ...S.btn, background: busyPdf ? "#7a3d10" : "#FF6600", width: "100%" }} onClick={makePdf} disabled={busyPdf}>
          {busyPdf ? "מייצר PDF..." : "יצירת PDF הוראות A3"}
        </button>
      )}
    </div>
  );

  const previewBlock = (
    <>
      <div
        ref={containerRef}
        onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp}
        onPointerCancel={onPtrUp} onWheel={onWheel}
        style={{
          width: "fit-content", maxWidth: "100%",
          overflow: "hidden", borderRadius: 10,
          boxShadow: "0 8px 40px rgba(0,0,0,.5)",
          touchAction: "none",
          cursor: pZoom > 1 ? "grab" : "zoom-in",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", maxWidth: 760 }}>
        <span style={{ fontSize: 12, color: "#8B8F98", whiteSpace: "nowrap" }}>זום {pZoom.toFixed(1)}×</span>
        <input style={{ flex: 1, accentColor: "#FF6600" }} type="range" min={10} max={Math.round(maxPZoom() * 10)}
          value={Math.min(pZoom, maxPZoom()) * 10} onChange={(e) => setPZoomClamped(+e.target.value / 10)} />
        {pZoom > 1 && <button style={{ ...S.ghost, padding: "5px 12px" }} onClick={() => setPZoomClamped(1)}>איפוס</button>}
      </div>
    </>
  );

  const TOOLS = [
    ["size", "גודל"],
    ["crop", "חיתוך"],
    ["adjust", "כוונון"],
    ["colors", "צבעים"],
    ["actions", "קבצים"],
  ];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={{ background: "#FFFFFF", borderRadius: 10, padding: "6px 12px", display: "inline-flex", alignItems: "center" }}>
          <img src="/assets/logo.png" alt="PicToBrix" style={{ height: isMobile ? 22 : 30, display: "block" }} />
        </span>
        <div style={{ display: "flex", gap: 8, marginInlineStart: "auto" }}>
          <button style={S.tab(view === "edit")} onClick={() => setView("edit")}>עריכה</button>
          <button style={S.tab(view === "wall")} onClick={goWall}>הדמיה על קיר</button>
        </div>
      </div>

      <input id="pbx-file" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />

      {/* ============== MOBILE: image first, tools below ============== */}
      {isMobile && view === "edit" && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }} ref={stageRef}>
          {!img ? (
            <label style={S.drop}>
              <div style={{ fontSize: 44 }}>🧱</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>לחצו כאן לבחירת תמונה</div>
              <div style={{ fontSize: 13, color: "#8B8F98" }}>התמונה תהפוך להדמיית בריקס חיה</div>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />
            </label>
          ) : (
            <>
              {previewBlock}
              <div style={{ display: "flex", width: "100%", background: "#23262C", borderRadius: 12, padding: 4 }}>
                {TOOLS.map(([k, l]) => (
                  <button key={k} style={S.toolTab(tool === k)} onClick={() => setTool(k)}>{l}</button>
                ))}
              </div>
              <div style={{ width: "100%", background: "#23262C", borderRadius: 12, padding: 14 }}>
                {tool === "size" && sizeControls}
                {tool === "crop" && cropControls}
                {tool === "adjust" && adjustControls}
                {tool === "colors" && colorLegend}
                {tool === "actions" && actionButtons}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============== DESKTOP edit / wall + MOBILE wall ============== */}
      {(!isMobile || view === "wall") && (
        <div style={S.main}>
          {view === "edit" && !isMobile && (
            <div style={S.panel}>
              {actionButtons}
              {sizeControls}
              {cropControls}
              {adjustControls}
            </div>
          )}

          {view === "wall" && (
            <div style={{ ...S.panel, width: isMobile ? "100%" : 320 }}>
              <div>
                <div style={S.label}>בחירת חדר</div>
                <div style={{
                  display: "flex",
                  flexDirection: isMobile ? "row" : "column",
                  overflowX: isMobile ? "auto" : "visible",
                  gap: 8, WebkitOverflowScrolling: "touch",
                }}>
                  {Object.entries(ROOMS).map(([k, r]) => (
                    <button key={k} style={{ ...S.sizeBtn(room === k), whiteSpace: "nowrap", padding: "8px 12px", flex: isMobile ? "0 0 auto" : 1 }} onClick={() => setRoom(k)}>{r.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#A9ADB6", lineHeight: 1.6 }}>
                {!img && <div style={{ color: "#FFA745", marginBottom: 6 }}>העלו תמונה בלשונית עריכה כדי לראות אותה כאן</div>}
                התמונה שלך: <b style={{ color: "#EDEDEF" }}>{picW.toFixed(0)} × {picH.toFixed(0)} ס״מ</b> ({boardsW}×{boardsH} לוחות)
                <br />ההדמיה על צילום אמיתי, בקנה מידה אמיתי לפי הריהוט בחדר.
              </div>
              <button style={S.ghost} onClick={() => setView("edit")}>חזרה לעריכה ושינוי גודל</button>
            </div>
          )}

          <div style={S.stage} ref={view === "wall" || !isMobile ? stageRef : undefined}>
            {view === "edit" && !isMobile && (!img ? (
              <label
                style={S.drop}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files[0]); }}
              >
                <div style={{ fontSize: 44 }}>🧱</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>לחצו כאן לבחירת תמונה</div>
                <div style={{ fontSize: 13, color: "#8B8F98" }}>או גררו תמונה לכאן — היא תהפוך להדמיית בריקס חיה</div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />
              </label>
            ) : (
              <>
                {previewBlock}
                <div style={{ maxWidth: 780 }}>{colorLegend}</div>
              </>
            ))}
            {view === "wall" && (
              <div style={{ width: stageW, borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,.5)", position: "relative" }}>
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
