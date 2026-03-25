import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/agent';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (process.env.ADMIN_PASSWORD && password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const published = await runPipeline();
    return NextResponse.json({ published });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
