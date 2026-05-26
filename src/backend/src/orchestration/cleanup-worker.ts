/**
 * Orchestration Cleanup Worker
 *
 * Periodically scans for plans that have been stuck in 'executing' or 'spawning'
 * for too long, cancels them, and cleans up their war room channels.
 */

import { db } from '../db/index.js';
import { orchestrationPlans, orchestrationTasks } from '../db/schema.js';
import { eq, and, lt } from 'drizzle-orm';
import { store } from '../db/store.js';
import { orchestratorEngine } from './engine.js';

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class CleanupWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('🧹 Orchestration cleanup worker started');
    this.tick();
    this.timer = setInterval(() => this.tick(), CLEANUP_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('🧹 Orchestration cleanup worker stopped');
  }

  private async tick(): Promise<void> {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

    try {
      // Find plans stuck in 'executing' or 'spawning' for >30 minutes
      const stuckPlans = await db.select()
        .from(orchestrationPlans)
        .where(
          and(
            eq(orchestrationPlans.status, 'executing'),
            lt(orchestrationPlans.startedAt, cutoff)
          )
        );

      for (const plan of stuckPlans) {
        console.warn(`🧹 Cancelling stuck plan ${plan.id} (started ${plan.startedAt?.toISOString()})`);

        // Cancel pending tasks
        await db.update(orchestrationTasks)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(orchestrationTasks.planId, plan.id),
              eq(orchestrationTasks.status, 'pending')
            )
          );

        // Mark plan as failed
        await db.update(orchestrationPlans)
          .set({
            status: 'failed',
            result: 'Cancelled by cleanup worker: plan exceeded 30-minute execution limit',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orchestrationPlans.id, plan.id));

        // Clean up war room channel
        if (plan.channelId) {
          try {
            await store.deleteChannel(plan.channelId);
            console.log(`🧹 Deleted abandoned war room ${plan.channelId}`);
          } catch (err) {
            console.warn(`⚠️ Failed to delete war room ${plan.channelId}:`, err);
          }
        }
      }

      // Also clean up 'spawning' plans that never started
      const stuckSpawning = await db.select()
        .from(orchestrationPlans)
        .where(
          and(
            eq(orchestrationPlans.status, 'spawning'),
            lt(orchestrationPlans.updatedAt, cutoff)
          )
        );

      for (const plan of stuckSpawning) {
        console.warn(`🧹 Cancelling stuck spawning plan ${plan.id}`);

        await db.update(orchestrationPlans)
          .set({
            status: 'failed',
            result: 'Cancelled by cleanup worker: plan stuck in spawning for >30 minutes',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orchestrationPlans.id, plan.id));

        if (plan.channelId) {
          try {
            await store.deleteChannel(plan.channelId);
          } catch (err) {
            console.warn(`⚠️ Failed to delete war room ${plan.channelId}:`, err);
          }
        }
      }

      if (stuckPlans.length > 0 || stuckSpawning.length > 0) {
        console.log(`🧹 Cleanup complete: ${stuckPlans.length} stuck executing + ${stuckSpawning.length} stuck spawning plans cleaned up`);
      }
    } catch (err) {
      console.error('❌ Cleanup worker error:', err);
    }
  }
}

export const cleanupWorker = new CleanupWorker();
