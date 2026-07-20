// ===== Soft login gate for the classic (pro) app =====
// A client-side password gate whose purpose is to stop people who arrived via
// the retail KIT link from wandering into the pro tool by accident. It is NOT
// strong security (this is a static site — the check runs in the browser); it
// keeps casual/accidental users out, nothing more.
//
// Only the SHA-256 hash of the password is stored here, never the plaintext.
const PASS_HASH = "8c2fca97b3faa721edba69d7ecc35ba5dd8c623858001b16c975302361d0a8e9";
const KEY = "pbx-auth";

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// unlocked on this device? (the stored token is the current hash, so changing
// the password automatically invalidates every previous unlock)
export function isUnlocked() {
  try { return localStorage.getItem(KEY) === PASS_HASH; } catch { return false; }
}

export async function unlock(password) {
  const h = await sha256Hex(password);
  if (h === PASS_HASH) {
    try { localStorage.setItem(KEY, PASS_HASH); } catch { /* ignore */ }
    return true;
  }
  return false;
}
