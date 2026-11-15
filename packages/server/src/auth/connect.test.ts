import { describe, expect, it } from 'vitest';
import type { IdpAdapter } from './adapter.js';
import { connectIdp, type IdpAdapterFactory } from './index.js';

const settings = {
  issuer: 'https://idp.example/realms/a',
  internalUrl: 'http://idp:8080/realms/a',
};
const fake =
  (label: string): IdpAdapterFactory =>
  () =>
    ({ label }) as unknown as IdpAdapter;
const labelOf = (adapter: IdpAdapter) => (adapter as unknown as { label: string }).label;

describe('connectIdp', () => {
  it('uses the only adapter given when no name is set', () => {
    expect(labelOf(connectIdp(settings, { one: fake('one') }, undefined).adapter)).toBe('one');
  });

  it('picks the adapter IDP_ADAPTER names', () => {
    const adapters = { one: fake('one'), two: fake('two') };
    expect(labelOf(connectIdp(settings, adapters, 'two').adapter)).toBe('two');
  });

  it('refuses an unknown name, or no name among several, listing the known ones', () => {
    const adapters = { one: fake('one'), two: fake('two') };
    expect(() => connectIdp(settings, adapters, 'three')).toThrow(
      'Unknown IDP_ADAPTER: three (known: one, two)',
    );
    expect(() => connectIdp(settings, adapters, undefined)).toThrow('IDP_ADAPTER must be set');
  });

  it('gives the adapter the lazily discovered IdP', () => {
    let given: unknown;
    const { idp } = connectIdp(
      settings,
      {
        one: (lazy) => {
          given = lazy;
          return {} as IdpAdapter;
        },
      },
      undefined,
    );
    expect(given).toBe(idp);
  });
});
