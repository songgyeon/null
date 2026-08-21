"""배치 실행. sweep.py 로 denoise 를 정한 뒤에 돌린다.

    python restyle.py --src src --refs refs --out out --denoise 0.55

중단돼도 이미 만든 건 건너뛴다. 그냥 다시 실행하면 이어서 간다.
"""
import argparse, os, time, traceback
import torch
from PIL import Image
from pipe import build, build_hints, list_images, fit

ap = argparse.ArgumentParser()
ap.add_argument("--src",  required=True)
ap.add_argument("--refs", default=None, help="LoRA 를 쓰면 생략 가능")
ap.add_argument("--out",  required=True)
ap.add_argument("--denoise", type=float, required=True, help="sweep 으로 정한 값")
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--seed",  type=int, default=1234)
ap.add_argument("--lora",  default=None)
ap.add_argument("--prompt", default="")
ap.add_argument("--cn", type=float, nargs=2, default=[0.55, 0.35])
ap.add_argument("--fmt", default="png", choices=["png", "webp", "jpg"])
ap.add_argument("--limit", type=int, default=0, help="0 이면 전부")
a = ap.parse_args()

NEG = ("lowres, bad anatomy, bad hands, extra fingers, watermark, text, "
       "signature, jpeg artifacts, deformed face, extra limbs")

os.makedirs(a.out, exist_ok=True)
refs = [Image.open(p).convert("RGB") for p in list_images(a.refs)] if a.refs else None
srcs = list_images(a.src)
if a.limit:
    srcs = srcs[: a.limit]

todo = [p for p in srcs
        if not os.path.exists(os.path.join(
            a.out, os.path.splitext(os.path.basename(p))[0] + "." + a.fmt))]
print(f"전체 {len(srcs)}장 / 남은 것 {len(todo)}장 / denoise {a.denoise}")
if not todo:
    raise SystemExit("이미 다 끝났다.")

pipe, hints = build(lora=a.lora), build_hints()

t0, done, failed = time.time(), 0, []
for i, p in enumerate(todo, 1):
    dst = os.path.join(a.out, os.path.splitext(os.path.basename(p))[0] + "." + a.fmt)
    try:
        src = fit(Image.open(p))
        hs  = hints(src)
        out = pipe(
            prompt=a.prompt, negative_prompt=NEG,
            image=src, control_image=[h.resize(src.size) for h in hs],
            ip_adapter_image=refs,
            strength=a.denoise, num_inference_steps=a.steps,
            controlnet_conditioning_scale=list(a.cn),
            # 시드를 파일마다 다르게 둔다. 같은 시드로 고정하면 결과가 서로 닮아간다.
            generator=torch.Generator("cuda").manual_seed(a.seed + i),
        ).images[0]
        out.save(dst, quality=95) if a.fmt != "png" else out.save(dst)
        done += 1
    except Exception:
        failed.append(p)
        traceback.print_exc()
        continue

    el = time.time() - t0
    eta = el / done * (len(todo) - done)
    print(f"[{i}/{len(todo)}] {os.path.basename(dst)}  "
          f"{el/done:.1f}s/장  남은시간 {eta/60:.0f}분", flush=True)

print(f"\n완료 {done}장 · 실패 {len(failed)}장 → {a.out}")
for p in failed:
    print("  실패:", p)
if failed:
    print("다시 실행하면 실패분만 재시도한다.")
