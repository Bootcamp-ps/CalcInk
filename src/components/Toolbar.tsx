import React from 'react';

type Tool = 'pen' | 'strokeEraser' | 'pixelEraser';

interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          id="btn-pen"
          className={`toolbar-btn ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => setTool('pen')}
          title="Pen (draw)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/>
            <circle cx="11" cy="11" r="2"/>
          </svg>
        </button>
        <button
          id="btn-stroke-eraser"
          className={`toolbar-btn ${tool === 'strokeEraser' ? 'active' : ''}`}
          onClick={() => setTool('strokeEraser')}
          title="Stroke Eraser"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7L3 16l8.5-8.5 9 9L17 20"/>
            <path d="M18 13l-1.5-7.5"/>
          </svg>
        </button>
        <button
          id="btn-pixel-eraser"
          className={`toolbar-btn ${tool === 'pixelEraser' ? 'active' : ''}`}
          onClick={() => setTool('pixelEraser')}
          title="Pixel Eraser"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 21h10"/>
            <rect x="3" y="5" width="18" height="12" rx="2"/>
            <path d="M12 9v4"/>
            <path d="M10 11h4"/>
          </svg>
        </button>
      </div>

      <div className="toolbar-group toolbar-separator">
        <label className="toolbar-label" htmlFor="stroke-width">
          Width
        </label>
        <input
          id="stroke-width"
          type="range"
          min="1"
          max="8"
          step="0.5"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
          className="toolbar-slider"
        />
        <span className="toolbar-value">{strokeWidth}</span>
      </div>

      <div className="toolbar-group toolbar-separator">
        <button
          id="btn-undo"
          className="toolbar-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
        <button
          id="btn-redo"
          className="toolbar-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
        <button
          id="btn-clear"
          className="toolbar-btn toolbar-btn-danger"
          onClick={onClear}
          title="Clear All"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
