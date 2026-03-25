import { NextResponse } from 'next/server';
import { pollFeeds } from '@/lib/rss';
import { runPipeline } from '@/lib/agent';

export const maxDuration = 300;

export async function POST(req: Request) {
  // Optional auth check
  const { password, runAgent } = await req.json().catch(() => ({}));
  if (process.env.ADMIN_PASSWORD && password !== process.env.ADMIN_PASSWORD) {
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
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// GET for simple health check / manual trigger
export async function GET() {
  try {
    const { fetched, errors } = await pollFeeds();
    return NextResponse.json({ fetched, errors });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
