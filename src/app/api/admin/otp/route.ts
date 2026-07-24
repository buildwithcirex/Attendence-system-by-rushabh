import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { requireAdmin } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

const OTP_VALIDITY_SECONDS = 120;

function isValidDeviceSecret(req: NextRequest): boolean {
  const deviceSecret = process.env.OTP_DEVICE_SECRET;
  if (!deviceSecret) return false;

  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;

  const provided = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(deviceSecret);
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin && !isValidDeviceSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();

    const { data: currentOtp, error: fetchError } = await supabase
      .from('otps')
      .select('*')
      .eq('used', false)
      .gte('expires_at', now.toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch OTP' }, { status: 500 });
    }

    if (currentOtp) {
      return NextResponse.json({ success: true, code: currentOtp.code, expires_at: currentOtp.expires_at });
    }

    const code = `${Math.floor(Math.random() * 1000000)}`.padStart(6, '0');
    const expires_at = new Date(now.getTime() + OTP_VALIDITY_SECONDS * 1000).toISOString();

    await supabase.from('otps').update({ used: true }).eq('used', false);

    const { data: newOtp, error: insertError } = await supabase
      .from('otps')
      .insert({ code, expires_at, used: false })
      .select('*')
      .single();

    if (insertError || !newOtp) {
      return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 });
    }

    return NextResponse.json({ success: true, code: newOtp.code, expires_at: newOtp.expires_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
