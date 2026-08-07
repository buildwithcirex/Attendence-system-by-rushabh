import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';

const PURGE_AFTER_DAYS = 7;
const TABLES = ['sessions', 'tasks', 'calendar_events', 'members'] as const;

// Hard-deletes rows that have sat soft-deleted (deleted_at set) for longer
// than the recovery window. Members are purged last so that any child rows
// still referencing them (not yet independently purged) don't orphan first.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const purged: Record<string, number> = {};

  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .lt('deleted_at', cutoff)
      .select('id');

    if (error) {
      return NextResponse.json({ error: `Failed to purge ${table}: ${error.message}` }, { status: 500 });
    }

    purged[table] = data?.length ?? 0;
  }

  return NextResponse.json({ purged });
}
