import { describe, it, expect } from 'vitest';
import { evaluate, evaluateTokens, tokenize } from './index';

describe('Tokenizer', () => {
  it('tokenizes a simple expression', () => {
    const tokens = tokenize('18+4×3=');
    expect(Array.isArray(tokens)).toBe(true);
    if (Array.isArray(tokens)) {
      expect(tokens.map(t => t.value)).toEqual(['18', '+', '4', '×', '3', '=', '']);
    }
  });

  it('handles decimal numbers', () => {
    const tokens = tokenize('3.14+2.5');
    expect(Array.isArray(tokens)).toBe(true);
    if (Array.isArray(tokens)) {
      expect(tokens[0].value).toBe('3.14');
      expect(tokens[2].value).toBe('2.5');
    }
  });

  it('rejects lone dot', () => {
    const tokens = tokenize('.');
    expect('error' in tokens).toBe(true);
  });

  it('rejects unknown characters', () => {
    const tokens = tokenize('2#3');
    expect('error' in tokens).toBe(true);
  });
});

describe('Parser - Basic arithmetic', () => {
  it('evaluates simple addition', () => {
    expect(evaluate('2+3')).toEqual({ ok: true, value: 5 });
  });

  it('evaluates simple subtraction', () => {
    expect(evaluate('10-4')).toEqual({ ok: true, value: 6 });
  });

  it('evaluates simple multiplication', () => {
    expect(evaluate('3×4')).toEqual({ ok: true, value: 12 });
  });

  it('evaluates simple division', () => {
    expect(evaluate('15÷3')).toEqual({ ok: true, value: 5 });
  });
});

describe('Parser - BODMAS/PEMDAS', () => {
  it('18+4×3 = 30 (multiplication before addition)', () => {
    expect(evaluate('18+4×3')).toEqual({ ok: true, value: 30 });
  });

  it('18+4×3= = 30 (with trailing equals)', () => {
    expect(evaluate('18+4×3=')).toEqual({ ok: true, value: 30 });
  });

  it('2+3×4-1 = 13', () => {
    expect(evaluate('2+3×4-1')).toEqual({ ok: true, value: 13 });
  });

  it('10÷2+3×4 = 17', () => {
    expect(evaluate('10÷2+3×4')).toEqual({ ok: true, value: 17 });
  });

  it('(2+3)×4 = 20', () => {
    expect(evaluate('(2+3)×4')).toEqual({ ok: true, value: 20 });
  });

  it('2×(3+4) = 14', () => {
    expect(evaluate('2×(3+4)')).toEqual({ ok: true, value: 14 });
  });

  it('(2+3)×(4+1) = 25', () => {
    expect(evaluate('(2+3)×(4+1)')).toEqual({ ok: true, value: 25 });
  });
});

describe('Parser - Multi-digit numbers', () => {
  it('handles multi-digit numbers', () => {
    expect(evaluate('123+456')).toEqual({ ok: true, value: 579 });
  });

  it('handles large numbers', () => {
    expect(evaluate('1000×1000')).toEqual({ ok: true, value: 1000000 });
  });
});

describe('Parser - Decimal numbers', () => {
  it('evaluates decimal addition', () => {
    expect(evaluate('1.5+2.5')).toEqual({ ok: true, value: 4 });
  });

  it('evaluates decimal multiplication', () => {
    expect(evaluate('3.14×2')).toEqual({ ok: true, value: 6.28 });
  });

  it('handles trailing dot', () => {
    expect(evaluate('3.+2')).toEqual({ ok: true, value: 5 });
  });
});

describe('Parser - Negative/unary minus', () => {
  it('evaluates unary minus', () => {
    expect(evaluate('-5+3')).toEqual({ ok: true, value: -2 });
  });

  it('evaluates double unary minus', () => {
    expect(evaluate('--5')).toEqual({ ok: true, value: 5 });
  });

  it('evaluates negative × positive', () => {
    expect(evaluate('-3×4')).toEqual({ ok: true, value: -12 });
  });

  it('evaluates expression with negative result', () => {
    expect(evaluate('3-10')).toEqual({ ok: true, value: -7 });
  });
});

describe('Parser - Division by zero', () => {
  it('5÷0 → Undefined', () => {
    const result = evaluate('5÷0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Undefined');
  });

  it('5÷0= → Undefined', () => {
    const result = evaluate('5÷0=');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Undefined');
  });

  it('10÷(3-3) → Undefined', () => {
    const result = evaluate('10÷(3-3)');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Undefined');
  });
});

describe('Parser - Malformed input', () => {
  it('empty string → error', () => {
    const result = evaluate('');
    expect(result.ok).toBe(false);
  });

  it('just spaces → error', () => {
    const result = evaluate('   ');
    expect(result.ok).toBe(false);
  });

  it('incomplete expression → error', () => {
    const result = evaluate('3+');
    expect(result.ok).toBe(false);
  });

  it('double operator → error', () => {
    const result = evaluate('3++');
    expect(result.ok).toBe(false);
  });

  it('mismatched parens → error', () => {
    const result = evaluate('(3+4');
    expect(result.ok).toBe(false);
  });

  it('unknown char → error', () => {
    const result = evaluate('3&4');
    expect(result.ok).toBe(false);
  });

  it('never throws on any input', () => {
    const inputs = ['', 'abc', '////', '((()))', '1+', '+', '×÷', '...', '=', '=='];
    for (const input of inputs) {
      const result = evaluate(input);
      expect(typeof result).toBe('object');
      expect('ok' in result).toBe(true);
    }
  });
});

describe('Parser - evaluateTokens', () => {
  it('evaluates token array from recognition', () => {
    expect(evaluateTokens(['1', '8', '+', '4', '×', '3', '='])).toEqual({ ok: true, value: 30 });
  });

  it('handles single digit tokens', () => {
    expect(evaluateTokens(['5', '+', '3'])).toEqual({ ok: true, value: 8 });
  });

  it('handles division by zero from tokens', () => {
    const result = evaluateTokens(['5', '÷', '0', '=']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Undefined');
  });
});

describe('Parser - Unicode operator variants', () => {
  it('handles × (multiplication sign)', () => {
    expect(evaluate('3×4')).toEqual({ ok: true, value: 12 });
  });

  it('handles * (asterisk)', () => {
    expect(evaluate('3*4')).toEqual({ ok: true, value: 12 });
  });

  it('handles ÷ (division sign)', () => {
    expect(evaluate('12÷4')).toEqual({ ok: true, value: 3 });
  });

  it('handles / (slash)', () => {
    expect(evaluate('12/4')).toEqual({ ok: true, value: 3 });
  });

  it('handles − (en dash minus)', () => {
    expect(evaluate('10−3')).toEqual({ ok: true, value: 7 });
  });

  it('handles – (em dash minus)', () => {
    expect(evaluate('10–3')).toEqual({ ok: true, value: 7 });
  });
});
