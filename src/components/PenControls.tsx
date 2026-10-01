import React from 'react';
import {
  type ToolStore,
  WIDTH_PRESETS,
  COLOR_SWATCHES,
} from '../canvas/toolState';

export interface PenControlsProps {
  toolStore: ToolStore;
  penWidth: number;
  penColor: string;
}

export const PenControls: React.FC<PenControlsProps> = ({
  toolStore,
  penWidth,
  penColor,
}) => {
  return (
    <div className="pen-controls" role="group" aria-label="Pen styling options">
      {/* Width presets */}
      <div className="preset-group" role="group" aria-label="Stroke width presets">
        {WIDTH_PRESETS.map((preset) => {
          const isActive = Math.abs(penWidth - preset.value) < 0.1;
          return (
            <button
              key={preset.label}
              type="button"
              className={`toolbar-btn preset-btn ${isActive ? 'active' : ''}`}
              onClick={() => toolStore.setPenWidth(preset.value)}
              aria-pressed={isActive}
              title={`Width preset: ${preset.label} (${preset.value}px)`}
              aria-label={`Width ${preset.label}`}
            >
              <span
                className="preset-preview-line"
                style={{ height: `${preset.value}px` }}
                aria-hidden="true"
              />
              <span className="preset-label">{preset.label}</span>
            </button>
          );
        })}
      </div>

      {/* Width slider */}
      <div className="slider-control">
        <label htmlFor="pen-width-slider" className="control-label">
          Width <span className="slider-value">{penWidth.toFixed(1)}px</span>
        </label>
        <input
          id="pen-width-slider"
          type="range"
          min="1"
          max="12"
          step="0.5"
          value={penWidth}
          onChange={(e) => toolStore.setPenWidth(parseFloat(e.target.value))}
          className="toolbar-slider"
          aria-label="Pen width slider"
        />
      </div>

      {/* Color swatches */}
      <div className="swatch-group" role="group" aria-label="Ink color swatches">
        {COLOR_SWATCHES.map((color) => {
          const isActive = penColor === color;
          return (
            <button
              key={color}
              type="button"
              className={`swatch-btn ${isActive ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => toolStore.setPenColor(color)}
              aria-pressed={isActive}
              title={`Ink color: ${color}`}
              aria-label={`Color ${color}`}
            >
              {isActive && <span className="swatch-check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
