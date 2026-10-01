/**
 * ToolGroup.tsx — Thin wrapper that renders a labelled group with a divider.
 *
 * Requirements: FR-19, NFR-8.
 */

import React from 'react';

export interface ToolGroupProps {
  label: string;
  children: React.ReactNode;
  /** If true, a visual separator is prepended before this group. */
  divider?: boolean;
}

export const ToolGroup: React.FC<ToolGroupProps> = ({
  label,
  children,
  divider = false,
}) => (
  <>
    {divider && <div className="toolbar-divider" aria-hidden="true" />}
    <div className="tool-group" role="group" aria-label={label}>
      {children}
    </div>
  </>
);
