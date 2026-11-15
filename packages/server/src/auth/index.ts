export { oidcSettingsFromEnv, type OidcSettings } from './config.js';
export { lazyIdp, ownClient, type Idp } from './metadata.js';
export {
  checkAccessToken,
  bearerToken,
  type AccessTokenChecks,
  type CheckedToken,
} from './token.js';
export { IdpUnavailableError, type IdpAdapter, type IdpUser } from './adapter.js';
export {
  checkAdapterContract,
  checkUnavailableContract,
  type ContractFixtures,
} from './contract.js';
export { TtlCache } from './cache.js';
export {
  authNames,
  DEFAULT_AUTH_PATHS,
  type AuthNameOptions,
  type AuthNames,
  type AuthPaths,
  type CookieName,
} from './names.js';
export { readCookie, setCookie, clearCookie, cookieSealer, type CookieSealer } from './cookies.js';
export {
  requireUser,
  loggedInUser,
  meHandler,
  type LoggedInUser,
  type BackendUserOptions,
} from './backend.js';
export {
  devBypassFromEnv,
  devBypassHeader,
  devRequireUser,
  devFesGate,
  type DevUser,
} from './dev-bypass.js';
export {
  requireService,
  serviceCaller,
  USER_SUB_HEADER,
  type ServiceCaller,
  type ServiceOptions,
} from './service.js';
export {
  fesGate,
  loginUrl,
  resumeUrl,
  tryAgainPage,
  userBearer,
  type FesGateOptions,
} from './fes.js';
export { loginRoutes, safeReturnTo, type LoginOptions } from './login.js';

import type { OidcSettings } from './config.js';
import type { IdpAdapter } from './adapter.js';
import { lazyIdp, type Idp } from './metadata.js';

/** Makes an IdP adapter for a discovered IdP, e.g. `keycloakAdapter` from `@arun-dev/server/auth/keycloak`. */
export type IdpAdapterFactory = (idp: () => Promise<Idp>) => IdpAdapter;

/**
 * The IdP and its adapter. `adapters` names the adapters this server ships with, e.g.
 * `{ keycloak: keycloakAdapter }`; `adapterName` (default `IDP_ADAPTER`) picks one. Without a name, the
 * only adapter given is used. An unknown or missing name stops the server at start.
 */
export function connectIdp(
  settings: OidcSettings,
  adapters: Record<string, IdpAdapterFactory>,
  adapterName = process.env.IDP_ADAPTER,
): { idp: () => Promise<Idp>; adapter: IdpAdapter } {
  const names = Object.keys(adapters);
  const name = adapterName ?? (names.length === 1 ? names[0] : undefined);
  const make = name === undefined ? undefined : adapters[name];
  if (!make) {
    throw new Error(
      `${name === undefined ? 'IDP_ADAPTER must be set' : `Unknown IDP_ADAPTER: ${name}`} (known: ${names.join(', ') || 'none'})`,
    );
  }
  const idp = lazyIdp(settings);
  return { idp, adapter: make(idp) };
}
