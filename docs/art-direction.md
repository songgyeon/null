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

SKIN — smooth, even tone, light natural sheen. No visible pores, no dry
matte texture.

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
40s, weathered, tired old man
```

## 갈아끼울 때 잊는 것 둘

파일명을 그대로 두고 그림만 바꾸면 화면이 안 바뀐다. 둘 다 코드에 주석으로
적혀 있지만 여기에도 적어둔다.

1. `app-data.js`의 `AV_V`를 올린다. 지금 `"?v=4"`다. 안 올리면 브라우저와
   CDN이 옛 그림을 계속 쓴다.
2. `app-data.js`의 `CHARS.jaeeon`에 있는 `zoom`·`pos`를 다시 잡는다.
   지금은 `150%` / `50% 22%`인데, 얼굴 위치가 달라지면 42px 동그라미에서
   머리가 잘리거나 턱만 보인다.

## 순서

프로필 한 장(`jaeeon-profile.webp`)이 제일 많이 보인다 — 방 목록 아바타와
프로필 화면이 둘 다 이 파일이다. 여기부터 잡고, 결과가 민현 옆에 놓아도
어색하지 않으면 갤러리 22장으로 넘어간다.
