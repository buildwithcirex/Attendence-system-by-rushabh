import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseAdmin, getSupabaseAuth } from '@/utils/supabase';
import { startAttendanceSession } from '@/utils/attendanceSession';

// Magic-link email links here. Supabase's email template must point to this
// route with token_hash + type, e.g.:
//   {{ .SiteURL }}/api/auth/admin-callback?token_hash={{ .TokenHash }}&type=email
const ALLOWED_TYPES: EmailOtpType[] = ['email', 'magiclink'];

function redirectToLogin(req: NextRequest, reason: string): NextResponse {
  const url = new URL('/login', req.nextUrl.origin);
  url.searchParams.set('admin_error', reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const tokenHash = req.nextUrl.searchParams.get('token_hash');
    const type = req.nextUrl.searchParams.get('type');

    if (!tokenHash || !type || !ALLOWED_TYPES.includes(type as EmailOtpType)) {
      return redirectToLogin(req, 'invalid_link');
    }

    // Verifying consumes the single-use token and confirms the recipient
    // controls the email address.
    const { data: verified, error: verifyError } = await getSupabaseAuth().auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    const email = verified?.user?.email;
    if (verifyError || !email) {
      return redirectToLogin(req, 'invalid_link');
    }

    // Email ownership proven — now enforce that it is an approved admin member.
    // Supabase lowercases the auth email, so match case-insensitively against
    // whatever casing the members row was stored with.
    const supabase = getSupabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, pnr_number, name, email, role, status')
      .ilike('email', email)
      .is('deleted_at', null)
      .maybeSingle();

    if (
      memberError ||
      !member ||
      member.role !== 'admin' ||
      member.status !== 'approved' ||
      !member.email
    ) {
      return redirectToLogin(req, 'not_admin');
    }

    const { error: sessionError } = await startAttendanceSession(
      {
        id: member.id,
        pnr_number: member.pnr_number,
        name: member.name,
        email: member.email,
        role: member.role,
      },
      'magic_link',
    );

    if (sessionError) {
      return redirectToLogin(req, 'session_failed');
    }

    return NextResponse.redirect(new URL('/admin', req.nextUrl.origin));
  } catch (err) {
    console.error('Admin callback error:', err);
    return redirectToLogin(req, 'server_error');
  }
}
