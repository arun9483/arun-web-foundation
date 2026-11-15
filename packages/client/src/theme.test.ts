/// <reference types="node" />
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemePreference,
  readThemePreference,
  setThemePreference,
  THEME_STORAGE_KEY,
  themeNoFlashScript,
} from './theme.js';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe('theme', () => {
  it('defaults to system', () => {
    expect(readThemePreference()).toBe('system');
  });

  it('ignores an unknown saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemePreference()).toBe('system');
  });

  it('sets data-theme for light and dark, and removes it for system', () => {
    applyThemePreference('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyThemePreference('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyThemePreference('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('keeps light and dark, and forgets system', () => {
    setThemePreference('dark');
    expect(readThemePreference()).toBe('dark');
    setThemePreference('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('still applies the theme when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setThemePreference('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('takes another storage key', () => {
    setThemePreference('light', 'app-theme');
    expect(localStorage.getItem('app-theme')).toBe('light');
    expect(readThemePreference('app-theme')).toBe('light');
    expect(readThemePreference()).toBe('system');
  });
});

describe('themeNoFlashScript', () => {
  it('applies the saved theme with the same key', () => {
    localStorage.setItem('app-theme', 'dark');
    runInNewContext(themeNoFlashScript('app-theme'), { localStorage, document });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('ignores an unknown value and blocked storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    runInNewContext(themeNoFlashScript(), { localStorage, document });
    expect(document.documentElement.dataset.theme).toBeUndefined();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => {
      runInNewContext(themeNoFlashScript(), { localStorage, document });
    }).not.toThrow();
  });

  it('refuses a key that could break out of the script', () => {
    expect(() => themeNoFlashScript("x');alert(1);('")).toThrow();
  });
});
