/**
 * GitHub Pages public viewer settings (no secrets).
 * SNAPSHOT_URL: 公開スナップショット（latest.json）の本命 = Cloudflare R2（2026-11-13〜）
 * SNAPSHOT_URL_FALLBACK: 予備 = Supabase Storage。本命が読めないときだけ使い、10分ごとに本命へ戻れるか試す。
 *   日付別・確定結果・前走・お知らせ・追跡ログの URL は SNAPSHOT_URL と同じ場所から作るので一緒に切り替わる。
 *   2026-11-13 に Supabase が無料枠の配信量超過（402）で止まったため R2 を本命にした。
 *
 * SHOW_CAST_ICONS:
 *   true  … 「登場人物の役割説明」にピクトグラムを表示（現行）
 *   false … 旧テキストのみ表示に戻す（いつでも切替可）
 *
 * PRE_RACE_TRIGGER_MODE:
 *   "15" … サイドバー「主な更新タイミング」の直前行を15分前帯に
 *   "6_8" … 6〜8分前帯に
 */
window.PUBLIC_VIEWER_CONFIG = {
  SNAPSHOT_URL: "https://pub-eb7407425e2249ab9b4d074c6e021637.r2.dev/snapshots/latest.json",
  SNAPSHOT_URL_FALLBACK: "https://rathgwvfewasazxlpusx.supabase.co/storage/v1/object/public/public-viewer/snapshots/latest.json",
  LINE_FRIEND_URL: "https://lin.ee/YOUR_LINE_OA",
  DISCORD_INVITE_URL: "https://discord.gg/j23u3KWtcH",
  /** 超直前予想（発走約5分前・Discord通知限定）の参加リンク。サイドバーの黒いボタン */
  DISCORD_5M_INVITE_URL: "https://discord.gg/4Xc5sxS9Y",
  BRAND_NAME: "\u7AF6\u99ACAI \u30DF\u30B9\u30C6\u30EA\u30FC\u4E88\u60F3",
  POLL_INTERVAL_MS: 30000,
  SHOW_CAST_ICONS: true,
  PRE_RACE_TRIGGER_MODE: "15",
  /* 管理画面は 2026-11-13 に閲覧サイトから外した（公開トンネルは 08-11 に廃止済み）。
     管理画面は自宅LAN / Tailscale の http://<サーバー>:8791/panel/ だけ。 */
};
