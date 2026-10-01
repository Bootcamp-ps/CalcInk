/**
 * WidthControl.tsx — Width presets + slider for the pen tool.
 *
 * Requirements: FR-12, FR-19.
 * Extracted from PenControls so each component stays under ~200 lines.
 */

import React from 'react';
import type { ToolStore } from '../canvas/toolState';
import { WIDTH_PRESETS } from '../canvas/toolState';

export interface WidthControlProps {
  toolStore: ToolStore;
  penWidth: number;
}

export const WidthControl: React.FC<WidthControlProps> = ({
  toolStore,
  penWidth,
}) => (
  <div className="width-control" role="group" aria-label="Stroke width">
    {/* Presets */}
    <div className="preset-group" role="group" aria-label="Width presets">
      {WIDTH_PRESETS.map((preset) => {
        const isActive = Math.abs(penWidth - preset.value) < 0.1;
        return (
          <button
            key={preset.label}
            type="button"
            className={`toolbar-btn preset-btn${isActive ? ' active' : ''}`}
            onClick={() => toolStore.setPenWidth(preset.value)}
            aria-pressed={isActive}
            title={`${preset.label} (${preset.value}px)`}
            aria-label={`Width ${preset.label}`}
          >
            <span
              className="preset-line"
              style={{ height: `${Math.max(1, preset.value)}px` }}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>

    {/* Slider */}
    <div className="slider-row">
      <label htmlFor="pen-width-slider" className="sr-only">
        Pen width
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
        aria-label={`Pen width ${penWidth.toFixed(1)}px`}
      />
      <span className="slider-value" aria-hidden="true">
        {penWidth.toFixed(1)}
      </span>
    </div>
  </div>
);
