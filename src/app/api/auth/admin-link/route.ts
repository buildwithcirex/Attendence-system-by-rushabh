import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseAuth } from '@/utils/supabase';

const ALLOWED_DOMAIN = '@kccemsr.edu.in';

// Sends a Supabase magic-link email, but only to an approved admin member.
// Always responds with the same generic success so callers can't enumerate
// which addresses belong to admins.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.json(
        { error: `Enter a valid ${ALLOWED_DOMAIN} email.` },
        { status: 400 },
      );
    }

    // Match case-insensitively so the link is sent regardless of how the
    // admin typed their email vs. how it is stored.
    const supabase = getSupabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, role, status')
      .ilike('email', email)
      .is('deleted_at', null)
      .maybeSingle();

    const isEligibleAdmin =
      !memberError && member?.role === 'admin' && member?.status === 'approved';

    if (isEligibleAdmin) {
      const redirectTo = new URL('/api/auth/admin-callback', req.nextUrl.origin).toString();
      const { error: otpError } = await getSupabaseAuth().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (otpError) {
        // Log server-side; still return generic success to the caller.
        console.error('Admin magic-link send failed:', otpError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If that email belongs to an admin, a login link is on its way.',
    });
  } catch (err) {
    console.error('Admin link request error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
