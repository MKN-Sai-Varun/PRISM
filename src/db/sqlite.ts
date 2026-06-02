import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

export async function initDB(): Promise<void> {
  // Return existing promise if init is already in progress — prevents concurrent calls
  if (initPromise) return initPromise;
  if (db) return;

  initPromise = (async () => {
    db = await SQLite.openDatabaseAsync('prism.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        employee_id  TEXT NOT NULL,
        rgb_embedding TEXT NOT NULL,
        geo_vector   TEXT NOT NULL,
        enrolled_at  TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attendance (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        user_name  TEXT NOT NULL,
        timestamp  TEXT NOT NULL,
        confidence REAL NOT NULL,
        channel    TEXT NOT NULL,
        synced     INTEGER DEFAULT 0
      );
    `);
  })();

  await initPromise;
}

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) await initDB();
  return db!;
}

export async function enrollUser(
  id:           string,
  name:         string,
  employeeId:   string,
  rgbEmbedding: number[],
  geoVector:    number[],
): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT OR REPLACE INTO users (id, name, employee_id, rgb_embedding, geo_vector, enrolled_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, employeeId, JSON.stringify(rgbEmbedding), JSON.stringify(geoVector), new Date().toISOString()],
  );
}

export async function getAllUsers(): Promise<any[]> {
  const database = await getDB();
  const rows = await database.getAllAsync('SELECT * FROM users');
  return (rows as any[]).map(u => ({
    ...u,
    rgb_embedding: JSON.parse(u.rgb_embedding),
    geo_vector:    JSON.parse(u.geo_vector),
  }));
}

export async function logAttendance(
  id:         string,
  userId:     string,
  userName:   string,
  confidence: number,
  channel:    string,
): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO attendance (id, user_id, user_name, timestamp, confidence, channel, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [id, userId, userName, new Date().toISOString(), confidence, channel],
  );
}

export async function getUnsyncedLogs(): Promise<any[]> {
  const database = await getDB();
  return await database.getAllAsync('SELECT * FROM attendance WHERE synced = 0');
}

export async function markSynced(ids: string[]): Promise<void> {
  const database = await getDB();
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(
    `UPDATE attendance SET synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}
