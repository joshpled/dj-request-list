import { NextResponse } from 'next/server';
import { getAdminData } from '@/lib/data';
import { requireAdmin } from '@/lib/db';

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Locked.' }, { status: 401 });
  return NextResponse.json(await getAdminData(), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

