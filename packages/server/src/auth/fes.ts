import type { Request, RequestHandler, Response } from 'express';
import { HttpError } from '../http/problem.js';
import { TtlCache } from './cache.js';
import { readCookie } from './cookies.js';
import { escapeHtml } from './html.js';
import { IdpUnavailableError, type IdpAdapter } from './adapter.js';
import type { Idp } from './metadata.js';
import { authNames, type AuthNames } from './names.js';
import { checkAccessToken } from './token.js';
import { newrelic } from '../newrelic.js';

export interface FesGateOptions {
  idp: () => Promise<Idp>;
  adapter: IdpAdapter;
  /** The client that logs users in for the whole application: only its tokens are accepted. */
  loginClientId: string;
  /** This server's backend; its `/me` is the gate. */
  backendUrl: string;
  /**
   * The backend's client, e.g. `catalog-backend`. The IdP puts it in a token's `aud` only when the
   * user holds one of its roles, so a valid token without it is a `403` at once, not a `401` that the
   * client would take for an expired login.
   */
  backendAudience: string;
  backendTimeoutMs: number;
  /** How long the backend's answer for one session is reused. */
  cacheMs?: number;
  /** Cookie names and login paths; default `authNames()`. */
  names?: AuthNames;
  /** The application's name in pages, e.g. "You do not have access to the shop". Default `the shop`. */
  appName?: string;
  /** The `403` detail for an API call without access. Default `No access`. */
  noAccessMessage?: string;
}

type GateAnswer = { status: 200; me: unknown } | { status: 401 | 403 };

const DEFAULT_NAMES = authNames();

/** Where a page goes to log in, coming back to the same address. */
export function loginUrl(req: Request, names: AuthNames = DEFAULT_NAMES): string {
  return `${names.urls.login}?returnTo=${encodeURIComponent(req.originalUrl)}`;
}

/**
 * Where a page without a valid token goes first (MVP-2 verification, F9): the resume route refreshes
 * the login with the refresh token, which only the login routes receive, and comes back to the same
 * address; without a usable refresh token it goes on to log in.
 */
export function resumeUrl(req: Request, names: AuthNames = DEFAULT_NAMES): string {
  return `${names.urls.resume}?returnTo=${encodeURIComponent(req.originalUrl)}`;
}

/**
 * The plain HTML `503` a page gets when login cannot be checked (F6): a link back to `href`, the
 * page the user asked for, so they can try again; it does not reload by itself.
 */
export function tryAgainPage(res: Response, href: string): void {
  res
    .status(503)
    .set('Cache-Control', 'no-store')
    .type('html')
    .send(
      '<!doctype html><title>Try again shortly</title>' +
        '<p>Login cannot be checked right now. Try again shortly.</p>' +
        `<p><a href="${escapeHtml(href)}">Try again</a></p>`,
    );
}

/** The lightweight access token for this request's backend calls; set by the gate. */
export function userBearer(res: Response): Record<string, string> {
  const token = res.locals.accessToken as string | undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * For an FES: the access token cookie must hold a lightweight access token issued to the login
 * client. Checked locally, then the gate asks the backend's `/me` with it, reused per session for
 * `cacheMs`: `200` lets the request through, `401` and `403` are passed back, and a backend or IdP
 * that cannot answer is `503`. Pages without a valid token are sent to the resume route (refresh, else
 * log in); API calls get `401` problem+json, so the client can refresh.
 */
export function fesGate({
  idp,
  adapter,
  loginClientId,
  backendUrl,
  backendAudience,
  backendTimeoutMs,
  cacheMs = 15_000,
  names = DEFAULT_NAMES,
  appName = 'the shop',
  noAccessMessage = 'No access',
}: FesGateOptions): { page: RequestHandler; api: RequestHandler } {
  const answers = new TtlCache<GateAnswer>(cacheMs);

  async function ask(token: string): Promise<GateAnswer> {
    let res: globalThis.Response;
    try {
      res = await fetch(`${backendUrl}/me`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(backendTimeoutMs),
      });
    } catch (error) {
      throw new IdpUnavailableError(`Backend /me: ${(error as Error).message}`);
    }
    if (res.status === 200) return { status: 200, me: await res.json() };
    if (res.status === 401 || res.status === 403) return { status: res.status };
    throw new IdpUnavailableError(`Backend /me: HTTP ${res.status}`);
  }

  async function check(req: Request, res: Response): Promise<GateAnswer> {
    const token = readCookie(req, names.cookies.accessToken.name);
    if (!token) return { status: 401 };
    const { settings, keys } = await idp();
    let sub: string;
    let sid: string;
    let audience: string[];
    try {
      ({ sub, sid, audience } = await checkAccessToken(token, {
        keys,
        issuer: settings.issuer,
        authorizedParty: loginClientId,
        isAccessToken: adapter.isAccessToken,
      }));
    } catch (error) {
      if (error instanceof HttpError) return { status: 401 };
      throw error;
    }
    const answer: GateAnswer = audience.includes(backendAudience)
      ? await answers.get(`${sub} ${sid}`, () => ask(token))
      : { status: 403 };
    if (answer.status !== 401) {
      newrelic?.setUserID(sub);
      res.locals.accessToken = token;
    }
    if (answer.status === 200) res.locals.me = answer.me;
    return answer;
  }

  function guard(
    onRefused: (req: Request, res: Response, status: 401 | 403 | 503) => void,
  ): RequestHandler {
    return async (req, res, next) => {
      let answer: GateAnswer;
      try {
        answer = await check(req, res);
      } catch (error) {
        res.set('Cache-Control', 'no-store');
        if (!(error instanceof IdpUnavailableError)) throw error;
        // Fail closed: the IdP or the backend cannot answer, so the request is not let through.
        onRefused(req, res, 503);
        return;
      }
      if (answer.status === 200) {
        next();
        return;
      }
      res.set('Cache-Control', 'no-store');
      onRefused(req, res, answer.status);
    };
  }

  return {
    page: guard((req, res, status) => {
      if (status === 401) {
        res.redirect(302, resumeUrl(req, names));
        return;
      }
      if (status === 503) {
        tryAgainPage(res, req.originalUrl);
        return;
      }
      res
        .status(403)
        .type('html')
        .send(
          `<!doctype html><title>No access</title><p>You do not have access to ${escapeHtml(appName)}.</p>`,
        );
    }),
    api: guard((_req, _res, status) => {
      const detail = {
        401: 'Login required',
        403: noAccessMessage,
        503: 'Login cannot be checked now',
      };
      throw new HttpError(status, detail[status]);
    }),
  };
}
