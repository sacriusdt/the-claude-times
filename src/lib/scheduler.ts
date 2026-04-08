import cron from 'node-cron';
import { pollFeeds } from './rss';
import { runPipeline } from './agent';
import { isMaintenanceEnabled } from './maintenance';

let task: cron.ScheduledTask | null = null;

export function startScheduler() {
  const schedule = process.env.CRON_SCHEDULE || '0 * * * *';

  if (task) {
    console.log('[scheduler] Already running');
    return;
  }

  console.log(`[scheduler] Starting with schedule: ${schedule}`);

  task = cron.schedule(schedule, async () => {
    console.log(`[scheduler] Tick at ${new Date().toISOString()}`);
    try {
      if (isMaintenanceEnabled()) {
        console.log('[scheduler] Maintenance mode active — skipping poll and publication');
        return;
      }

      // Step 1: Poll RSS feeds
      const { fetched, errors } = await pollFeeds();
      console.log(`[scheduler] Polled feeds: ${fetched} new items, ${errors.length} errors`);

      // Step 2: Run Jean-Claude's editorial pipeline
      if (fetched > 0) {
        const published = await runPipeline();
        console.log(`[scheduler] Published: ${published.length} article(s)`);
      } else {
        console.log('[scheduler] No new items — skipping analysis');
      }
    } catch (err) {
      console.error('[scheduler] Error:', err);
    }
  });

  console.log('[scheduler] Cron job scheduled');
}

export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
    console.log('[scheduler] Stopped');
  }
}
