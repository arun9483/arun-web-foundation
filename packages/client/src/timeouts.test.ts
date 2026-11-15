import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, positiveMs, TimeoutError, withTimeout } from './timeouts.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('withTimeout', () => {
  it('rejects with a TimeoutError when the promise is too slow', async () => {
    vi.useFakeTimers();
    const slow = withTimeout(new Promise(() => {}), 100, 'Loading a page');
    vi.advanceTimersByTime(100);
    await expect(slow).rejects.toBeInstanceOf(TimeoutError);
  });

  it('passes a fast result through', async () => {
    await expect(withTimeout(Promise.resolve('page'), 100, 'Loading a page')).resolves.toBe('page');
  });
});

describe('fetchWithTimeout', () => {
  function hangingFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, { signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(signal.reason as Error);
            });
          }),
      ),
    );
  }

  it('aborts after the timeout', async () => {
    vi.useFakeTimers();
    hangingFetch();
    const call = fetchWithTimeout('/api/slow', 4000);
    vi.advanceTimersByTime(4000);
    await expect(call).rejects.toBeInstanceOf(TimeoutError);
  });

  it('aborts when the caller aborts', async () => {
    hangingFetch();
    const controller = new AbortController();
    const call = fetchWithTimeout('/api/slow', 4000, controller.signal);
    controller.abort(new Error('unmounted'));
    await expect(call).rejects.toThrow('unmounted');
  });
});

describe('positiveMs', () => {
  it.each([
    ['2500', 2500],
    [1200, 1200],
    [undefined, 5000],
    ['', 5000],
    ['0', 5000],
    ['-1', 5000],
    ['soon', 5000],
  ])('%j → %d', (value, expected) => {
    expect(positiveMs(value, 5000)).toBe(expected);
  });
});
