import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export type Msg = {
  id?: number;
  room: string;
  sender: string;
  text: string;
  photo?: string | null;
  track?: string | null;
  created_at: number;
};

export async function initDB() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('null.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL,
      sender TEXT NOT NULL,
      text TEXT,
      photo TEXT,
      track TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_room_time ON messages(room, created_at);
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  return db;
}

// ── meta ──
export async function getMeta(key: string): Promise<string | null> {
  const d = await initDB();
  const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  const d = await initDB();
  await d.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

export async function delMeta(key: string) {
  const d = await initDB();
  await d.runAsync('DELETE FROM meta WHERE key = ?', key);
}

/* 통째로 읽는다. 규칙 파일(rules.ts)이 쓰는 localStorage는 동기라, 켤 때
   한 번 여기서 다 읽어 메모리에 올려두고 그 뒤로는 메모리에서 읽는다. */
export async function getAllMeta(): Promise<[string, string][]> {
  const d = await initDB();
  const rows = await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta');
  return rows.map(r => [r.key, r.value] as [string, string]);
}

// ── messages ──
export async function insertMsg(m: Msg) {
  const d = await initDB();
  const res = await d.runAsync(
    'INSERT INTO messages (room, sender, text, photo, track, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    m.room, m.sender, m.text ?? '', m.photo ?? null, m.track ?? null, m.created_at
  );
  return res.lastInsertRowId;
}

/* ── 관전 장부의 멱등 열쇠 (§8.5) ──
   장부(runAutoBatch)가 같은 말풍선을 두 번 붙이지 않으려면 「이미
   들어갔나」를 물을 수 있어야 한다. track에 장부 항목 id를 싣고 여기로
   확인한다 — 재개가 남은 것만 정확히 한 번 더 붙는 근거다. */
export async function hasMsgTrack(room: string, track: string): Promise<boolean> {
  const d = await initDB();
  const rows = await d.getAllAsync<{ id: number }>(
    'SELECT id FROM messages WHERE room = ? AND track = ? LIMIT 1', room, track);
  return rows.length > 0;
}

/* 최근 것부터 limit개를 가져와 시간순으로 되돌려 준다.
   전에는 ORDER BY ASC LIMIT 200이었다 — 200개가 넘는 순간 제일 오래된 200개가
   돌아왔다. 화면에는 옛날 대화만 남고 새 말은 안 보이고, 프롬프트에도 옛날
   것이 실렸다. .slice(-30)을 붙여봐야 오래된 200개 중 뒤쪽 30개다. */
export async function getMsgs(room: string, limit = 1000): Promise<Msg[]> {
  const d = await initDB();
  const rows = await d.getAllAsync<Msg>(
    'SELECT * FROM (SELECT * FROM messages WHERE room = ? ORDER BY created_at DESC LIMIT ?)'
    + ' ORDER BY created_at ASC', room, limit
  );
  return rows;
}

/* 이 방에서 제일 처음 한 말. D-30을 세는 기준이라 진짜 오래된 쪽이 필요하다 */
export async function getFirstMsg(room: string): Promise<Msg | null> {
  const d = await initDB();
  return await d.getFirstAsync<Msg>(
    'SELECT * FROM messages WHERE room = ? ORDER BY created_at ASC LIMIT 1', room
  );
}

export async function getLastMsg(room: string): Promise<Msg | null> {
  const d = await initDB();
  return await d.getFirstAsync<Msg>(
    'SELECT * FROM messages WHERE room = ? ORDER BY created_at DESC LIMIT 1', room
  );
}

// 방별 누적 메시지 수 — 프로필 단계 판정용
export async function countMsgs(room: string): Promise<number> {
  const d = await initDB();
  const row = await d.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM messages WHERE room = ?', room
  );
  return row?.n ?? 0;
}

// 오늘 메시지 수 — 눈치 신호용
export async function countToday(room: string): Promise<number> {
  const d = await initDB();
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const row = await d.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM messages WHERE room = ? AND created_at >= ?', room, t0.getTime()
  );
  return row?.n ?? 0;
}

// 최근 사진 — 중복 방지용
export async function recentPhotos(room: string, n = 4): Promise<string[]> {
  const d = await initDB();
  const rows = await d.getAllAsync<{ photo: string }>(
    'SELECT DISTINCT photo FROM messages WHERE room = ? AND photo IS NOT NULL ORDER BY created_at DESC LIMIT ?',
    room, n
  );
  return rows.map(r => r.photo);
}

/* ── 이야기만 비운다 ──
   웹의 nullWipeStory와 같은 일이다. 여기 meta에는 이야기 상태 말고
   접속 설정도 들어 있어서, 통째로 지우면 새로 시작할 때마다 열쇠를 다시
   넣어야 했다. 남길 것만 적는다 — 지울 것을 적으면 늘 빠뜨린다.
   한 트랜잭션으로 묶는다: 메시지만 지워지고 meta가 남으면 이름은 있는데
   대화가 없는 세계가 된다. */
export const KEEP_META = ['null_apikey', 'null_rev'];

export async function wipeStory() {
  const d = await initDB();
  const marks = KEEP_META.map(() => '?').join(',');
  await d.withTransactionAsync(async () => {
    await d.runAsync('DELETE FROM messages');
    await d.runAsync(`DELETE FROM meta WHERE key NOT IN (${marks})`, ...KEEP_META);
  });
}

/* ── 판 갈이 ──
   옛 세이브에는 옛 정사(첫 만남 자리·D-day)가 섞여 있다. 새 정사로 옮기는
   변환은 안 만든다 — 어차피 맞출 수 없고, 반쯤 맞은 세계가 제일 나쁘다.
   판 번호가 다르면 이야기만 한 번 비운다. 비운 뒤 번호를 찍으므로 다음
   실행부터는 새로 쌓인 것이 그대로 남는다. 웹(index.html)과 같은 번호다. */
export const NULL_STORY_REV = '4';

export async function wipeIfOldRevision(): Promise<boolean> {
  const at = await getMeta('null_rev');
  if (at === NULL_STORY_REV) return false;
  await wipeStory();
  await setMeta('null_rev', NULL_STORY_REV);
  return true;
}
