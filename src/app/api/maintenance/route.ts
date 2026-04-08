import { NextResponse } from 'next/server';
import { isMaintenanceEnabled, setMaintenanceEnabled } from '@/lib/maintenance';

function isAuthorized(password: string | undefined): boolean {
  const expected = (process.env.ADMIN_PASSWORD || '').trim();
  const provided = String(password || '').trim();
  return !!expected && provided === expected;
}

export async function GET(req: Request) {
  const password = req.headers.get('x-admin-password') || undefined;
  if (!isAuthorized(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ enabled: isMaintenanceEnabled() });
}

export async function POST(req: Request) {
  const { password, enabled } = await req.json().catch(() => ({}));
  if (!isAuthorized(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload: "enabled" must be boolean.' }, { status: 400 });
  }

  setMaintenanceEnabled(enabled);
  return NextResponse.json({ enabled: isMaintenanceEnabled() });
}
