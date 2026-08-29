export function nextJobProgress(currentStep: number, totalSteps: number) {
  const safeTotal = Math.max(1, Math.trunc(totalSteps));
  const nextStep = Math.min(safeTotal, Math.max(0, Math.trunc(currentStep)) + 1);
  return {
    nextStep,
    progress: Math.round((nextStep / safeTotal) * 100),
    completed: nextStep >= safeTotal,
  };
}

export function canClaimJob(
  status: string,
  updatedAt: string,
  now: Date,
  leaseMilliseconds = 120_000,
) {
  if (status === 'queued' || status === 'blocked') return true;
  if (status !== 'running') return false;
  const updated = new Date(updatedAt).getTime();
  return Number.isFinite(updated) && updated < now.getTime() - leaseMilliseconds;
}
