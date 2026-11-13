# エラー案内（画像と閲覧サイト共通）

2026-11-14 採用。**正はサーバーの `~/keiba-mystery-viewer/error-pages/`**（閲覧サイトのリポジトリ）。
PC の `Documents\error-images\` は作業用の写しなので、直したらサーバーへ戻すこと。

- `errors.json` … エラーごとの文字。**文言を変えるときはここだけ**直す
  - 閲覧サイト（`error_card.js`）が実行時にこれを読んで案内を出す
  - 画像（`out/*.png`）もこれから作る
- `template.html` … 画像の共通の土台（形・色・鍵のマーク）
- `build.py` … `python build.py` で `out/` の画像を作り直す（Chrome が要るので PC で実行）
- `out/` … 画像と差し替え後の HTML。独自ドメイン導入時に Cloudflare のエラー画面の素材にする

閲覧サイトでの使い分け（`error_card.js` の pickId）:
404→404_not_found / 429→429_too_many / 403→403_generic / 401・402・503→503_paused / それ以外と通信エラー→502_network。
403_block_6h・403_block_7d は Cloudflare 側（独自ドメイン導入後）で使う。
別サイトからの読み込みでブロックされたときは、ブラウザの決まりで番号が読めないので閲覧サイトでは 502_network になる。
