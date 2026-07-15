import { useState, useRef, useEffect, useCallback } from "react";
import { PALETTE, BOARD, BOARD_CM, iconUrl, textureUrl } from "../lib/palette.js";
import { quantize, renderGrid } from "../lib/bricks.js";
import { buildInstructionsPdf, bytesToDataUrl } from "../lib/pdf.js";
import RoomScene, { ROOMS, WALL_H } from "./RoomScene.jsx";

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
  const [view, setView] = useState("edit"); // edit | wall
  const [room, setRoom] = useState("living");
  const [snapshot, setSnapshot] = useState(null);
  const [busyPdf, setBusyPdf] = useState(false);
  const [textures, setTextures] = useState(null);
  const canvasRef = useRef(null);
  const gridRef = useRef(null);
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(760);

  // load the 40 real brick textures once
  useEffect(() => {
    let alive = true;
    Promise.all(
      PALETTE.map((_, i) => new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = textureUrl(i);
      }))
    ).then((imgs) => { if (alive) setTextures(imgs); })
     .catch(() => {}); // procedural fallback stays
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const measure = () => {
      if (stageRef.current) setStageW(Math.min(760, stageRef.current.clientWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view]);

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => { setImg(image); setZoom(1); setOffX(50); setOffY(50); setView("edit"); };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const render = useCallback(() => {
    if (!img || view !== "edit") return;
    const W = boardsW * BOARD, H = boardsH * BOARD;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    // cover-crop + zoom/pan
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
    const cell = Math.max(6, Math.floor(Math.min(760 / W, 760 / H)));
    const cv = canvasRef.current;
    if (!cv) return;
    cv.width = W * cell; cv.height = H * cell;
    const ctx = cv.getContext("2d");
    renderGrid(ctx, grid, W, H, cell, textures);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    for (let bx = 1; bx < boardsW; bx++) {
      ctx.beginPath(); ctx.moveTo(bx * BOARD * cell, 0); ctx.lineTo(bx * BOARD * cell, H * cell); ctx.stroke();
    }
    for (let by = 1; by < boardsH; by++) {
      ctx.beginPath(); ctx.moveTo(0, by * BOARD * cell); ctx.lineTo(W * cell, by * BOARD * cell); ctx.stroke();
    }
  }, [img, view, boardsW, boardsH, brightness, contrast, saturation, dither, zoom, offX, offY, enabled, textures]);

  useEffect(() => { render(); }, [render]);

  const toggleColor = (i) => {
    const next = [...enabled];
    const on = next.filter(Boolean).length;
    if (next[i] && on <= 2) return;
    next[i] = !next[i];
    setEnabled(next);
  };

  const downloadPNG = () => {
    const cv = canvasRef.current;
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
    const cv = canvasRef.current;
    if (cv && img) setSnapshot(cv.toDataURL("image/jpeg", 0.9));
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
    header: { display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: "1px solid #2C2F36", flexWrap: "wrap" },
    main: { display: "flex", flexWrap: "wrap", gap: 22, padding: 22, alignItems: "flex-start" },
    panel: { width: 320, background: "#23262C", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 16 },
    stage: { flex: 1, minWidth: 300, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" },
    label: { fontSize: 13, color: "#A9ADB6", marginBottom: 6 },
    row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
    btn: { background: "#FF6600", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
    ghost: { background: "transparent", color: "#EDEDEF", border: "1px solid #3A3E46", borderRadius: 10, padding: "9px 16px", fontSize: 14, cursor: "pointer" },
    stat: { background: "#1B1D22", borderRadius: 10, padding: "10px 12px", flex: 1, textAlign: "center" },
    statN: { fontSize: 18, fontWeight: 800 },
    statL: { fontSize: 11, color: "#8B8F98" },
    slider: { width: "100%", accentColor: "#FF6600" },
    drop: { border: "2px dashed " + (drag ? "#FF6600" : "#3A3E46"), borderRadius: 16, width: "100%", maxWidth: 760, aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: "pointer", background: drag ? "#2A2216" : "#202329", transition: "all .15s" },
    sizeBtn: (on) => ({ flex: 1, padding: "8px 0", borderRadius: 8, border: on ? "1.5px solid #FF6600" : "1px solid #3A3E46", background: on ? "#33230F" : "transparent", color: "#EDEDEF", cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 400 }),
    chip: (on) => ({ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 10px", borderRadius: 8, background: "#1B1D22", cursor: "pointer", opacity: on ? 1 : 0.32, border: "1px solid #2C2F36", fontSize: 12 }),
    tab: (on) => ({ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 400, background: on ? "#FF6600" : "#2C2F36", color: "#fff" }),
  };

  const roomCfg = ROOMS[room];
  const ppm = stageW / roomCfg.width;
  const wallPx = WALL_H * ppm;
  const floorPx = 0.55 * ppm;
  const picPxW = (picW / 100) * ppm;
  const picPxH = (picH / 100) * ppm;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={{ background: "#FFFFFF", borderRadius: 10, padding: "8px 14px", display: "inline-flex", alignItems: "center" }}>
          <img src="/assets/logo.png" alt="PicToBrix" style={{ height: 30, display: "block" }} />
        </span>
        <div style={{ display: "flex", gap: 8, marginInlineStart: "auto" }}>
          <button style={S.tab(view === "edit")} onClick={() => setView("edit")}>עריכה</button>
          <button style={S.tab(view === "wall")} onClick={goWall}>הדמיה על קיר</button>
        </div>
      </div>

      <div style={S.main}>
        {view === "edit" && (
          <div style={S.panel}>
            <div>
              <div style={S.label}>תמונה</div>
              <div style={S.row}>
                <label htmlFor="pbx-file" style={{ ...S.btn, display: "inline-block" }}>העלאת תמונה</label>
                {img && <button style={S.ghost} onClick={downloadPNG}>הורדת הדמיה PNG</button>}
                {img && (
                  <button style={{ ...S.btn, background: busyPdf ? "#7a3d10" : "#FF6600", width: "100%" }} onClick={makePdf} disabled={busyPdf}>
                    {busyPdf ? "מייצר PDF..." : "יצירת PDF הוראות A3"}
                  </button>
                )}
              </div>
              <input id="pbx-file" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />
            </div>

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
            </div>

            {img && (
              <div>
                <div style={S.label}>חיתוך — זום {zoom.toFixed(1)}×</div>
                <input style={S.slider} type="range" min={10} max={40} value={zoom * 10} onChange={(e) => setZoom(+e.target.value / 10)} />
                <div style={S.label}>מיקום אופקי</div>
                <input style={S.slider} type="range" min={0} max={100} value={offX} onChange={(e) => setOffX(+e.target.value)} />
                <div style={S.label}>מיקום אנכי</div>
                <input style={S.slider} type="range" min={0} max={100} value={offY} onChange={(e) => setOffY(+e.target.value)} />
                <div style={{ fontSize: 11, color: "#8B8F98", marginTop: 4 }}>
                  זום פנימה + הזזה = פיקסול של אזור הפנים בלבד
                </div>
              </div>
            )}

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

            {counts && (
              <div style={S.row}>
                <div style={S.stat}><div style={S.statN}>{boardsW * boardsH}</div><div style={S.statL}>לוחות</div></div>
                <div style={S.stat}><div style={S.statN}>{totalBrix.toLocaleString()}</div><div style={S.statL}>בריקס</div></div>
                <div style={S.stat}><div style={S.statN}>{usedColors}</div><div style={S.statL}>צבעים</div></div>
              </div>
            )}
          </div>
        )}

        {view === "wall" && (
          <div style={S.panel}>
            <div>
              <div style={S.label}>בחירת חדר</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(ROOMS).map(([k, r]) => (
                  <button key={k} style={S.sizeBtn(room === k)} onClick={() => setRoom(k)}>{r.label}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#A9ADB6", lineHeight: 1.6 }}>
              {!img && <div style={{ color: "#FFA745", marginBottom: 6 }}>העלו תמונה בלשונית עריכה כדי לראות אותה כאן</div>}
              התמונה שלך: <b style={{ color: "#EDEDEF" }}>{picW.toFixed(0)} × {picH.toFixed(0)} ס״מ</b>
              <br />({boardsW}×{boardsH} לוחות • {totalBrix.toLocaleString()} בריקס)
              <br />ההדמיה בקנה מידה אמיתי מול רוחב קיר של {roomCfg.width} מ׳.
            </div>
            <button style={S.ghost} onClick={() => setView("edit")}>חזרה לעריכה ושינוי גודל</button>
          </div>
        )}

        <div style={S.stage} ref={stageRef}>
          {!img && view === "edit" ? (
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
          ) : view === "edit" ? (
            <>
              <canvas ref={canvasRef} style={{ maxWidth: "100%", borderRadius: 10, boxShadow: "0 8px 40px rgba(0,0,0,.5)" }} />
              {counts && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 780, justifyContent: "center" }}>
                  {sorted.map(({ c, i }) => (
                    <div key={i} style={S.chip(enabled[i])} onClick={() => toggleColor(i)}
                      title={enabled[i] ? "לחיצה לביטול הצבע" : "לחיצה להחזרת הצבע"}>
                      <img src={iconUrl(i)} alt="" style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid rgba(255,255,255,.25)" }} />
                      <span>{c.toLocaleString()}</span>
                    </div>
                  ))}
                  {PALETTE.map((p, i) => !enabled[i] && (
                    <div key={"off" + i} style={S.chip(false)} onClick={() => toggleColor(i)} title="לחיצה להחזרת הצבע">
                      <img src={iconUrl(i)} alt="" style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid rgba(255,255,255,.25)" }} />
                      <span>כבוי</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#8B8F98" }}>לחיצה על אייקון במקרא מבטלת את הצבע — התמונה מחושבת מחדש מיד</div>
            </>
          ) : (
            <div style={{ width: stageW, borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,.5)", position: "relative" }}>
              <RoomScene room={room} stageW={stageW} ppm={ppm} wallPx={wallPx} floorPx={floorPx}
                snapshot={snapshot} picPxW={picPxW} picPxH={picPxH} />
              <div style={{ position: "absolute", bottom: 8, insetInlineStart: 10, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "4px 10px", borderRadius: 8 }}>
                {roomCfg.label} • תמונה {picW.toFixed(0)}×{picH.toFixed(0)} ס״מ • דמות בגובה 1.70 מ׳
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
