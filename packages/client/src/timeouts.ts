/** A call or load that took longer than allowed. */
export class TimeoutError extends Error {
  override name = 'TimeoutError';
}

/**
 * `value` as a number of milliseconds when it is a positive number, otherwise `fallback`. For timeouts
 * read from build-time or runtime settings, which arrive as strings or not at all.
 */
export function positiveMs(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * `promise`, or a `TimeoutError` naming `what` once `timeoutMs` has passed. The timer runs on
 * `setTimeout`, so a test can fast-forward the clock instead of waiting.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`${what} took longer than ${timeoutMs} ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** `fetch` that is aborted with a `TimeoutError` after `timeoutMs`, or when `signal` aborts. */
export function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new TimeoutError(`${url} took longer than ${timeoutMs} ms`));
  }, timeoutMs);
  signal?.addEventListener('abort', () => {
    controller.abort(signal.reason);
  });
  return fetch(url, { signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}
