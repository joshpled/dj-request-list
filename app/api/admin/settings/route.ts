import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/json';
import { updateSettings } from '@/lib/data';
import { requireAdmin } from '@/lib/db';
import { isSameOrigin } from '@/lib/security';

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Locked.' }, { status: 401 });
  const result = await updateSettings(await readJsonObject(request));
  return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : 400 });
}
