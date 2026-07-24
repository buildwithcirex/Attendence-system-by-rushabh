import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';
import { startAttendanceSession } from '@/utils/attendanceSession';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Missing email or otp' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. check member exists
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('email', email)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Email not registered' }, { status: 404 });
    }

    if (!member.email || !member.email.endsWith('@kccemsr.edu.in')) {
      return NextResponse.json({ error: 'Login restricted to @kccemsr.edu.in emails only.' }, { status: 403 });
    }

    if (member.status !== 'approved') {
      return NextResponse.json({ error: 'Your account is pending admin approval.' }, { status: 403 });
    }

    // 2. validate OTP
    const { data: validOtp, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('code', otp)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (otpError || !validOtp) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }

    // 3. Mark OTP as used
    await supabase
      .from('otps')
      .update({ used: true })
      .eq('id', validOtp.id);

    // 4. record the attendance session and mint the JWT cookie
    const { error: sessionError } = await startAttendanceSession(member, otp);
    if (sessionError) {
      return NextResponse.json({ error: sessionError }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
