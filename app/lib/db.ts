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

export async function clearAll() {
  const d = await initDB();
  await d.execAsync('DELETE FROM messages; DELETE FROM meta;');
}
