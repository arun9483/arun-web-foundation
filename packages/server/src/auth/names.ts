/** Where the login routes live: one base path and each route's name under it. */
export interface AuthPaths {
  base: string;
  login: string;
  callback: string;
  refresh: string;
  resume: string;
  logout: string;
  loggedOut: string;
}

export const DEFAULT_AUTH_PATHS: AuthPaths = {
  base: '/auth',
  login: 'login',
  callback: 'callback',
  refresh: 'refresh',
  resume: 'resume',
  logout: 'logout',
  loggedOut: 'logged-out',
};

export interface AuthNameOptions {
  /** Starts every cookie name and the browser channel name. Default `shop`. */
  cookiePrefix?: string;
  /** Default `/auth` with today's route names; only the base and the names can change. */
  authPaths?: Partial<AuthPaths>;
}

export interface CookieName {
  name: string;
  path: string;
}

/** Every name and path the login uses, derived from one prefix and one base path. */
export interface AuthNames {
  /** The base path, e.g. `/auth`. */
  base: string;
  /** Each route's full path, e.g. `/auth/login`. */
  urls: Omit<AuthPaths, 'base'>;
  cookies: {
    /** The lightweight access token, not encrypted: any server checks it. `Path=/`. */
    accessToken: CookieName;
    /** The refresh token, encrypted: only the login routes receive it. `Path=<base>`. */
    refreshToken: CookieName;
    /** The ID token, encrypted: only logout receives it. `Path=<base>/<logout>`. */
    idToken: CookieName;
  };
  /** The per-attempt login cookie: only the callback receives it. `Path=<base>/<callback>`. */
  loginAttempt(state: string): CookieName;
  /** The `BroadcastChannel` that tells other tabs about logout. */
  channel: string;
}

const PREFIX = /^[A-Za-z0-9_-]+$/;
const ROUTE = /^[A-Za-z0-9._~-]+$/;

/**
 * The names and paths for `cookiePrefix` and `authPaths`; with no options, today's (`shop_at`,
 * `/auth/login`, …). The cookie paths come from the base, so the refresh and ID tokens and the login
 * attempt reach only the routes that need them.
 */
export function authNames({
  cookiePrefix = 'shop',
  authPaths = {},
}: AuthNameOptions = {}): AuthNames {
  if (!PREFIX.test(cookiePrefix))
    throw new Error(`cookiePrefix must be letters, digits, _ or -: ${cookiePrefix}`);
  const { base, ...routes } = { ...DEFAULT_AUTH_PATHS, ...authPaths };
  if (!base.startsWith('/') || base.endsWith('/') || base.includes('//'))
    throw new Error(`authPaths.base must start with / and not end with /: ${base}`);
  for (const [key, name] of Object.entries(routes)) {
    if (!ROUTE.test(name)) throw new Error(`authPaths.${key} must be one path segment: ${name}`);
  }
  const urls = Object.fromEntries(
    Object.entries(routes).map(([key, name]) => [key, `${base}/${name}`]),
  ) as AuthNames['urls'];
  return {
    base,
    urls,
    cookies: {
      accessToken: { name: `${cookiePrefix}_at`, path: '/' },
      refreshToken: { name: `${cookiePrefix}_rt`, path: base },
      idToken: { name: `${cookiePrefix}_id`, path: urls.logout },
    },
    loginAttempt: (state) => ({ name: `${cookiePrefix}_tx_${state}`, path: urls.callback }),
    channel: `${cookiePrefix}-auth`,
  };
}
