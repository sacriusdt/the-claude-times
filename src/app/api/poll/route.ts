import { NextResponse } from 'next/server';
import { pollFeeds } from '@/lib/rss';
import { runPipeline, runSophiaPipeline } from '@/lib/agent';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { password, runAgent } = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fetched, errors } = await pollFeeds();
    let jcPublished: string[] = [];
    let sophiaPublished: string[] = [];

    if (runAgent && fetched > 0) {
      // Run both pipelines concurrently
      [jcPublished, sophiaPublished] = await Promise.all([
        runPipeline(),
        runSophiaPipeline(),
      ]);
    }

    return NextResponse.json({
      fetched,
      errors,
      published: [...jcPublished, ...sophiaPublished],
      byAuthor: { 'Jean-Claude': jcPublished, 'Sophia': sophiaPublished },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { fetched, errors } = await pollFeeds();
    return NextResponse.json({ fetched, errors });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
