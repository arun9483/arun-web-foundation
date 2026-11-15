import { describe, expect, it } from 'vitest';
import { appConfigScript } from './app-config.js';

describe('appConfigScript', () => {
  it('writes the given fields as JSON, leaving undefined ones out', () => {
    expect(appConfigScript({ appId: '123', sampled: true, max: 5, missing: undefined })).toBe(
      '<script type="application/json" id="app-config">{"appId":"123","sampled":true,"max":5}</script>',
    );
  });

  it('escapes every < so no value can close the script element', () => {
    const html = appConfigScript({ name: '</script><script>alert(1)</script>' });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const json = /<script[^>]*>(.*)<\/script>/.exec(html)?.[1] ?? '';
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script>' });
  });

  it('takes another element id, but only a plain one', () => {
    expect(appConfigScript({}, 'cfg')).toBe('<script type="application/json" id="cfg">{}</script>');
    expect(() => appConfigScript({}, 'a"b')).toThrow();
  });
});
