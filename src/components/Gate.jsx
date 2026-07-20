import { useState } from "react";
import { isUnlocked, unlock } from "../lib/auth.js";

// Password gate for the classic (pro) app. Wraps the editor; kit + shared-board
// routes are never wrapped, so customers are unaffected.
export default function Gate({ children }) {
  const [ok, setOk] = useState(() => isUnlocked());
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  if (ok) return children;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const good = await unlock(pw);
    setBusy(false);
    if (good) setOk(true);
    else { setErr(true); setPw(""); }
  };

  return (
    <div className="px-page" dir="rtl">
      <div className="px-gate">
        <img src="/assets/brixi.png" alt="Brixi" className="px-gate-brixi" width="426" height="480" />
        <img src="/assets/logo-white.png" alt="PicToBrix" className="px-gate-logo" />
        <div className="px-gate-title">כניסה לתוכנה</div>
        <form className="px-gate-form" onSubmit={submit}>
          <input
            type="password"
            className={"px-gate-input" + (err ? " is-err" : "")}
            placeholder="סיסמה"
            value={pw}
            autoFocus
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
          />
          <button type="submit" className="px-btn" disabled={busy || !pw}>
            {busy ? "בודק..." : "כניסה"}
          </button>
        </form>
        {err && <div className="px-gate-err">סיסמה שגויה — נסו שוב</div>}
        <div className="px-gate-hint">הגעתם מערכת בריקס? סרקו שוב את ה-QR שעל האריזה — היא נפתחת בלי סיסמה.</div>
      </div>
    </div>
  );
}
