#!/usr/bin/env python3
"""Markdown wiki builder (stdlib only).

pages/**/*.md  ->  wiki_data.js  (index.html 이 이 파일을 읽어서 렌더링)

사용법:  python3 build.py          # 빌드 + 링크 점검
        python3 build.py --check  # 빌드 없이 점검만
"""
import json, re, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAGES = ROOT / "pages"
OUT = ROOT / "wiki_data.js"
CONFIG = json.loads((ROOT / "wiki_config.json").read_text(encoding="utf-8"))
SITE_NAME = CONFIG.get("name", "위키")
ROOT_TITLE = CONFIG.get("root", "대문")
LINK_RE = re.compile(r"\[\[([^\]|#\\]*)(?:#[^\]|\\]*)?(?:\\?\|[^\]]*)?\]\]")


def parse_front_matter(text):
    meta = {}
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            block = text[3:end].strip("\n")
            body = text[end + 4:].lstrip("\n")
            for line in block.splitlines():
                if not line.strip() or ":" not in line:
                    continue
                k, v = line.split(":", 1)
                k, v = k.strip(), v.strip()
                if v.startswith("[") and v.endswith("]"):
                    v = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
                else:
                    v = v.strip("'\"")
                meta[k] = v
            return meta, body
    return meta, text


def strip_code(body):
    body = re.sub(r"```.*?```", "", body, flags=re.S)
    return re.sub(r"`[^`\n]*`", "", body)


def main():
    check_only = "--check" in sys.argv
    pages, seen = [], {}
    for path in sorted(PAGES.rglob("*.md")):
        if path.name.startswith("_"):
            continue  # 템플릿 등
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        title = meta.get("title") or path.stem
        aliases = meta.get("aliases") or []
        if isinstance(aliases, str):
            aliases = [aliases]
        page = {
            "title": title,
            "aliases": aliases,
            "category": meta.get("category", "미분류"),
            "parent": meta.get("parent", ""),
            "summary": meta.get("summary", ""),
            "status": meta.get("status", ""),
            "updated": meta.get("updated", ""),
            "file": str(path.relative_to(ROOT)),
            "body": body,
            "links": sorted({m.group(1).strip() for m in LINK_RE.finditer(strip_code(body)) if m.group(1).strip()}),
        }
        for key in [title] + aliases:
            k = key.lower()
            if k in seen and seen[k] != page["file"]:
                print(f"[경고] 제목/별칭 중복: '{key}' ({seen[k]} / {page['file']})")
            seen[k] = page["file"]
        pages.append(page)

    # 링크 점검
    names = {k for p in pages for k in [p["title"].lower()] + [a.lower() for a in p["aliases"]]}
    red, inbound = {}, {p["title"]: 0 for p in pages}
    resolve = {}
    for p in pages:
        for k in [p["title"]] + p["aliases"]:
            resolve[k.lower()] = p["title"]
    for p in pages:
        for l in p["links"]:
            if l.lower() not in names:
                red.setdefault(l, []).append(p["title"])
            else:
                t = resolve[l.lower()]
                if t != p["title"]:
                    inbound[t] += 1
        if p["parent"] and p["parent"].lower() not in names:
            print(f"[경고] '{p['title']}'의 parent '{p['parent']}' 문서가 없음")

    if ROOT_TITLE.lower() not in names:
        print(f"[경고] 대문 문서 '{ROOT_TITLE}'가 없음 (wiki_config.json의 root 확인)")

    print(f"문서 {len(pages)}개")
    if red:
        print(f"빨간 링크(아직 없는 문서) {len(red)}개:")
        for k, v in sorted(red.items()):
            print(f"  - {k}  ← {', '.join(v)}")
    orphans = [t for t, n in inbound.items() if n == 0 and t != resolve.get(ROOT_TITLE.lower(), ROOT_TITLE)]
    if orphans:
        print(f"고아 문서(들어오는 링크 없음): {', '.join(orphans)}")

    if check_only:
        return
    data = {
        "built": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "name": SITE_NAME,
        "root": resolve.get(ROOT_TITLE.lower(), ROOT_TITLE),
        "pages": pages,
    }
    OUT.write_text("window.WIKI = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"→ {OUT.name} 작성 완료")


if __name__ == "__main__":
    main()
