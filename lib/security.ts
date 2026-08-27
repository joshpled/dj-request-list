const encoder = new TextEncoder();
const PIN_HASH_ITERATIONS = 100_000;

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string, salt = randomToken(18)) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: PIN_HASH_ITERATIONS },
    material,
    256,
  );
  return { salt, hash: toBase64Url(new Uint8Array(bits)) };
}

export function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export async function createAdminSession(secret: string, pinVersion: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const payload = `${pinVersion}.${expiresAt}.${randomToken(12)}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyAdminSession(token: string | undefined, secret: string, pinVersion: number) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [version, expiration, nonce, signature] = parts;
  if (Number(version) !== pinVersion || Number(expiration) <= Math.floor(Date.now() / 1000)) return false;
  const payload = `${version}.${expiration}.${nonce}`;
  return safeEqual(signature, await hmac(secret, payload));
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const item of cookieHeader.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function sessionCookie(request: Request, token: string, maxAge = 60 * 60 * 12) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `dj_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export function deviceCookie(request: Request, deviceId: string) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `dj_request_device=${encodeURIComponent(deviceId)}; SameSite=Lax; Path=/; Max-Age=31536000${secure}`;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function clientKey(request: Request) {
  const address =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'local';
  const agent = request.headers.get('user-agent') ?? 'unknown';
  return sha256(`${address}|${agent}`);
}
