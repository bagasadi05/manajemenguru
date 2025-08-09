import { describe, it, expect } from 'vitest';
import { violationList } from './violations.data';

describe('violationList', () => {
  it('contains unique codes', () => {
    const codes = violationList.map(v => v.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});
