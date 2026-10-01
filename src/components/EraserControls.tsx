import React from 'react';
import type { ToolStore } from '../canvas/toolState';

export interface EraserControlsProps {
  toolStore: ToolStore;
  eraserRadius: number;
}

export const EraserControls: React.FC<EraserControlsProps> = ({
  toolStore,
  eraserRadius,
}) => {
  return (
    <div className="eraser-controls" role="group" aria-label="Eraser options">
      <div className="slider-control">
        <label htmlFor="eraser-radius-slider" className="control-label">
          Eraser radius <span className="slider-value">{eraserRadius}px</span>
        </label>
        <input
          id="eraser-radius-slider"
          type="range"
          min="6"
          max="50"
          step="2"
          value={eraserRadius}
          onChange={(e) => toolStore.setEraserRadius(parseInt(e.target.value, 10))}
          className="toolbar-slider"
          aria-label="Eraser radius slider"
        />
      </div>
    </div>
  );
};
