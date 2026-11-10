/** Thrown for failures that retrying cannot fix (bad request, auth, missing config). */
export class NonRetryableError extends Error {
  readonly nonRetryable = true;
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

export class RetryableError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'RetryableError';
  }
}

export function errorForStatus(status: number, message: string): Error {
  if (status === 408 || status === 429 || status >= 500) return new RetryableError(message, status);
  return new NonRetryableError(message, status);
}
