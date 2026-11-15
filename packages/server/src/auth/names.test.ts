import { describe, expect, it } from 'vitest';
import { authNames } from './names.js';

describe('authNames', () => {
  it("defaults to today's names and paths", () => {
    const names = authNames();
    expect(names.base).toBe('/auth');
    expect(names.urls).toEqual({
      login: '/auth/login',
      callback: '/auth/callback',
      refresh: '/auth/refresh',
      resume: '/auth/resume',
      logout: '/auth/logout',
      loggedOut: '/auth/logged-out',
    });
    expect(names.cookies).toEqual({
      accessToken: { name: 'shop_at', path: '/' },
      refreshToken: { name: 'shop_rt', path: '/auth' },
      idToken: { name: 'shop_id', path: '/auth/logout' },
    });
    expect(names.loginAttempt('s1')).toEqual({ name: 'shop_tx_s1', path: '/auth/callback' });
    expect(names.channel).toBe('shop-auth');
  });

  it('derives every cookie path from the base, so each token reaches only its routes', () => {
    const names = authNames({
      cookiePrefix: 'app',
      authPaths: { base: '/session', logout: 'end', callback: 'cb' },
    });
    expect(names.urls.login).toBe('/session/login');
    expect(names.cookies.accessToken).toEqual({ name: 'app_at', path: '/' });
    expect(names.cookies.refreshToken).toEqual({ name: 'app_rt', path: '/session' });
    expect(names.cookies.idToken).toEqual({ name: 'app_id', path: '/session/end' });
    expect(names.loginAttempt('s1')).toEqual({ name: 'app_tx_s1', path: '/session/cb' });
    expect(names.channel).toBe('app-auth');
  });

  it.each([
    [{ cookiePrefix: 'a b' }],
    [{ cookiePrefix: "x'" }],
    [{ cookiePrefix: '' }],
    [{ authPaths: { base: 'auth' } }],
    [{ authPaths: { base: '/auth/' } }],
    [{ authPaths: { base: '//auth' } }],
    [{ authPaths: { login: 'a/b' } }],
    [{ authPaths: { logout: '' } }],
  ])('refuses %j', (options) => {
    expect(() => authNames(options)).toThrow();
  });
});
