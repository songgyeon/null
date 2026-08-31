/* 규칙 파일(rules.ts)이 딛고 설 바닥.
   rules.ts는 scripts/data/*.js에서 그대로 만들어진다 — 웹과 앱이 같은 규칙을 쓰게
   하려면 베껴 오는 게 아니라 같은 글을 쓰게 해야 한다. 두 판으로 갈라두면
   반드시 어긋난다. 실제로 갈라져 있었고, 앱은 지도도 자리도 없는 채로 남았다.

   그 글이 딛고 있는 것은 딱 둘이다 — localStorage(43번)와 location.search(1번).
   앱에는 둘 다 없으므로 여기서 만들어 준다.

   localStorage는 동기다. 앱의 저장소(SQLite)는 비동기라 그대로는 못 맞춘다.
   그래서 켤 때 한 번 통째로 읽어 메모리에 올리고(hydrate), 그 뒤로 읽기는
   메모리에서 즉시, 쓰기는 메모리에 먼저 쓰고 저장소에는 뒤따라 쓴다.
   앱이 꺼져도 남아야 하는 값들이라 쓰기는 반드시 끝까지 간다 — 다만 화면이
   그걸 기다리지 않을 뿐이다. */
import { getAllMeta, setMeta, delMeta } from './db';

const mem = new Map<string, string>();
let installed = false;

/* 저장이 밀리면 순서가 뒤집힐 수 있다 — 같은 열쇠의 마지막 값이 이겨야 한다.
   열쇠마다 줄을 세운다. */
const queue = new Map<string, Promise<void>>();
function persist(k: string, v: string | null) {
  const prev = queue.get(k) || Promise.resolve();
  const next = prev
    .then(() => (v === null ? delMeta(k) : setMeta(k, v)))
    .catch(() => {})
    .then(() => { if (queue.get(k) === next) queue.delete(k); });
  queue.set(k, next);
}

export function installShim() {
  if (installed) return;
  installed = true;
  const g = globalThis as any;
  g.localStorage = {
    get length() { return mem.size; },
    key(i: number) { return [...mem.keys()][i] ?? null; },
    getItem(k: string) { const v = mem.get(String(k)); return v === undefined ? null : v; },
    setItem(k: string, v: any) { mem.set(String(k), String(v)); persist(String(k), String(v)); },
    removeItem(k: string) { mem.delete(String(k)); persist(String(k), null); },
    clear() { for (const k of [...mem.keys()]) persist(k, null); mem.clear(); },
  };
  /* 웹은 주소에 ?demo=1을 붙여 각본으로 굳힌다. 앱에는 주소창이 없다 —
     빈 채로 둔다. 앱에서 각본으로 넘어가는 길은 실패했을 때뿐이다. */
  if (!g.location) g.location = { search: '' };
}

/* 켤 때 한 번. 이걸 안 부르면 규칙이 전부 「저장된 게 없다」로 읽는다 —
   이름도 가방도 다녀온 자리도 없는 첫날처럼 보인다. */
export async function hydrateShim() {
  installShim();
  const rows = await getAllMeta();
  for (const [k, v] of rows) mem.set(k, v);
}

/* 저장소를 비운 뒤(리스타트) 메모리도 같이 비운다 — 안 비우면 지운 값이
   화면에 그대로 남아 있다가 다음 저장 때 도로 써진다. 웹에서 겪은 일이다. */
export function resetShim() { mem.clear(); }

installShim();
