# NULL styles

`null.css`가 아래 파일을 번호 순서대로 불러온다. 번호는 CSS cascade 순서이므로
파일 이름이나 import 순서를 바꾸지 않는다.

- `00-shell.css` — 바탕, 공용 창틀, 메뉴, 다이얼로그
- `10-gift.css` — gift, bag, 장소 선택, 선물 메모
- `20-story.css` — 오프닝 장면, 일기, 등록 진입
- `30-messenger.css` — rooms, map, cam, hidden, 채팅, 프로필
- `40-opening-profile.css` — 오프닝·등록·세계 확정 전용 프레임
- `50-chat-scenes.css` — 채팅 입력줄, 진행도, 키스타임
- `90-refinements.css` — 여러 화면에 함께 적용되는 최신 공용 보정

새 수정은 가능하면 해당 기능 파일의 기존 선택자에 합친다. 같은 선택자를 파일
맨 아래에 다시 추가하지 않는다. 여러 기능을 동시에 고치는 공용 규칙만
`90-refinements.css`에 둔다.

모듈 안의 이미지 경로는 `styles/` 기준이므로 루트 에셋을 `../`로 가리킨다.
배포할 때는 `index.html`과 `null.css`의 캐시 판 번호를 함께 올린다.
