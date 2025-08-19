type JobState = {
  jobId: string;
  status: string;
  progress?: number;
  videoUrl?: string;
  updatedAt: number;
};

const store = new Map<string, JobState>();

export function upsertJobState(update: Partial<JobState> & { jobId: string }) {
  const prev = store.get(update.jobId) || { jobId: update.jobId, status: 'unknown', updatedAt: Date.now() };
  const next: JobState = {
    ...prev,
    ...update,
    updatedAt: Date.now(),
  };
  store.set(update.jobId, next);
  return next;
}

export function getJobState(jobId: string): JobState | undefined {
  return store.get(jobId);
}


