// ===== Saved projects: the finished grid + assembly progress, kept in
// localStorage so losing the phone tab / closing the browser never means
// redesigning the picture. Keyed per flow (kit / classic).
const KEY = (mode) => `pbx-project-${mode}`;

const CH = 0x8000;
function gridToB64(grid) {
  const u8 = Uint8Array.from(grid);
  let bin = "";
  for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(bin);
}
function b64ToGrid(b64) {
  const bin = atob(b64);
  const g = new Int16Array(bin.length);
  for (let i = 0; i < bin.length; i++) g[i] = bin.charCodeAt(i);
  return g;
}

export function saveProject(mode, { grid, W, H, boardsW, boardsH, kits, progress }) {
  try {
    localStorage.setItem(KEY(mode), JSON.stringify({
      v: 1, ts: Date.now(), W, H, boardsW, boardsH, kits: kits || 0,
      progress: progress || { b: 0, row: 0 },
      grid: gridToB64(grid),
    }));
    return true;
  } catch { return false; }
}

export function loadProject(mode) {
  try {
    const raw = localStorage.getItem(KEY(mode));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.v !== 1 || !p.grid) return null;
    p.grid = b64ToGrid(p.grid);
    if (p.grid.length !== p.W * p.H) return null;
    return p;
  } catch { return null; }
}

export function saveProgress(mode, progress) {
  try {
    const raw = localStorage.getItem(KEY(mode));
    if (!raw) return;
    const p = JSON.parse(raw);
    p.progress = progress;
    localStorage.setItem(KEY(mode), JSON.stringify(p));
  } catch { /* storage full/blocked — non-fatal */ }
}

export function clearProject(mode) {
  try { localStorage.removeItem(KEY(mode)); } catch { /* ignore */ }
}
