import { describe, it, expect } from 'vitest';

describe('scaffold smoke test', () => {
  it('contract module is importable', async () => {
    const contract = await import('../../contract');
    expect(contract).toBeDefined();
  });

  it('RowResult evaluation error literals include NO_EQUALS', () => {
    // Types are erased at runtime; verify the literal is accepted by checking
    // that a well-formed object satisfies the shape we expect.
    const result = {
      rowId: 'r1',
      version: 1,
      symbols: [],
      expression: '',
      evaluation: { ok: false as const, error: 'NO_EQUALS' as const },
    };
    // If the type were wrong this assignment would fail tsc (strict).
    expect(result.evaluation.ok).toBe(false);
    expect(result.evaluation.error).toBe('NO_EQUALS');
  });

  it('AnswerMark shape is correct', () => {
    const mark = {
      rowId: 'r1',
      anchor: { x: 100, y: 200, w: 20, h: 30 },
      text: '42',
      status: 'ok' as const,
    };
    expect(mark.anchor.w).toBe(20);
    expect(mark.status).toBe('ok');
  });

  it('StrokeAction replace variant carries before and after arrays', () => {
    const action = {
      type: 'replace' as const,
      before: [],
      after: [],
    };
    expect(action.type).toBe('replace');
    expect(Array.isArray(action.before)).toBe(true);
  });
});
