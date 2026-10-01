/**
 * PaperPopover.tsx — Paper type and tone picker popover.
 *
 * Requirements: FR-17, FR-20, NFR-8.
 *
 * - Segmented control for Plain / Ruled / Dot paper types.
 * - Six colour dots (one per tone) with the selected one ringed.
 * - Closes on Escape and outside click; removes those listeners on cleanup.
 * - Focus is managed (first focusable element receives focus on open).
 * - aria-expanded on the trigger; role="dialog" on the popover panel.
 */

import React, { useEffect, useRef } from 'react';
import type { PaperStore } from '../canvas/paperStore';
import type { PaperType, PaperTone } from '../canvas/paperSpec';
import { TONE_SPECS } from '../canvas/paperSpec';

export interface PaperPopoverProps {
  paperStore: PaperStore;
  onClose: () => void;
}

const PAPER_TYPES: { value: PaperType; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'ruled', label: 'Ruled' },
  { value: 'dot', label: 'Dot' },
];

/** Tooltip labels for each tone. */
const TONE_LABELS: Record<PaperTone, string> = {
  cream: 'Cream',
  white: 'White',
  'blue-grey': 'Blue grey',
  sage: 'Sage',
  blush: 'Blush',
  chalkboard: 'Chalkboard',
};

export const PaperPopover: React.FC<PaperPopoverProps> = ({
  paperStore,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const currentType = paperStore.type;
  const currentTone = paperStore.tone;

  // Focus the first button on mount
  useEffect(() => {
    const firstBtn = panelRef.current?.querySelector<HTMLElement>('button, [tabindex]');
    firstBtn?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so click on the trigger button is caught before bubbling
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="paper-popover"
      role="dialog"
      aria-label="Paper settings"
      aria-modal="false"
    >
      {/* Paper type segmented control */}
      <div className="popover-section">
        <p className="popover-label" id="paper-type-label">
          Style
        </p>
        <div
          className="segmented-control"
          role="group"
          aria-labelledby="paper-type-label"
        >
          {PAPER_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`segment-btn${currentType === value ? ' active' : ''}`}
              onClick={() => paperStore.setPaperType(value)}
              aria-pressed={currentType === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone colour dots */}
      <div className="popover-section">
        <p className="popover-label" id="paper-tone-label">
          Colour
        </p>
        <div
          className="tone-dots"
          role="group"
          aria-labelledby="paper-tone-label"
        >
          {TONE_SPECS.map((spec) => {
            const isActive = currentTone === spec.tone;
            return (
              <button
                key={spec.tone}
                type="button"
                className={`tone-dot${isActive ? ' active' : ''}`}
                style={{ backgroundColor: spec.preview }}
                onClick={() => {
                  paperStore.setPaperTone(spec.tone);
                }}
                aria-pressed={isActive}
                title={TONE_LABELS[spec.tone]}
                aria-label={`${TONE_LABELS[spec.tone]}${isActive ? ' (selected)' : ''}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
