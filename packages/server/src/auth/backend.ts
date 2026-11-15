import type { RequestHandler, Response } from 'express';
import { HttpError } from '../http/problem.js';
import { TtlCache } from './cache.js';
import { IdpUnavailableError, type IdpAdapter, type IdpUser } from './adapter.js';
import type { Idp } from './metadata.js';
import { bearerToken, checkAccessToken } from './token.js';
import { newrelic } from '../newrelic.js';

export interface LoggedInUser {
  sub: string;
  sid: string;
  user: IdpUser;
  /** The user's roles on `rolesClient` only. */
  roles: string[];
}

export interface BackendUserOptions {
  idp: () => Promise<Idp>;
  adapter: IdpAdapter;
  /** This backend's client at the IdP, e.g. `catalog-backend`: it must be in the token's `aud`. */
  audience: string;
  /** The client whose roles the user holds here. Default: `audience`. */
  rolesClient?: string;
  /** A user with no role on `rolesClient` gets `403`. Default true. */
  requireRole?: boolean;
  /** How long the IdP's answer for one session is reused. */
  cacheMs?: number;
  /** The `403` detail for a user with no role. Default `No role`. */
  noRoleMessage?: string;
}

/** Problems from the auth checks are never cached by anyone. */
function refuse(res: Response, error: unknown): never {
  res.set('Cache-Control', 'no-store');
  if (error instanceof IdpUnavailableError)
    throw new HttpError(503, 'The identity provider is unavailable');
  throw error;
}

/**
 * For a backend: the request must carry the user's lightweight access token as its bearer.
 * Checks it locally, then asks the IdP, with this backend's own service access token, whether the
 * session is still live, the user is enabled, and which roles they hold on `rolesClient`. The answer
 * is reused per session for `cacheMs`. `401` for no valid token, an ended session or a disabled
 * user; `403` for no role (unless `requireRole` is false); `503` when the IdP cannot answer. The token is never sent on.
 */
export function requireUser({
  idp,
  adapter,
  audience,
  rolesClient = audience,
  requireRole = true,
  cacheMs = 15_000,
  noRoleMessage = 'No role',
}: BackendUserOptions): RequestHandler {
  const answers = new TtlCache<{ active: boolean; user: IdpUser | undefined; roles: string[] }>(
    cacheMs,
  );

  return async (req, res, next) => {
    try {
      const token = bearerToken(req.get('authorization'));
      if (!token) throw new HttpError(401, 'Login required');
      const { settings, keys } = await idp();
      const { sub, sid } = await checkAccessToken(token, {
        keys,
        issuer: settings.issuer,
        audience,
        isAccessToken: adapter.isAccessToken,
      });
      const { active, user, roles } = await answers.get(`${sub} ${sid}`, async () => {
        const [active, user, roles] = await Promise.all([
          adapter.isSessionActive(sub, sid),
          adapter.getUser(sub),
          adapter.getClientRoles(sub, rolesClient),
        ]);
        return { active, user, roles };
      });
      if (!active || !user?.enabled) throw new HttpError(401, 'The session has ended');
      newrelic?.setUserID(sub);
      if (requireRole && roles.length === 0) throw new HttpError(403, noRoleMessage);
      const loggedIn: LoggedInUser = { sub, sid, user, roles };
      res.locals.user = loggedIn;
      next();
    } catch (error) {
      refuse(res, error);
    }
  };
}

export function loggedInUser(res: Response): LoggedInUser {
  const user = res.locals.user as LoggedInUser | undefined;
  if (!user) throw new HttpError(401, 'Login required');
  return user;
}

/**
 * `GET /me`: the user with OpenID Connect field names and their roles here. Never a token, `sid`,
 * another client's roles or raw IdP attributes. It is also the FES's gate.
 */
export const meHandler: RequestHandler = (_req, res) => {
  const { user, roles } = loggedInUser(res);
  const fields = Object.fromEntries(Object.entries(user).filter(([name]) => name !== 'enabled'));
  res
    .set('Cache-Control', 'no-store')
    .set('Vary', 'Authorization')
    .json({ ...fields, roles });
};
