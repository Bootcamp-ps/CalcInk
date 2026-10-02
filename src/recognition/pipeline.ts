// ─── Recognition Pipeline (Multi-Expression) ──────────────────────
// Orchestrates: group strokes → detect rows → cache → special symbol → preprocess → worker → parser
// Handles debouncing, row caching (dirty-region optimization), and worker lifecycle.

import { Stroke } from '../canvas/strokeModel';
import { groupStrokesIntoSymbols, SymbolGroup } from './symbolGrouper';
import { detectRows, Row } from './rowDetector';
import { preprocessSymbol } from './preprocess';
import { detectSpecialSymbol } from './specialSymbols';
import { parseMath } from '../parser';

export interface RowResult {
  rowId: string;
  tokens: string[];
  confidences: number[];
  groups: SymbolGroup[];
  result: string | null;
  bounds: Row['bounds'];
}

type WorkerCallback = (results: RowResult[] | null, error?: string) => void;

interface RowCache {
  rowId: string;
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
  }

  recognize(strokes: readonly Stroke[], callback: WorkerCallback): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this._runRecognition([...strokes], callback);
    }, this.debounceMs);
  }

  private async _runRecognition(strokes: Stroke[], callback: WorkerCallback): Promise<void> {
    if (strokes.length === 0) {
      this.rowCacheMap.clear();
      callback([]);
      return;
    }

    // 1. Full group & row detection
    // (Optimization: we could map new strokes to cached rows, but for simplicity
    // and robustness we re-group all strokes into rows, and match them against cache by stable stroke IDs).
    const allGroups = groupStrokesIntoSymbols(strokes);
    const rows = detectRows(allGroups);

    const pendingTensors: Float32Array[] = [];
    const pendingIndices: { rowIndex: number; groupIndex: number }[] = [];
    
    const newCacheMap = new Map<string, RowCache>();
    const rowResults: RowResult[] = [];

    // 2. Identify dirty rows vs cached rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      // Generate a deterministic signature for the row based on its stroke IDs
      const strokeIds = new Set(row.groups.flatMap(g => g.strokes.map(s => s.id)));
      const signature = Array.from(strokeIds).sort().join('|');

      if (this.rowCacheMap.has(signature)) {
        // Cached!
        const cached = this.rowCacheMap.get(signature)!;
        newCacheMap.set(signature, cached);
        rowResults.push({
          rowId: cached.rowId,
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
          const group = row.groups[g];
          const special = detectSpecialSymbol(group);
          if (special) {
            tokens[g] = special.token;
            confidences[g] = special.confidence;
          } else {
            pendingIndices.push({ rowIndex: r, groupIndex: g });
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
          tokens,
          confidences,
          groups: row.groups,
          result: null,
          bounds: row.bounds
        };
        rowResults.push(newRowResult);
        
        newCacheMap.set(signature, {
          rowId,
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
      
      const inferencePromise = new Promise<{tokens: string[], confidences: number[]} | null>((resolve) => {
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
          const { rowIndex, groupIndex } = pendingIndices[i];
          rowResults[rowIndex].tokens[groupIndex] = workerRes.tokens[i] ?? '?';
          rowResults[rowIndex].confidences[groupIndex] = workerRes.confidences[i] ?? 0;
        }
      }
    }

    // 4. Parse math per row
    for (const rowRes of rowResults) {
      if (rowRes.tokens.length > 0 && rowRes.tokens[rowRes.tokens.length - 1] === '=') {
        const parseResult = parseMath(rowRes.tokens);
        if (parseResult.ok) {
          rowRes.result = parseResult.value.toString();
        } else {
          rowRes.result = '?';
        }
      }
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
