#!/usr/bin/env python3
"""사물함 지도 에셋을 원화 3장에서 잘라낸다.

원화는 통짜 한 장이라 그대로는 못 쓴다. 코드가 칸마다 문짝을 갈아끼우기
때문이다. 프레임은 통짜를 그대로 쓰고, 문짝만 같은 그림에서 잘라 제자리에
다시 얹는다 — 픽셀이 같으니 겹쳐도 티가 안 나고, 잠김·다녀옴 같은 상태는
그 문짝 한 장에만 필터가 걸린다.

    art/cab-closed.webp   자물쇠 없는 사물함      -> frame.webp + 열린 문짝
    art/cab-locked.webp   여섯 칸 다 잠긴 사물함  -> 잠긴 문짝
    art/cab-open.webp     학교 칸이 열린 사물함    -> open.webp
    art/cab-open-slot.webp 같은 것을 제자리에서   (안 씀. 원화 보관용)

원화가 통짜라 잠금 조합을 열 장 받았지만 쓰는 건 「전부 잠긴」 한 장이다.
여섯 칸이 다 잠긴 그림 하나에서 잠긴 문짝 여섯이 다 나오고, 나머지 조합은
그 여섯을 다시 섞은 것이라 볼 게 없다.

    python3 tools/build-cab-art.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art")
OUT = os.path.join(ROOT, "cab-icons")

# 원화에서 잰 값이다. 사물함 몸통(알파 경계)과 문짝 여덟 칸.
BODY = (84, 92, 1365, 2756)          # 통짜 원화에서 사물함만
COLX = [(128, 708), (743, 1323)]     # 문짝 좌우 (원화 좌표). 폭을 같게 맞춘다
ROWY = [(396, 896), (924, 1424), (1452, 1952), (1980, 2480)]
RADIUS = 42                          # 문짝 모서리. 마스크가 이 곡률을 따라야
                                     # 그림자와 다녀옴 발광이 네모로 안 퍼진다

# 칸 차례는 CAB_SLOT과 같다 — 왼쪽 위부터 오른쪽으로 읽는다
SLOT = ["start", "school", "conv", "library", "record", "laundry", "home", "null"]
# 자리인 여섯은 잠김·열림 두 장으로 나간다(그림은 같고 필터가 다르다).
# 명패 둘은 한 장이면 된다 — 열고 닫을 것이 없는 칸이다
PLATE = {"start", "null"}

FRAME_W = 760
DOOR_W = 400


def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=255)
    return m


def save(im, name):
    p = os.path.join(OUT, name)
    im.save(p, "WEBP", quality=92, method=6)
    return os.path.getsize(p)


def main():
    closed = Image.open(os.path.join(SRC, "cab-closed.webp")).convert("RGBA")
    locked = Image.open(os.path.join(SRC, "cab-locked.webp")).convert("RGBA")
    opened = Image.open(os.path.join(SRC, "cab-open.webp")).convert("RGBA")
    os.makedirs(OUT, exist_ok=True)
    total = 0

    body = closed.crop(BODY)
    bw, bh = body.size
    total += save(body.resize((FRAME_W, round(FRAME_W * bh / bw)), Image.LANCZOS), "frame.webp")

    mask = None
    for i, key in enumerate(SLOT):
        box = (COLX[i % 2][0], ROWY[i // 2][0], COLX[i % 2][1], ROWY[i // 2][1])

        def cut(src):
            global mask
            t = src.crop(box)
            t.putalpha(rounded_mask(t.size, RADIUS))
            w, h = t.size
            return t.resize((DOOR_W, round(DOOR_W * h / w)), Image.LANCZOS)

        if key in PLATE:
            total += save(cut(closed), key + ".webp")
        else:
            total += save(cut(closed), "%s-open.webp" % key)
            total += save(cut(locked), "%s-lock.webp" % key)

    # 열린 문은 잘라내지 않는다. 원화가 사물함 한가운데에 TV를 놓은 한 장으로
    # 그려져 있고, 그게 학교 안 화면 그대로다 — 열린 부분만 오려서 띄우면
    # 사물함 안이 아니라 화면 위에 얹힌 판때기가 된다
    op = opened.crop(BODY)
    ow, oh = op.size
    total += save(op.resize((FRAME_W, round(FRAME_W * oh / ow)), Image.LANCZOS), "open.webp")

    print("cab-icons/ %d bytes" % total)


if __name__ == "__main__":
    main()
