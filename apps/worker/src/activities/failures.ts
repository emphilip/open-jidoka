import { ApplicationFailure } from '@temporalio/common';

/** Maps integration errors onto Temporal failures so the retry policy only retries transient errors. */
export async function asActivity<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as Error & { nonRetryable?: boolean };
    if (e?.nonRetryable) throw ApplicationFailure.nonRetryable(e.message, e.name);
    throw err;
  }
}

export function fail(message: string, type = 'ConfigurationError'): never {
  throw ApplicationFailure.nonRetryable(message, type);
}
