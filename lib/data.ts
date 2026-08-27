import { getD1, getSettings, initializeDb, type RequestStatus, type SongRequest } from './db';
import { clientKey, hashPin, randomToken, safeEqual } from './security';

const statuses: RequestStatus[] = ['New', 'Approved', 'Played', 'Declined'];

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function normalize(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function getPublicEvent(token: string, deviceId: string) {
  const settings = await initializeDb();
  if (!safeEqual(settings.guest_token, token)) return null;
  const countRow = await getD1()
    .prepare('SELECT COUNT(*) AS count FROM song_requests WHERE device_id = ?')
    .bind(deviceId)
    .first<{ count: number }>();
  const now = Date.now();
  return {
    eventName: settings.event_name,
    requestLimit: settings.request_limit,
    closingTime: settings.closing_time,
    requestCount: Number(countRow?.count ?? 0),
    isOpen: !settings.closing_time || new Date(settings.closing_time).getTime() > now,
  };
}

type RequestInput = {
  song?: unknown;
  artist?: unknown;
  guest?: unknown;
  note?: unknown;
  website?: unknown;
};

export async function submitSongRequest(token: string, deviceId: string, input: RequestInput) {
  const settings = await initializeDb();
  if (!safeEqual(settings.guest_token, token)) return { ok: false as const, status: 404, error: 'Event not found.' };
  if (clean(input.website, 200)) return { ok: false as const, status: 400, error: 'Request could not be submitted.' };

  const song = clean(input.song, 120);
  const artist = clean(input.artist, 120);
  const guest = clean(input.guest, 80);
  const note = clean(input.note, 120);
  if (song.length < 2 || artist.length < 2) {
    return { ok: false as const, status: 400, error: 'Add both a song title and artist.' };
  }
  if (settings.closing_time && new Date(settings.closing_time).getTime() <= Date.now()) {
    return { ok: false as const, status: 423, error: 'The request line is closed for tonight.' };
  }

  const db = getD1();
  const countRow = await db
    .prepare('SELECT COUNT(*) AS count FROM song_requests WHERE device_id = ?')
    .bind(deviceId)
    .first<{ count: number }>();
  const currentCount = Number(countRow?.count ?? 0);
  if (currentCount >= settings.request_limit) {
    return { ok: false as const, status: 429, error: `This device has reached the ${settings.request_limit}-request limit.` };
  }

  const last = await db
    .prepare('SELECT created_at FROM song_requests WHERE device_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(deviceId)
    .first<{ created_at: string }>();
  if (last && Date.now() - new Date(last.created_at).getTime() < 12_000) {
    return { ok: false as const, status: 429, error: 'Give the DJ booth a few seconds before sending another request.' };
  }

  const normalizedSong = normalize(song);
  const normalizedArtist = normalize(artist);
  const sameDeviceDuplicate = await db.prepare(`SELECT id FROM song_requests
    WHERE device_id = ? AND normalized_song = ? AND normalized_artist = ? LIMIT 1`)
    .bind(deviceId, normalizedSong, normalizedArtist)
    .first();
  if (sameDeviceDuplicate) {
    return { ok: false as const, status: 409, error: 'You already sent this song to the DJ booth.' };
  }

  const recentCutoff = new Date(Date.now() - 90_000).toISOString();
  const recentDuplicate = await db.prepare(`SELECT id FROM song_requests
    WHERE normalized_song = ? AND normalized_artist = ? AND created_at >= ? LIMIT 1`)
    .bind(normalizedSong, normalizedArtist, recentCutoff)
    .first();
  if (recentDuplicate) {
    return { ok: false as const, status: 409, error: 'That song was just requested. The DJ has it on the list.' };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO song_requests
    (id, song_title, artist, guest_name, note, status, device_id, normalized_song, normalized_artist, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`)
    .bind(id, song, artist, guest || null, note || null, deviceId, normalizedSong, normalizedArtist, now, now)
    .run();
  return { ok: true as const, requestId: id, requestCount: currentCount + 1, requestLimit: settings.request_limit };
}

export async function getAdminData() {
  const settings = await getSettings();
  const result = await getD1().prepare(`SELECT id, song_title, artist, guest_name, note, status, device_id, created_at, updated_at
    FROM song_requests ORDER BY created_at DESC`).all<SongRequest>();
  return {
    settings: {
      eventName: settings.event_name,
      requestLimit: settings.request_limit,
      closingTime: settings.closing_time,
      guestToken: settings.guest_token,
      pinVersion: settings.pin_version,
    },
    requests: result.results,
  };
}

export async function setRequestStatus(id: string, status: unknown) {
  if (typeof status !== 'string' || !statuses.includes(status as RequestStatus)) return false;
  const result = await getD1().prepare('UPDATE song_requests SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, new Date().toISOString(), id)
    .run();
  return Boolean(result.meta.changes);
}

export async function updateSettings(input: Record<string, unknown>) {
  const eventName = clean(input.eventName, 100);
  const requestLimit = Number(input.requestLimit);
  const rawClosing = clean(input.closingTime, 40);
  const closingTime = rawClosing && !Number.isNaN(new Date(rawClosing).getTime()) ? new Date(rawClosing).toISOString() : null;
  if (!eventName || !Number.isInteger(requestLimit) || requestLimit < 1 || requestLimit > 25) {
    return { ok: false as const, error: 'Check the event name and request limit.' };
  }
  await getD1().prepare(`UPDATE event_settings
    SET event_name = ?, request_limit = ?, closing_time = ?, updated_at = ? WHERE id = 1`)
    .bind(eventName, requestLimit, closingTime, new Date().toISOString())
    .run();
  return { ok: true as const };
}

export async function verifyAdminPin(pin: string, request: Request) {
  const settings = await getSettings();
  const key = await clientKey(request);
  const db = getD1();
  const attempt = await db.prepare('SELECT attempts, blocked_until FROM admin_login_attempts WHERE client_key = ?')
    .bind(key)
    .first<{ attempts: number; blocked_until: string | null }>();
  if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
    return { ok: false as const, status: 429, error: 'Too many attempts. Try again in 15 minutes.' };
  }

  const candidate = await hashPin(pin, settings.admin_pin_salt);
  if (!safeEqual(candidate.hash, settings.admin_pin_hash)) {
    const attempts = Number(attempt?.attempts ?? 0) + 1;
    const blockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await db.prepare(`INSERT INTO admin_login_attempts (client_key, attempts, blocked_until, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(client_key) DO UPDATE SET attempts = excluded.attempts, blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`)
      .bind(key, attempts, blockedUntil, new Date().toISOString())
      .run();
    return { ok: false as const, status: 401, error: attempts >= 5 ? 'Too many attempts. Try again in 15 minutes.' : 'Incorrect PIN.' };
  }

  await db.prepare('DELETE FROM admin_login_attempts WHERE client_key = ?').bind(key).run();
  return { ok: true as const, settings };
}

export async function changeAdminPin(currentPin: unknown, newPin: unknown) {
  const current = clean(currentPin, 24);
  const next = clean(newPin, 24);
  if (!/^\d{4,12}$/.test(next)) return { ok: false as const, error: 'Use a PIN with 4–12 digits.' };
  const settings = await getSettings();
  const candidate = await hashPin(current, settings.admin_pin_salt);
  if (!safeEqual(candidate.hash, settings.admin_pin_hash)) return { ok: false as const, error: 'Current PIN is incorrect.' };
  if (current === next) return { ok: false as const, error: 'Choose a different PIN.' };
  const updated = await hashPin(next);
  await getD1().prepare(`UPDATE event_settings
    SET admin_pin_hash = ?, admin_pin_salt = ?, pin_version = pin_version + 1, session_secret = ?, updated_at = ? WHERE id = 1`)
    .bind(updated.hash, updated.salt, randomToken(32), new Date().toISOString())
    .run();
  return { ok: true as const };
}
