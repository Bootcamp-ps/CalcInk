import { describe, it, expect } from 'vitest';

describe('scaffold smoke test', () => {
  it('contract types are importable', async () => {
    const contract = await import('../../contract');
    // Verify the module exports exist (types are erased, but the module should load)
    expect(contract).toBeDefined();
  });
});
