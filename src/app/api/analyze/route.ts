import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/agent';
import { isMaintenanceEnabled } from '@/lib/maintenance';

export const maxDuration = 300;

export async function POST(req: Request) {
  if (isMaintenanceEnabled()) {
    return NextResponse.json({ error: 'Maintenance mode is active.' }, { status: 503 });
  }

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
