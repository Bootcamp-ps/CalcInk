// ─── CalcInk Math Parser (Algebraic) ───────────────────────────────
// Hand-written tokenizer + recursive-descent algebraic parser.
// Supports: numbers, decimals, unary minus, BODMAS, brackets, ONE variable (x),
// implicit multiplication, and linear equation solving (LHS = RHS).

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

// ─── Polynomial Algebra ────────────────────────────────────────────
class Polynomial {
  coeffs: number[]; // coeffs[0] + coeffs[1]*x + coeffs[2]*x^2 + ...

  constructor(coeffs: number[]) {
    this.coeffs = [...coeffs];
    this.trim();
  }

  trim() {
    while (this.coeffs.length > 1 && Math.abs(this.coeffs[this.coeffs.length - 1]) < 1e-10) {
      this.coeffs.pop();
    }
  }

  static constant(c: number) { return new Polynomial([c]); }
  static variable() { return new Polynomial([0, 1]); }

  add(other: Polynomial): Polynomial {
    const len = Math.max(this.coeffs.length, other.coeffs.length);
    const res = new Array(len).fill(0);
    for (let i = 0; i < len; i++) {
      res[i] = (this.coeffs[i] || 0) + (other.coeffs[i] || 0);
    }
    return new Polynomial(res);
  }

  sub(other: Polynomial): Polynomial {
    const len = Math.max(this.coeffs.length, other.coeffs.length);
    const res = new Array(len).fill(0);
    for (let i = 0; i < len; i++) {
      res[i] = (this.coeffs[i] || 0) - (other.coeffs[i] || 0);
    }
    return new Polynomial(res);
  }

  mul(other: Polynomial): Polynomial {
    const res = new Array(this.coeffs.length + other.coeffs.length - 1).fill(0);
    for (let i = 0; i < this.coeffs.length; i++) {
      for (let j = 0; j < other.coeffs.length; j++) {
        res[i + j] += this.coeffs[i] * other.coeffs[j];
      }
    }
    return new Polynomial(res);
  }

  div(other: Polynomial): Polynomial {
    if (other.coeffs.length > 1) throw new Error("Cannot divide by variable expression");
    const denom = other.coeffs[0];
    if (Math.abs(denom) < 1e-10) throw new Error("Undefined"); // DIV_ZERO
    return new Polynomial(this.coeffs.map(c => c / denom));
  }
}

// ─── Tokenizer ─────────────────────────────────────────────────────
export type TokenKind = 'NUMBER' | 'VAR' | 'PLUS' | 'MINUS' | 'MUL' | 'DIV' | 'LPAREN' | 'RPAREN' | 'EQUALS' | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
}

function normalizeChar(ch: string): string {
  if (ch === '×' || ch === '*') return '*';
  if (ch === '÷' || ch === '/') return '/';
  if (ch === '−' || ch === '–') return '-';
  return ch;
}

export function tokenize(input: string): Token[] | { error: string } {
  const tokens: Token[] = [];
  let i = 0;
  const src = input.trim();

  while (i < src.length) {
    const rawChar = src[i];
    if (!rawChar) break;
    const ch = normalizeChar(rawChar);

    if (ch === ' ') { i++; continue; }

    if (ch >= '0' && ch <= '9' || ch === '.') {
      let num = '';
      let hasDot = false;
      while (i < src.length) {
        const rawC = src[i];
        if (!rawC) break;
        const c = normalizeChar(rawC);
        if (c >= '0' && c <= '9') { num += c; i++; }
        else if (c === '.' && !hasDot) { hasDot = true; num += c; i++; }
        else break;
      }
      if (num === '.' || num.endsWith('.')) {
        if (num === '.') return { error: 'Unexpected "."' };
      }
      tokens.push({ kind: 'NUMBER', value: num });
      continue;
    }

    if (ch.match(/[a-zA-Z]/)) {
      tokens.push({ kind: 'VAR', value: ch.toLowerCase() });
      i++;
      continue;
    }

    if (ch === '+') { tokens.push({ kind: 'PLUS', value: '+' }); i++; continue; }
    if (ch === '-') { tokens.push({ kind: 'MINUS', value: '-' }); i++; continue; }
    if (ch === '*') { tokens.push({ kind: 'MUL', value: '×' }); i++; continue; }
    if (ch === '/') { tokens.push({ kind: 'DIV', value: '÷' }); i++; continue; }
    if (ch === '(') { tokens.push({ kind: 'LPAREN', value: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ kind: 'RPAREN', value: ')' }); i++; continue; }
    if (ch === '=') { tokens.push({ kind: 'EQUALS', value: '=' }); i++; continue; }

    return { error: `Unexpected character "${rawChar}"` };
  }

  // Inject implicit multiplication
  const finalTokens: Token[] = [];
  for (let j = 0; j < tokens.length; j++) {
    finalTokens.push(tokens[j]);
    if (j < tokens.length - 1) {
      const current = tokens[j].kind;
      const next = tokens[j + 1].kind;
      const needsMul = 
        (current === 'NUMBER' && (next === 'VAR' || next === 'LPAREN')) ||
        (current === 'RPAREN' && (next === 'VAR' || next === 'LPAREN' || next === 'NUMBER')) ||
        (current === 'VAR' && (next === 'LPAREN' || next === 'VAR' || next === 'NUMBER'));
      
      if (needsMul) {
        finalTokens.push({ kind: 'MUL', value: '×' });
      }
    }
  }

  finalTokens.push({ kind: 'EOF', value: '' });
  return finalTokens;
}

// ─── Parser ────────────────────────────────────────────────────────
class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { kind: 'EOF', value: '' };
  }

  private advance(): Token {
    const t = this.tokens[this.pos] ?? { kind: 'EOF', value: '' };
    this.pos++;
    return t;
  }

  private expect(kind: TokenKind): Token {
    const t = this.peek();
    if (t.kind !== kind) throw new Error(`Expected ${kind} but got ${t.kind} ("${t.value}")`);
    return this.advance();
  }

  parse(env: Record<string, number> = {}): ParseResult {
    try {
      const lhs = this.expression(env);
      
      if (this.peek().kind === 'EQUALS') {
        this.advance();
        if (this.peek().kind === 'EOF') {
          // e.g. "2x + 4 =" -> we must evaluate LHS if possible.
          // If lhs has variables and we didn't substitute, it's not a scalar.
          if (lhs.coeffs.length > 1) {
            // Solve LHS = 0 ? Or just error out?
            // "evaluates expressions with atmost one variable" - if it's 2x+4=0
            if (lhs.coeffs.length === 2) {
              const x = -lhs.coeffs[0] / lhs.coeffs[1];
              return { ok: true, value: Math.round(x * 1e10) / 1e10 };
            }
            return { ok: false, error: 'Cannot evaluate variable expression without value' };
          }
          return { ok: true, value: Math.round(lhs.coeffs[0] * 1e10) / 1e10 };
        } else {
          // LHS = RHS
          const rhs = this.expression(env);
          if (this.peek().kind !== 'EOF') throw new Error(`Unexpected token "${this.peek().value}"`);
          
          const eq = lhs.sub(rhs); // eq = 0
          if (eq.coeffs.length === 1) {
            // e.g. 5 = 5 or 5 = 3
            if (Math.abs(eq.coeffs[0]) < 1e-10) return { ok: true, value: 0 }; // True identity, return 0 (or anything)
            return { ok: false, error: 'No solution' };
          }
          if (eq.coeffs.length === 2) {
            // c0 + c1*x = 0 -> x = -c0 / c1
            const x = -eq.coeffs[0] / eq.coeffs[1];
            return { ok: true, value: Math.round(x * 1e10) / 1e10 };
          }
          if (eq.coeffs.length === 3) {
            // c0 + c1*x + c2*x^2 = 0
            const a = eq.coeffs[2], b = eq.coeffs[1], c = eq.coeffs[0];
            const det = b * b - 4 * a * c;
            if (det < 0) return { ok: false, error: 'No real solution' };
            // Return largest root for now
            const root = (-b + Math.sqrt(det)) / (2 * a);
            return { ok: true, value: Math.round(root * 1e10) / 1e10 };
          }
          return { ok: false, error: 'Polynomial degree too high' };
        }
      }

      if (this.peek().kind !== 'EOF') throw new Error(`Unexpected token "${this.peek().value}"`);

      if (lhs.coeffs.length > 1) return { ok: false, error: 'Cannot evaluate variable expression without value' };
      return { ok: true, value: Math.round(lhs.coeffs[0] * 1e10) / 1e10 };

    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : 'Parse error' };
    }
  }

  private expression(env: Record<string, number>): Polynomial {
    let left = this.term(env);
    while (this.peek().kind === 'PLUS' || this.peek().kind === 'MINUS') {
      const op = this.advance();
      const right = this.term(env);
      left = op.kind === 'PLUS' ? left.add(right) : left.sub(right);
    }
    return left;
  }

  private term(env: Record<string, number>): Polynomial {
    let left = this.unary(env);
    while (this.peek().kind === 'MUL' || this.peek().kind === 'DIV') {
      const op = this.advance();
      const right = this.unary(env);
      if (op.kind === 'DIV') {
        left = left.div(right);
      } else {
        left = left.mul(right);
      }
    }
    return left;
  }

  private unary(env: Record<string, number>): Polynomial {
    if (this.peek().kind === 'MINUS') {
      this.advance();
      return this.unary(env).mul(Polynomial.constant(-1));
    }
    if (this.peek().kind === 'PLUS') {
      this.advance();
      return this.unary(env);
    }
    return this.primary(env);
  }

  private primary(env: Record<string, number>): Polynomial {
    const t = this.peek();
    if (t.kind === 'NUMBER') {
      this.advance();
      return Polynomial.constant(parseFloat(t.value));
    }
    if (t.kind === 'VAR') {
      this.advance();
      if (t.value in env) {
        return Polynomial.constant(env[t.value]);
      }
      return Polynomial.variable();
    }
    if (t.kind === 'LPAREN') {
      this.advance();
      const val = this.expression(env);
      this.expect('RPAREN');
      return val;
    }
    throw new Error(t.kind === 'EOF' ? 'Unexpected end of expression' : `Unexpected token "${t.value}"`);
  }
}

let globalEnv: Record<string, number> = {};

export function evaluate(input: string, env: Record<string, number> = globalEnv): ParseResult {
  if (!input || !input.trim()) return { ok: false, error: 'Empty expression' };
  const tokens = tokenize(input);
  if ('error' in tokens) return { ok: false, error: tokens.error };
  const parser = new Parser(tokens);
  
  // If it's a simple assignment like "x = 5" or "x = 2+3"
  // Let's check tokens: [VAR, EQUALS, ...expr...]
  if (tokens.length >= 4 && tokens[0].kind === 'VAR' && tokens[1].kind === 'EQUALS') {
    const varName = tokens[0].value;
    const subParser = new Parser(tokens.slice(2));
    const res = subParser.parse(env);
    if (res.ok) {
      env[varName] = res.value;
      return { ok: true, value: res.value };
    }
  }

  return parser.parse(env);
}

export function evaluateTokens(tokens: string[], env?: Record<string, number>): ParseResult {
  const expr = tokens.join('');
  return evaluate(expr, env);
}
