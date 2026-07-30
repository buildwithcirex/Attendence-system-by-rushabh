import { NextResponse } from 'next/server';
import { getSession } from '@/utils/session';

// Sessions have no auto-logout — they stay open until the member checks out (or a
// later same-day login resumes, and a prior-day login auto-closes, them). This
// endpoint just reports the current session and the server clock for skew correction.
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true, session, serverNow: Date.now() });
  } catch (err) {
    console.error('Session status error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
