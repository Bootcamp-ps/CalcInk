// ─── Recognition Pipeline (Multi-Expression) ──────────────────────
// Orchestrates: group strokes → detect rows → cache → special symbol → preprocess → worker → parser
// Handles debouncing, row caching (dirty-region optimization), and worker lifecycle.

import { Stroke, RowResult as ContractRowResult } from '../contract';
import { groupStrokesIntoSymbols, SymbolGroup } from './symbolGrouper';
import { detectRows, Row } from './rowDetector';
import { preprocessSymbol } from './preprocess';
import { detectSpecialSymbol, SpecialSymbolMatch, ENABLE_BRACKET_RULES, setEnableBracketRules } from './specialSymbols';
import { evaluateTokens as parseMath, resetEnv } from '../parser';

export { ENABLE_BRACKET_RULES, setEnableBracketRules };

if (typeof window !== 'undefined') {
  (window as any).setEnableBracketRules = setEnableBracketRules;
}

export interface RowResult extends ContractRowResult {
  tokens: string[];
  confidences: number[];
  groups: SymbolGroup[];
  result: string | null;
  bounds: Row['bounds'];
}

interface RowCache {
  rowId: string;
  version: number;
  symbols: ContractRowResult['symbols'];
  expression: string;
  evaluation: ContractRowResult['evaluation'];
  strokeIds: Set<string>;
  tokens: string[];
  confidences: number[];
  groups: SymbolGroup[];
  result: string | null;
  bounds: Row['bounds'];
  dirty: boolean;
}

export class RecognitionPipeline {
  private worker: Worker | null = null;
  private nextId = 0;
  private pendingCallbacks = new Map<number, (res: { tokens: string[]; confidences: number[] } | null, error?: string) => void>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentJobId: number | null = null;
  private debounceMs: number;
  private rowCacheMap = new Map<string, RowCache>();
  private varEnv: Record<string, number> = {}; // persists variable assignments across recognition runs

  constructor(debounceMs: number = 600) {
    this.debounceMs = debounceMs;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/recognitionWorker.ts', import.meta.url),
        { type: 'module' },
      );
      this.worker.onmessage = (e: MessageEvent) => {
        const { type, id, labels, confidences, message } = e.data;
        const cb = this.pendingCallbacks.get(id);
        if (!cb) return;
        this.pendingCallbacks.delete(id);

        if (type === 'result') {
          cb({ tokens: labels, confidences });
        } else if (type === 'error') {
          cb(null, message);
        }
      };
    }
    return this.worker;
  }

  public clearCache(): void {
    this.rowCacheMap.clear();
    this.varEnv = {}; // Clear variable memory when canvas is cleared
    resetEnv();
  }

  recognize(strokes: readonly Stroke[], version: number, callback: (results: RowResult[]) => void): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this._runRecognition([...strokes], version, callback);
    }, this.debounceMs);
  }

  private async _runRecognition(strokes: Stroke[], version: number, callback: (results: RowResult[]) => void): Promise<void> {
    if (strokes.length === 0) {
      this.rowCacheMap.clear();
      resetEnv(); // Clear variable memory too
      callback([]);
      return;
    }

    // 1. Full group & row detection
    const allGroups = groupStrokesIntoSymbols(strokes);
    const rows = detectRows(allGroups);

    const pendingTensors: Float32Array[] = [];
    const pendingIndices: { rowIndex: number; groupIndex: number; bracketCandidate?: SpecialSymbolMatch | null }[] = [];

    const newCacheMap = new Map<string, RowCache>();
    const rowResults: RowResult[] = [];

    // 2. Identify dirty rows vs cached rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      // Generate a deterministic signature for the row based on its stroke IDs
      const strokeIds = new Set(row.groups.flatMap(g => g.strokes.map(s => s.id)));
      const signature = Array.from(strokeIds).sort().join('|');

      if (this.rowCacheMap.has(signature)) {
        // Cached!
        const cached = this.rowCacheMap.get(signature)!;
        newCacheMap.set(signature, cached);
        rowResults.push({
          rowId: cached.rowId,
          version,
          symbols: cached.symbols,
          expression: cached.expression,
          evaluation: cached.evaluation,
          tokens: cached.tokens,
          confidences: cached.confidences,
          groups: cached.groups,
          result: cached.result,
          bounds: cached.bounds
        });
      } else {
        // Dirty or new row
        const rowId = `row_${Date.now()}_${r}`;
        const tokens: string[] = new Array(row.groups.length).fill('');
        const confidences: number[] = new Array(row.groups.length).fill(0);

        for (let g = 0; g < row.groups.length; g++) {
          const group = row.groups[g]!;
          const special = detectSpecialSymbol(group);
          if (special && special.token !== '(' && special.token !== ')') {
            tokens[g] = special.token;
            confidences[g] = special.confidence;
          } else {
            pendingIndices.push({
              rowIndex: r,
              groupIndex: g,
              bracketCandidate: special && (special.token === '(' || special.token === ')') ? special : null,
            });
            try {
              const tensor = preprocessSymbol(group.strokes, group.bounds, 100, 3);
              pendingTensors.push(tensor);
            } catch {
              pendingTensors.push(new Float32Array(100 * 100 * 3));
            }
          }
        }

        const newRowResult: RowResult = {
          rowId,
          version,
          symbols: [],
          expression: '',
          evaluation: { ok: false, error: 'NO_EQUALS' },
          tokens,
          confidences,
          groups: row.groups,
          result: null,
          bounds: row.bounds
        };
        rowResults.push(newRowResult);

        newCacheMap.set(signature, {
          rowId,
          version,
          symbols: [],
          expression: '',
          evaluation: { ok: false, error: 'NO_EQUALS' },
          strokeIds,
          tokens,
          confidences,
          groups: row.groups,
          result: null,
          bounds: row.bounds,
          dirty: false
        });
      }
    }

    this.rowCacheMap = newCacheMap;

    // 3. Inference for dirty symbols
    if (pendingTensors.length > 0) {
      if (this.currentJobId !== null) {
        this.pendingCallbacks.delete(this.currentJobId);
      }
      const id = this.nextId++;
      this.currentJobId = id;

      const worker = this.ensureWorker();

      const inferencePromise = new Promise<{ tokens: string[], confidences: number[] } | null>((resolve) => {
        this.pendingCallbacks.set(id, (workerRes, error) => {
          if (error) resolve(null);
          else resolve(workerRes);
        });
      });

      worker.postMessage(
        { type: 'classify', id, tensors: pendingTensors, batchSize: pendingTensors.length },
        pendingTensors.map(t => t.buffer)
      );

      const workerRes = await inferencePromise;
      if (workerRes) {
        for (let i = 0; i < pendingIndices.length; i++) {
          const { rowIndex, groupIndex, bracketCandidate } = pendingIndices[i]!;
          const cnnToken = workerRes.tokens[i] ?? '?';
          const cnnConf = workerRes.confidences[i] ?? 0;

          if (bracketCandidate) {
            // Option B: If the CNN model is confident it's a '3' (which shares a right-bow with ')'), trust the model!
            if (cnnToken === '3' && cnnConf >= 0.70) {
              rowResults[rowIndex]!.tokens[groupIndex] = cnnToken;
              rowResults[rowIndex]!.confidences[groupIndex] = cnnConf;
            } else {
              rowResults[rowIndex]!.tokens[groupIndex] = bracketCandidate.token;
              rowResults[rowIndex]!.confidences[groupIndex] = bracketCandidate.confidence;
            }
          } else {
            rowResults[rowIndex]!.tokens[groupIndex] = cnnToken;
            rowResults[rowIndex]!.confidences[groupIndex] = cnnConf;
          }
        }
      }
    }

    // 4. Parse math per row and populate ContractRowResult fields.
    // Rebuild varEnv from scratch every run — erasing an assignment row removes its
    // variable on the next run; undo/redo are handled for free since they change
    // which strokes (and rows) exist. ML inference is still cached; only the cheap
    // math re-runs on already-known tokens.
    this.varEnv = {};
    const env = this.varEnv;
    for (let r = 0; r < rowResults.length; r++) {
      const rowRes = rowResults[r]!;
      rowRes.version = version;
      rowRes.symbols = rowRes.groups.map((g, idx) => ({
        label: rowRes.tokens[idx] ?? '',
        confidence: rowRes.confidences[idx] ?? 0,
        strokeIds: g.strokes.map(s => s.id),
      }));
      rowRes.expression = rowRes.tokens.join('');

      const hasEquals = rowRes.tokens.includes('=');
      const eqIdx = rowRes.tokens.indexOf('=');
      const afterEq = eqIdx !== -1
        ? rowRes.tokens.slice(eqIdx + 1).filter(t => t !== '=')
        : [];
      const isTwoSided = eqIdx !== -1 && afterEq.length > 0;
      const hasVar = rowRes.tokens.some(t => /^[a-zA-Z]$/.test(t));

      if (rowRes.tokens.length > 0 && hasEquals) {
        if (isTwoSided && hasVar) {
          // Variable assignment or equation solving (e.g. 4x=16)
          const parseResult = parseMath(rowRes.tokens, env);
          if (parseResult.ok) {
            rowRes.result = parseResult.value.toString();
            rowRes.evaluation = { ok: true, value: parseResult.value };
          } else {
            rowRes.result = null;
            rowRes.evaluation = { ok: false, error: 'VAR_PENDING' };
          }
        } else {
          // Non-assignment rows: always parse (may use variables from env)
          const parseResult = parseMath(rowRes.tokens, env);
          if (parseResult.ok) {
            rowRes.result = parseResult.value.toString();
            rowRes.evaluation = { ok: true, value: parseResult.value };
          } else if (hasVar) {
            // Row has a variable but failed (e.g. '3x=' mid-write, or x not yet defined)
            // Show nothing — user is likely still writing
            rowRes.result = null;
            rowRes.evaluation = { ok: false, error: parseResult.error ?? 'VAR_PENDING' };
          } else {
            // Pure arithmetic error — show '?'
            rowRes.result = parseResult.error === 'Undefined' ? 'Undefined' : '?';
            rowRes.evaluation = {
              ok: false,
              error: parseResult.error ?? 'SYNTAX',
            };
          }
        }
      } else {
        rowRes.result = null;
        rowRes.evaluation = { ok: false, error: 'NO_EQUALS' };
      }

      console.log(`%c[CalcInk Recognition] Row ${r + 1}: "${rowRes.expression}" -> ${rowRes.result ?? '(waiting for =)'}`,
        'background: #1e293b; color: #38bdf8; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        {
          tokens: rowRes.tokens,
          confidences: rowRes.confidences.map(c => `${Math.round(c * 100)}%`),
          evaluation: rowRes.evaluation,
        }
      );
    }

    callback(rowResults);
  }

  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingCallbacks.clear();
    this.currentJobId = null;
  }

  destroy(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }
}
