/**
 * PenControls.tsx — Pen width and colour controls.
 *
 * Requirements: FR-12, FR-13.
 *
 * This component is kept for backward-compat but is no longer used by Toolbar
 * directly — Toolbar uses WidthControl + ColorSwatches individually.
 * If you need to render both together (e.g. in a palette panel), use this.
 */

import React from 'react';
import type { ToolStore } from '../canvas/toolState';
import { WidthControl } from './WidthControl';
import { ColorSwatches } from './ColorSwatches';
import { LIGHT_PALETTE } from '../canvas/paperSpec';

export interface PenControlsProps {
  toolStore: ToolStore;
  penWidth: number;
  penColor: string;
  /** Optional ink palette — defaults to light palette if omitted. */
  palette?: readonly [string, string, string, string, string];
}

export const PenControls: React.FC<PenControlsProps> = ({
  toolStore,
  penWidth,
  penColor,
  palette = LIGHT_PALETTE.colors,
}) => (
  <div className="pen-controls" role="group" aria-label="Pen styling options">
    <WidthControl toolStore={toolStore} penWidth={penWidth} />
    <ColorSwatches toolStore={toolStore} penColor={penColor} palette={palette} />
  </div>
);
