import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/json';
import { changeAdminPin } from '@/lib/data';
import { requireAdmin } from '@/lib/db';
import { isSameOrigin, sessionCookie } from '@/lib/security';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Locked.' }, { status: 401 });
  const body = await readJsonObject(request);
  const result = await changeAdminPin(body.currentPin, body.newPin);
  const response = NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : 400 });
  if (result.ok) response.headers.set('Set-Cookie', sessionCookie(request, '', 0));
  return response;
}
