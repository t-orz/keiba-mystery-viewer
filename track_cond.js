/* 【天候・馬場・直線風向 m/s】の表示部品（閲覧サイト app.js と追跡ページ tracker.html で共用）。
   2026-10-25 に app.js から切り出した。直すときはここ1か所でよい。
   表示先の要素 id は trackCond / trackCondList / trackCondWindAt で両ページ共通。 */
(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeStartTime(st) {
    const m = String(st || "").trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return "";
    return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
  }

  function isDayClosedSnapshot(data) {
    if (!data || typeof data !== "object") return false;
    if (data.cleared === true) return true;
    const venues = Array.isArray(data.venues) ? data.venues : [];
    const n = Number(data.race_count || 0);
    return n === 0 && venues.length === 0;
  }

  const TRACK_BABA_CLASS = { "良": "ryo", "稍重": "yaya", "重": "omo", "不良": "furyo" };

  // JRA 公式の天候は 6 種（晴・曇・小雨・雨・小雪・雪）。
  // BMP の記号には異体字セレクタ FE0F を付け、字形フォントではなく絵文字で出させる。
  const TRACK_WEATHER_ICON = {
    "晴": String.fromCodePoint(0x2600, 0xfe0f),
    "曇": String.fromCodePoint(0x2601, 0xfe0f),
    "小雨": String.fromCodePoint(0x1f302),
    "雨": String.fromCodePoint(0x2602, 0xfe0f),
    "小雪": String.fromCodePoint(0x1f328, 0xfe0f),
    "雪": String.fromCodePoint(0x26c4),
  };

  let trackEmojiOk = null;

  /** 使う絵文字が全て字形を持つ環境か。1 つでも豆腐になるなら文字表示に戻す。 */
  function trackEmojiSupported() {
    if (trackEmojiOk !== null) return trackEmojiOk;
    trackEmojiOk = false;
    try {
      const canvas = document.createElement("canvas");
      if (!canvas.getContext) return trackEmojiOk;
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return trackEmojiOk;
      const draw = (ch) => {
        ctx.clearRect(0, 0, 24, 24);
        ctx.textBaseline = "top";
        ctx.font = "18px sans-serif";
        ctx.fillText(ch, 0, 0);
        return canvas.toDataURL();
      };
      // U+FFFF は非文字なので必ず豆腐になる。これと同じ描画＝その字形が無い。
      const tofu = draw(String.fromCodePoint(0xffff));
      trackEmojiOk = Object.keys(TRACK_WEATHER_ICON)
        .map((k) => TRACK_WEATHER_ICON[k])
        .every((ch) => draw(ch) !== tofu);
    } catch (e) {
      trackEmojiOk = false;
    }
    return trackEmojiOk;
  }

  function trackWeatherHtml(weather) {
    const text = String(weather || "").trim();
    const icon = TRACK_WEATHER_ICON[text];
    // 未知の表記と、絵文字を出せない環境では従来どおり文字で出す。
    if (!icon || !trackEmojiSupported()) {
      return '<span class="track-cond-weather">' + escapeHtml(text || "—") + "</span>";
    }
    return (
      '<span class="track-cond-weather track-cond-weather--icon" title="' +
      escapeHtml(text) +
      '" aria-label="' +
      escapeHtml(text) +
      '">' +
      icon +
      "</span>"
    );
  }

  function trackBabaClass(v) {
    return "track-cond-baba track-cond-baba--" + (TRACK_BABA_CLASS[String(v || "").trim()] || "none");
  }

  // 直前予想は個別レースだけを更新するので、predicted_at が新しいレースほど
  // 天候・馬場の取得時刻も新しい。predicted_at が無いものは R の大きい方で代用する。
  function trackCondRecencyKey(r) {
    const pa = r && r.predicted_at;
    if (pa) {
      const t = Date.parse(String(pa).replace(" ", "T"));
      if (!Number.isNaN(t)) return [1, t];
    }
    const rn = parseInt(String((r && r.R) || "").replace(/[^0-9]/g, ""), 10);
    return [0, Number.isNaN(rn) ? -1 : rn];
  }

  function trackLatestValue(races, valueOf) {
    let best = "";
    let bestKey = null;
    for (const r of races) {
      const v = String(valueOf(r) || "").trim();
      if (!v || v === "-") continue;
      const key = trackCondRecencyKey(r);
      if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
        best = v;
        bestKey = key;
      }
    }
    return best;
  }

  /* 最後の直線の風（2026-10-17）。気象庁アメダスの最寄り観測点を閲覧者のブラウザから直接読む
     （CORS 許可あり・1観測点 約8KB）。表示だけで予想には使わない。
     bearing は直線をゴールへ向かう進行方向（北=0°・時計回り）。OSM の走路と実測コース形状の
     照合で求め、180°取り違えはスタンド側の建物面積で検算した（サーバー ~/research_wind/）。 */
  const WIND_STRETCH = {
    札幌: { bearing: 179.4, hand: "right", station: "14163", stationName: "札幌", km: 1.8 },
    函館: { bearing: 123.5, hand: "right", station: "23232", stationName: "函館", km: 4.3 },
    福島: { bearing: 26.5, hand: "right", station: "36127", stationName: "福島", km: 1.3 },
    新潟: { bearing: 241.8, hand: "left", station: "54236", stationName: "松浜", km: 6.5 },
    東京: { bearing: 267.5, hand: "left", station: "44116", stationName: "府中", km: 2.1 },
    中山: { bearing: 14.8, hand: "right", station: "45106", stationName: "船橋", km: 7.6 },
    中京: { bearing: 234.1, hand: "left", station: "51216", stationName: "大府", km: 9.0 },
    京都: { bearing: 53.5, hand: "right", station: "61326", stationName: "京田辺", km: 9.1 },
    阪神: { bearing: 286.8, hand: "right", station: "62051", stationName: "豊中", km: 7.1 },
    小倉: { bearing: 156.5, hand: "right", station: "82056", stationName: "八幡", km: 12.1 },
  };
  const WIND_DIR16 = ["", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西", "北"];
  const WIND_REFRESH_MS = 10 * 60 * 1000;
  const windState = { byPlace: {}, loadedAt: 0, loading: false, frozenDay: "" };
  /** 最終レースの発走からこの分だけ後の観測で風を止める（その10分観測にレースが入る） */
  const WIND_FREEZE_AFTER_LAST_START_MIN = 10;

  /** 当日最終レース発走＋10分を "YYYYMMDDHHMM00"（アメダスのキーと同じ形）で。発走時刻が無ければ "" */
  function windFreezeKey(data) {
    let last = -1;
    for (const v of Array.isArray(data.venues) ? data.venues : []) {
      for (const r of Array.isArray(v && v.races) ? v.races : []) {
        const hm = normalizeStartTime(r && r.start_time);
        if (hm) last = Math.max(last, Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)));
      }
    }
    if (last < 0) return "";
    const t = Math.min(last + WIND_FREEZE_AFTER_LAST_START_MIN, 23 * 60 + 50);
    const ymd = String(data.schedule_date || "").replace(/-/g, "");
    return `${ymd}${String(Math.floor(t / 60)).padStart(2, "0")}${String(t % 60).padStart(2, "0")}00`;
  }

  /** 風向（吹いてくる方位 1〜16）と直線の向きから、追い風／向かい風／横風を判定する。
      rel は「風が吹いていく向き」を、馬が上へ走り内ラチが左にある図に置いたときの角度
      （0=真上=追い風、180=向かい風、-90=外から内へ吹く横風、+90=内から外へ）。
      右回りは内ラチが右手なので左右を反転して、どの場でも内ラチを左に描く */
  function windRelation(dirCode, speed, info) {
    if (!dirCode || !(speed > 0)) return { label: "無風", cls: "calm", rel: 0 };
    const toward = (dirCode * 22.5 + 180) % 360;
    let rel = ((toward - info.bearing + 540) % 360) - 180;
    if (info.hand === "right") rel = -rel;
    const diff = Math.abs(rel);
    if (diff <= 45) return { label: "追い風", cls: "tail", rel };
    if (diff >= 135) return { label: "向かい風", cls: "head", rel };
    return { label: rel < 0 ? "スタンド側からの横風" : "内馬場側からの横風", cls: "cross", rel };
  }

  function jstTodayYmd() {
    const d = new Date(Date.now() + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  /** 当日開催の表示中だけ取りに行く（過去日の表示に「現在の風」を出さない） */
  function windApplies(data) {
    return !!data && !isDayClosedSnapshot(data) && String(data.schedule_date || "") === jstTodayYmd();
  }

  async function loadWind(data, { force = false, onLoaded = null } = {}) {
    if (!windApplies(data)) {
      windState.byPlace = {};
      return;
    }
    if (windState.loading) return;
    // 最終レースが終わった後は、そのレース時点の風で止めて取りに行かない
    if (windState.frozenDay === String(data.schedule_date || "") && Object.keys(windState.byPlace).length) return;
    if (!force && Date.now() - windState.loadedAt < WIND_REFRESH_MS) return;
    const places = (Array.isArray(data.venues) ? data.venues : [])
      .map((v) => String((v && v.place) || "").trim())
      .filter((p) => WIND_STRETCH[p]);
    if (!places.length) return;
    windState.loading = true;
    try {
      const base = "https://www.jma.go.jp/bosai/amedas/data";
      const latest = String(await (await fetch(`${base}/latest_time.txt`, { cache: "no-store" })).text()).trim();
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(latest);
      if (!m) return;
      const latestKey = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}00`;
      const freezeKey = windFreezeKey(data);
      const frozen = !!freezeKey && latestKey >= freezeKey;
      // 止めるときは最終レース時点を含む3時間ブロックを読む（最新のブロックだと後の観測しか無い）
      const k = frozen ? freezeKey : latestKey;
      const block = `${k.slice(0, 8)}_${String(Math.floor(Number(k.slice(8, 10)) / 3) * 3).padStart(2, "0")}`;
      const next = {};
      await Promise.all(
        places.map(async (place) => {
          const info = WIND_STRETCH[place];
          try {
            const res = await fetch(`${base}/point/${info.station}/${block}.json`, { cache: "no-store" });
            if (!res.ok) return;
            const series = await res.json();
            const keys = Object.keys(series || {}).sort();
            for (let i = keys.length - 1; i >= 0; i--) {
              if (frozen && keys[i] > freezeKey) continue;
              const row = series[keys[i]] || {};
              const dir = Array.isArray(row.windDirection) ? row.windDirection[0] : null;
              const spd = Array.isArray(row.wind) ? row.wind[0] : null;
              if (typeof spd !== "number" || typeof dir !== "number") continue;
              next[place] = { dir, speed: spd, at: `${keys[i].slice(8, 10)}:${keys[i].slice(10, 12)}` };
              break;
            }
          } catch (e) {
            /* 1場の失敗で他の場を落とさない */
          }
        })
      );
      windState.byPlace = next;
      windState.loadedAt = Date.now();
      windState.frozenDay = frozen && Object.keys(next).length ? String(data.schedule_date || "") : "";
    } catch (e) {
      /* 気象庁に届かないときは風の行を出さないだけ */
    } finally {
      windState.loading = false;
    }
    if (typeof onLoaded === "function") onLoaded(data);
  }

  /** 小さな図: テレビ中継と同じくスタンド側から見た向き。上の横線が内ラチ（奥）、
      馬は右回りなら右→左、左回りなら左→右へ走る。矢印は風が吹いていく向き。
      rel（馬が上へ走り内ラチが左の図での角度）を、右回りは鏡映して -90-rel、左回りは 90+rel に移す */
  function trackWindHtml(place) {
    const info = WIND_STRETCH[place];
    const w = windState.byPlace[place];
    if (!info || !w) return "";
    const rel = windRelation(w.dir, w.speed, info);
    // 風速は常に小数1桁（4 → 4.0）
    const speedText = Number(w.speed).toFixed(1);
    const dirName = WIND_DIR16[w.dir] || "静穏";
    // 例: 「向かい風 3.5m/s（府中 北西 11:40）」
    const title =
      `${rel.label}${rel.cls === "calm" ? "" : ` ${speedText}m/s`}（${info.stationName} ${dirName} ${w.at}）`;
    const screenDeg = info.hand === "right" ? -90 - rel.rel : 90 + rel.rel;
    const arrow =
      rel.cls === "calm"
        ? '<circle cx="8" cy="9.5" r="1.6" fill="currentColor"/>'
        : `<g transform="rotate(${screenDeg.toFixed(0)} 8 9.5)"><path d="M8 14.5V4.5M4.8 7.6 8 4.4l3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    return (
      `<span class="track-cond-wind track-cond-wind--${rel.cls}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">` +
      `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1.5h14" stroke="currentColor" stroke-width="1.2" opacity="0.45"/>${arrow}</svg>` +
      `<span class="track-cond-wind-speed">${rel.cls === "calm" ? "0.0" : escapeHtml(speedText)}</span></span>`
    );
  }

  function renderTrackConditions(data) {
    const box = byId("trackCond");
    const list = byId("trackCondList");
    if (!box || !list) return;
    const vs = (data && Array.isArray(data.venues) ? data.venues : []).filter(
      (v) => v && Array.isArray(v.races) && v.races.length
    );
    if (isDayClosedSnapshot(data) || !vs.length) {
      box.hidden = true;
      list.innerHTML = "";
      return;
    }
    const items = [];
    for (const v of vs) {
      const races = v.races.filter((r) => r && typeof r === "object");
      const place = String(v.place || (races[0] && races[0].place) || "").trim();
      if (!place) continue;
      const weather = trackLatestValue(races, (r) => r.weather);
      // 障害は芝・ダートのどちらの馬場を指すか一意でないので、面別集計からは外す
      const onSurface = (name) => races.filter((r) => String(r.course || "").trim() === name);
      const cells = [
        ["芝", trackLatestValue(onSurface("芝"), (r) => r.baba)],
        ["ダ", trackLatestValue(onSurface("ダート"), (r) => r.baba)],
      ]
        .map(
          ([label, baba]) =>
            '<span class="track-cond-surface"><span class="track-cond-surface-label">' +
            escapeHtml(label) +
            '</span><span class="' +
            trackBabaClass(baba) +
            '">' +
            escapeHtml(baba || "—") +
            "</span></span>"
        )
        .join("");
      items.push(
        '<li class="track-cond-item"><span class="track-cond-place">' +
          escapeHtml(place) +
          "</span>" +
          trackWeatherHtml(weather) +
          cells +
          trackWindHtml(place) +
          "</li>"
      );
    }
    list.innerHTML = items.join("");
    box.hidden = !items.length;
    // 風の観測時刻は場ごとでなく見出しに1回だけ（全場が同じアメダスの時刻）
    const windAt = byId("trackCondWindAt");
    if (windAt) {
      const at = Object.values(windState.byPlace).map((w) => w.at).sort().pop() || "";
      windAt.textContent = at ? `風${at}` : "";
      windAt.hidden = !at;
    }
  }

  /** 閉じた状態の見出しに添える要約（場ごとに 天候アイコン＋芝/ダの馬場）。風は入れない */
  function summaryHtml(data) {
    const vs = (data && Array.isArray(data.venues) ? data.venues : []).filter(
      (v) => v && Array.isArray(v.races) && v.races.length
    );
    if (isDayClosedSnapshot(data) || !vs.length) return "";
    const items = [];
    for (const v of vs) {
      const races = v.races.filter((r) => r && typeof r === "object");
      const place = String(v.place || (races[0] && races[0].place) || "").trim();
      if (!place) continue;
      const onSurface = (name) => races.filter((r) => String(r.course || "").trim() === name);
      const babas = [
        ["芝", trackLatestValue(onSurface("芝"), (r) => r.baba)],
        ["ダ", trackLatestValue(onSurface("ダート"), (r) => r.baba)],
      ]
        .filter(([, baba]) => baba)
        .map(([label, baba]) => escapeHtml(label) + '<span class="' + trackBabaClass(baba) + '">' + escapeHtml(baba) + "</span>")
        .join("");
      items.push(
        '<span class="track-cond-sum-item"><span class="track-cond-place">' +
          escapeHtml(place) +
          "</span>" +
          trackWeatherHtml(trackLatestValue(races, (r) => r.weather)) +
          babas +
          "</span>"
      );
    }
    return items.join("");
  }

  function clearWind() {
    windState.byPlace = {};
    windState.loadedAt = 0;
  }

  window.TrackCond = {
    render: renderTrackConditions,
    loadWind,
    clearWind,
    summaryHtml,
    windApplies,
    jstTodayYmd,
    WIND_REFRESH_MS,
  };
})();
