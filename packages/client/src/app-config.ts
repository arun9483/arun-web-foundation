/**
 * The public settings the server placed in the page with `appConfigScript()` from
 * `@arun-dev/server/http`: the JSON in `<script type="application/json" id="app-config">`. Empty when the
 * element is missing or its content is not a JSON object, so callers fall back to their defaults.
 */
export function readAppConfig(id = 'app-config'): Record<string, unknown> {
  const text = document.getElementById(id)?.textContent;
  if (!text) return {};
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
