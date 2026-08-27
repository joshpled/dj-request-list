import { NextResponse } from 'next/server';
import { setRequestStatus } from '@/lib/data';
import { requireAdmin } from '@/lib/db';
import { isSameOrigin } from '@/lib/security';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Locked.' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (!(await setRequestStatus(id, body.status))) return NextResponse.json({ error: 'Invalid request or status.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

