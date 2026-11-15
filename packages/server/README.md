# @arun-dev/server

Building blocks for an Express 5 server on Node 24 that serves a JavaScript single-page app and logs users in through an OpenID Connect provider (backend-for-frontend, session in HttpOnly cookies).

| Import                           | What it has                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@arun-dev/server/http`          | `traceResponse`, `problemHandler` and `HttpError` (problem+json), `healthRouter`, `readVersion`, `closeOnSignal`, `forward`, `requiredEnv`, backend auth headers         |
| `@arun-dev/server/auth`          | `loginRoutes`, `fesGate`, `requireUser`, `requireService`, `checkAccessToken`, cookies (`authNames`, `cookieSealer`), dev bypass, the IdP adapter contract and its tests |
| `@arun-dev/server/auth/keycloak` | `keycloakAdapter`                                                                                                                                                        |

Peer dependencies: `express`, `jose`, `openid-client`, used directly. `newrelic` is optional: when installed, traces and user IDs go to it.

Names and paths default to `shop_*` cookies under `/auth`; change them once with `authNames({ cookiePrefix, authPaths })` and pass the result as `names`.

The `write-version` bin writes `version.json` for `readVersion`.
