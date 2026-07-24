import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

const OPTION_TABLES = ['branches', 'years', 'positions'] as const;
type OptionTable = (typeof OPTION_TABLES)[number];

function isOptionTable(value: unknown): value is OptionTable {
  return typeof value === 'string' && (OPTION_TABLES as readonly string[]).includes(value);
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const [branches, years, positions] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('years').select('*').order('name'),
      supabase.from('positions').select('*').order('name'),
    ]);

    if (branches.error || years.error || positions.error) {
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      branches: branches.data,
      years: years.data,
      positions: positions.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const { type, name } = await req.json();

    if (!isOptionTable(type) || !name) {
      return NextResponse.json({ error: 'Missing or invalid type/name' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(type).insert({ name });

    if (error) {
      return NextResponse.json({ error: `Failed to create ${type} entry` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const { type, id, is_active } = await req.json();

    if (!isOptionTable(type) || !id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Missing or invalid type/id/is_active' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(type).update({ is_active }).eq('id', id);

    if (error) {
      return NextResponse.json({ error: `Failed to update ${type} entry` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
