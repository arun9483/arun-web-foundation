# @arun-dev/client

## 1.0.0

### Major Changes

- c51abd4: 1.0.0: the API is stable after MVP-3 (shared packages, configuration and isolated tenants). No change from 0.2.0 (server) and 0.3.0 (client).

## 0.3.0

### Minor Changes

- a4490bf: `readAppConfig(id?)` reads the public settings a server placed in the page with `appConfigScript()` from `@arun-dev/server/http`; empty when missing or not a JSON object.

## 0.2.0

### Minor Changes

- 6578280: `startLogout()`: call it when the logout form is submitted. A call answered after the logout response gets `401`; from then on the page no longer refreshes or goes to login, which would cancel the logout's redirects and keep the server's logged-out page, which tells the other tabs, from loading.

## 0.1.0

### Minor Changes

- 75e5dd0: First release: `createAuth` (`apiFetch` with a shared refresh lock, `refreshFor`, `headStatus`, login and logout URLs, the login marker), `fetchWithTimeout`, `withTimeout`, `positiveMs`, and theme storage with `themeNoFlashScript`. No runtime dependencies.
