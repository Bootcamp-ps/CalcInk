/**
 * Toolbar.tsx — Minimal toolbar for CalcInk supporting Undo, Redo, Clear.
 *
 * Requirements: FR-11, FR-35, FR-36.
 * - Undo (Ctrl/Cmd+Z)
 * - Redo (Ctrl/Cmd+Shift+Z, Ctrl+Y)
 * - Clear canvas (undoable)
 * - Accessible tooltips and disabled states.
 */

import React, { useEffect, useState } from 'react';
import type { StrokeStore } from '../canvas/strokeStore';
import './Toolbar.css';

export interface ToolbarProps {
  store: StrokeStore;
}

export const Toolbar: React.FC<ToolbarProps> = ({ store }) => {
  const [canUndo, setCanUndo] = useState(store.canUndo);
  const [canRedo, setCanRedo] = useState(store.canRedo);
  const [hasStrokes, setHasStrokes] = useState(store.strokes.length > 0);

  useEffect(() => {
    const updateState = () => {
      setCanUndo(store.canUndo);
      setCanRedo(store.canRedo);
      setHasStrokes(store.strokes.length > 0);
    };

    updateState();
    return store.subscribe(updateState);
  }, [store]);

  // Global keyboard shortcuts (FR-36)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modKey) return;

      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
          e.preventDefault();
          store.redo();
        } else {
          // Undo: Ctrl+Z / Cmd+Z
          e.preventDefault();
          store.undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        // Redo: Ctrl+Y
        e.preventDefault();
        store.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [store]);

  return (
    <div className="toolbar" role="toolbar" aria-label="Canvas actions">
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => store.undo()}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        Undo
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => store.redo()}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
        aria-label="Redo"
      >
        Redo
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => store.clear()}
        disabled={!hasStrokes}
        title="Clear canvas"
        aria-label="Clear canvas"
      >
        Clear
      </button>
    </div>
  );
};
