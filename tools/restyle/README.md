# 재언 화풍 통일

가진 이미지들은 화풍 빼고 다 맞았다.
얼굴·피지컬·자세·표정·구도·조명·코디·장소는 이미 나왔다.
그래서 처음부터 다시 뽑지 않는다. **화풍만 갈아끼운다.**

## 왜 ChatGPT로는 안 됐나

항목 12개가 한 장에 동시에 맞아야 하는데 매번 12개를 전부 새로 굴린다.
각 항목이 70%씩 맞아도 0.7¹² = 1.4%. 장수를 늘려서 이길 수 있는 싸움이 아니다.

그리고 11개가 맞고 1개가 틀렸을 때 그 1개만 고칠 방법이 없다.
고치라고 하면 전부 다시 그려서 맞았던 11개가 도로 흔들린다.

여기서는 맞은 건 잠그고 틀린 데만 다시 그린다.

## 두 갈래

| | 학습 | 시간 | 화풍 재현 |
|---|---|---|---|
| A. IP-Adapter | 없음 | 바로 | 준수 |
| B. 화풍 LoRA | 있음 | +1시간 | 확실 |

기준 화풍 이미지가 6장 이상이면 **B로 간다.** A는 먼저 감을 잡을 때 쓴다.

## 준비

캐글 노트북: Accelerator **GPU T4 x2** 또는 **P100**, Internet **On**.

    !pip -q install diffusers transformers accelerate safetensors controlnet_aux peft

- `refs/` — 기준 화풍 컷 전부
- `src/`  — 화풍을 끌어올 나머지 이미지
- `out/`  — 결과

## A. IP-Adapter (학습 없음)

### 1. denoise 스윕 — 반드시 먼저

    python sweep.py --src src --refs refs --n 5

`sweep/` 에 denoise 0.35 / 0.45 / 0.55 / 0.65 / 0.75 비교본이 나온다. 눈으로 고른다.

- 화풍 왔는데 얼굴·자세 그대로 → **그 값**
- 화풍이 안 옴 → 올린다
- 자세·손이 무너짐 → 내리거나 `--cn 0.7 0.35` 로 depth 를 올린다

### 2. 배치

    python restyle.py --src src --refs refs --out out --denoise 0.55

T4 기준 1024px 한 장 10~15초. 중단돼도 이미 만든 건 건너뛰므로 그냥 다시 실행한다.

## B. 화풍 LoRA

### 1. 캡션

    python caption.py --src refs --out style_ds/10_jaeeon1 --trigger jaeeon1

**내용은 전부 적고 화풍은 한 글자도 적지 않는다.**

    ✅ jaeeon1, a man with glasses in a school infirmary, black cardigan,
       lanyard, shelves with bottles behind, warm lamp at right, looking down

    ❌ jaeeon1, semi-realistic, cinematic, masterpiece, detailed

캡션으로 설명되지 않고 남는 것 = 화풍이 트리거에 몰린다.
화풍을 적으면 그 단어들로 흩어져서 트리거가 빈다.

자동 캡션은 자주 틀리니 눈으로 훑고 빠진 걸 채운다.

### 2. 학습

    bash train_style_lora.sh

`network_dim 4 / alpha 1` 이 핵심이다.
16 이상이면 열 몇 장을 통째로 외워서 화풍이 아니라 구도·배경까지 복사한다.

`network_train_unet_only` 도 그대로 둔다.
장수가 적을 때 텍스트 인코더를 건드리면 프롬프트 이해력이 망가진다.

### 3. 체크포인트 고르기 — 마지막 파일을 쓰면 안 된다

200스텝마다 저장된다. 같은 시드로 뽑아 비교한다.

- 화풍은 왔는데 구도가 레퍼런스와 다름 → **정답**
- 레퍼런스 구도·배경이 그대로 나옴 → 과적합, 앞 체크포인트로
- 화풍이 안 옴 → 학습 부족, 뒤 체크포인트로

### 4. 배치

    python restyle.py --src src --out out --lora style_lora/style-step00000800.safetensors --denoise 0.55

## 남는 문제

denoise 를 올리면 얼굴이 조금 흔들린다.
ControlNet 이 구조를 잡아주지만 완벽하진 않다.
많이 틀어지면 얼굴만 인페인트로 되돌린다 — 몸과 배경 픽셀은 그대로 둔 채.

## 주의

- T4 는 Turing 이라 bf16 이 없다. **fp16** 을 쓴다.
- 원본은 지우지 않는다. denoise 를 다시 고르고 재실행할 일이 생긴다.
