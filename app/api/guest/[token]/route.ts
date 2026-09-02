import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/json';
import { getPublicEvent, submitSongRequest } from '@/lib/data';
import { deviceCookie, isSameOrigin, randomToken, readCookie } from '@/lib/security';

function getDevice(request: Request) {
  return readCookie(request, 'dj_request_device') ?? randomToken(18);
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const deviceId = getDevice(request);
  const event = await getPublicEvent(token, deviceId);
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  const response = NextResponse.json(event);
  if (!readCookie(request, 'dj_request_device')) response.headers.set('Set-Cookie', deviceCookie(request, deviceId));
  return response;
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  const { token } = await context.params;
  const deviceId = getDevice(request);
  const input = await readJsonObject(request);
  const result = await submitSongRequest(token, deviceId, input);
  const response = NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 201 : result.status });
  if (!readCookie(request, 'dj_request_device')) response.headers.set('Set-Cookie', deviceCookie(request, deviceId));
  return response;
}
