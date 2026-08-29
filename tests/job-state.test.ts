import { describe, expect, it } from 'vitest';
import { canClaimJob, nextJobProgress } from '@/lib/job-state';

describe('resumable generation state', () => {
  it('advances one persisted section at a time', () => {
    expect(nextJobProgress(0, 5)).toEqual({ nextStep: 1, progress: 20, completed: false });
    expect(nextJobProgress(4, 5)).toEqual({ nextStep: 5, progress: 100, completed: true });
  });

  it('allows queued and blocked jobs to resume but protects an active lease', () => {
    const now = new Date('2026-08-23T20:00:00.000Z');
    expect(canClaimJob('queued', now.toISOString(), now)).toBe(true);
    expect(canClaimJob('blocked', now.toISOString(), now)).toBe(true);
    expect(canClaimJob('running', '2026-08-23T19:59:30.000Z', now)).toBe(false);
    expect(canClaimJob('running', '2026-08-23T19:55:00.000Z', now)).toBe(true);
    expect(canClaimJob('completed', '2026-08-23T19:55:00.000Z', now)).toBe(false);
  });
});
