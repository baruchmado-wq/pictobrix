// Vercel serverless function: shorten a PicToBrix share link via a free URL
// shortener (server-side, to avoid browser CORS). Falls back across providers;
// the client falls back to the long link if this fails entirely.
export default async function handler(req, res) {
  const url = (req.query.url || "").toString();
  // only shorten our own links — don't act as an open redirect/shortener
  if (!/^https:\/\/(www\.)?pic2brix\.com\/(#|kit|\?|$)/.test(url) || url.length > 9000) {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  const providers = [
    // is.gd / v.gd redirect straight through (no preview interstitial)
    async () => {
      const r = await fetch("https://is.gd/create.php?format=simple&logstats=0&url=" + encodeURIComponent(url));
      const t = (await r.text()).trim();
      return r.ok && t.startsWith("https://") ? t : null;
    },
    async () => {
      const r = await fetch("https://v.gd/create.php?format=simple&logstats=0&url=" + encodeURIComponent(url));
      const t = (await r.text()).trim();
      return r.ok && t.startsWith("https://") ? t : null;
    },
    async () => {
      const r = await fetch("https://tinyurl.com/api-create.php?url=" + encodeURIComponent(url));
      const t = (await r.text()).trim();
      return r.ok && /^https?:\/\//.test(t) ? t : null;
    },
  ];

  // race all providers — first valid short link wins (much faster than trying
  // them one after another, since is.gd is often slow/flaky)
  let short = null;
  try {
    short = await Promise.any(providers.map(async (p) => {
      const s = await p();
      if (!s) throw new Error("empty");
      return s;
    }));
  } catch { short = null; }

  if (short) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ short });
    return;
  }
  res.status(502).json({ error: "shorten failed" });
}
