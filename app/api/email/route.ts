import { NextResponse } from 'next/server';
import { sendEmail } from '../../../lib/email';
import { validatePayload } from '../../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = validatePayload(body);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    console.log(
      `[email] sending items=${payload.items.length} shortLen=${payload.shortDesc.length} longLen=${payload.longDesc.length}`
    );
    await sendEmail(payload);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send failed';
    console.error('[email] failed:', msg);
    const isConfigError = msg === 'Server is not configured';
    return NextResponse.json(
      { ok: false, error: isConfigError ? msg : 'Email send failed' },
      { status: 500 }
    );
  }
}
