// ===== Lightweight A3 instructions PDF, generated fully in the browser =====
// Light because each icon is embedded ONCE as a PDF XObject and reused on every
// cell (the 2019 system embedded thousands of images), and all content streams
// are Flate-compressed. No server needed.
import { RGB, BOARD, BOARD_CM, textureUrl } from "./palette.js";

const PT_W = 841.89, PT_H = 1190.55; // A3 portrait
const MM = 2.83465;
const ICON_PX = 96; // /assets/icons/iN.jpg size
const ENC = new TextEncoder();

async function deflate(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const cs = new CompressionStream("deflate");
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch { return null; }
}

export function bytesToDataUrl(bytes, mime) {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return `data:${mime};base64,` + btoa(bin);
}

let ICON_CACHE = null;
async function loadIconJpegs() {
  if (ICON_CACHE) return ICON_CACHE;
  ICON_CACHE = await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      fetch(`/assets/icons/i${i + 1}.jpg`).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b))
    )
  );
  return ICON_CACHE;
}

let LOGO_CACHE = null;
async function loadLogoJpeg() {
  if (LOGO_CACHE) return LOGO_CACHE;
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = "/assets/logo.png";
  });
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0);
  const b64 = cv.toDataURL("image/jpeg", 0.88).split(",")[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  LOGO_CACHE = { bytes, w: img.width, h: img.height };
  return LOGO_CACHE;
}

let TEXTURE_CACHE = null;
async function loadTextureImages() {
  if (TEXTURE_CACHE) return TEXTURE_CACHE;
  TEXTURE_CACHE = await Promise.all(
    Array.from({ length: 40 }, (_, i) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = textureUrl(i);
    }))
  );
  return TEXTURE_CACHE;
}

// realistic brick-texture overview image for page 1
async function overviewJpeg(grid, W, H) {
  const tex = await loadTextureImages();
  // print-quality overview: up to 32px per stud (~430 DPI on the A3 page),
  // capped at 4096px so mobile browsers can still render the canvas
  const cell = Math.max(12, Math.min(32, Math.floor(4096 / Math.max(W, H))));
  const cv = document.createElement("canvas");
  cv.width = W * cell; cv.height = H * cell;
  const ctx = cv.getContext("2d");
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      ctx.drawImage(tex[grid[y * W + x]], x * cell, y * cell, cell, cell);
  const b64 = cv.toDataURL("image/jpeg", 0.8).split(",")[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, w: cv.width, h: cv.height };
}

const f2 = (v) => (Math.round(v * 100) / 100).toString();
const textW = (s, size) => s.length * size * 0.55; // Helvetica approximation
const rgbn = (i) => {
  const [r, g, b] = RGB[i];
  return `${f2(r / 255)} ${f2(g / 255)} ${f2(b / 255)}`;
};

export async function buildInstructionsPdf(gridData, bw, bh, projectName, format = "A3") {
  const { grid, W, H } = gridData;
  const icons = await loadIconJpegs();
  const logo = await loadLogoJpeg();
  const ov = await overviewJpeg(grid, W, H);
  const totalPages = bw * bh + 1;

  // The whole layout is authored in A3 coordinates (PT_W × PT_H). For A4 we
  // keep every layout constant identical and just scale the rendered page down
  // to A4 via a content-stream transform + a smaller MediaBox — so nothing in
  // the layout logic changes. (A3 = 1:1 with the real 25.6cm board; A4 is the
  // shrunk fallback for printers without A3.)
  const A4 = format === "A4";
  const pageW = A4 ? 595.28 : PT_W;   // A4 portrait = 210 × 297 mm
  const pageH = A4 ? 841.89 : PT_H;
  const pscale = A4 ? pageW / PT_W : 1;
  // higher precision than f2 here so the whole A3 page maps exactly onto A4
  const scalePrefix = A4 ? `${pscale.toFixed(5)} 0 0 ${pscale.toFixed(5)} 0 0 cm\n` : "";
  const mediaBox = `[0 0 ${f2(pageW)} ${f2(pageH)}]`;

  const chunks = [];
  let pos = 0;
  const offsets = [];
  const push = (s) => {
    const b = typeof s === "string" ? ENC.encode(s) : s;
    chunks.push(b); pos += b.length;
  };
  const obj = (n, body) => { offsets[n] = pos; push(`${n} 0 obj\n${body}\nendobj\n`); };
  const streamObj = async (n, dictExtra, data, precompressed) => {
    let bytes = typeof data === "string" ? ENC.encode(data) : data;
    let filter = "";
    if (!precompressed) {
      const d = await deflate(bytes);
      if (d && d.length < bytes.length) { bytes = d; filter = "/Filter /FlateDecode "; }
    }
    offsets[n] = pos;
    push(`${n} 0 obj\n<< ${dictExtra} ${filter}/Length ${bytes.length} >>\nstream\n`);
    push(bytes);
    push("\nendstream\nendobj\n");
  };

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  for (let i = 0; i < 40; i++) {
    await streamObj(5 + i,
      `/Type /XObject /Subtype /Image /Width ${ICON_PX} /Height ${ICON_PX} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      icons[i], true);
  }
  await streamObj(45,
    `/Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
    logo.bytes, true);
  let xo = "";
  for (let i = 0; i < 40; i++) xo += `/I${i + 1} ${5 + i} 0 R `;
  await streamObj(47,
    `/Type /XObject /Subtype /Image /Width ${ov.w} /Height ${ov.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
    ov.bytes, true);
  obj(46, `<< /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xo}/LG 45 0 R /OV 47 0 R >> >>`);

  const pageObjIds = [];
  let nextId = 48;

  const header = (logoW) => {
    const lh = (logo.h / logo.w) * logoW;
    return `q ${f2(logoW)} 0 0 ${f2(lh)} ${f2((PT_W - logoW) / 2)} ${f2(PT_H - 18 * MM - lh)} cm /LG Do Q\n`;
  };
  const txt = (font, size, x, y, s) =>
    `BT /${font} ${size} Tf ${f2(x)} ${f2(y)} Td (${String(s).replace(/[()\\]/g, "")}) Tj ET\n`;
  const ctxt = (font, size, cx, y, s) => txt(font, size, cx - textW(String(s), size) / 2, y, s);

  // ---------- page 1: overview ----------
  {
    let c = "";
    c += header(170);
    c += "0 0 0 rg\n" + ctxt("F1", 11, PT_W / 2, PT_H - 33 * MM, "Instructions sheet");
    const gw = 180 * MM;
    const cell = gw / W;
    const gh = H * cell;
    const gx = (PT_W - gw) / 2, gyTop = PT_H - 42 * MM;
    c += `q ${f2(gw)} 0 0 ${f2(gh)} ${f2(gx)} ${f2(gyTop - gh)} cm /OV Do Q\n`;
    c += "1 1 1 RG 1.6 w\n";
    for (let b = 1; b < bw; b++) c += `${f2(gx + b * BOARD * cell)} ${f2(gyTop - gh)} m ${f2(gx + b * BOARD * cell)} ${f2(gyTop)} l S\n`;
    for (let b = 1; b < bh; b++) c += `${f2(gx)} ${f2(gyTop - b * BOARD * cell)} m ${f2(gx + gw)} ${f2(gyTop - b * BOARD * cell)} l S\n`;
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        const n = by * bw + bx + 1;
        const tx = gx + bx * BOARD * cell + 2, ty = gyTop - by * BOARD * cell - 13;
        c += `0.12 0.12 0.12 rg ${f2(tx)} ${f2(ty)} 12 11 re f\n`;
        c += "1 1 1 rg\n" + txt("F2", 8, tx + 2.5, ty + 2.5, n);
      }
    const counts = new Array(40).fill(0);
    for (let i = 0; i < grid.length; i++) counts[grid[i]]++;
    const order = counts.map((v, i) => ({ v, i })).filter(o => o.v > 0).sort((a, b) => b.v - a.v);
    const perRow = 6, colW = 32 * MM, sw = 5 * MM;
    const lx = 18 * MM;
    const ly = gyTop - gh - 10 * MM;
    c += "0 0 0 rg\n";
    order.forEach((o, k) => {
      const px = lx + (k % perRow) * colW;
      const py = ly - Math.floor(k / perRow) * 8 * MM;
      c += `q ${f2(sw)} 0 0 ${f2(sw)} ${f2(px)} ${f2(py)} cm /I${o.i + 1} Do Q\n`;
      c += txt("F1", 10, px + sw + 2, py + 3, o.v);
    });
    const infoY = ly - Math.ceil(order.length / perRow) * 8 * MM - 6 * MM;
    c += txt("F1", 10, 18 * MM, infoY,
      `Name: ${projectName}   Boards: ${bw * bh}   BRIX: ${grid.length}   Colors: ${order.length}   Pages: ${totalPages}`);
    c += ctxt("F1", 9, PT_W / 2, 10 * MM, `PAGE 1/${totalPages}`);

    const pid = nextId++, cid = nextId++;
    await streamObj(cid, "", scalePrefix + c);
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} /Resources 46 0 R /Contents ${cid} 0 R >>`);
    pageObjIds.push(pid);
  }

  // ---------- board pages ----------
  let pageNo = 2;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let c = "";
      c += header(150);
      // grid = the physical board size exactly, so the transparent board lays
      // straight over the icons on A3 (25.6cm → 8mm per stud)
      const gsize = BOARD_CM * 10 * MM;
      const cs = gsize / BOARD;
      const gx = (PT_W - gsize) / 2, gyTop = PT_H - 40 * MM;
      for (let y = 0; y < BOARD; y++)
        for (let x = 0; x < BOARD; x++) {
          const v = grid[(by * BOARD + y) * W + (bx * BOARD + x)];
          c += `q ${f2(cs)} 0 0 ${f2(cs)} ${f2(gx + x * cs)} ${f2(gyTop - (y + 1) * cs)} cm /I${v + 1} Do Q\n`;
        }
      c += "0.78 0.78 0.78 RG 0.3 w\n";
      for (let i = 0; i <= BOARD; i++) {
        c += `${f2(gx)} ${f2(gyTop - i * cs)} m ${f2(gx + gsize)} ${f2(gyTop - i * cs)} l S\n`;
        c += `${f2(gx + i * cs)} ${f2(gyTop - gsize)} m ${f2(gx + i * cs)} ${f2(gyTop)} l S\n`;
      }
      c += "0 0 0 rg\n";
      for (let i = 0; i < BOARD; i++) {
        c += ctxt("F1", 6, gx + i * cs + cs / 2, gyTop + 1.5 * MM, i + 1);
        c += txt("F1", 6, gx - 4 * MM, gyTop - i * cs - cs / 2 - 2, i + 1);
      }
      const counts = new Array(40).fill(0);
      for (let y = 0; y < BOARD; y++)
        for (let x = 0; x < BOARD; x++)
          counts[grid[(by * BOARD + y) * W + (bx * BOARD + x)]]++;
      const order = counts.map((v, i) => ({ v, i })).filter(o => o.v > 0).sort((a, b) => b.v - a.v);
      const perRow = 8, colW = 30 * MM, sw = 6.5 * MM;
      const ly = gyTop - gsize - 12 * MM;
      order.forEach((o, k) => {
        const px = gx + (k % perRow) * colW;
        const py = ly - Math.floor(k / perRow) * 10 * MM;
        c += `q ${f2(sw)} 0 0 ${f2(sw)} ${f2(px)} ${f2(py)} cm /I${o.i + 1} Do Q\n`;
        c += "0 0 0 rg\n" + txt("F2", 12, px + sw + 2.5, py + 4, o.v);
      });
      const bn = by * bw + bx + 1;
      c += txt("F1", 9, 18 * MM, 10 * MM, `BOARD ${bn}/${bw * bh}`);
      c += txt("F1", 9, PT_W - 18 * MM - textW(`PAGE ${pageNo}/${totalPages}`, 9), 10 * MM, `PAGE ${pageNo}/${totalPages}`);

      const pid = nextId++, cid = nextId++;
      await streamObj(cid, "", scalePrefix + c);
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} /Resources 46 0 R /Contents ${cid} 0 R >>`);
      pageObjIds.push(pid);
      pageNo++;
    }
  }

  obj(2, `<< /Type /Pages /Kids [${pageObjIds.map(i => i + " 0 R").join(" ")}] /Count ${pageObjIds.length} >>`);
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");

  const maxId = nextId - 1;
  const xrefPos = pos;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxId; i++) {
    xref += String(offsets[i] ?? 0).padStart(10, "0") + " 00000 n \n";
  }
  push(xref);
  push(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const total = new Uint8Array(pos);
  let p = 0;
  for (const ch of chunks) { total.set(ch, p); p += ch.length; }
  return total;
}
