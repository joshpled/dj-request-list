import { NextResponse } from 'next/server';
import { markRequestPlayed, removeSongRequest } from '@/lib/data';
import { requireAdmin } from '@/lib/db';
import { isSameOrigin } from '@/lib/security';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Locked.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await markRequestPlayed(id))) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Locked.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await removeSongRequest(id))) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
