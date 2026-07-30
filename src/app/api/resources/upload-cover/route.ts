import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { COVER_BUCKET, MAX_COVER_BYTES, ALLOWED_COVER_TYPES } from '@/utils/resources';

// Uploads a single cover image to the public resource-covers bucket and returns its URL.
// Kept separate from record creation so the donate/add routes stay JSON-only.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (!(ALLOWED_COVER_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: 'Cover must be a JPEG, PNG, WebP, or GIF image.' }, { status: 400 });
    }
    if (file.size > MAX_COVER_BYTES) {
      return NextResponse.json({ error: 'Cover image must be 5 MB or smaller.' }, { status: 400 });
    }

    const ext = file.type.split('/')[1] ?? 'bin';
    const path = `${session.member_id}/${crypto.randomUUID()}.${ext}`;

    const supabase = getSupabaseAdmin();
    const { error: uploadErr } = await supabase.storage
      .from(COVER_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadErr) {
      return NextResponse.json({ error: 'Failed to upload cover image.' }, { status: 500 });
    }

    const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
