import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorMessage, isRecord, readJsonObject } from '../lib/json.ts';

test('JSON helpers accept objects and reject null, arrays, and malformed JSON', async () => {
  assert.equal(isRecord(null), false);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord('text'), false);
  assert.equal(isRecord({ ok: true }), true);
  for (const value of [null, [], 'text', 42]) {
    assert.deepEqual(await readJsonObject({ json: async () => value }), {});
  }
  assert.deepEqual(await readJsonObject({ json: async () => { throw new SyntaxError('Invalid JSON'); } }), {});
  assert.deepEqual(await readJsonObject({ json: async () => ({ ok: true }) }), { ok: true });
});

test('error messages require a string from the server', () => {
  assert.equal(errorMessage({ error: 'Try again' }, 'Fallback'), 'Try again');
  assert.equal(errorMessage({ error: { private: 'detail' } }, 'Fallback'), 'Fallback');
  assert.equal(errorMessage({}, 'Fallback'), 'Fallback');
});
