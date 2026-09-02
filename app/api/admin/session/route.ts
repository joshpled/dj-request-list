import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/json';
import { verifyAdminPin } from '@/lib/data';
import { createAdminSession, isSameOrigin, sessionCookie } from '@/lib/security';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  const body = await readJsonObject(request);
  const pin = typeof body.pin === 'string' ? body.pin : '';
  const result = await verifyAdminPin(pin, request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const token = await createAdminSession(result.settings.session_secret, result.settings.pin_version);
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(request, token));
  return response;
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(request, '', 0));
  return response;
}
