const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);

/** Reject prototype-pollution keys before data becomes RNN passProps. */
export function assertSafeParams(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) throw new TypeError('Navigation params must not contain circular references.');
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => assertSafeParams(item, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (blockedKeys.has(key)) throw new TypeError(`Unsafe navigation param key: ${key}`);
    assertSafeParams(child, seen);
  }
}
