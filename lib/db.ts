import { env } from 'cloudflare:workers';
import { hashPin, randomToken } from './security';

export type RequestStatus = 'New' | 'Approved' | 'Played' | 'Declined';

export type EventSettings = {
  id: number;
  event_name: string;
  welcome_message: string;
  request_limit: number;
  closing_time: string | null;
  guest_token: string;
  admin_pin_hash: string;
  admin_pin_salt: string;
  pin_version: number;
  session_secret: string;
  updated_at: string;
};

export type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  guest_name: string | null;
  note: string | null;
  status: RequestStatus;
  device_id: string;
  created_at: string;
  updated_at: string;
};

export function getD1() {
  if (!env.DB) throw new Error('Database binding is unavailable.');
  return env.DB;
}

export async function initializeDb() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS event_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      event_name TEXT NOT NULL,
      welcome_message TEXT NOT NULL,
      request_limit INTEGER NOT NULL DEFAULT 5,
      closing_time TEXT,
      guest_token TEXT NOT NULL UNIQUE,
      admin_pin_hash TEXT NOT NULL,
      admin_pin_salt TEXT NOT NULL,
      pin_version INTEGER NOT NULL DEFAULT 1,
      session_secret TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS song_requests (
      id TEXT PRIMARY KEY,
      song_title TEXT NOT NULL,
      artist TEXT NOT NULL,
      guest_name TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Approved','Played','Declined')),
      device_id TEXT NOT NULL,
      normalized_song TEXT NOT NULL,
      normalized_artist TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_login_attempts (
      client_key TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      blocked_until TEXT,
      updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_song_requests_created_at ON song_requests(created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_song_requests_status_created ON song_requests(status, created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_song_requests_device_created ON song_requests(device_id, created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_song_requests_duplicate ON song_requests(normalized_song, normalized_artist, created_at DESC)'),
  ]);

  const current = await db.prepare('SELECT * FROM event_settings WHERE id = 1').first<EventSettings>();
  if (!current) {
    const now = new Date().toISOString();
    const pin = await hashPin(env.INITIAL_ADMIN_PIN ?? '2468');
    await db.prepare(`INSERT OR IGNORE INTO event_settings
      (id, event_name, welcome_message, request_limit, closing_time, guest_token, admin_pin_hash, admin_pin_salt, pin_version, session_secret, updated_at)
      VALUES (1, ?, ?, 5, NULL, ?, ?, ?, 1, ?, ?)`)
      .bind(
        "Joshua & Gabriel's Wedding",
        "Send a song to the DJ booth. We'll do our best to work it into the night.",
        randomToken(20),
        pin.hash,
        pin.salt,
        randomToken(32),
        now,
      )
      .run();
    await db.prepare('PRAGMA optimize').run();
  }
  return (await db.prepare('SELECT * FROM event_settings WHERE id = 1').first<EventSettings>())!;
}

export async function getSettings() {
  return initializeDb();
}

export async function requireAdmin(request: Request) {
  const { readCookie, verifyAdminSession } = await import('./security');
  const settings = await getSettings();
  const valid = await verifyAdminSession(
    readCookie(request, 'dj_admin_session'),
    settings.session_secret,
    settings.pin_version,
  );
  return valid ? settings : null;
}
