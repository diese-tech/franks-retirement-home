import { NextResponse } from 'next/server';

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
}
