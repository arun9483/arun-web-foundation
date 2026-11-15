import { notFound, HttpError } from '../http/problem.js';
import { IdpUnavailableError, type IdpAdapter } from './adapter.js';
import { TtlCache } from './cache.js';
import { clearCookie, readCookie, setCookie, type CookieSealer } from './cookies.js';
import { tryAgainPage } from './fes.js';
import { escapeHtml } from './html.js';
import { ownClient, type Idp } from './metadata.js';
import { authNames, type AuthNames } from './names.js';
import { checkAccessToken } from './token.js';
import { Router, type Request, type Response } from 'express';
import * as client from 'openid-client';

export interface LoginOptions {
  idp: () => Promise<Idp>;
  adapter: IdpAdapter;
  /** The application's public origin, e.g. `https://shop.test`: the callback and return addresses. */
  publicOrigin: string;
  /** Encrypts the refresh token, the ID token and each login attempt. */
  sealer: CookieSealer;
  /** How long the login route waits for the IdP before saying login cannot be checked (F9). */
  idpCheckTimeoutMs?: number;
  /** How long one IdP check's answer is reused. */
  idpCheckCacheMs?: number;
  /** Cookie names and login paths; default `authNames()`. */
  names?: AuthNames;
  /** The application's name in pages, e.g. "Back to the shop". Default `the shop`. */
  appName?: string;
}

// A login attempt must finish within this time.
const ATTEMPT_MS = 10 * 60 * 1000;

interface Attempt {
  verifier: string;
  nonce: string;
  returnTo: string;
}

/** Only a path on the application's own origin, never another site or the login routes themselves. */
export function safeReturnTo(value: unknown, base = '/auth'): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x5c) return '/'; // control characters, backslash
  }
  if (value.startsWith(`${base}/`)) return '/';
  return value;
}

/**
 * The login lifecycle (MVP-2, backend-for-frontend): the only place tokens are received, refreshed or
 * cleared.
 * Sets the three session cookies together and clears them together (ADR 0003).
 */
export function loginRoutes({
  idp,
  adapter,
  publicOrigin,
  sealer,
  idpCheckTimeoutMs = 2000,
  idpCheckCacheMs = 5000,
  names = authNames(),
  appName = 'the shop',
}: LoginOptions): Router {
  const router = Router();
  const { base, urls, cookies } = names;
  const callbackUrl = `${publicOrigin}${urls.callback}`;
  const app = escapeHtml(appName);
  const idpChecks = new TtlCache<boolean>(idpCheckCacheMs);

  router.use(base, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  async function setSession(res: Response, tokens: client.TokenEndpointResponse): Promise<void> {
    setCookie(res, cookies.accessToken, tokens.access_token);
    if (tokens.refresh_token)
      setCookie(res, cookies.refreshToken, await sealer.seal(tokens.refresh_token));
    if (tokens.id_token) setCookie(res, cookies.idToken, await sealer.seal(tokens.id_token));
  }

  function clearSession(res: Response): void {
    clearCookie(res, cookies.accessToken);
    clearCookie(res, cookies.refreshToken);
    clearCookie(res, cookies.idToken);
  }

  // Another site may not refresh or end a user's session.
  function sameOrigin(req: Request): void {
    if (req.get('origin') !== publicOrigin)
      throw new HttpError(403, 'Cross-origin request refused');
  }

  async function loggedIn(req: Request): Promise<boolean> {
    const token = readCookie(req, cookies.accessToken.name);
    if (!token) return false;
    const current = await idp();
    return checkAccessToken(token, {
      keys: current.keys,
      issuer: current.settings.issuer,
      authorizedParty: ownClient(current).clientId,
      isAccessToken: adapter.isAccessToken,
    }).then(
      () => true,
      () => false,
    );
  }

  /**
   * Whether the IdP answers now, asked inside the network where this server reaches it. The login
   * page itself is the IdP's, so without this check a down IdP shows the browser a bare gateway error
   * on the IdP's address instead of the application's page (MVP-2 verification, F9).
   */
  function idpAnswers(): Promise<boolean> {
    return idpChecks.get('idp', async () => {
      const current = await reachIdp();
      if (!current) return false;
      const base = current.settings.internalUrl.replace(/\/$/, '');
      try {
        const res = await fetch(`${base}/.well-known/openid-configuration`, {
          signal: AbortSignal.timeout(idpCheckTimeoutMs),
        });
        return res.ok;
      } catch {
        return false;
      }
    });
  }

  /** The IdP, or undefined when it cannot be reached; a wrong setting is still an error. */
  async function reachIdp(): Promise<Idp | undefined> {
    try {
      return await idp();
    } catch (error) {
      if (error instanceof IdpUnavailableError) return undefined;
      throw error;
    }
  }

  // `none` is the user's own navigation (typed address, bookmark); covers every step of a redirect chain.
  const fromShop = (req: Request) =>
    ['same-origin', 'none'].includes(req.get('sec-fetch-site') ?? '');

  const toLogin = (returnTo: string) => `${urls.login}?returnTo=${encodeURIComponent(returnTo)}`;

  router.get(urls.login, async (req, res) => {
    const returnTo = safeReturnTo(req.query.returnTo, base);
    if (!(await idpAnswers())) {
      // Try again goes to the page asked for, not here: the gate then decides afresh.
      tryAgainPage(res, returnTo);
      return;
    }
    const { config } = ownClient(await idp());
    const verifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const attempt: Attempt = { verifier, nonce, returnTo };
    setCookie(
      res,
      names.loginAttempt(state),
      await sealer.seal(JSON.stringify(attempt)),
      ATTEMPT_MS,
    );
    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: 'openid',
      code_challenge: await client.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    res.redirect(302, url.href);
  });

  router.get(urls.callback, async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const cookie = names.loginAttempt(state);
    const sealed = state ? readCookie(req, cookie.name) : undefined;
    const opened = sealed && (await sealer.open(sealed));
    if (!opened) {
      // Another tab may have finished logging in already.
      res.redirect(302, (await loggedIn(req)) ? '/' : urls.login);
      return;
    }
    const attempt = JSON.parse(opened) as Attempt;
    clearCookie(res, cookie);
    const { config } = ownClient(await idp());
    let tokens: client.TokenEndpointResponse;
    try {
      tokens = await client.authorizationCodeGrant(config, new URL(req.originalUrl, publicOrigin), {
        pkceCodeVerifier: attempt.verifier,
        expectedState: state,
        expectedNonce: attempt.nonce,
      });
    } catch {
      res.redirect(302, (await loggedIn(req)) ? attempt.returnTo : toLogin(attempt.returnTo));
      return;
    }
    await setSession(res, tokens);
    res.redirect(302, attempt.returnTo);
  });

  router.post(urls.refresh, async (req, res) => {
    sameOrigin(req);
    const sealed = readCookie(req, cookies.refreshToken.name);
    const refreshToken = sealed && (await sealer.open(sealed));
    if (!refreshToken) {
      clearSession(res);
      throw new HttpError(401, 'Login required');
    }
    const { config } = ownClient(await idp());
    let tokens: client.TokenEndpointResponse;
    try {
      tokens = await client.refreshTokenGrant(config, refreshToken);
    } catch (error) {
      if (error instanceof client.ResponseBodyError) {
        // The IdP's session has ended.
        clearSession(res);
        throw new HttpError(401, 'Login required');
      }
      throw new HttpError(503, 'Login cannot be refreshed now');
    }
    await setSession(res, tokens);
    res.status(204).end();
  });

  /**
   * A page load with an expired login (MVP-2 verification, F9): the gate sends pages here, as only
   * the login routes receive the refresh token. Refreshes on the server and goes back to the page, so the
   * browser never visits the IdP while the refresh token is valid; an ended or missing login goes on
   * to log in; an IdP that cannot answer gets the `503` page. A GET, as it is a page load; so
   * it refreshes only for a navigation the browser says started in the application or from the user
   * (`Sec-Fetch-Site`), and another site cannot make it refresh, e.g. to keep a session from timing
   * out. Anything else, or no header, goes on to log in, as before F9.
   */
  router.get(urls.resume, async (req, res) => {
    const returnTo = safeReturnTo(req.query.returnTo, base);
    const sealed = fromShop(req) ? readCookie(req, cookies.refreshToken.name) : undefined;
    const refreshToken = sealed && (await sealer.open(sealed));
    if (!refreshToken) {
      res.redirect(302, toLogin(returnTo));
      return;
    }
    const current = await reachIdp();
    if (!current) {
      tryAgainPage(res, returnTo);
      return;
    }
    const { config } = ownClient(current);
    let tokens: client.TokenEndpointResponse;
    try {
      tokens = await client.refreshTokenGrant(config, refreshToken);
    } catch (error) {
      if (error instanceof client.ResponseBodyError) {
        // The IdP's session has ended.
        clearSession(res);
        res.redirect(302, toLogin(returnTo));
        return;
      }
      // As the refresh route: any other failure means the IdP cannot answer now.
      tryAgainPage(res, returnTo);
      return;
    }
    await setSession(res, tokens);
    res.redirect(302, returnTo);
  });

  router.post(urls.logout, async (req, res) => {
    sameOrigin(req);
    const sealed = readCookie(req, cookies.idToken.name);
    const idToken = sealed && (await sealer.open(sealed));
    clearSession(res);
    const { config, clientId } = ownClient(await idp());
    const postLogout = { post_logout_redirect_uri: `${publicOrigin}${urls.loggedOut}` };
    // With the ID token the IdP logs out at once; without it, it asks the user to confirm.
    const url = client.buildEndSessionUrl(
      config,
      idToken ? { ...postLogout, id_token_hint: idToken } : { ...postLogout, client_id: clientId },
    );
    res.redirect(303, url.href);
  });

  // Where the IdP sends the browser once its session has ended: only now are the other tabs told, so
  // none of them logs in again on the session being ended. Then on to the application, which asks to log in.
  router.get(urls.loggedOut, (_req, res) => {
    res.type('html').send(
      '<!doctype html><title>Logged out</title><script>' +
        // The channel name is letters, digits, _ and - only (checked by authNames).
        `try{new BroadcastChannel('${names.channel}').postMessage({type:'logged-out'})}catch{}` +
        'location.replace(\'/\')</script><p>You are logged out. <a href="/">Continue</a></p>',
    );
  });

  // Logout and refresh change state, so they take POST only: otherwise another site could end a
  // user's session with a plain link. An address typed in the browser gets a page saying so (F1).
  router.get([urls.logout, urls.refresh], (req, res) => {
    const text =
      req.path === urls.logout
        ? `To log out, use the Log out button in ${app}.`
        : `This address is used by ${app} itself, not opened in a browser.`;
    res
      .status(405)
      .set('Allow', 'POST')
      .type('html')
      .send(
        `<!doctype html><title>Not a page</title><p>${text}</p><p><a href="/">Back to ${app}</a></p>`,
      );
  });
  // Any other address under the base is not part of the application: a 404, never the app.
  router.use(base, notFound);

  return router;
}
