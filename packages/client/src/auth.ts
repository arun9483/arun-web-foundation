import { fetchWithTimeout } from './timeouts.js';

export interface AuthOptions {
  /** The server's login base path (`authPaths.base` in `@arun-dev/server`). Default `/auth`. */
  basePath?: string;
  /** Route names under the base, as on the server. Defaults `login`, `refresh`, `logout`. */
  routes?: { login?: string; refresh?: string; logout?: string };
  /**
   * The same prefix as the server's `cookiePrefix`. Names the refresh lock (`<prefix>-auth-refresh`),
   * the tab channel (`<prefix>-auth`) and the login marker (`<meta name="<prefix>-login">`).
   * Default `shop`.
   */
  prefix?: string;
  /** How long an API call may take. Default 4000 ms. */
  apiTimeoutMs?: number;
}

export interface Auth {
  /** The login routes' full paths; `logout` is the action of the logout form (POST). */
  urls: { login: string; refresh: string; logout: string };
  /** The `BroadcastChannel` name the server's logged-out page posts to; tabs listen on it. */
  channel: string;
  /** The Web Locks name every tab refreshes under. */
  lockName: string;
  /** Where this page goes to log in, coming back to the same address. */
  loginUrl: () => string;
  goToLogin: () => void;
  /** True when the server marked the page with `<meta name="<prefix>-login">` (login is on). */
  loginIsOn: () => boolean;
  /** The status of `url` without its body, or 0 when it does not answer in time. */
  headStatus: (url: string) => Promise<number>;
  /**
   * After a `401` for `url` that cannot be retried as a call (e.g. a script): under the shared lock,
   * check again (another tab may have refreshed), then refresh once. `unavailable` when login cannot
   * be checked right now (`503`): going to login would only reach an IdP that is down.
   */
  refreshFor: (url: string) => Promise<'logged-in' | 'login' | 'unavailable'>;
  /**
   * An API call with login handled. A `401` means the access token has expired: under the shared
   * lock, retry first (another tab may have refreshed, and cookies are shared by every tab), then
   * refresh once and retry. If the user still is not logged in, go to login. If login cannot be
   * checked right now (refresh answers `503`, e.g. the IdP is down), return that answer, so the page
   * says it could not load, instead of sending the user to an IdP that is down. With login off no
   * call is ever a `401`, so this is a plain call.
   */
  apiFetch: (url: string, signal?: AbortSignal) => Promise<Response>;
}

const NAME = /^[A-Za-z0-9_-]+$/;

/**
 * The client side of the server's login (`@arun-dev/server/auth`), with matching names. Its functions
 * use no `this`, so they can be taken apart: `const { apiFetch } = createAuth()`.
 */
export function createAuth({
  basePath = '/auth',
  routes = {},
  prefix = 'shop',
  apiTimeoutMs = 4000,
}: AuthOptions = {}): Auth {
  if (!NAME.test(prefix)) throw new Error(`prefix must be letters, digits, _ or -: ${prefix}`);
  const urls = {
    login: `${basePath}/${routes.login ?? 'login'}`,
    refresh: `${basePath}/${routes.refresh ?? 'refresh'}`,
    logout: `${basePath}/${routes.logout ?? 'logout'}`,
  };
  const lockName = `${prefix}-auth-refresh`;

  // Without the Web Locks API, refreshes are still serialised within this page.
  let pageQueue: Promise<unknown> = Promise.resolve();
  function underRefreshLock<T>(work: () => Promise<T>): Promise<T> {
    if ('locks' in navigator) return navigator.locks.request(lockName, work);
    const run = pageQueue.then(work, work);
    pageQueue = run.catch(() => undefined);
    return run;
  }

  const refresh = () => fetch(urls.refresh, { method: 'POST' });
  const call = (url: string, signal?: AbortSignal) => fetchWithTimeout(url, apiTimeoutMs, signal);

  function loginUrl(): string {
    const here = window.location.pathname + window.location.search;
    return `${urls.login}?returnTo=${encodeURIComponent(here)}`;
  }

  function goToLogin(): void {
    window.location.assign(loginUrl());
  }

  async function headStatus(url: string): Promise<number> {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(apiTimeoutMs),
      });
      return res.status;
    } catch {
      return 0;
    }
  }

  return {
    urls,
    channel: `${prefix}-auth`,
    lockName,
    loginUrl,
    goToLogin,
    loginIsOn: () => document.querySelector(`meta[name="${prefix}-login"]`) !== null,
    headStatus,
    refreshFor: (url) =>
      underRefreshLock(async () => {
        if ((await headStatus(url)) !== 401) return 'logged-in';
        const refreshed = await refresh();
        if (refreshed.ok) return 'logged-in';
        return refreshed.status === 401 ? 'login' : 'unavailable';
      }),
    apiFetch: async (url, signal) => {
      const first = await call(url, signal);
      if (first.status !== 401) return first;
      const res = await underRefreshLock(async () => {
        const retry = await call(url, signal);
        if (retry.status !== 401) return retry;
        const refreshed = await refresh();
        if (refreshed.ok) return call(url, signal);
        return refreshed.status === 401 ? retry : refreshed;
      });
      if (res.status === 401) goToLogin();
      return res;
    },
  };
}
