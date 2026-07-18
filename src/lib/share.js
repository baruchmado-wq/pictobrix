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
  return `${window.location.origin}/#bld=${b64url(bytes)}`;
}

// parse a "#bld=..." hash into a single-board project; null if not one / invalid
export function decodeBoardShare(hash) {
  try {
    if (!hash || !hash.startsWith("#bld=")) return null;
    const bytes = unb64url(hash.slice(5));
    if (bytes[0] !== 1) return null;
    const grid = unpackCells(bytes.subarray(3), BOARD * BOARD);
    for (let i = 0; i < grid.length; i++) if (grid[i] > 39) return null;
    return {
      grid, W: BOARD, H: BOARD, boardsW: 1, boardsH: 1,
      boardLabel: { i: bytes[1], n: bytes[2] },
      key: hash.slice(5, 25), // stable id for saving progress on this device
    };
  } catch { return null; }
}
