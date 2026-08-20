"""SDXL img2img + ControlNet(Depth+Canny) + IP-Adapter(style only).

화풍만 바꾸고 구도·자세·해부는 ControlNet이 붙잡는다.
sweep.py 와 restyle.py 가 공유한다.
"""
import os, glob
import torch
from PIL import Image

DEPTH_CN = "diffusers/controlnet-depth-sdxl-1.0"
CANNY_CN = "diffusers/controlnet-canny-sdxl-1.0"
BASE     = "stabilityai/stable-diffusion-xl-base-1.0"

# IP-Adapter 를 화풍 전용으로 쓰는 레이어 배치.
# layout 을 담당하는 블록은 0 으로 죽이고 style 블록만 살린다.
# 이걸 안 하면 레퍼런스의 구도까지 딸려온다.
STYLE_ONLY_SCALE = {
    "down": {"block_2": [0.0, 1.0]},
    "up":   {"block_0": [0.0, 1.0, 0.0]},
}

IMG_EXT = ("*.png", "*.jpg", "*.jpeg", "*.webp")


def list_images(d):
    out = []
    for e in IMG_EXT:
        out += glob.glob(os.path.join(d, e))
        out += glob.glob(os.path.join(d, e.upper()))
    return sorted(set(out))


def fit(img, target_px=1024):
    """원본 비율을 유지한 채 넓이가 대략 1024^2 이 되도록. SDXL 은 8 배수를 요구한다."""
    w, h = img.size
    s = (target_px * target_px / (w * h)) ** 0.5
    w, h = max(512, int(w * s)) // 8 * 8, max(512, int(h * s)) // 8 * 8
    return img.convert("RGB").resize((w, h), Image.LANCZOS)


def build(lora=None, lora_scale=0.8, base=BASE):
    from diffusers import (StableDiffusionXLControlNetImg2ImgPipeline,
                           ControlNetModel, AutoencoderKL)

    dt = torch.float16          # T4 는 Turing 이라 bf16 이 없다
    cns = [ControlNetModel.from_pretrained(DEPTH_CN, torch_dtype=dt, variant="fp16"),
           ControlNetModel.from_pretrained(CANNY_CN, torch_dtype=dt, variant="fp16")]
    vae = AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix", torch_dtype=dt)

    pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(
        base, controlnet=cns, vae=vae, torch_dtype=dt, variant="fp16",
        use_safetensors=True)

    if lora:                    # 스타일 LoRA 를 구웠을 때만
        pipe.load_lora_weights(lora)
        pipe.fuse_lora(lora_scale=lora_scale)

    pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models",
                         weight_name="ip-adapter_sdxl.safetensors")
    pipe.set_ip_adapter_scale(STYLE_ONLY_SCALE)

    pipe.enable_model_cpu_offload()     # 16GB 에 SDXL + CN 2개 + IP-Adapter 를 얹으려면 필요
    pipe.enable_vae_tiling()
    return pipe


def build_hints():
    """Depth 와 Canny 전처리기. 원본에서 구조만 뽑아낸다."""
    from controlnet_aux import MidasDetector, CannyDetector
    midas = MidasDetector.from_pretrained("lllyasviel/Annotators")
    canny = CannyDetector()

    def hints(img):
        return [midas(img, image_resolution=min(img.size)),
                canny(img, low_threshold=80, high_threshold=180)]
    return hints
