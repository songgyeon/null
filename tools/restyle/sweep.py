"""denoise 스윕. 1000장 돌리기 전에 이걸 먼저 본다.

샘플 몇 장을 여러 denoise 값으로 뽑아 한 장에 붙여준다.
왼쪽이 원본이고 오른쪽으로 갈수록 화풍이 세게 들어간다.

    python sweep.py --src src --refs refs --n 5
"""
import argparse, os
import torch
from PIL import Image, ImageDraw
from pipe import build, build_hints, list_images, fit

ap = argparse.ArgumentParser()
ap.add_argument("--src",  required=True, help="화풍만 틀린 기존 이미지 폴더")
ap.add_argument("--refs", required=True, help="원하는 화풍 레퍼런스 폴더")
ap.add_argument("--out",  default="sweep")
ap.add_argument("--n",    type=int, default=5, help="샘플 장수")
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--seed", type=int, default=1234)
ap.add_argument("--lora", default=None)
ap.add_argument("--prompt", default="")
ap.add_argument("--cn", type=float, nargs=2, default=[0.55, 0.35],
                help="ControlNet 가중치: depth canny")
ap.add_argument("--denoise", type=float, nargs="+",
                default=[0.35, 0.45, 0.55, 0.65, 0.75])
a = ap.parse_args()

NEG = ("lowres, bad anatomy, bad hands, extra fingers, watermark, text, "
       "signature, jpeg artifacts, deformed face, extra limbs")

os.makedirs(a.out, exist_ok=True)
refs = [Image.open(p).convert("RGB") for p in list_images(a.refs)]
srcs = list_images(a.src)[: a.n]
assert refs, f"{a.refs} 에 레퍼런스가 없다"
assert srcs, f"{a.src} 에 이미지가 없다"
print(f"레퍼런스 {len(refs)}장 / 샘플 {len(srcs)}장 / denoise {a.denoise}")

pipe, hints = build(lora=a.lora), build_hints()

for p in srcs:
    src = fit(Image.open(p))
    hs  = hints(src)
    row = [src]
    for d in a.denoise:
        row.append(pipe(
            prompt=a.prompt, negative_prompt=NEG,
            image=src, control_image=[h.resize(src.size) for h in hs],
            ip_adapter_image=refs,
            strength=d, num_inference_steps=a.steps,
            controlnet_conditioning_scale=list(a.cn),
            generator=torch.Generator("cuda").manual_seed(a.seed),
        ).images[0])

    # 가로로 이어 붙이고 라벨을 얹는다
    w, h = row[0].size
    sheet = Image.new("RGB", (w * len(row), h + 28), "black")
    dr = ImageDraw.Draw(sheet)
    for i, im in enumerate(row):
        sheet.paste(im.resize((w, h)), (i * w, 28))
        dr.text((i * w + 8, 8), "원본" if i == 0 else f"denoise {a.denoise[i-1]}", fill="white")

    dst = os.path.join(a.out, os.path.splitext(os.path.basename(p))[0] + "-sweep.jpg")
    sheet.save(dst, quality=92)
    print("→", dst)

print(f"""
{a.out}/ 을 열어서 고른다.

  화풍 왔는데 얼굴·자세 그대로  → 그 denoise 값을 쓴다
  화풍이 안 옴                  → 더 높은 값으로
  자세·손이 무너짐              → 낮추거나 --cn 의 depth 를 0.7 로 올린다

정한 값으로:
  python restyle.py --src {a.src} --refs {a.refs} --out out --denoise <값>
""")
