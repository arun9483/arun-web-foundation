import { afterEach, describe, expect, it } from 'vitest';
import { readAppConfig } from './app-config.js';

afterEach(() => {
  document.head.innerHTML = '';
});

describe('readAppConfig', () => {
  it('reads the JSON the server placed in the page', () => {
    document.head.innerHTML =
      '<script type="application/json" id="app-config">{"appId":"123","name":"\\u003c/b>"}</script>';
    expect(readAppConfig()).toEqual({ appId: '123', name: '</b>' });
  });

  it('is empty when the element is missing, not JSON, or not an object', () => {
    expect(readAppConfig()).toEqual({});
    for (const text of ['not json', '[1,2]', 'null', '"text"']) {
      document.head.innerHTML = `<script type="application/json" id="app-config">${text}</script>`;
      expect(readAppConfig()).toEqual({});
    }
  });

  it('takes another element id', () => {
    document.head.innerHTML = '<script type="application/json" id="cfg">{"a":1}</script>';
    expect(readAppConfig('cfg')).toEqual({ a: 1 });
  });
});
