# 프로젝트 위키

- 보기: `index.html` 더블클릭 (인터넷 불필요)
- 원본: `pages/**/*.md` (Obsidian으로 열어도 `[[링크]]` 동작)
- 문서 추가/수정 후: `python3 build.py` → 브라우저 새로고침
- 새 문서 틀: `pages/_template.md`
- 위키 이름·대문 문서: `wiki_config.json`
- 자세한 사용법: 위키의 "위키 사용법" 문서

## 처음 설정
1. `wiki_config.json`의 `name`을 프로젝트 이름으로 바꾼다. `root`는 대문 문서의 title이다(기본 `대문`).
2. `pages/00_대문/대문.md`의 [대괄호] 부분을 채운다.
3. 예시 문서(`예시 개념`, `예시 실험`, `Q: 예시 개념이 왜 필요한가`)는 실제 문서를 쓴 뒤 지운다. 지울 때 다른 문서의 링크도 같이 고친다.
4. `python3 build.py`를 실행해 경고가 없는지 확인한다.

## 들어 있는 것
- `build.py` — 표준 라이브러리만 쓰는 빌더. 제목·별칭 중복, parent 없음, 빨간 링크, 고아 문서를 점검한다.
- `index.html`, `wiki.js`, `wiki.css` — 뷰어 (미리보기, 탐색 경로, 검색, 역링크, 다크 모드)
- `vendor/` — marked 12.0.2, KaTeX 0.16.11 (각 라이선스 파일 포함)
- `claude/` — Claude 프로젝트에 올릴 규칙 문서와 pending 폴더
