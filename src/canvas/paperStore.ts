/**
 * paperStore.ts — Framework-agnostic paper settings store.
 *
 * Requirements: FR-17, FR-20.
 *
 * Follows the same pub-sub pattern as StrokeStore.
 * Settings live in memory only — no localStorage (autosave in a later slice).
 * Zero React imports.
 */

import {
  type PaperType,
  type PaperTone,
  type PaperSpec,
  type PaperFamily,
  getToneSpec,
  getDefaultPaperSpec,
  getPaletteForFamily,
} from './paperSpec';

export type { PaperType, PaperTone, PaperFamily };

export interface PaperState {
  readonly type: PaperType;
  readonly tone: PaperTone;
  readonly spec: PaperSpec;
}

export type PaperStoreListener = (state: Readonly<PaperState>) => void;

/**
 * Manages the current paper type and tone.
 *
 * On construction, the default is `ruled + blush` per the spec.
 */
export class PaperStore {
  private _state: PaperState;
  private readonly _listeners = new Set<PaperStoreListener>();

  constructor() {
    const defaultSpec = getDefaultPaperSpec();
    this._state = {
      type: defaultSpec.type,
      tone: defaultSpec.toneSpec.tone,
      spec: defaultSpec,
    };
  }

  public get state(): Readonly<PaperState> {
    return this._state;
  }

  public get type(): PaperType {
    return this._state.type;
  }

  public get tone(): PaperTone {
    return this._state.tone;
  }

  public get spec(): PaperSpec {
    return this._state.spec;
  }

  /** Returns the ink palette for the current paper family. */
  public get inkPalette() {
    return getPaletteForFamily(this._state.spec.toneSpec.family);
  }

  /** Returns the paper family ('light' | 'dark'). */
  public get family(): PaperFamily {
    return this._state.spec.toneSpec.family;
  }

  public setPaperType(type: PaperType): void {
    if (this._state.type === type) return;
    const toneSpec = getToneSpec(this._state.tone);
    this._state = {
      ...this._state,
      type,
      spec: { type, toneSpec },
    };
    this._notify();
  }

  public setPaperTone(tone: PaperTone): void {
    if (this._state.tone === tone) return;
    const toneSpec = getToneSpec(tone);
    this._state = {
      ...this._state,
      tone,
      spec: { type: this._state.type, toneSpec },
    };
    this._notify();
  }

  /** Subscribe to paper changes. Returns an unsubscribe function. */
  public subscribe(listener: PaperStoreListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener(this._state);
    }
  }
}
