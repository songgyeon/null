# 이재언 재생성 프롬프트 33장

방향과 이유는 `art-direction.md`에 있다. 여기는 뽑을 때 복사할 것만 둔다.

쓰는 법: **BASE를 매번 앞에 붙이고**, 그 뒤에 그 장의 SCENE 한 덩이를 잇는다.
네거티브는 33장 전부 같은 것을 쓴다.

안 쓰는 여섯 장(`bg` `hall` `library` `museum` `night` `stairs`)은 여기에 없다.

---

## BASE — 매번 앞에 붙인다

```
Korean man, 29, school nurse. Clean-cut and handsome. Smooth full
mid-face, no nasolabial folds, no hollow cheeks, no forehead lines.
Firm but light jawline, softly rounded chin. Calm level eyes,
single-fold lids, only the faintest shadow beneath. Straight dark
brows. Black hair, soft-textured, swept back neatly.

PALE — fair, cool-toned, bloodless but clean and well-kept, faint
porcelain sheen. Lips keep a trace of natural colour. Hands
smooth-backed, no raised veins or tendons.

CLOTHING — achromatic. Pressed shirt under a fine-knit sweater,
immaculately ironed, collar crisp and flat.

STYLE — soft painterly semi-realistic Korean illustration. Smooth
gradient shading, minimal facial shadow modeling, softly painted
edges, muted cool winter palette. Illustrative, not photographic.
Soft diffused light, low contrast, gentle falloff, no hard side-key.
```

## NEGATIVE — 33장 공통

```
photorealistic skin texture, visible pores, nasolabial folds, laugh
lines, forehead wrinkles, crow's feet, hollow cheeks, sunken cheeks,
gaunt, heavy jaw, jowls, stubble, five o'clock shadow, deep dark
circles, harsh side lighting, dramatic chiaroscuro, high contrast
shadows, matte dry skin, veiny hands, prominent tendons, middle-aged,
40s, weathered, tired old man, sallow skin, grey complexion, jaundiced,
sickly, ashen, colourless lips, heavy dark circles, ill, gothic vampire
```

---

# ① 프로필 사진 — 1장

여기서 화풍을 확정한다. 이 한 장이 방 목록 아바타와 프로필 화면에 같이 쓰인다.

### `jaeeon-profile`
```
SCENE — upper-body portrait, three-quarter view, eyes lowered slightly
away from camera. Charcoal crewneck over a pale grey shirt. Cool winter
daylight through a window behind him, a warm lamp far off to one side.
Square 1:1, head and shoulders, headroom above the hair.
```

---

# ② 프로필 배경 — 5장

관계가 깊어질수록 이 순서로 바뀐다. 밝은 데서 어두운 데로 간다.
전부 **세로 3:4**, 인물은 화면을 채우지 않고 자리 안에 서 있다.

### `jaeeon-gallery` — 1단계
```
SCENE — inside a quiet art museum, standing at a distance before a large
canvas, seen from behind and slightly to the side. High diffuse hall
light, pale walls, polished floor. He is small in the frame. Vertical 3:4.
```

### `jaeeon-landing` — 2단계
```
SCENE — apartment stairwell landing in the evening, leaning against the
handrail, one hand in a pocket. Cool light from a frosted window, warm
bulb above. Concrete and painted steel. Vertical 3:4.
```

### `jaeeon-lobby` — 3단계
```
SCENE — building lobby at night, standing and waiting, glass walls with
faint reflections, floor lit from overhead. Empty, quiet, no other
people. Vertical 3:4.
```

### `jaeeon-drive` — 4단계
```
SCENE — inside a parked car at night, rain beading on the glass,
dashboard glow on his face from below, streetlights blurred outside.
Seen from the passenger side. Vertical 3:4.
```

### `jaeeon-kitchen` — 5단계 · 마지막
```
SCENE — home kitchen late at night, standing at the sink. On the rack
beside him, two washed bowls turned upside down to dry. Warm low kitchen
light, dark window. He is not doing anything dramatic. Vertical 3:4.
```

> 마지막 장의 그릇 두 개가 이 사람의 결말이다. 1인분을 계량하던 사람한테
> 2인분이 손에 붙었다는 게 그 사진이니, 그릇 둘이 반드시 보여야 한다.

---

# ③ 보내는 사진 — 22장

대화 중에 인물이 골라 보내는 사진이다. **폰으로 찍은 느낌, 정사각 1:1**로
통일한다. `[셀카]`는 자기가 찍은 것이고 나머지는 눈앞의 것을 찍은 것이다.

### `jaeeon-cook` [셀카]
```
SCENE — home kitchen, a set table with rice and soup laid for two, two
bowls. Taken by himself, phone raised, he is half in frame. Warm evening
kitchen light. Square 1:1.
```

### `jaeeon-care` [셀카]
```
SCENE — holding a strip of medicine, a bottle of water and a folded
blanket gathered in his arms. Taken by himself. Nurse's room, daylight.
Square 1:1.
```

### `jaeeon-treat` [셀카]
```
SCENE — pouring antiseptic onto a folded gauze pad, close on the hands,
his face partly in frame. Taken by himself. Nurse's room. Square 1:1.
```

### `jaeeon-market` [셀카]
```
SCENE — grocery aisle, a basket in hand holding food enough for two.
Taken by himself under flat supermarket light. Square 1:1.
```

### `jaeeon-driveseat`
```
SCENE — parked car at dusk, seen from the driver's seat, a paper cup in
one hand resting on the wheel. He has not gone home yet. Square 1:1.
```

### `jaeeon-corridor`
```
SCENE — school corridor, holding a stack of documents, dark outside the
windows. Fluorescent ceiling light, empty hallway. Square 1:1.
```

### `jaeeon-sink`
```
SCENE — nurse's room sink, washing his hands and rolling a sleeve up the
forearm. Close, hands and forearms in focus. Square 1:1.
```

### `jaeeon-work`
```
SCENE — nurse's office desk, working. A glass candy jar on the desk,
filled. Daylight through blinds. Square 1:1.
```

### `jaeeon-evening`
```
SCENE — at home after work, sitting, the day finished. Low warm lamp,
dark window. Quiet. Square 1:1.
```

### `jaeeon-laundry`
```
SCENE — folding laundry at home, everything squared and stacked. His
tidiness is the subject. Daylight. Square 1:1.
```

### `jaeeon-car`
```
SCENE — inside the car, driving, one hand on the wheel, city at dusk
through the windshield. An old playlist is on. Square 1:1.
```

### `jaeeon-classroom`
```
SCENE — a classroom during the school day, standing near the desks,
winter light through tall windows. Square 1:1.
```

### `jaeeon-rooftop`
```
SCENE — school rooftop, alone, wind in his hair, hands in pockets. He is
not smoking and there is no cigarette anywhere. Overcast winter sky.
Square 1:1.
```

### `jaeeon-shelf`
```
SCENE — library stacks, pulling a book from a shelf. Seen from behind,
his face is not visible at all. The book is a plain paperback of
Camus's "The Stranger". Square 1:1.
```

### `jaeeon-bandage`
```
SCENE — winding a bandage around a student's forearm. Close on both
pairs of hands, the student only partly in frame. Nurse's room. His face
is calm and half-lowered. Square 1:1.
```

### `jaeeon-cabinet`
```
SCENE — restocking a medicine cabinet, boxes lined up square on the
shelf, one in his hand. Nurse's room. Square 1:1.
```

### `jaeeon-bottle`
```
SCENE — nurse's room at sunset, holding a medicine bottle up to check
its label. Orange low light across the room, not across his face.
Square 1:1.
```

### `jaeeon-chart`
```
SCENE — night, only a desk lamp on, writing in the health log. The room
dark around the pool of lamplight. Square 1:1.
```

### `jaeeon-door`
```
SCENE — the corridor just outside the nurse's room door, leafing through
documents while walking. Daylight. Square 1:1.
```

### `jaeeon-mug`
```
SCENE — nurse's office desk in the morning, holding a plain grey ceramic
mug in one hand, reading documents in the other. Morning light. The mug
is ordinary and unremarked. Square 1:1.
```

### `jaeeon-back`
```
SCENE — at home, turned away toward the window. His face is not visible.
On the table beside him a mug has gone cold. Grey daylight. Square 1:1.
```

### `jaeeon-curtain`
```
SCENE — at home, standing beside the curtain in profile, doing nothing
in particular, one hand near the fabric. Soft window light. Square 1:1.
```

---

# ④ 히든 — 5장

대화가 쌓이면 열리는 것들이다. **앞의 넷은 사람이 안 나온다** — BASE의 얼굴
항목은 빼고 STYLE 덩이만 붙인다. 마지막 졸업사진만 얼굴이 나오는데, 거기서는
스물아홉이 아니다.

### `jaeeon-bag` — 12회에 열림
```
SCENE — still life, no person. The contents of a man's shoulder bag laid
out in a neat row on a flat surface: a folded schedule, a pen, a blister
strip of painkillers, keys, a plain handkerchief pressed square.
Everything aligned. Top-down, soft even light. Square 1:1.
```

### `jaeeon-room` — 26회
```
SCENE — an empty bedroom, no person. Bed made tight, nothing on the
floor, one shelf of books, a single chair. Almost nothing personal on
display. Cold morning light. Square 1:1.
```

### `jaeeon-playlist` — 44회
```
SCENE — still life, no person. An old music player screen, or a
handwritten track list on worn paper. The same short list for years,
edges softened by handling. Close, soft light. Square 1:1.
```

### `jaeeon-ticket` — 64회
```
SCENE — still life, no person. A single kept ticket stub on a dark
surface, paper faded and creased once down the middle, print half worn
away. Close, soft light. Square 1:1.
```

### `jaeeon-yearbook` — 90회 · **여기만 나이가 다르다**
```
SCENE — a page of an old school yearbook photographed close, showing one
formal graduation portrait of the same man at nineteen — younger, softer
jaw, same pale skin and same cool level eyes, hair neater, expression
blank. Slight print grain and a faint paper sheen. Square 1:1.
```

> 졸업사진에는 열아홉의 얼굴이 들어간다. BASE의 「29」를 「19」로 바꾸고
> 나머지 얼굴 항목은 그대로 둔다 — 같은 사람으로 읽혀야 한다.

---

## 다 뽑고 나서

파일명을 그대로 두고 그림만 바꾸면 화면이 안 바뀐다. 둘 다 잊기 쉽다.

1. `app-data.js`의 `AV_V`를 올린다 (지금 `"?v=4"`). 안 올리면 브라우저와
   CDN이 옛 그림을 계속 쓴다.
2. `app-data.js`의 `CHARS.jaeeon`에 있는 `zoom`·`pos`를 다시 잡는다
   (지금 `150%` / `50% 22%`). 얼굴 위치가 달라지면 42px 동그라미에서
   머리가 잘리거나 턱만 보인다.
