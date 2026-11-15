import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuth } from './auth.js';

let loggedIn: boolean;
let refreshes: number;

function stubServer(refreshWorks: boolean, refreshStatus?: number, refreshUrl = '/auth/refresh') {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === refreshUrl) {
        expect(init?.method).toBe('POST');
        refreshes++;
        if (refreshWorks) loggedIn = true;
        return Promise.resolve(
          new Response(null, { status: refreshStatus ?? (refreshWorks ? 204 : 401) }),
        );
      }
      return Promise.resolve(
        loggedIn ? Response.json({ ok: true }) : new Response(null, { status: 401 }),
      );
    }),
  );
}

beforeEach(() => {
  loggedIn = false;
  refreshes = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

describe('apiFetch', () => {
  it('passes any answer but 401 through untouched', async () => {
    loggedIn = true;
    stubServer(true);
    expect((await createAuth().apiFetch('/api/shell/greeting')).status).toBe(200);
    expect(refreshes).toBe(0);
  });

  it('refreshes once on a 401 and retries the call', async () => {
    stubServer(true);
    const res = await createAuth().apiFetch('/api/shell/greeting');
    expect(res.status).toBe(200);
    expect(refreshes).toBe(1);
  });

  it('shares one refresh between calls refused at the same time', async () => {
    stubServer(true);
    const { apiFetch } = createAuth();
    const answers = await Promise.all([apiFetch('/a'), apiFetch('/b'), apiFetch('/c')]);
    expect(answers.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(refreshes).toBe(1);
  });

  it('goes to login, back to this page, when refresh fails', async () => {
    stubServer(false);
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/help', search: '?x=1', assign });
    const res = await createAuth().apiFetch('/api/shell/greeting');
    expect(res.status).toBe(401);
    expect(assign).toHaveBeenCalledWith('/auth/login?returnTo=%2Fhelp%3Fx%3D1');
  });

  it('stays on the page when login cannot be checked (refresh answers 503)', async () => {
    stubServer(false, 503);
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/help', search: '', assign });
    const res = await createAuth().apiFetch('/api/shell/greeting');
    expect(res.status).toBe(503);
    expect(assign).not.toHaveBeenCalled();
  });

  it('uses the configured base path and route names', async () => {
    stubServer(false, undefined, '/session/renew');
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/', search: '', assign });
    const auth = createAuth({ basePath: '/session', routes: { refresh: 'renew', login: 'in' } });
    await auth.apiFetch('/api/x');
    expect(refreshes).toBe(1);
    expect(assign).toHaveBeenCalledWith('/session/in?returnTo=%2F');
    expect(auth.urls.logout).toBe('/session/logout');
  });
});

describe('startLogout', () => {
  it('stops refreshing and going to login, so the logout redirects can finish', async () => {
    stubServer(false);
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/', search: '', assign });
    const auth = createAuth();
    auth.startLogout();
    const res = await auth.apiFetch('/api/shell/greeting');
    expect(res.status).toBe(401);
    expect(await auth.refreshFor('/mfe/x/entry.js')).toBe('login');
    auth.goToLogin();
    expect(refreshes).toBe(0);
    expect(assign).not.toHaveBeenCalled();
  });

  it('applies only to its own createAuth', async () => {
    stubServer(false);
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/', search: '', assign });
    createAuth().startLogout();
    await createAuth().apiFetch('/api/shell/greeting');
    expect(refreshes).toBe(1);
    expect(assign).toHaveBeenCalledOnce();
  });
});

describe('refreshFor', () => {
  it('refreshes only when the address still answers 401', async () => {
    stubServer(true);
    expect(await createAuth().refreshFor('/mfe/x/entry.js')).toBe('logged-in');
    expect(refreshes).toBe(1);
    expect(await createAuth().refreshFor('/mfe/x/entry.js')).toBe('logged-in');
    expect(refreshes).toBe(1);
  });

  it('says login or unavailable when refresh fails', async () => {
    stubServer(false);
    expect(await createAuth().refreshFor('/x')).toBe('login');
    stubServer(false, 503);
    expect(await createAuth().refreshFor('/x')).toBe('unavailable');
  });
});

describe('names', () => {
  it("defaults to today's names", () => {
    const auth = createAuth();
    expect(auth.urls).toEqual({
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
    });
    expect(auth.channel).toBe('shop-auth');
    expect(auth.lockName).toBe('shop-auth-refresh');
  });

  it('takes the prefix for the channel, the lock and the login marker', () => {
    const auth = createAuth({ prefix: 'app' });
    expect(auth.channel).toBe('app-auth');
    expect(auth.lockName).toBe('app-auth-refresh');
    expect(auth.loginIsOn()).toBe(false);
    document.head.innerHTML = '<meta name="app-login" content="on">';
    expect(auth.loginIsOn()).toBe(true);
    expect(createAuth().loginIsOn()).toBe(false);
  });

  it('refuses a prefix that could break a selector or a name', () => {
    expect(() => createAuth({ prefix: 'a"]' })).toThrow();
  });
});
