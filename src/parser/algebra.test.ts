import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, resetEnv } from './index';

beforeEach(() => {
  resetEnv();
});

// ── Mode 1: EQUATION SOLVE (LHS = RHS, stores solved variable) ───────
describe('Parser - Equation Solving (Mode 1)', () => {
  it('solves linear equation: y+5=10  →  y=5', () => {
    expect(evaluate('y+5=10')).toEqual({ ok: true, value: 5 });
  });

  it('solves with implicit multiplication: 2y=10  →  y=5', () => {
    expect(evaluate('2y=10')).toEqual({ ok: true, value: 5 });
  });

  it('solves with brackets: 2(y+3)=14  →  y=4', () => {
    expect(evaluate('2(y+3)=14')).toEqual({ ok: true, value: 4 });
  });

  it('solves variable on both sides: 3y-2=y+6  →  y=4', () => {
    expect(evaluate('3y-2=y+6')).toEqual({ ok: true, value: 4 });
  });

  it('solves with division: (y+2)÷3=4  →  y=10', () => {
    expect(evaluate('(y+2)÷3=4')).toEqual({ ok: true, value: 10 });
  });

  it('stores the solved variable in env for subsequent rows', () => {
    const env: Record<string, number> = {};
    evaluate('2y+4=10', env);          // solves y=3, stores in env
    expect(env['y']).toBe(3);
    const res = evaluate('y+1=', env); // should NOT be an equation solve, just evaluate y+1
    // y+1=  is trailing-equals → Mode 2: substitute y=3 → 4
    expect(res).toEqual({ ok: true, value: 4 });
  });
});

// ── Mode 2: EXPRESSION EVALUATE (trailing =, uses stored variable) ───
describe('Parser - Expression Evaluate (Mode 2)', () => {
  it('evaluates expression using stored y: 2y+5= where y=3  →  11', () => {
    const env: Record<string, number> = { y: 3 };
    expect(evaluate('2y+5=', env)).toEqual({ ok: true, value: 11 });
  });

  it('returns error when variable not yet defined', () => {
    const env: Record<string, number> = {};
    const res = evaluate('y+5=', env);
    expect(res.ok).toBe(false);
  });

  it('evaluates plain number expression (no variable): 3+4=  →  7', () => {
    expect(evaluate('3+4=')).toEqual({ ok: true, value: 7 });
  });

  it('treats x as multiplication operator: 3x4+2=  →  14', () => {
    expect(evaluate('3x4+2=')).toEqual({ ok: true, value: 14 });
  });

  it('end-to-end two rows: solve then use', () => {
    const env: Record<string, number> = {};
    const r1 = evaluate('3y-2=7', env);   // y = 3
    expect(r1).toEqual({ ok: true, value: 3 });
    expect(env['y']).toBe(3);

    const r2 = evaluate('y×2+1=', env);   // 3*2+1 = 7
    expect(r2).toEqual({ ok: true, value: 7 });
  });
});

