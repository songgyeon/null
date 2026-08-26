# NULL BLANKWARE UI asset pack

`NULL`을 **아직 비어 있지만 관계와 색으로 채워질 자리**로 해석한 UI용 PNG 묶음이다. 화면 텍스트·이름·숫자는 이미지에 굽지 않았으며 기존 DOM이 에셋 위에 올라가야 한다.

## Visual rule

- 밝고 몽환적인 Korean Y2K retro-computer stationery
- 밀키 화이트, 블러시 핑크, 아이스 블루, 소프트 라일락, 오팔광
- 외곽은 딥 그레이프의 얇고 단단한 픽셀 계단선
- 빈 부분은 흰색/투명, 채워지는 부분만 핑크·블루·오팔
- 큰 네이비 면, 보라 안개, 범용 glassmorphism, 포토리얼 플라스틱은 사용하지 않는다.

## Opening: 반드시 네 창을 따로 배치

| Asset | Existing target | Overlay that stays as HTML |
|---|---|---|
| `opening/boot-main-window.png` | `.spcard` | `.splogo`, `.spinput`, `.spgo` |
| `opening/boot-error-dialog-lilac.png` | `.spwin.w1` | `.sptb`, `.spbd`, `.spbtn` text |
| `opening/boot-system-error-dialog-pink.png` | `.spcurwrap.w2 > .spwin` | `.sptb`, `.spbd`, `.spbtn` text |
| `opening/boot-loading-window.png` | `.spwin.w3` | `.sptb`, `.spbar > i` |
| `opening/opal-cd-missing-sector.png` | `.spcd` | none |

`boot-main-window.png`가 첫 화면의 주인공이다. 상단의 넓은 빈 칸은 `NULL_`, 가운데 긴 슬롯은 “안녕, 널 입력해줘”, 하단 판은 `Click!`을 HTML로 얹기 위한 자리다. PNG 안에는 글자가 없다.

오프닝 레이어 권장 순서는 배경 → bubble/sparkle → CD → 보조창 → 메인창 → cursor다. 창 이미지의 원형 컨트롤은 장식층이며 실제 클릭 타깃과 충돌시키지 않는다.

## Name fill meter: 요청 수정사항

`core/meter-name-fill-long.png`는 기존보다 훨씬 긴 연속형 바다.

- 적용 대상: `.nmcard`
- 기존 글자별 보라색 네모 `.nmbx`는 시각적으로 숨긴다.
- 기존 점선 `.nmcard::before`는 제거한다.
- 이름 글자는 HTML로 유지한다.
- 바의 진행 정도만 wrapper의 `width`, `overflow: hidden`, 또는 `clip-path`로 제어한다.
- PNG 자체에는 네모 셀·포도색 블록·점선·도트가 없다.

`core/meter-name-fill-long.png`, `opening/boot-*.png` 네 장, `gift/*.png` 두 장은 배경 제거 전 RGB 판본이다. 사용자가 후처리하기로 한 자산이므로 실제 합성 전 흰/체커 배경을 제거한다. 배경 두 장은 원래부터 불투명이다.

## Gift / wrap reason screen

| Asset | Existing target | Overlay that stays as HTML |
|---|---|---|
| `gift/gift-wrap-panel-frame.png` | gift/wrap 최상위 세로 패널 | 제목, 아이템, 받는 사람, 장소, 버튼 전체 |
| `gift/gift-reason-note-card.png` | `A NOTE` 아래 이유 입력 행 | 문장 앞·뒤 조각과 실제 input |

`gift-wrap-panel-frame.png`는 중앙을 거의 비운 포장지형 셸이다. 왼쪽의 얇은 리본과 한 개의 매듭만 남기고, 아이템·인물·장소 카드가 올라갈 영역은 장식하지 않았다.

`gift-reason-note-card.png`의 가운데 선큰 슬롯에 실제 입력창을 겹치고, 슬롯 좌우의 빈 여백에 “이걸 받고”와 “면 좋겠어!” 같은 동적 문장 조각을 올린다. 입력 자체를 PNG에 굽지 않는다. 기존 흰 사각 입력 박스와 외곽 shadow를 함께 남기면 이중 테두리가 생기므로 끈다.

## Shared assets

| Asset | Suggested use |
|---|---|
| `background/bg-null-dream-desktop.png` | `.app-bg`, desktop `.screen.splash` |
| `background/bg-null-dream-mobile.png` | mobile media query background |
| `core/window-frame-main.png` | messenger / bag / gift의 대표 외곽 chrome |
| `core/button-primary-cta.png` | `Click`, `YES`, `WRAP` 등 주 CTA의 무문자 표면 |
| `stickers/sticker-heart-null-fill.png` | 넓은 빈 영역의 fill-state 장식 |
| `stickers/sticker-sparkle-4point.png` | `.spark` 대체 또는 모서리 장식 |
| `stickers/sticker-bubble-opal.png` | `.bub` 대체; 밝은 배경에서만 사용 |
| `stickers/decal-null-cursor.png` | 잠금/빈 상태의 `□ _` decal 또는 포인터 장식 |
| `icons/icon-rooms.png` | rooms tab/menu |
| `icons/icon-map.png` | map tab/menu |
| `icons/icon-cam.png` | cam tab/menu |
| `icons/icon-hidden.png` | hidden tab/menu |
| `icons/icon-bag.png` | bag action/menu |
| `icons/icon-gift.png` | gift action/menu |

## Composition rules for Claude

1. PNG를 통째로 스크린샷처럼 덮지 말고 프레임/표면 레이어로 쓴다.
2. 모든 이름, 문장, 버튼 라벨, 진행률, 시간은 기존 HTML을 유지한다.
3. 크기가 변하는 창은 가능하면 `border-image`/9-slice 또는 pseudo-element 장식층으로 사용한다.
4. 사진·인물·장소·선물은 기존 `jaeeon-*`, `minhyun-*`, `place-*`, `hidden-*`, `gicon-*`, `item-*`, `cab-icons/*`를 그대로 둔다.
5. 하트와 CD는 64px 이상 장식용이다. 작은 기능 아이콘으로 축소하지 않는다.

파일 크기·알파 여부와 전체 목록은 `manifest.json`에 있다.
