# NULL web scripts

`index.html`이 파일 이름의 번호 순서대로 스크립트를 불러온다. 이 프로젝트는
번들러 없이 브라우저 전역 선언을 공유하므로 로드 순서를 바꾸지 않는다.

- `data/00-runtime.js` — 화면 높이, API, 인물, 세계 시계
- `data/10-memory.js` — 일기, 플래시백, 첫 만남, 이름 진행도
- `data/20-content.js` — 방, 히든, 선물, 기본 저장소
- `data/30-world.js` — 시간 문구, 접속 상태, 오프닝, 관전 조건
- `data/40-places.js` — 지도, 캐비닛, 가방, 시간표, 이동과 장면
- `data/50-story-state.js` — 편집, 효과, 큐, 이야기 장부, 사진첩
- `ui/00-profile.js` — 공용 아이콘, 아바타, 캐릭터 프로필
- `ui/10-opening.js` — 스플래시, 등록, 세계 확정, 인트로
- `ui/20-story-overlays.js` — 사진, 일기, 플래시백, 키스타임
- `ui/30-messenger.js` — 시간표, 가방, 검색, 선물, 방 목록
- `ui/40-chat.js` — 남은 날, 개발 시계, 채팅방
- `game.js` — 게임 상태, 요청, 효과 적용과 화면 orchestration
- `../app.js` — QA 진입점과 최종 React 마운트

기능을 추가할 때는 가장 가까운 책임의 파일에 넣고, 다른 파일의 선언이 필요하면
그 선언보다 뒤에서 로드되는 파일에 둔다. 캐시 번호는 `index.html`과
`null.css`에서 함께 올린다.
