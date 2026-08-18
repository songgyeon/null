# 그림 방향 — 이재언 재생성

친구들에게 「재언이 29살 아니고 39살 같다」는 말을 들었다. 이미지를 열어보니
맞는 말이었다. 왜 그런지와, 다시 뽑을 때 넣을 것을 여기 적는다.

## 원인은 얼굴이 아니라 화풍이다

두 프로필을 나란히 놓으면 바로 보인다. **두 사람이 다른 화풍으로 뽑혀 있다.**

| | 이민현 (20세로 읽힘) | 이재언 (39세로 읽힘) |
|---|---|---|
| 화풍 | 부드러운 페인터리 일러스트 | 거의 실사 |
| 얼굴 음영 | 모델링이 거의 없다 — 평평하고 고르다 | 광대 아래·팔자에 하드 셰이딩 |
| 조명 | 역광 림라이트, 저대비 | 측면 키라이트가 얼굴을 깎는다 |
| 피부 | 옅은 윤기, 주근깨, 매끈 | 매트하고 건조, 모공 질감 |
| 윤곽 | 부드럽게 칠한 경계 | 사진처럼 또렷한 경계 |

같은 얼굴이어도 이 차이만으로 10년이 붙는다. 실사 렌더링에 측면광을 쓰면
20대 얼굴에는 원래 없는 주름과 패임이 전부 살아나기 때문이다.

그래서 지시는 「젊게」가 아니라 **「민현과 같은 화풍으로」**다. 이게 제일 크고,
아래 얼굴 항목들은 그다음이다.

## 창백으로 간다

피곤함을 무엇으로 그리느냐의 문제다. 지금 그림은 설정의 「표정의 기본값은
피곤함이다」를 **주름과 볼 패임으로** 그리고 있고, 그게 곧 늙음이다.
창백으로 옮기면 같은 피곤함을 **혈색으로** 그리게 된다 — 창백이 살려면
피부가 오히려 매끈하고 고와야 하니 노화 신호와 방향이 정반대다. 피곤함을
하나도 안 깎고 서른아홉만 뺄 수 있다.

「눈매가 서늘하다」, 「기본 온도가 낮다」와도 붙는다. 실내에서 일하는
보건교사이고 계절이 겨울이라 설정으로도 자연스럽다.

대신 둘을 같이 박아야 한다.

**하나 — 민현과 갈라야 한다.** 민현 설정에 이미 「이목구비보다 낯빛이
흐리다는 인상이 먼저 온다. 다크서클이 있다」가 있다. 둘 다 희멀게지면 두
사람이 같은 인상이 된다. 갈리는 자리는 이렇다.

| | 낯빛 |
|---|---|
| 이재언 | **관리된 창백.** 고르고 깨끗한 흰 피부에 옅은 윤기, 혈색만 없다. 정돈이 이 사람의 갑옷이다 |
| 이민현 | **방치된 흐림.** 고르지 않은 낯빛, 다크서클. 자기 몸 챙기는 회로가 꺼져 있던 쪽이다 |

지금 그림은 이게 거꾸로다. 재언이 거칠고 민현이 말끔하다.

**둘 — 창백이 병약으로 넘어가면 안 된다.** 회색이나 누런 기가 돌면 아픈
사람이 되고, 입술 혈색까지 빼면 시체가 된다. 차고 깨끗한 흰색이어야 하고
입술에는 옅게 남긴다. 다크서클도 여기서는 아주 옅게만 — 창백에 진한 눈
밑을 얹으면 뺀 나이가 그대로 돌아온다.

## 얼굴에서 나이를 만들던 것들

프로필과 교실 사진에서 실제로 확인한 것만 적는다.

- 팔자주름 그림자가 뚜렷하다 — 20대 얼굴에는 거의 안 생긴다
- 광대 아래가 패여 있다
- 눈두덩이 무겁고 입꼬리가 내려가 있다
- 피부가 매트하고 건조하다
- (교실 사진) 손등 힘줄과 혈관이 도드라진다 — 설정에 있던 「10년 차」가
  그대로 반영된 손이다. 그 숫자는 5년 차로 고쳤다(cd8952f)

설정에는 「단정한 얼굴. 잘생겼다는 말을 자주 듣는다」고 적혀 있다. 지금 그림은
그 문장을 배신하고 있다.

## 프롬프트

이미지 도구는 영문이 잘 먹으므로 영문으로 둔다. 프로필 한 장부터 뽑고,
그게 잡히면 갤러리에 같은 블록을 돌려 쓴다.

```
Korean man, 29 years old, school nurse, upper-body portrait,
three-quarter view, eyes lowered slightly away from camera.

FACE — clean-cut and handsome. Smooth full mid-face with no hollowing
under the cheekbones. No nasolabial folds, no forehead lines, no crow's
feet. Firm jawline that is not heavy, softly rounded chin. Calm level
eyes, single-fold lids, only a faint shadow beneath them — quiet
tiredness, not age. Straight dark brows, neither thick nor low-set.
Closed relaxed mouth with neutral corners.

SKIN — pale. Fair, cool-toned, bloodless but clean and well-kept.
Smooth, even, with a faint sheen, like porcelain. Lips keep a trace of
natural colour. No sallow or grey cast, no visible pores, no dry matte
texture.

HANDS (when visible) — smooth backs, no raised veins or tendons.

HAIR — black, soft-textured, swept back neatly, a few loose strands at
the temple.

CLOTHING — pressed pale grey shirt under a charcoal fine-knit crewneck.
Collar crisp and flat. Achromatic, immaculately ironed.

LIGHT — soft diffused frontal light, low contrast, gentle falloff. Cool
winter daylight through a window behind, warm lamp glow far side. No
hard side-key, no light raking across the cheek.

STYLE — soft painterly semi-realistic Korean illustration. Smooth
gradient shading, minimal facial shadow modeling, softly painted edges.
Muted cool winter palette. Illustrative, not photographic.

Square 1:1, head and shoulders, headroom above the hair.
```

네거티브:

```
photorealistic skin texture, visible pores, nasolabial folds, laugh
lines, forehead wrinkles, crow's feet, hollow cheeks, sunken cheeks,
gaunt, heavy jaw, jowls, stubble, five o'clock shadow, deep dark
circles, harsh side lighting, dramatic chiaroscuro, high contrast
shadows, matte dry skin, veiny hands, prominent tendons, middle-aged,
40s, weathered, tired old man, sallow skin, grey complexion, jaundiced,
sickly, ashen, colourless lips, heavy dark circles, ill, gothic vampire
```

창백을 넣으면 도구가 병약한 쪽으로 흐르기 쉽다. 뒷줄이 그걸 막는다.

## 갈아끼울 때 잊는 것 둘

파일명을 그대로 두고 그림만 바꾸면 화면이 안 바뀐다. 둘 다 코드에 주석으로
적혀 있지만 여기에도 적어둔다.

1. `app-data.js`의 `AV_V`를 올린다. 지금 `"?v=4"`다. 안 올리면 브라우저와
   CDN이 옛 그림을 계속 쓴다.
2. `app-data.js`의 `CHARS.jaeeon`에 있는 `zoom`·`pos`를 다시 잡는다.
   지금은 `150%` / `50% 22%`인데, 얼굴 위치가 달라지면 42px 동그라미에서
   머리가 잘리거나 턱만 보인다.

## 무엇을 몇 장 다시 뽑나

재언 파일은 39장인데 화면에 나오는 것은 33장이다. 쓰이는 자리별로 이렇다.

| 자리 | 장수 | 무엇 |
|---|---|---|
| 프로필 사진 | 1 | `jaeeon-profile` — 방 목록 아바타와 프로필 화면이 같은 파일이다 |
| 프로필 배경 | 5 | 단계별로 바뀐다: `gallery` → `landing` → `lobby` → `drive` → `kitchen` |
| 보내는 사진 | 22 | 대화 중에 인물이 골라 보낸다. 갤러리 탭에 걸리는 것도 같은 22장이다 |
| 히든 | 5 | `bag` `room` `playlist` `ticket` `yearbook`. 대화가 쌓이면 열린다 |
| **안 쓰임** | 6 | `bg` `hall` `library` `museum` `night` `stairs` |

민현도 같은 구조다 — 프로필 1, 배경 5(`shop` → `lp` → `bus` → `cat` →
`sunset`), 보내는 사진 21, 히든 5, 안 쓰이는 것 7(`bg` `elevator` `poster`
`record` `roof` `street` `tv`).

안 쓰이는 13장은 코드 어디에서도 참조하지 않는다(README·이 문서 제외).
`jaeeon-bg`·`minhyun-bg`는 이름이 배경 같지만 쓰는 데가 없다 — 배경은
위의 단계별 다섯 장이 맡는다. 다시 뽑을 때 이 13장은 빼도 된다.

각 사진이 무엇을 찍은 것인지는 `worker.js`의 `PHOTOS`에 `when`으로 적혀
있다. 여기 옮겨 적지 않는다 — 두 판으로 두면 갈라진다.

**두 사람 말고 공용으로 쓰는 것** (인물이 안 나오므로 이번 화풍 문제와
무관하다): 자리 배경 `place-*` 9장, 주울 수 있는 물건 `item-*` 9장, 선물
`gift-*` 4장과 그 아이콘 `gicon-*` 16장, 히든 문서 `hidden-*` 8장(일기·
상담기록·SNS 캡처라 그림이 아니라 종이다), 바탕화면 `bg-desk`·
`bg-wallpaper`, 캐비닛 지도 `cab-icons/` 17장.

## 순서

프로필 한 장(`jaeeon-profile.webp`)이 제일 많이 보인다 — 방 목록 아바타와
프로필 화면이 둘 다 이 파일이다. 여기부터 잡고, 결과가 민현 옆에 놓아도
어색하지 않으면 다음으로 간다.

1. `jaeeon-profile` — 1장. 여기서 화풍을 확정한다
2. 프로필 배경 5장 — 단계가 오를 때마다 유저가 보는 자리다
3. 보내는 사진 22장 — 제일 많지만 대화 중에 한 장씩 스쳐 간다
4. 히든 5장 — 늦게 열리므로 마지막이어도 된다
