/**
 * ColorSwatches.tsx — Ink colour swatches for the current paper palette.
 *
 * Requirements: FR-13, FR-17.
 *
 * Receives the palette colours from the parent so the component stays pure.
 * When the paper family changes, the parent passes a new palette; existing
 * strokes in the store keep their stored colour (not touched here).
 */

import React from 'react';
import type { ToolStore } from '../canvas/toolState';
import { CheckIcon } from './icons';

export interface ColorSwatchesProps {
  toolStore: ToolStore;
  penColor: string;
  /** Five ink colours from the current paper palette. */
  palette: readonly [string, string, string, string, string];
}

export const ColorSwatches: React.FC<ColorSwatchesProps> = ({
  toolStore,
  penColor,
  palette,
}) => (
  <div className="swatch-group" role="group" aria-label="Ink colour">
    {palette.map((color, index) => {
      const isActive = penColor === color;
      return (
        <button
          key={color}
          type="button"
          className={`swatch-btn${isActive ? ' active' : ''}`}
          style={{ backgroundColor: color }}
          onClick={() => toolStore.setPenColor(color)}
          aria-pressed={isActive}
          title={`Ink colour ${index + 1}`}
          aria-label={`Ink colour ${index + 1}${isActive ? ' (selected)' : ''}`}
        >
          {isActive && (
            <CheckIcon
              size={14}
              className="swatch-check"
              aria-hidden="true"
            />
          )}
        </button>
      );
    })}
  </div>
);
