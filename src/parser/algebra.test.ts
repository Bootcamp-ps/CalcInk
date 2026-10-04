import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, resetEnv } from './index';

beforeEach(() => {
  resetEnv();
});

// ── Mode 1: EQUATION SOLVE (LHS = RHS, stores solved variable) ───────
describe('Parser - Equation Solving (Mode 1)', () => {
  it('solves linear equation: x+5=10  →  x=5', () => {
    expect(evaluate('x+5=10')).toEqual({ ok: true, value: 5 });
  });

  it('solves with implicit multiplication: 2x=10  →  x=5', () => {
    expect(evaluate('2x=10')).toEqual({ ok: true, value: 5 });
  });

  it('solves with brackets: 2(x+3)=14  →  x=4', () => {
    expect(evaluate('2(x+3)=14')).toEqual({ ok: true, value: 4 });
  });

  it('solves variable on both sides: 3x-2=x+6  →  x=4', () => {
    expect(evaluate('3x-2=x+6')).toEqual({ ok: true, value: 4 });
  });

  it('solves with division: (x+2)÷3=4  →  x=10', () => {
    expect(evaluate('(x+2)÷3=4')).toEqual({ ok: true, value: 10 });
  });

  it('stores the solved variable in env for subsequent rows', () => {
    const env: Record<string, number> = {};
    evaluate('2x+4=10', env);          // solves x=3, stores in env
    expect(env['x']).toBe(3);
    const res = evaluate('x+1=', env); // should NOT be an equation solve, just evaluate x+1
    // x+1=  is trailing-equals → Mode 2: substitute x=3 → 4
    expect(res).toEqual({ ok: true, value: 4 });
  });
});

// ── Mode 2: EXPRESSION EVALUATE (trailing =, uses stored variable) ───
describe('Parser - Expression Evaluate (Mode 2)', () => {
  it('evaluates expression using stored x: 2x+5= where x=3  →  11', () => {
    const env: Record<string, number> = { x: 3 };
    expect(evaluate('2x+5=', env)).toEqual({ ok: true, value: 11 });
  });

  it('returns error when variable not yet defined', () => {
    const env: Record<string, number> = {};
    const res = evaluate('x+5=', env);
    expect(res.ok).toBe(false);
  });

  it('evaluates plain number expression (no variable): 3+4=  →  7', () => {
    expect(evaluate('3+4=')).toEqual({ ok: true, value: 7 });
  });

  it('end-to-end two rows: solve then use', () => {
    const env: Record<string, number> = {};
    const r1 = evaluate('3x-2=7', env);   // x = 3
    expect(r1).toEqual({ ok: true, value: 3 });
    expect(env['x']).toBe(3);

    const r2 = evaluate('x×2+1=', env);   // 3*2+1 = 7
    expect(r2).toEqual({ ok: true, value: 7 });
  });
});
