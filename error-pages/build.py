"""errors.json の各エラーを template.html に流し込み、out/<id>.png（と .html）を作る。

使い方:  python build.py            全部作る
         python build.py 403_block_6h   指定したものだけ
形・色は template.html、文字は errors.json だけを直す。画像化は Chrome のヘッドレス撮影。
"""
from __future__ import annotations

import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
CHROME_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]


def render(tpl: str, e: dict) -> str:
    code = html.escape(str(e["code"]))
    # 真ん中の数字だけ色を変える（403 の 0 など）。3桁以外はそのまま
    code_html = f"{code[0]}<span>{code[1]}</span>{code[2:]}" if len(code) == 3 else code
    boxes = "".join(f'<div class="rule"><b>{html.escape(k)}</b><em>{html.escape(v)}</em></div>'
                    for k, v in (e.get("boxes") or [])[:2])
    vals = {
        "code": code,
        "code_html": code_html,
        "label": html.escape(e.get("label", "")),
        "title": html.escape(e["title"]),
        "message": "<br>".join(html.escape(s) for s in e["message"].split("\n")),
        "boxes": boxes,
        "foot": html.escape(e.get("foot", "")),
    }
    out = tpl
    for k, v in vals.items():
        out = out.replace("{{" + k + "}}", v)
    assert "{{" not in out, f"差し替え漏れ: {e['id']}"
    return out


def shoot(html_path: Path, png_path: Path, profile: Path) -> None:
    chrome = next((c for c in CHROME_CANDIDATES if c.exists()), None)
    if not chrome:
        raise SystemExit("Chrome / Edge が見つからない")
    subprocess.run([str(chrome), "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--window-size=1200,675", f"--user-data-dir={profile}",
                    f"--screenshot={png_path}", html_path.as_uri()],
                   check=True, capture_output=True, timeout=60)


def main() -> None:
    tpl = (HERE / "template.html").read_text(encoding="utf-8")
    errors = json.loads((HERE / "errors.json").read_text(encoding="utf-8"))["errors"]
    want = set(sys.argv[1:])
    ids = [e["id"] for e in errors]
    unknown = want - set(ids)
    if unknown:
        raise SystemExit(f"errors.json に無い: {sorted(unknown)}（あるのは {ids}）")
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as profile:
        for e in errors:
            if want and e["id"] not in want:
                continue
            h = OUT / f"{e['id']}.html"
            h.write_text(render(tpl, e), encoding="utf-8")
            png = OUT / f"{e['id']}.png"
            shoot(h, png, Path(profile))
            print(f"作成: {png}")


if __name__ == "__main__":
    main()
