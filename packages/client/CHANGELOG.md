# @arun-dev/client

## 0.2.0

### Minor Changes

- 6578280: `startLogout()`: call it when the logout form is submitted. A call answered after the logout response gets `401`; from then on the page no longer refreshes or goes to login, which would cancel the logout's redirects and keep the server's logged-out page, which tells the other tabs, from loading.

## 0.1.0

### Minor Changes

- 75e5dd0: First release: `createAuth` (`apiFetch` with a shared refresh lock, `refreshFor`, `headStatus`, login and logout URLs, the login marker), `fetchWithTimeout`, `withTimeout`, `positiveMs`, and theme storage with `themeNoFlashScript`. No runtime dependencies.
