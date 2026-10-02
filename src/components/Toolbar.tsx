/**
 * Toolbar.tsx — Floating dock toolbar for CalcInk.
 *
 * Requirements: FR-19, FR-35, FR-36, NFR-8.
 *
 * Layout:
 *   Desktop (>720px): vertical dock fixed to the left edge.
 *   Mobile (≤720px): horizontal bar fixed to the bottom edge.
 *
 * Groups (with dividers):
 *   Tools: Pen | Stroke Eraser | Pixel Eraser
 *   History: Undo | Redo | Clear
 *   Paper: Paper button (opens PaperPopover)
 *
 * Contextual controls:
 *   Pen active  → WidthControl + ColorSwatches
 *   Eraser active → eraser radius slider
 *
 * All existing keyboard shortcuts (FR-36) are preserved.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { StrokeStore } from '../canvas/strokeStore';
import type { ToolStore, ToolState } from '../canvas/toolState';
import type { PaperStore } from '../canvas/paperStore';
import type { PaperFamily } from '../canvas/paperSpec';
import { ToolGroup } from './ToolGroup';
import { WidthControl } from './WidthControl';
import { ColorSwatches } from './ColorSwatches';
import { PaperPopover } from './PaperPopover';
import {
  PenIcon,
  StrokeEraserIcon,
  PixelEraserIcon,
  UndoIcon,
  RedoIcon,
  TrashIcon,
  PaperIcon,
} from './icons';
import { getPaletteForFamily } from '../canvas/paperSpec';
import './Toolbar.css';

export interface ToolbarProps {
  store: StrokeStore;
  toolStore: ToolStore;
  paperStore: PaperStore;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  store,
  toolStore,
  paperStore,
}) => {
  const [canUndo, setCanUndo] = useState(store.canUndo);
  const [canRedo, setCanRedo] = useState(store.canRedo);
  const [hasStrokes, setHasStrokes] = useState(store.strokes.length > 0);
  const [toolState, setToolState] = useState<ToolState>(toolStore.state);
  const [paperFamily, setPaperFamily] = useState<PaperFamily>(
    paperStore.family
  );
  const [popoverOpen, setPopoverOpen] = useState(false);
  const paperBtnRef = useRef<HTMLButtonElement>(null);

  // Sync stroke store
  useEffect(() => {
    const update = () => {
      setCanUndo(store.canUndo);
      setCanRedo(store.canRedo);
      setHasStrokes(store.strokes.length > 0);
    };
    update();
    return store.subscribe(update);
  }, [store]);

  // Sync tool store
  useEffect(
    () => toolStore.subscribe((s) => setToolState(s)),
    [toolStore]
  );

  // Sync paper store (family drives ink palette)
  useEffect(
    () =>
      paperStore.subscribe((s) => {
        setPaperFamily(s.spec.toneSpec.family);
      }),
    [paperStore]
  );

  // Close popover and restore focus to the trigger button
  const closePopover = useCallback(() => {
    setPopoverOpen(false);
    paperBtnRef.current?.focus();
  }, []);

  // Global keyboard shortcuts (FR-36)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          e.shiftKey ? store.redo() : store.undo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          store.redo();
        }
      } else {
        switch (e.key) {
          case 'b':
          case 'B':
            toolStore.setTool('pen');
            break;
          case 'e':
          case 'E':
            toolStore.setTool(
              toolStore.tool === 'stroke-eraser'
                ? 'pixel-eraser'
                : 'stroke-eraser'
            );
            break;
          case '[':
            toolStore.setPenWidth(Math.max(1, toolStore.penWidth - 0.5));
            break;
          case ']':
            toolStore.setPenWidth(Math.min(20, toolStore.penWidth + 0.5));
            break;
          case 'Delete':
            store.clear();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, toolStore]);

  const { tool, penWidth, penColor, eraserRadius } = toolState;
  const palette = getPaletteForFamily(paperFamily).colors;
  const isEraser = tool === 'stroke-eraser' || tool === 'pixel-eraser';

  return (
    <nav className="toolbar" aria-label="Drawing tools">
      {/* ── Brand ─────────────────────────────────────────────── */}
      <span className="toolbar-brand" aria-hidden="true">
        CalcInk
      </span>

      {/* ── Tools group ───────────────────────────────────────── */}
      <ToolGroup label="Tools" divider>
        <button
          type="button"
          className={`toolbar-btn icon-btn${tool === 'pen' ? ' active' : ''}`}
          onClick={() => toolStore.setTool('pen')}
          aria-pressed={tool === 'pen'}
          title="Pen (B)"
        >
          <PenIcon />
          <span className="btn-label">Pen</span>
        </button>

        <button
          type="button"
          className={`toolbar-btn icon-btn${
            tool === 'stroke-eraser' ? ' active' : ''
          }`}
          onClick={() => toolStore.setTool('stroke-eraser')}
          aria-pressed={tool === 'stroke-eraser'}
          title="Stroke eraser (E)"
        >
          <StrokeEraserIcon />
          <span className="btn-label">Eraser</span>
        </button>

        <button
          type="button"
          className={`toolbar-btn icon-btn${
            tool === 'pixel-eraser' ? ' active' : ''
          }`}
          onClick={() => toolStore.setTool('pixel-eraser')}
          aria-pressed={tool === 'pixel-eraser'}
          title="Pixel eraser (E again)"
        >
          <PixelEraserIcon />
          <span className="btn-label">Pixel</span>
        </button>
      </ToolGroup>

      {/* ── History group ─────────────────────────────────────── */}
      <ToolGroup label="History" divider>
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={() => store.undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <UndoIcon />
        </button>

        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={() => store.redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <RedoIcon />
        </button>

        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={() => store.clear()}
          disabled={!hasStrokes}
          title="Clear canvas (Del)"
          aria-label="Clear canvas"
        >
          <TrashIcon />
        </button>
      </ToolGroup>

      {/* ── Paper group ───────────────────────────────────────── */}
      <ToolGroup label="Paper" divider>
        <div className="paper-btn-wrap">
          <button
            ref={paperBtnRef}
            type="button"
            className={`toolbar-btn icon-btn${popoverOpen ? ' active' : ''}`}
            onClick={() => setPopoverOpen((o) => !o)}
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
            title="Paper settings"
          >
            <PaperIcon />
            <span className="btn-label">Paper</span>
          </button>

          {popoverOpen && (
            <PaperPopover paperStore={paperStore} onClose={closePopover} />
          )}
        </div>
      </ToolGroup>

      {/* ── Contextual controls ───────────────────────────────── */}
      {tool === 'pen' && (
        <ToolGroup label="Pen options" divider>
          <WidthControl toolStore={toolStore} penWidth={penWidth} />
          <ColorSwatches
            toolStore={toolStore}
            penColor={penColor}
            palette={palette}
          />
        </ToolGroup>
      )}

      {isEraser && (
        <ToolGroup label="Eraser options" divider>
          <div className="slider-row eraser-row">
            <label htmlFor="eraser-radius-slider" className="slider-label">
              Radius
            </label>
            <input
              id="eraser-radius-slider"
              type="range"
              min="6"
              max="50"
              step="2"
              value={eraserRadius}
              onChange={(e) =>
                toolStore.setEraserRadius(parseInt(e.target.value, 10))
              }
              className="toolbar-slider"
              aria-label={`Eraser radius ${eraserRadius}px`}
            />
            <span className="slider-value" aria-hidden="true">
              {eraserRadius}
            </span>
          </div>
        </ToolGroup>
      )}
    </nav>
  );
};
