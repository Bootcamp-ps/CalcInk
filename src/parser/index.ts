// ─── CalcInk Math Parser ───────────────────────────────────────────
// Hand-written tokenizer + recursive-descent parser.
// Supports: multi-digit integers, decimals, unary minus, BODMAS/PEMDAS.
// Division by zero → "Undefined". Malformed input → error result, never throws.

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

// ─── Tokenizer ─────────────────────────────────────────────────────
export type TokenKind = 'NUMBER' | 'PLUS' | 'MINUS' | 'MUL' | 'DIV' | 'LPAREN' | 'RPAREN' | 'EQUALS' | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
}

/** Normalize recognition output into canonical characters */
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
        // Trailing dot is okay — treat as integer e.g. "3." → 3
        // But lone dot is invalid
        if (num === '.') return { error: 'Unexpected "."' };
      }
      tokens.push({ kind: 'NUMBER', value: num });
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

  tokens.push({ kind: 'EOF', value: '' });
  return tokens;
}

// ─── Recursive-Descent Parser ──────────────────────────────────────
// Grammar:
//   expression  = term (('+' | '-') term)*
//   term        = unary (('*' | '/') unary)*
//   unary       = ('-')* primary
//   primary     = NUMBER | '(' expression ')'

class Parser {
  private tokens: Token[];
  private pos = 0;
  private divByZero = false;

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

  parse(): ParseResult {
    try {
      const val = this.expression();
      // Skip optional trailing '='
      if (this.peek().kind === 'EQUALS') this.advance();
      if (this.peek().kind !== 'EOF') {
        return { ok: false, error: `Unexpected token "${this.peek().value}"` };
      }
      if (this.divByZero) return { ok: false, error: 'Undefined' };
      // Round to 10 decimal places to avoid floating-point artifacts
      const rounded = Math.round(val * 1e10) / 1e10;
      return { ok: true, value: rounded };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : 'Parse error' };
    }
  }

  private expression(): number {
    let left = this.term();
    while (this.peek().kind === 'PLUS' || this.peek().kind === 'MINUS') {
      const op = this.advance();
      const right = this.term();
      left = op.kind === 'PLUS' ? left + right : left - right;
    }
    return left;
  }

  private term(): number {
    let left = this.unary();
    while (this.peek().kind === 'MUL' || this.peek().kind === 'DIV') {
      const op = this.advance();
      const right = this.unary();
      if (op.kind === 'DIV') {
        if (right === 0) { this.divByZero = true; return 0; }
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  private unary(): number {
    if (this.peek().kind === 'MINUS') {
      this.advance();
      return -this.unary();
    }
    if (this.peek().kind === 'PLUS') {
      this.advance();
      return this.unary();
    }
    return this.primary();
  }

  private primary(): number {
    const t = this.peek();
    if (t.kind === 'NUMBER') {
      this.advance();
      return parseFloat(t.value);
    }
    if (t.kind === 'LPAREN') {
      this.advance();
      const val = this.expression();
      this.expect('RPAREN');
      return val;
    }
    throw new Error(t.kind === 'EOF' ? 'Unexpected end of expression' : `Unexpected token "${t.value}"`);
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Parse and evaluate a math expression string.
 * Tokens may come from recognition (e.g. ["1","8","+","4","×","3","="]).
 * Returns { ok: true, value } or { ok: false, error }.
 * NEVER throws.
 */
export function evaluate(input: string): ParseResult {
  if (!input || !input.trim()) return { ok: false, error: 'Empty expression' };
  const tokens = tokenize(input);
  if ('error' in tokens) return { ok: false, error: tokens.error };
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Evaluate from a token array (e.g. from recognition pipeline).
 * Joins tokens and feeds to evaluate().
 */
export function evaluateTokens(tokens: string[]): ParseResult {
  // Filter out "=" at the end for evaluation but keep it for the parser to skip
  const expr = tokens.join('');
  return evaluate(expr);
}
