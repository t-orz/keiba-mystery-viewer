/* 閲覧サイト共通のエラー案内（2026-11-14 ユーザー採用）。
   見た目はエラー画像（error-pages/out/*.png）と同じ。文言の正は error-pages/errors.json の1か所で、
   画像（error-pages/build.py）とこの案内の両方がそこを読む。文言を変えたら errors.json だけ直す。

   使い方: ErrorCard.show(要素, エラー) / ErrorCard.hide(要素)
   エラーは new Error("HTTP 404") の形か、通信エラー（TypeError など）。
   別サイト（R2・Supabase）からの読み込みでブロックされた（403）ときは、ブラウザの決まりで番号が
   読めず通信エラーになる。そのときは「読み込めませんでした」（502_network）を出す。 */
(function () {
  "use strict";
  const FALLBACK = {
    code: "502", label: "BAD GATEWAY", title: "データを読み込めませんでした",
    message: "配信先との通信がうまくいきませんでした。\n時間をおいて、もう一度お試しください。",
    boxes: [], foot: "",
  };
  let table = null;
  let loading = null;
  const seqs = new WeakMap(); // 出す場所ごとの順番（待っている間に hide / 別の show が来たら捨てる）

  function load() {
    if (table) return Promise.resolve(table);
    if (!loading) {
      loading = fetch("error-pages/errors.json?t=" + Date.now(), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const t = {};
          for (const e of (j && j.errors) || []) t[e.id] = e;
          if (Object.keys(t).length) table = t;
          loading = null;
          return t;
        })
        .catch(() => {
          loading = null;
          return {};
        });
    }
    return loading;
  }

  function statusOf(err) {
    const m = /HTTP (\d{3})/.exec(String((err && err.message) || err || ""));
    return m ? Number(m[1]) : 0;
  }

  function pickId(status) {
    if (status === 404) return "404_not_found";
    if (status === 429) return "429_too_many";
    if (status === 403) return "403_generic";
    if (status === 401 || status === 402 || status === 503) return "503_paused";
    return "502_network";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function injectStyle() {
    if (document.getElementById("errorCardStyle")) return;
    const st = document.createElement("style");
    st.id = "errorCardStyle";
    st.textContent = `
.ec-card{display:flex;max-width:860px;margin:12px auto;background:#fff;border:1px solid #e3ddd0;border-radius:16px;
  box-shadow:0 8px 28px rgba(60,50,30,.10);overflow:hidden;color:#1f2430;text-align:left;
  font-family:"Yu Gothic UI","Meiryo","Noto Sans JP",sans-serif}
.ec-left{flex:0 0 220px;background:#1f2430;color:#fff;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:10px;padding:24px 12px}
.ec-lock{width:52px;height:52px}
.ec-code{font-size:72px;font-weight:800;letter-spacing:3px;line-height:1}
.ec-code span{color:#e8a0a0}
.ec-tag{font-size:13px;letter-spacing:4px;color:#c9ccd6;text-align:center}
.ec-right{flex:1;padding:24px 28px;display:flex;flex-direction:column;justify-content:center;gap:12px}
.ec-title{font-size:22px;font-weight:800;color:#b23a3a;margin:0}
.ec-msg{font-size:15px;line-height:1.75;color:#5b6170;margin:0}
.ec-boxes{display:flex;gap:10px}
.ec-box{flex:1;border:1px solid #e3ddd0;border-radius:10px;padding:10px 12px;background:#faf8f3}
.ec-box b{display:block;font-size:12px;color:#5b6170;font-weight:600;margin-bottom:4px}
.ec-box em{font-style:normal;font-size:17px;font-weight:800;color:#1f2430}
.ec-foot{font-size:12px;color:#8a8f9c;border-top:1px solid #e3ddd0;padding-top:10px;margin:0}
@media (max-width:600px){
  .ec-card{flex-direction:column;margin:10px 0}
  .ec-left{flex:none;flex-direction:row;gap:14px;padding:14px}
  .ec-lock{width:34px;height:34px}
  .ec-code{font-size:44px}
  .ec-right{padding:16px}
  .ec-title{font-size:18px}
  .ec-msg br{display:none}
  .ec-boxes{flex-direction:column}
}`;
    document.head.appendChild(st);
  }

  const LOCK = '<svg class="ec-lock" viewBox="0 0 64 64" fill="none" stroke="#e8a0a0" stroke-width="5" stroke-linecap="round" aria-hidden="true">'
    + '<rect x="12" y="28" width="40" height="28" rx="6" fill="#2c3343"/><path d="M20 28v-8a12 12 0 0 1 24 0v8"/>'
    + '<circle cx="32" cy="41" r="3.5" fill="#e8a0a0" stroke="none"/><path d="M32 44v5"/></svg>';

  function cardHtml(e, err, status) {
    const code = esc(e.code);
    const codeHtml = code.length === 3 ? `${code[0]}<span>${code[1]}</span>${code.slice(2)}` : code;
    const boxes = (e.boxes || []).slice(0, 2)
      .map(([k, v]) => `<div class="ec-box"><b>${esc(k)}</b><em>${esc(v)}</em></div>`).join("");
    const msg = String(e.message || "").split("\n").map(esc).join("<br>");
    // 調べるとき用に、実際の中身（HTTP 番号か通信エラー）を小さく添える
    const detail = status ? `HTTP ${status}` : "通信エラー";
    const foot = [e.foot ? esc(e.foot) : "", `（詳細: ${esc(detail)}）`].filter(Boolean).join(" ");
    return `<div class="ec-card" role="alert">
  <div class="ec-left">${LOCK}<div><div class="ec-code">${codeHtml}</div><div class="ec-tag">${esc(e.label)}</div></div></div>
  <div class="ec-right">
    <h2 class="ec-title">${esc(e.title)}</h2>
    <p class="ec-msg">${msg}</p>
    ${boxes ? `<div class="ec-boxes">${boxes}</div>` : ""}
    <p class="ec-foot">${foot}</p>
  </div>
</div>`;
  }

  async function show(el, err) {
    if (!el) return;
    const my = (seqs.get(el) || 0) + 1;
    seqs.set(el, my);
    const status = statusOf(err);
    const t = await load();
    if (seqs.get(el) !== my) return;
    injectStyle();
    el.innerHTML = cardHtml(t[pickId(status)] || FALLBACK, err, status);
    el.hidden = false;
  }

  function hide(el) {
    if (!el) return;
    seqs.set(el, (seqs.get(el) || 0) + 1);
    if (el.hidden) return;
    el.hidden = true;
    el.innerHTML = "";
  }

  window.ErrorCard = { show, hide, statusOf, pickId };
})();
