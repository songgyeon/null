"""학습용 캡션 생성. train_style_lora.sh 전에 한 번 돌린다.

    python caption.py --src refs --out style_ds/10_jaeeon1 --trigger jaeeon1

내용만 적고 화풍은 한 글자도 적지 않는다.
캡션으로 설명되지 않고 남는 것 = 화풍이 트리거 워드에 몰린다.
화풍을 캡션에 쓰면 그 단어들로 흩어져서 트리거가 빈다.
"""
import argparse, os, shutil, re
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True, help="기준 화풍 이미지 폴더")
ap.add_argument("--out", required=True, help="kohya 학습 폴더 (10_트리거 형식)")
ap.add_argument("--trigger", default="jaeeon1")
a = ap.parse_args()

# 화풍을 가리키는 말은 캡션에서 전부 제거한다. 남겨두면 트리거가 빈다.
BANNED = re.compile(
    r"\b(anime|manga|cartoon|illustration|illustrated|painting|painted|drawing|drawn|"
    r"render|rendered|3d|cgi|photo|photograph|photorealistic|realistic|artwork|art|"
    r"style|digital|sketch|detailed|beautiful|masterpiece|high quality|cinematic)\b",
    re.I)

os.makedirs(a.out, exist_ok=True)

from transformers import BlipProcessor, BlipForConditionalGeneration
import torch
proc = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-large", torch_dtype=torch.float16).to("cuda")

srcs = [f for f in sorted(os.listdir(a.src))
        if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
assert srcs, f"{a.src} 가 비어 있다"

for i, f in enumerate(srcs, 1):
    img = Image.open(os.path.join(a.src, f)).convert("RGB")
    ids = model.generate(**proc(img, return_tensors="pt").to("cuda", torch.float16),
                         max_new_tokens=60)
    cap = proc.decode(ids[0], skip_special_tokens=True)

    cap = BANNED.sub("", cap)
    cap = re.sub(r"\s{2,}", " ", cap).strip(" ,")
    cap = f"{a.trigger}, {cap}"

    stem = f"{i:03d}"
    img.save(os.path.join(a.out, stem + ".png"))
    with open(os.path.join(a.out, stem + ".txt"), "w") as fh:
        fh.write(cap)
    print(f"{stem}  {cap}")

print(f"""
{len(srcs)}장 준비 완료 → {a.out}

캡션을 눈으로 훑어라. 자동 캡션은 자주 틀린다.
빠진 내용(안경, 사원증, 카디건, 배경 선반 …)은 손으로 채워 넣는다.
적을수록 화풍이 아니라 그 물건까지 트리거에 딸려온다.

다음:  bash train_style_lora.sh
""")
