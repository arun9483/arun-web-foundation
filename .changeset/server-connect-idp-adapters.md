---
'@arun-dev/server': minor
---

`connectIdp(settings, adapters, adapterName?)` takes the adapters to choose from, e.g. `{ keycloak: keycloakAdapter }`, and picks one by `IDP_ADAPTER` (or the only one given), so `@arun-dev/server/auth` no longer loads Keycloak's adapter. Breaking: pass the adapters map. New `appConfigScript(values, id?)` in `/http`: public settings for the browser as a JSON script element, with `<` escaped.
