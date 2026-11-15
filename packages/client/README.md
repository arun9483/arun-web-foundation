# @arun-dev/client

Browser helpers for a single-page app behind the backend-for-frontend login of [`@arun-dev/server`](../server). Plain TypeScript and browser APIs, no runtime dependencies, so any framework can use it.

```ts
import { createAuth } from '@arun-dev/client';

// Same base path and prefix as the server's authNames({ authPaths, cookiePrefix }).
export const { apiFetch, goToLogin, urls } = createAuth({ basePath: '/auth', prefix: 'shop' });
```

| Export                                                                                    | What it does                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createAuth(options)`                                                                     | `apiFetch` (on a `401`: retry, then one refresh shared by every tab through Web Locks, then login), `refreshFor`, `headStatus`, `loginUrl`, `goToLogin`, `startLogout` (call it when the logout form is submitted), `loginIsOn`, the login routes' `urls`, the tab `channel` name |
| `readAppConfig()`                                                                         | The public settings the server placed in the page with `appConfigScript()`                                                                                                                                                                                                        |
| `fetchWithTimeout`, `withTimeout`, `TimeoutError`, `positiveMs`                           | Timeouts for calls and loads                                                                                                                                                                                                                                                      |
| `readThemePreference`, `setThemePreference`, `applyThemePreference`, `themeNoFlashScript` | A light, dark or system theme kept in `localStorage`, applied before the first paint                                                                                                                                                                                              |
