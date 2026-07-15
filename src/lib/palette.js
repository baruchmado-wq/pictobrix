// ===== The 40-color PicToBrix palette (extracted from the original brand assets) =====
export const PALETTE = [
  { n: 1, hex: "#FFFFFF" }, { n: 2, hex: "#9C9C9C" }, { n: 3, hex: "#5E5E5E" },
  { n: 4, hex: "#151014" }, { n: 5, hex: "#591F0B" }, { n: 6, hex: "#AA0000" },
  { n: 7, hex: "#E44F63" }, { n: 8, hex: "#F1876F" }, { n: 9, hex: "#FF6600" },
  { n: 10, hex: "#FFA745" }, { n: 11, hex: "#44D1E5" }, { n: 12, hex: "#BAFFEC" },
  { n: 13, hex: "#004F32" }, { n: 14, hex: "#01B14C" }, { n: 15, hex: "#ABFFAA" },
  { n: 16, hex: "#638263" }, { n: 17, hex: "#787355" }, { n: 18, hex: "#EFDB96" },
  { n: 19, hex: "#FFFF95" }, { n: 20, hex: "#FFE001" }, { n: 21, hex: "#5EA5F5" },
  { n: 22, hex: "#006EB5" }, { n: 23, hex: "#1D3768" }, { n: 24, hex: "#593F96" },
  { n: 25, hex: "#A285BD" }, { n: 26, hex: "#FFC6E6" }, { n: 27, hex: "#C754A1" },
  { n: 28, hex: "#891046" }, { n: 29, hex: "#B5755C" }, { n: 30, hex: "#CBAB94" },
  { n: 31, hex: "#FFDAC7" }, { n: 32, hex: "#FABF97" }, { n: 33, hex: "#EDB9A1" },
  { n: 34, hex: "#C29288" }, { n: 35, hex: "#C37233" }, { n: 36, hex: "#5C4B44" },
  { n: 37, hex: "#E39C80" }, { n: 38, hex: "#AF9654" }, { n: 39, hex: "#8C4737" },
  { n: 40, hex: "#FAAB82" },
];

export const BOARD = 32;       // 32x32 studs per board
export const BOARD_CM = 25.6;  // physical board size in cm

export const hexToRgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export const RGB = PALETTE.map((p) => hexToRgb(p.hex));

export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export const iconUrl = (i) => `/assets/icons/i${i + 1}.jpg`;       // i = palette index (0-39)
export const textureUrl = (i) => `/assets/textures/t${i + 1}.jpg`;
