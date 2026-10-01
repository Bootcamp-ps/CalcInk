import React, { useEffect, useState } from 'react';
import type { StrokeStore } from '../canvas/strokeStore';
import type { ToolStore, ToolState } from '../canvas/toolState';
import { PenControls } from './PenControls';
import { EraserControls } from './EraserControls';
import './Toolbar.css';

export interface ToolbarProps {
  store: StrokeStore;
  toolStore: ToolStore;
}

export const Toolbar: React.FC<ToolbarProps> = ({ store, toolStore }) => {
  const [canUndo, setCanUndo] = useState(store.canUndo);
  const [canRedo, setCanRedo] = useState(store.canRedo);
  const [hasStrokes, setHasStrokes] = useState(store.strokes.length > 0);
  const [toolState, setToolState] = useState<ToolState>(toolStore.state);

  // Sync stroke store changes
  useEffect(() => {
    const updateStoreState = () => {
      setCanUndo(store.canUndo);
      setCanRedo(store.canRedo);
      setHasStrokes(store.strokes.length > 0);
    };

    updateStoreState();
    return store.subscribe(updateStoreState);
  }, [store]);

  // Sync tool store changes
  useEffect(() => {
    return toolStore.subscribe((state) => {
      setToolState(state);
    });
  }, [toolStore]);

  // Global keyboard shortcuts (FR-36)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside an input or editable field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            store.redo();
          } else {
            store.undo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          store.redo();
        }
      } else {
        if (e.key === 'b' || e.key === 'B') {
          toolStore.setTool('pen');
        } else if (e.key === 'e' || e.key === 'E') {
          toolStore.setTool(
            toolStore.tool === 'stroke-eraser' ? 'pixel-eraser' : 'stroke-eraser'
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [store, toolStore]);

  const { tool, penWidth, penColor, eraserRadius } = toolState;

  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools and actions">
      {/* Tool Selection */}
      <div className="tool-selector" role="group" aria-label="Tool selection">
        <button
          type="button"
          className={`toolbar-btn tool-btn ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => toolStore.setTool('pen')}
          aria-pressed={tool === 'pen'}
          title="Pen (B)"
          aria-label="Pen tool"
        >
          Pen
        </button>
        <button
          type="button"
          className={`toolbar-btn tool-btn ${tool === 'stroke-eraser' ? 'active' : ''}`}
          onClick={() => toolStore.setTool('stroke-eraser')}
          aria-pressed={tool === 'stroke-eraser'}
          title="Stroke Eraser (E)"
          aria-label="Stroke eraser tool"
        >
          Stroke Eraser
        </button>
        <button
          type="button"
          className={`toolbar-btn tool-btn ${tool === 'pixel-eraser' ? 'active' : ''}`}
          onClick={() => toolStore.setTool('pixel-eraser')}
          aria-pressed={tool === 'pixel-eraser'}
          title="Pixel Eraser"
          aria-label="Pixel eraser tool"
        >
          Pixel Eraser
        </button>
      </div>

      <div className="toolbar-separator" aria-hidden="true" />

      {/* Contextual controls based on active tool */}
      {tool === 'pen' ? (
        <PenControls
          toolStore={toolStore}
          penWidth={penWidth}
          penColor={penColor}
        />
      ) : (
        <EraserControls
          toolStore={toolStore}
          eraserRadius={eraserRadius}
        />
      )}

      <div className="toolbar-separator" aria-hidden="true" />

      {/* History & canvas management actions */}
      <div className="history-group" role="group" aria-label="History actions">
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
    </div>
  );
};
