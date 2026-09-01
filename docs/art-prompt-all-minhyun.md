# 이강현 — 한 번에 던지는 프롬프트

`minhyun-profile.webp`를 레퍼런스로 첨부하고 아래를 통째로 붙여넣는다.
33장을 한 대화 안에서 순서대로 뽑는 용도다. 재언 쪽은
`art-prompt-all.md`에 따로 있다.

## 화풍이 두 갈래인 것을 알고 쓴다

지금 파일을 열어보면 이렇게 갈려 있다. **일부러 갈라져 있는 것이고,
새로 뽑을 때도 그대로 지킨다.**

| | 무엇 | 화풍 |
|---|---|---|
| 인물이 나오는 것 | 프로필 1, 보내는 사진 21, 졸업사진 1 | 페인터리 세미리얼 일러스트 |
| 인물이 없는 것 | 프로필 배경 5, 히든 4 | **사진** — 실사 스냅 |

프로필 배경 다섯 장은 그냥 빈 공간을 찍은 사진이다(레코드샵 창가,
중고반 가게, 빈 버스 좌석, 골목 고양이, 눈 남은 옥상). 여기에
일러스트를 넣으면 지금 있는 것과 완전히 다른 물건이 된다. 히든 넷도
같다 — 가방 플랫레이, 방, 플레이리스트 앱 화면, 영화표.

그래서 아래 프롬프트는 **STYLE LOCK이 두 개**다. 번호마다 어느 쪽을
쓰는지 적어뒀다.

## 이미 받아둔 것 — 5장

정사각으로 있던 것을 세로로 다시 뽑아온 것들이다. 전부 1024×1536(2:3)이고
`docs/new-shots/`에 웹피로 넣어뒀다. **아직 갈아끼우지는 않았다** — 같은
파일명이라 옮기기만 하면 적용된다.

| 파일 | 무엇이 찍혔나 | 목록 번호 |
|---|---|---|
| `minhyun-desk` | 교실 책상에 엎드린 채 이쪽을 본다. 회색 후드, 10월 달력, 뒤에 인체 실루엣 포스터 | 8 |
| `minhyun-profile` | 눈 쌓인 겨울 해질녘 밖. 감색 야상, 넥타이 풀림, 한쪽 이어버드 | 1 |
| `minhyun-bench` | 밤 길가에 앉아 턱을 괴고 있다. 검은 티, 가로등 하나 | 20 |
| `minhyun-roof` | 해질녘 옥상 난간에 팔을 걸치고 있다. 헤드폰은 목에, 이어버드는 귀에. 도시 스카이라인 | (새 자리) |
| `minhyun-library` | 도서관 책상에 엎드려 잔다. 서가와 창, 역광 | 33 |

두 가지가 걸린다.

- **비율.** 보내는 사진은 지금 전부 1:1이고, 프로필 배경만 세로다.
  이 다섯은 2:3이라 말풍선 안에서 세로로 길게 들어간다. 그게 의도면
  그대로 가고, 아니면 정사각으로 잘라야 한다.
- **`minhyun-roof`는 지금 안 쓰이는 파일이다.** 자리를 주려면
  `PHOTOS`에 넣고 `SCENE_SHOT`의 `"옥상"`에 붙여야 한다. 지금 옥상은
  `minhyun-vending` 한 장뿐이라 넣을 자리는 있다.

---

```
첨부한 이미지가 이 인물의 레퍼런스다. 아래 33장을 순서대로 그려라.
인물이 나오는 장은 전부 이 사람, 이 얼굴, 이 화풍이어야 한다.
STYLE LOCK이 A와 B 두 개 있으니 각 번호에 적힌 쪽을 쓴다.
한 번에 한 장씩, 각 장 앞에 파일명을 적어라. 내가 "다음"이라고 하면
다음 번호로 간다.

═══════════════════════════════════════════
CHARACTER LOCK — 인물이 나오는 장 전부 동일
═══════════════════════════════════════════

Korean boy, 20 years old, high-school senior (he lost a year to
rehabilitation after an accident at nineteen, so he is a year older
than his classmates). Same face in every image as the attached
reference.

BUILD — tall and thin. Muscle has not fully come back after a year of
rehab. Long neck, narrow shoulders, thin wrists. When he walks the
right side is fractionally heavier, though he says he is fine.

FACE — young and sharp, reads clearly as around twenty. Straight nose,
full lower lip, defined jaw that is still soft at the chin. Dark brown
eyes, monolid-leaning, level and unguarded. Straight dark brows. A
scattering of faint freckles across the nose and upper cheeks. No
smile by default — but when he does smile he suddenly looks much
younger.

SKIN — the complexion registers before the features do. Dull and
slightly uneven, warm-neutral rather than cool. Visible dark circles
under both eyes, soft-edged, never touched up. He is not pale — he is
unkempt. A person whose circuit for looking after himself has been
switched off a long time.

HAIR — black, thick and shaggy, cut in a messy layered crop that falls
into his eyes and past his ears. Never styled. Slightly wind-pushed.

EARPHONE — one white wireless earbud in the left ear in most images.
Sometimes nothing is playing; it is a sign that says do not talk to me.

CLOTHING — dark navy winter school uniform worn loosely: white shirt
with the collar open, tie pulled down or off, dark knit vest, navy
blazer. Over it a dark navy hooded field jacket. Everything a size too
thin for the season — he dresses too lightly for winter and it shows.

SCAR — he has one from the accident. He neither hides it nor displays
it. If a forearm or shoulder is bare it may simply be there,
unremarked.

CIGARETTES — he has quit. A lighter may appear in his hand, but never
a lit cigarette, never smoke.

═══════════════════════════════════════════
STYLE LOCK A — 인물이 나오는 장
═══════════════════════════════════════════

Soft painterly semi-realistic Korean illustration. Smooth gradient
shading with minimal hard facial shadow modeling, softly painted
edges, no photographic pore texture. Backlit rim light with low
overall contrast — light wraps him rather than carving him. Muted cool
winter palette with one warm source per frame. Shallow depth of field,
grounded everyday Korean settings. Illustrative, not photographic.

═══════════════════════════════════════════
STYLE LOCK B — 인물이 없는 장
═══════════════════════════════════════════

Photograph, not illustration. Handheld phone snapshot, available light
only, slight grain and soft focus falloff. Ordinary, unstyled, a
little untidy — the frame of someone who took it without thinking.
Cold muted colour. NO PERSON anywhere in frame.

═══════════════════════════════════════════
NEGATIVE — 33장 전부
═══════════════════════════════════════════

middle-aged, adult man, mature face, heavy jaw, stubble, muscular,
broad shoulders, harsh side key light, dramatic chiaroscuro, glossy
retouched skin, airbrushed complexion, idol styling, neat combed hair,
bright saturated colour, lit cigarette, smoke, blood, visible wound,
posed model expression, wide grin, cosplay, anime cel shading

═══════════════════════════════════════════
SHOT LIST — 33장
═══════════════════════════════════════════

── A. 프로필 (1장) · STYLE A ──────────────

1. minhyun-profile — 1:1
Upper-body portrait outdoors in winter, three-quarter view, looking
off to the side past the camera. Bare trees and a low sun behind him,
snow on the ground. One earbud in. Head and shoulders with headroom
above the hair.

── B. 프로필 배경 (5장) · STYLE B · 인물 없음 ──
   CHARACTER LOCK은 쓰지 않는다. 다섯 장 다 사람이 한 명도 없다.
   관계가 깊어질수록 이 순서로 바뀐다.

2. minhyun-shop — 3:4 세로 · 사진
A corner of an old record shop, no person. A turntable and a small
speaker on a laminate counter by a window, a few LP sleeves propped
upright, headphones lying beside the deck with the cable trailing off.
Crates of records packed tight in the shelf below. Peeling cream wall
with old tape marks and one small pinned photo. A single warm strip
light above the window; grey rain and a parked car outside.

3. minhyun-lp — 3:4 세로 · 사진
Interior of a narrow second-hand record shop at dusk, no person. Racks
of LPs on both sides, a wall completely papered with sleeves and
flyers, one bare bulb hanging. Two wooden stools by the window, empty.
Dark tiled floor. Blue evening street and bare trees through the glass.

4. minhyun-bus — 3:4 세로 · 사진
Inside a city bus at night in the rain, no person. One empty blue
vinyl seat by the window, grab rail, grey plastic panelling. Rain
beaded thick on the glass, tail lights and a lit apartment tower
smeared beyond.

5. minhyun-cat — 3:4 세로 · 사진
A back alley at night after rain, no person. A black-and-white stray
cat sitting on a wet kerb beside stacked green plastic crates and a
flattened cardboard box, a plastic water dish nearby. Wet asphalt
throwing back the light of a shop window. Nobody around.

6. minhyun-sunset — 3:4 세로 · 마지막 · 사진
A school rooftop at dusk in winter, no person. Chain-link fence along
a low concrete parapet, an outdoor AC unit, melting snow left in a
line at the base of the wall, wet concrete underfoot. Pink and violet
sky over lit apartment towers and a dark ridge of hills.

── C. 보내는 사진 (21장) · STYLE A · 전부 1:1 ──
   폰으로 찍은 느낌. [셀카]는 본인이 든 폰으로 찍은 각도다.
   나머지는 눈앞의 것을 찍었거나 남이 찍어준 것이다.

7. minhyun-window
Sitting at a classroom window seat, chin propped on one hand, looking
out. One earbud in. Winter light through tall windows.

8. minhyun-desk
Face down asleep across a classroom desk, arms folded under his head.
Taken by the boy sitting next to him without asking. Afternoon light.

9. minhyun-nap [셀카]
Just woken from sleeping face-down in an empty classroom at sunset,
hair flattened on one side, eyes half open. Taken by himself. Orange
low light across the empty desks.

10. minhyun-corridor
School corridor at break, leaning by the window. One earbud in, the
other cable hanging. Students out of focus behind him.

11. minhyun-stair
Sitting on a stairwell windowsill halfway between floors. He is not
in class and is not pretending otherwise. Cold light through frosted
glass.

12. minhyun-rain
Standing at a stairwell window on a rainy day, a lighter turning in
his fingers. He is not smoking and there is no cigarette. Grey light,
rain streaking the glass.

13. minhyun-candy
Sitting on the bed in the nurse's office, unwrapping a candy from a
glass jar. Legs over the edge, in no hurry to leave. Daylight through
blinds.

14. minhyun-vending
Beside a vending machine on the school rooftop at night, headphones
around his neck rather than on. A can in one hand. He is skipping
evening study.

15. minhyun-gym
In the school gymnasium, standing at the edge of the court, hands on
hips, catching his breath. He is careful with himself now and does not
push it. Flat overhead light.

16. minhyun-gate
Outside the school front gate on a winter morning, walking in with his
bag on one shoulder. Cold blue early light, breath visible.

17. minhyun-alley
A narrow back-gate alley in winter, standing against a brick wall, a
lighter in one hand. No cigarette, no smoke. This is where he first
met her. Dim late light between buildings.

18. minhyun-busstop
Waiting at a bus stop, hands in his jacket pockets, looking down the
road. Evening. Cold.

19. minhyun-neon
Waiting for a bus on a rainy night under a shop's neon spill,
earphones in, hood up. Wet pavement throwing back colour.

20. minhyun-bench
Sitting on a low bench by the roadside late at night, chin on his
hand, hunched. He is not going home yet and will not say so. Streetlight
overhead, dark beyond.

21. minhyun-laundry
Night, a self-service laundromat. Sitting up on top of a running
washing machine, a can in one hand, feet dangling. Flat fluorescent
light, dark window behind.

22. minhyun-fridge
Standing at the open fridge door of a convenience store, a bag of
jelly sweets picked out in one hand. Cold white store light on his
face.

23. minhyun-ramen
At the window counter of a convenience store, a cup of instant noodles
in front of him, chopsticks in hand. This is his dinner. Night street
through the glass.

24. minhyun-morning [셀카]
Just woken up at home, hair everywhere, a shirt half on, eyes barely
open. Taken by himself, phone raised, grey morning light.

25. minhyun-mirror [셀카]
A mirror selfie somewhere he has just arrived, the phone covering half
his face. He is not reporting where he is — he is fishing for a reply.
Dim available light.

26. minhyun-winter
Outdoors in deep winter, caught wearing far too little for the
weather — thin uniform, no scarf, hands pulled into his sleeves. Grey
overcast day.

27. minhyun-snow
Standing outside on a day of fresh snow, looking up, snow settling in
his hair and on his shoulders. The winter is nearly over. Soft white
light.

── D. 히든 (5장) · 전부 1:1 ────────────────
   28~31은 인물이 없다 · STYLE B.  32만 STYLE A다.

28. minhyun-bag — 사진 · 인물 없음
Flat-lay from directly above on a dark rumpled bedsheet: a worn black
canvas shoulder bag open on the left with a spiral notebook and a
camera lens inside, and laid out beside it — a compact digital camera,
a tangle of wired earphones, a battered tin box holding guitar picks
and a USB stick and two wrapped candies, a white earbud case, a
blister strip of pills, a black hardcover notebook with a ballpoint
pen across it, a transit card, a fabric festival wristband, a keyring
shaped like a cassette tape, a coiled headphone cable. Everything
dark, everything used.

29. minhyun-room — 사진 · 인물 없음
A small bedroom at night, no person. An open clothes rack crowded with
jackets and shirts, shoe boxes stacked on top, sneakers and boots on
the lower shelf. One whole wall papered edge to edge with gig flyers,
band photos, polaroids and an LP sleeve, a full-length mirror set into
the middle of it. A shelf of books and CDs, a small guitar amp on the
floor, headphones and records left on the rug. Warm lamp light, warm
clutter.

30. minhyun-playlist — 9:16 세로 · 인물 없음
A phone screenshot of a music app in dark mode, Korean UI. A playlist
of 27 tracks, its cover a dim photo of his own poster-covered bedroom
wall. Buttons reading 재생 / 셔플. Track list visible: Interpol
"Obstacle 1", Slowdive "When the Sun Hits" (marked on repeat),
Radiohead "My Iron Lung", The Strokes "The Adults Are Talking",
Arctic Monkeys "505". A now-playing bar pinned at the bottom.

31. minhyun-ticket — 사진 · 인물 없음
Still life on a dark wooden desk beside a turntable, lit red and blue
from a window. Three kept cinema ticket stubs fanned out — a yellow
one, a blue one, a red one — creased and faded, each with a seat
number and an old date printed on it. Around them: headphones, a
guitar pick, a frayed festival wristband, one unwrapped fruit candy.

32. minhyun-yearbook — 1:1 · STYLE A · ★ 열아홉이다
A formal graduation ID portrait of the SAME boy at NINETEEN, straight
to camera against a plain pale grey studio backdrop. Override the age
in CHARACTER LOCK to 19: the jaw a shade softer, the same shaggy black
hair falling into his eyes, the same dark circles, the same freckles,
blank unsmiling expression, no earbud. Navy school blazer with an
embroidered crest on the breast pocket, white shirt, dark knit vest,
navy striped tie done up properly. Even shot-flat studio light.

── E. 새로 필요한 것 (1장) · STYLE A · 1:1 ──

33. minhyun-library
Public library stacks, slouched against the end of a shelf with a book
open in one hand, not really reading it. One earbud in. He is here
because someone else is. Warm shelf-level light, tall rows behind.

═══════════════════════════════════════════

1번부터 시작해라.
```

---

## 받은 뒤에 할 것

1. `app-data.js`의 `AV_V`를 올린다 — 안 올리면 옛 그림이 계속 뜬다
2. `CHARS.minhyun`의 `zoom`·`pos`를 새 프로필에 맞춰 다시 잡는다
   (지금 `150%` / `50% 22%`)
3. `SCENE_SHOT`의 `"도서관"`에 `minhyun-library`를 연결한다
