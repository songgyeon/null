#!/usr/bin/env bash
# 화풍 LoRA. 기준 화풍 이미지 6장 이상이면 굽는다.
#
#   DATA/10_jaeeon1/  안에 이미지 + 같은 이름의 .txt 캡션
#   bash train_style_lora.sh
set -euo pipefail

DATA=${DATA:-style_ds}
OUT=${OUT:-style_lora}
BASE=${BASE:-stabilityai/stable-diffusion-xl-base-1.0}

[ -d sd-scripts ] || git clone -q --depth 1 https://github.com/kohya-ss/sd-scripts
pip -q install -r sd-scripts/requirements.txt

# dim 4 / alpha 1 이 핵심이다.
# 16 이상으로 잡으면 열 몇 장을 통째로 외워서
# 화풍이 아니라 구도와 배경까지 복사해온다.
accelerate launch --num_cpu_threads_per_process 2 \
  sd-scripts/sdxl_train_network.py \
  --pretrained_model_name_or_path "$BASE" \
  --train_data_dir "$DATA" \
  --output_dir "$OUT" --output_name style \
  --resolution 1024,1024 --enable_bucket \
  --network_module networks.lora \
  --network_dim 4 --network_alpha 1 \
  --network_train_unet_only \
  --learning_rate 1e-4 --lr_scheduler cosine --lr_warmup_steps 50 \
  --max_train_steps 1200 \
  --save_every_n_steps 200 \
  --train_batch_size 1 --gradient_checkpointing \
  --mixed_precision fp16 --save_precision fp16 \
  --cache_latents --cache_text_encoder_outputs \
  --optimizer_type AdamW8bit --xformers \
  --flip_aug \
  --seed 42

echo
echo "마지막 파일을 그냥 쓰면 안 된다. 체크포인트를 하나씩 걸어보고 고른다:"
echo "  for s in 00000600 00000800 00001000 00001200; do"
echo "    python restyle.py --src src --out test-\$s --lora $OUT/style-step\$s.safetensors --denoise 0.55 --limit 3"
echo "  done"
