import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function GET() {
    revalidatePath('/');              // re-generate the homepage on next request
    return NextResponse.json({ ok: true, revalidated: '/', at: new Date().toISOString() });
}
