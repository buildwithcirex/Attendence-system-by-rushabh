import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone_number, pnr_number, branch_id, year_id } = await req.json();

    if (!name || !email || !phone_number || !pnr_number || !branch_id || !year_id) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!email.endsWith('@kccemsr.edu.in')) {
      return NextResponse.json({ error: 'Registration is restricted to @kccemsr.edu.in emails only.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existingUser } = await supabase
      .from('members')
      .select('id')
      .or(`email.eq.${email},pnr_number.eq.${pnr_number}`)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'This email or PNR is already registered.' }, { status: 409 });
    }

    const { data: defaultPosition, error: positionError } = await supabase
      .from('positions')
      .select('id')
      .eq('name', 'Member')
      .single();

    if (positionError || !defaultPosition) {
      return NextResponse.json({ error: 'Failed to determine default position.' }, { status: 500 });
    }

    const { error: insertError } = await supabase
      .from('members')
      .insert({
        name,
        email,
        phone_number,
        pnr_number,
        branch_id,
        year_id,
        position_id: defaultPosition.id,
        status: 'pending',
      });

    if (insertError) {
      console.error('Registration Error:', insertError);
      return NextResponse.json({ error: 'Failed to register account.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
