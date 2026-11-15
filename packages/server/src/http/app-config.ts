/** A value the page may read; `undefined` leaves the field out. */
export type AppConfigValue = string | number | boolean | undefined;

/**
 * Public settings for the browser, as `<script type="application/json" id="…">` to place in a page's
 * `<head>`: `readAppConfig()` in `@arun-dev/client` reads it, with no extra request. Pass only values that
 * are public by design, named one by one, never a copy of `process.env`. Every `<` is escaped, so no value
 * can close the script element.
 */
export function appConfigScript(values: Record<string, AppConfigValue>, id = 'app-config'): string {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) throw new Error(`Invalid app config element id: ${id}`);
  const fields = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
  const json = JSON.stringify(fields).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${id}">${json}</script>`;
}
