import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [branchesRes, yearsRes] = await Promise.all([
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
      supabase.from('years').select('id, name').eq('is_active', true).order('name'),
    ]);

    if (branchesRes.error || yearsRes.error) {
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      branches: branchesRes.data,
      years: yearsRes.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
