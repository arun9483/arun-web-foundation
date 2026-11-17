# @arun-dev/server

## 1.0.0

### Major Changes

- c51abd4: 1.0.0: the API is stable after MVP-3 (shared packages, configuration and isolated tenants). No change from 0.2.0 (server) and 0.3.0 (client).

## 0.2.0

### Minor Changes

- a4490bf: `connectIdp(settings, adapters, adapterName?)` takes the adapters to choose from, e.g. `{ keycloak: keycloakAdapter }`, and picks one by `IDP_ADAPTER` (or the only one given), so `@arun-dev/server/auth` no longer loads Keycloak's adapter. Breaking: pass the adapters map. New `appConfigScript(values, id?)` in `/http`: public settings for the browser as a JSON script element, with `<` escaped.

## 0.1.0

### Minor Changes

- d31a67e: First release: `/http` (trace response, problem+json, health and version, graceful shutdown, `forward`, `requiredEnv`, backend auth headers), `/auth` (token checks, FES gate, backend and service checks, cookies, login routes, dev bypass, IdP adapter contract) and `/auth/keycloak`. New Relic is optional.
