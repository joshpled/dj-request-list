import assert from 'node:assert/strict';
import test from 'node:test';
import { requireInitialPin } from '../lib/bootstrap.ts';

test('new databases fail closed without an explicit private PIN', () => {
  for (const value of [undefined, null, '', '123', '1234567890123', 'abcd', ' 1234', 1234]) {
    assert.throws(() => requireInitialPin(value), /INITIAL_ADMIN_PIN/);
  }
});

test('explicit PINs preserve leading zeroes', () => {
  assert.equal(requireInitialPin('008642'), '008642');
});
