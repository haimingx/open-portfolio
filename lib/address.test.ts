import { describe, expect, it } from 'vitest';
import { isAddress, normalizeAddress } from './address';

describe('address', () => {
  it('accepts 0x addresses with 40 hex characters, ignoring surrounding spaces', () => {
    expect(isAddress(' 0x7a3f4e1b9d02c6a85f17e3ba40d96c2e8f51c2e1 ')).toBe(true);
    expect(isAddress('0xD8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
  });

  it('rejects short values, names and injection attempts', () => {
    expect(isAddress('0x123')).toBe(false);
    expect(isAddress('vitalik.eth')).toBe(false);
    expect(isAddress("0x1' OR 1=1")).toBe(false);
  });

  it('normalizes to trimmed lower case', () => {
    expect(normalizeAddress(' 0xABC' + 'a'.repeat(37))).toBe('0xabc' + 'a'.repeat(37));
  });
});
