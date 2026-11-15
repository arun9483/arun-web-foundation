---
'@arun-dev/client': minor
---

`startLogout()`: call it when the logout form is submitted. A call answered after the logout response gets `401`; from then on the page no longer refreshes or goes to login, which would cancel the logout's redirects and keep the server's logged-out page, which tells the other tabs, from loading.
