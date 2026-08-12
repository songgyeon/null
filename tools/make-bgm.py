#!/usr/bin/env python3
"""NULL 메신저 BGM — "the blank" 을 만든다.

    python3 tools/make-bgm.py        # → null-1.wav

라이브러리를 안 쓴다(표준 wave 모듈뿐). 음원을 어디서 받아오는 대신 코드로
합성하는 이유는 두 가지다. 저작권이 걸리지 않고, 이 앱의 결(픽셀 폰트,
Y2K 메신저)과 맞는 소리가 나온다.

곡 구조 — 60BPM, 4/4, 4마디(16초), A단조. 이어 붙여도 티가 안 나게
꼬리를 머리에 접어 넣는다.

마지막 음이 없다. 4마디 멜로디가 으뜸음(A)으로 떨어질 자리에서 그냥
쉰다. 그 빈 자리를 듣는 사람이 머리로 채우게 두는 것이다 —
이 프로젝트의 이름이 NULL이고, 부제가 "the blank u fill in"이다.
"""
import math, wave, array, os

SR   = 32000        # 샘플레이트. 벨소리 배음이 살 만큼은 되고 파일은 작게
BPM  = 60.0
BEAT = 60.0 / BPM
BARS = 4
DUR  = BARS * 4 * BEAT          # 16초
TAIL = 3.0                      # 잔향이 끝날 때까지 더 그린 뒤 머리에 접는다
N    = int((DUR + TAIL) * SR)

buf = [0.0] * N

def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)

def place(start, dur, freq, amp, partials, attack, decay, curve=1.0):
    """한 음을 버퍼에 더한다. partials는 (배음, 세기) 목록."""
    i0 = int(start * SR)
    n  = int(dur * SR)
    if i0 + n > N:
        n = N - i0
    two_pi_sr = 2.0 * math.pi / SR
    for k in range(n):
        t = k / SR
        # 어택은 직선, 릴리스는 지수 — 벨은 빠르게, 패드는 길게 사라진다
        if t < attack:
            env = t / attack
        else:
            env = math.exp(-(t - attack) / decay)
            # 다 사라진 뒤로는 그릴 필요가 없다. 어택 구간에서 끊으면
            # 첫 샘플(env=0)에서 바로 빠져나가 소리가 통째로 없어진다.
            if env <= 0.0005:
                break
        v = 0.0
        for mul, w in partials:
            v += w * math.sin(two_pi_sr * freq * mul * (i0 + k))
        buf[i0 + k] += v * env * amp * curve

# ── 소리 ──────────────────────────────────────────────
# 패드: 배음이 거의 없는 부드러운 화음. 뒤에 깔린다
PAD  = [(1.0, 1.0), (2.0, 0.18), (3.01, 0.06)]
# 벨: 오르골. 첫 배음이 세고 금방 사라진다
BELL = [(1.0, 1.0), (2.0, 0.45), (4.0, 0.12), (6.7, 0.05)]
BASS = [(1.0, 1.0), (2.0, 0.10)]

pad  = lambda t, m: place(t, 4.6, hz(m), 0.055, PAD,  0.55, 1.9)
bell = lambda t, m, a=0.30: place(t, 2.2, hz(m), a,  BELL, 0.004, 0.42)
bass = lambda t, m: place(t, 3.4, hz(m), 0.085, BASS, 0.05, 1.4)

# ── 화성 ──────────────────────────────────────────────
# Am7 – Fmaj7 – Cmaj7 – Em7. 흔한 진행이지만 7음을 얹어 딱 떨어지지 않게 뒀다.
CHORDS = [
    (0*4*BEAT, 45, [57, 60, 64, 67]),   # Am7   (A2 / A3 C4 E4 G4)
    (1*4*BEAT, 41, [53, 57, 60, 64]),   # Fmaj7 (F2 / F3 A3 C4 E4)
    (2*4*BEAT, 36, [55, 60, 64, 67]),   # Cmaj7 (C2 / G3 C4 E4 G4)
    (3*4*BEAT, 40, [52, 55, 59, 62]),   # Em7   (E2 / E3 G3 B3 D4)
]
for t0, root, notes in CHORDS:
    bass(t0, root)
    for j, m in enumerate(notes):
        pad(t0 + j * 0.045, m)          # 아주 살짝 흩어 치면 사람이 친 것처럼 들린다

# ── 멜로디 ────────────────────────────────────────────
# (박, 음, 세기). 마지막 마디 끝의 A4(69)가 없다 — 그 자리가 이 곡의 제목이다.
MELODY = [
    (0.0, 76, .30), (1.5, 79, .26), (2.0, 81, .32), (3.0, 79, .22),
    (4.0, 79, .30), (5.5, 76, .26), (6.5, 74, .22),
    (8.0, 74, .30), (8.5, 76, .24), (9.5, 79, .30), (11.0, 76, .20),
    (12.0, 76, .28), (13.0, 74, .24), (14.0, 72, .20),
    # 15.0 — 여기에 A4(69)가 와야 한다. 안 온다.
]
for b, m, a in MELODY:
    bell(b * BEAT, m, a)

# ── 잔향 ──────────────────────────────────────────────
# 제대로 된 리버브 대신 멀티탭 딜레이. 이 정도면 방 안에서 나는 소리로 들린다.
TAPS = [(0.031, .28), (0.057, .22), (0.093, .17), (0.141, .12), (0.211, .08)]
wet = list(buf)
for d, g in TAPS:
    off = int(d * SR)
    for i in range(off, N):
        wet[i] += buf[i - off] * g
buf = wet

# ── 이어 붙여도 티가 안 나게 ──────────────────────────
# 16초 뒤로 흘러넘친 잔향을 머리에 그대로 더한다. 그래야 한 바퀴 돌 때
# 소리가 뚝 끊겼다가 다시 시작하지 않는다.
loop_n = int(DUR * SR)
for i in range(N - loop_n):
    buf[i] += buf[loop_n + i]
buf = buf[:loop_n]

# ── 노멀라이즈 + 쓰기 ─────────────────────────────────
peak = max(abs(v) for v in buf) or 1.0
gain = 0.72 / peak                       # 대화 밑에 깔리는 소리라 여유를 둔다
pcm = array.array('h', (max(-32767, min(32767, int(v * gain * 32767))) for v in buf))

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'null-1.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'{out}  {os.path.getsize(out)/1024:.0f}KB  {DUR:.0f}초  {SR}Hz 모노')
