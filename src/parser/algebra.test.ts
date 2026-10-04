import { describe, it, expect } from 'vitest';
import { evaluate, evaluateTokens, tokenize } from './index';

describe('Parser - Algebra and Equation Solving', () => {
  it('solves simple linear equation: x+5=10', () => {
    expect(evaluate('x+5=10')).toEqual({ ok: true, value: 5 });
  });

  it('solves equation with implicit multiplication: 2x=10', () => {
    expect(evaluate('2x=10')).toEqual({ ok: true, value: 5 });
  });

  it('solves equation with implicit brackets: 2(x+3)=14', () => {
    expect(evaluate('2(x+3)=14')).toEqual({ ok: true, value: 4 });
  });

  it('solves equation with variables on both sides: 3x-2=x+6', () => {
    expect(evaluate('3x-2=x+6')).toEqual({ ok: true, value: 4 });
  });

  it('handles division in algebra: (x+2)/3=4', () => {
    expect(evaluate('(x+2)÷3=4')).toEqual({ ok: true, value: 10 });
  });

  it('solves quadratic equation: x(x-1)=6', () => {
    expect(evaluate('x(x-1)=6')).toEqual({ ok: true, value: 3 }); // Our parser returns largest root!
  });
});

describe('Parser - Variable Environment', () => {
  it('assigns and uses variable x', () => {
    const env: Record<string, number> = {};
    // Row 1
    const res1 = evaluate('x=10', env);
    expect(res1).toEqual({ ok: true, value: 10 });
    expect(env['x']).toBe(10);
    
    // Row 2
    const res2 = evaluate('2x+5', env);
    expect(res2).toEqual({ ok: true, value: 25 });
  });
});
