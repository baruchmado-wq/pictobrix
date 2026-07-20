// ===== Board sharing: the whole board is encoded inside the link itself =====
// A family builds together: the designer sends each builder their board as a
// WhatsApp link; opening it lands straight in the assembly screen. No server,
// no account — the link IS the instructions (~1KB of URL).
import { BOARD } from "./palette.js";

// 6-bit packing (palette indices 0-39 fit in 6 bits)
function packCells(cells) {
  const out = new Uint8Array(Math.ceil((cells.length * 6) / 8));
  let acc = 0, nbits = 0, o = 0;
  for (let i = 0; i < cells.length; i++) {
    acc = (acc << 6) | (cells[i] & 63);
    nbits += 6;
    while (nbits >= 8) { nbits -= 8; out[o++] = (acc >> nbits) & 255; }
  }
  if (nbits > 0) out[o++] = (acc << (8 - nbits)) & 255;
  return out;
}
function unpackCells(bytes, count) {
  const cells = new Int16Array(count);
  let acc = 0, nbits = 0, o = 0;
  for (let i = 0; i < count; i++) {
    while (nbits < 6) { acc = (acc << 8) | (bytes[o++] || 0); nbits += 8; }
    nbits -= 6;
    cells[i] = (acc >> nbits) & 63;
  }
  return cells;
}

const b64url = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// build a share URL for board `bi` of a project (grid is the full W×H picture)
export function boardShareUrl(project, bi, meta) {
  const { grid, W, boardsW, boardsH } = project;
  const n = meta?.n ?? boardsW * boardsH;
  const label = meta?.bi ?? bi;
  const bx = bi % boardsW, by = Math.floor(bi / boardsW);
  const cells = new Int16Array(BOARD * BOARD);
  for (let y = 0; y < BOARD; y++) {
    for (let x = 0; x < BOARD; x++) {
      cells[y * BOARD + x] = grid[(by * BOARD + y) * W + bx * BOARD + x];
    }
  }
  const bytes = new Uint8Array(3 + Math.ceil((cells.length * 6) / 8));
  bytes[0] = 1; // format version
  bytes[1] = label;
  bytes[2] = n;
  bytes.set(packCells(cells), 3);
  // Board data goes in a QUERY parameter (not a #fragment): URL shorteners strip
  // fragments on redirect but keep query params, so short links stay intact.
  return `${window.location.origin}/kit?b=${b64url(bytes)}`;
}

// share url for the WHOLE project (all boards) — format version 2
export function projectShareUrl(project) {
  const { grid, boardsW, boardsH } = project;
  const bytes = new Uint8Array(3 + Math.ceil((grid.length * 6) / 8));
  bytes[0] = 2; // full-project format
  bytes[1] = boardsW;
  bytes[2] = boardsH;
  bytes.set(packCells(grid), 3);
  return `${window.location.origin}/kit?b=${b64url(bytes)}`;
}

// parse the payload (from ?b=... , or legacy #bld=...) into a project; null if
// not present / invalid. Handles single-board (v1) and full-project (v2).
export function decodeBoardShare() {
  try {
    const enc =
      new URLSearchParams(window.location.search).get("b") ||
      (window.location.hash.startsWith("#bld=") ? window.location.hash.slice(5) : null);
    if (!enc) return null;
    const bytes = unb64url(enc);
    const key = enc.slice(0, 20); // stable id for saving progress on this device
    if (bytes[0] === 1) {
      const grid = unpackCells(bytes.subarray(3), BOARD * BOARD);
      for (let i = 0; i < grid.length; i++) if (grid[i] > 39) return null;
      return { grid, W: BOARD, H: BOARD, boardsW: 1, boardsH: 1, boardLabel: { i: bytes[1], n: bytes[2] }, key };
    }
    if (bytes[0] === 2) {
      const boardsW = bytes[1], boardsH = bytes[2];
      if (boardsW < 1 || boardsW > 8 || boardsH < 1 || boardsH > 8) return null;
      const W = boardsW * BOARD, H = boardsH * BOARD;
      const grid = unpackCells(bytes.subarray(3), W * H);
      for (let i = 0; i < grid.length; i++) if (grid[i] > 39) return null;
      return { grid, W, H, boardsW, boardsH, boardLabel: null, key };
    }
    return null;
  } catch { return null; }
}
