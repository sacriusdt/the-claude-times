import { NextResponse } from 'next/server';
import { pollFeeds } from '@/lib/rss';
import { runPipeline } from '@/lib/agent';
import { isMaintenanceEnabled } from '@/lib/maintenance';

export const maxDuration = 300;

export async function POST(req: Request) {
  if (isMaintenanceEnabled()) {
    return NextResponse.json({ error: 'Maintenance mode is active.' }, { status: 503 });
  }

  const { password, runAgent } = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fetched, errors } = await pollFeeds();
    let published: string[] = [];

    if (runAgent && fetched > 0) {
      published = await runPipeline();
    }

    return NextResponse.json({ fetched, errors, published });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  if (isMaintenanceEnabled()) {
    return NextResponse.json({ error: 'Maintenance mode is active.' }, { status: 503 });
  }

  try {
    const { fetched, errors } = await pollFeeds();
    return NextResponse.json({ fetched, errors });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
