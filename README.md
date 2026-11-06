# 위키 + Claude 작업 방식 공유 패키지

| 폴더 | 내용 | 받는 사람이 하는 일 |
|---|---|---|
| `wiki-template/` | 바로 열리는 위키(빌더, 뷰어, 예시 문서, 규칙 문서) | git 저장소로 만들어 자기 프로젝트 위키로 쓴다 |
| `wiki-pending-apply/` | Claude 스킬 | zip으로 묶어 Claude 설정 → Skills에 업로드한다 |

## 작동 방식
1. 질문 끝에 "위키!"를 붙인다(예: "1+1은 왜 2야? 위키!"). Claude가 답한 뒤, `claude/wiki_conventions.md` 규칙대로 질문 문서와 필요한 개념 문서를 만들고 질문 기록에 행을 추가한다.
2. 위키가 있는 컴퓨터가 연결돼 있으면 `pages/`에 바로 넣고 `build.py`로 빌드해 경고 0을 확인한다.
3. 연결이 없으면 `claude/wiki_pending/`에 저장해 둔다. 나중에 컴퓨터를 연결한 세션에서 "위키!"나 "반영"이라고 하면 쌓인 문서가 들어간다.
4. commit·push는 사람이 직접 한다.

## 설정 순서
1. `wiki-template/`을 복사해 새 git 저장소를 만든다. `index.html`을 더블클릭해 열리는지 본다.
2. `wiki_config.json`의 `name`을 바꾸고 `대문.md`를 채운 뒤 `python3 build.py`. (자세히는 `wiki-template/README.md`)
3. Claude에서 새 프로젝트를 만들고 `wiki-template/claude/wiki_conventions.md`를 프로젝트 파일 `claude/wiki_conventions.md`로 올린다. "프로젝트 정보"와 "위키 경로"를 채운다.
4. 프로젝트 지침(Instructions)에 한 줄 넣는다: "위키 문서를 쓰거나 고치기 전에 `claude/wiki_conventions.md`를 읽고 따른다."
5. `wiki-pending-apply/` 폴더를 zip으로 묶어 Claude 설정 → Skills에서 업로드한다.
6. 위키 폴더가 있는 컴퓨터를 Claude에 연결해 둔다. 반영 단계는 이 연결이 있어야 동작한다.
