/**
 * icons.tsx — Inline SVG icons for CalcInk toolbar.
 *
 * No icon library. Each icon is a 24×24 SVG path component.
 * All icons accept className and aria-hidden so callers control accessibility.
 */

import React from 'react';

interface IconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  size?: number;
}

const Icon: React.FC<
  IconProps & { children: React.ReactNode; viewBox?: string }
> = ({ children, className, size = 20, 'aria-hidden': ariaHidden = true }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {children}
  </svg>
);

export const PenIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Icon>
);

export const StrokeEraserIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M20 20H7L3 16l10-10 7 7-2.5 2.5" />
    <path d="M6.0001 17.9999 3 15" />
  </Icon>
);

export const PixelEraserIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);

export const UndoIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

export const RedoIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);

export const TrashIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Icon>
);

export const PaperIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="9" x2="16" y2="9" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </Icon>
);

/** Small inline dot icon for paper tone swatches. */
export const CheckIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <polyline points="20 6 9 17 4 12" />
  </Icon>
);
