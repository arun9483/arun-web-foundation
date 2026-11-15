/** The theme a user picks: light, dark, or whatever the operating system prefers. */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** The default storage key. Every function here takes the same key, as does `themeNoFlashScript`. */
export const THEME_STORAGE_KEY = 'shop-theme';

function isPreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

/** The saved preference, or `system` when none is saved or storage is unavailable. */
export function readThemePreference(key = THEME_STORAGE_KEY): ThemePreference {
  try {
    const saved = localStorage.getItem(key);
    return isPreference(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Applies a preference: `data-theme` on `<html>` for light or dark, none for system, so the styles'
 * `prefers-color-scheme` rules decide.
 */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
}

/** Applies a preference and keeps it for the next visit. */
export function setThemePreference(preference: ThemePreference, key = THEME_STORAGE_KEY): void {
  applyThemePreference(preference);
  try {
    if (preference === 'system') localStorage.removeItem(key);
    else localStorage.setItem(key, preference);
  } catch {
    // Storage is blocked: the theme still applies for this page load.
  }
}

/**
 * The body of an inline `<script>` for the page's `<head>`: it applies the saved theme before the
 * first paint, before any module runs. Keys are letters, digits, `_` and `-` only, so the result is
 * safe to place in HTML.
 */
export function themeNoFlashScript(key = THEME_STORAGE_KEY): string {
  if (!/^[A-Za-z0-9_-]+$/.test(key))
    throw new Error(`Theme storage key must be letters, digits, _ or -: ${key}`);
  return (
    `try{const t=localStorage.getItem('${key}');` +
    `if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`
  );
}
