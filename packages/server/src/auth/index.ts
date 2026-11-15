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
  COOKIES,
  loginAttemptCookie,
  readCookie,
  setCookie,
  clearCookie,
  cookieSealer,
  type CookieSealer,
} from './cookies.js';
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
import { keycloakAdapter } from './keycloak/keycloak.js';
import { lazyIdp, type Idp } from './metadata.js';

/** The IdP and its adapter, as `IDP_ADAPTER` names it (only `keycloak` so far). */
export function connectIdp(
  settings: OidcSettings,
  adapterName = process.env.IDP_ADAPTER ?? 'keycloak',
): { idp: () => Promise<Idp>; adapter: IdpAdapter } {
  if (adapterName !== 'keycloak') throw new Error(`Unknown IDP_ADAPTER: ${adapterName}`);
  const idp = lazyIdp(settings);
  return { idp, adapter: keycloakAdapter(idp) };
}
