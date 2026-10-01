/**
 * Toolbar.test.tsx — Unit tests for Toolbar and sub-components.
 *
 * Uses React DOM + jsdom directly (no @testing-library dependency).
 *
 * Tests:
 * - Pen-active: width slider and swatch group rendered
 * - Eraser-active: radius slider rendered, no swatch group
 * - Paper popover opens on button click, closes on Escape
 * - aria-pressed states are correct
 * - 6 tone dots rendered in popover
 * - History buttons disabled with empty store
 */

import ReactDOM from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { Toolbar } from '../Toolbar';
import { StrokeStore } from '../../canvas/strokeStore';
import { ToolStore } from '../../canvas/toolState';
import { PaperStore } from '../../canvas/paperStore';

// ---------------------------------------------------------------------------
// Mock applyPaperCSS / GRAIN_TILE (paperTexture calls document.createElement
// during module init to build the grain tile, which is fine in jsdom, but we
// mock it to avoid the canvas API not being fully implemented in jsdom)
// ---------------------------------------------------------------------------
vi.mock('../../canvas/paperTexture', () => ({
  applyPaperCSS: vi.fn(),
  GRAIN_TILE: null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: ReturnType<typeof ReactDOM.createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
});

function renderToolbar(opts: {
  toolStore?: ToolStore;
  store?: StrokeStore;
  paperStore?: PaperStore;
} = {}) {
  const store = opts.store ?? new StrokeStore();
  const toolStore = opts.toolStore ?? new ToolStore();
  const paperStore = opts.paperStore ?? new PaperStore();

  act(() => {
    root.render(
      <Toolbar store={store} toolStore={toolStore} paperStore={paperStore} />
    );
  });

  return { store, toolStore, paperStore };
}

function query(selector: string) {
  return container.querySelector(selector);
}
function queryAll(selector: string) {
  return Array.from(container.querySelectorAll(selector));
}
function getByLabel(label: string) {
  const el = container.querySelector(`[aria-label="${label}"]`);
  if (!el) throw new Error(`No element with aria-label="${label}"`);
  return el as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tool buttons
// ---------------------------------------------------------------------------

describe('Toolbar — tool buttons', () => {
  it('renders Pen, Stroke eraser, Pixel eraser buttons', () => {
    renderToolbar();
    expect(query('[title="Pen (B)"]')).toBeTruthy();
    expect(query('[title="Stroke eraser (E)"]')).toBeTruthy();
    expect(query('[title="Pixel eraser (E again)"]')).toBeTruthy();
  });

  it('Pen button has aria-pressed=true by default', () => {
    renderToolbar();
    const penBtn = query('[title="Pen (B)"]') as HTMLElement;
    expect(penBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('Stroke eraser gets aria-pressed=true when active', () => {
    const toolStore = new ToolStore();
    renderToolbar({ toolStore });

    act(() => {
      toolStore.setTool('stroke-eraser');
    });

    const btn = query('[title="Stroke eraser (E)"]') as HTMLElement;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Contextual controls
// ---------------------------------------------------------------------------

describe('Toolbar — contextual controls', () => {
  it('shows pen width slider when pen is active', () => {
    const toolStore = new ToolStore();
    toolStore.setTool('pen');
    renderToolbar({ toolStore });

    const slider = query('#pen-width-slider');
    expect(slider).toBeTruthy();
  });

  it('shows ink colour swatches when pen is active', () => {
    const toolStore = new ToolStore();
    toolStore.setTool('pen');
    renderToolbar({ toolStore });

    const swatchGroup = query('[aria-label="Ink colour"]');
    expect(swatchGroup).toBeTruthy();
  });

  it('hides pen width slider when stroke-eraser is active', () => {
    const toolStore = new ToolStore();
    toolStore.setTool('stroke-eraser');
    renderToolbar({ toolStore });

    expect(query('#pen-width-slider')).toBeNull();
  });

  it('hides ink colour swatches when stroke-eraser is active', () => {
    const toolStore = new ToolStore();
    toolStore.setTool('stroke-eraser');
    renderToolbar({ toolStore });

    expect(query('[aria-label="Ink colour"]')).toBeNull();
  });

  it('shows eraser radius slider when stroke-eraser is active', () => {
    const toolStore = new ToolStore();
    toolStore.setTool('stroke-eraser');
    renderToolbar({ toolStore });

    expect(query('#eraser-radius-slider')).toBeTruthy();
  });

  it('shows eraser radius slider when pixel-eraser is active', () => {
    const toolStore = new ToolStore();
    toolStore.setTool('pixel-eraser');
    renderToolbar({ toolStore });

    expect(query('#eraser-radius-slider')).toBeTruthy();
  });

  it('hides eraser radius slider when pen is active', () => {
    const toolStore = new ToolStore();
    toolStore.setTool('pen');
    renderToolbar({ toolStore });

    expect(query('#eraser-radius-slider')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Paper popover
// ---------------------------------------------------------------------------

describe('Toolbar — paper popover', () => {
  it('popover is not shown initially', () => {
    renderToolbar();
    expect(query('[role="dialog"]')).toBeNull();
  });

  it('popover opens on Paper button click', () => {
    renderToolbar();
    const paperBtn = query('[title="Paper settings"]') as HTMLElement;
    act(() => {
      paperBtn.click();
    });
    expect(query('[role="dialog"]')).toBeTruthy();
  });

  it('paper button has aria-expanded=true when popover is open', () => {
    renderToolbar();
    const paperBtn = query('[title="Paper settings"]') as HTMLElement;
    expect(paperBtn.getAttribute('aria-expanded')).toBe('false');
    act(() => {
      paperBtn.click();
    });
    expect(paperBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('popover closes on Escape key', () => {
    renderToolbar();
    const paperBtn = query('[title="Paper settings"]') as HTMLElement;
    act(() => {
      paperBtn.click();
    });
    expect(query('[role="dialog"]')).toBeTruthy();

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);
    });
    expect(query('[role="dialog"]')).toBeNull();
  });

  it('popover shows Plain, Ruled, Dot buttons', () => {
    renderToolbar();
    act(() => {
      (query('[title="Paper settings"]') as HTMLElement).click();
    });
    const labels = queryAll('.segment-btn').map((el) => el.textContent?.trim());
    expect(labels).toContain('Plain');
    expect(labels).toContain('Ruled');
    expect(labels).toContain('Dot');
  });

  it('selected paper type has aria-pressed=true in popover', () => {
    const paperStore = new PaperStore();
    paperStore.setPaperType('dot');
    renderToolbar({ paperStore });

    act(() => {
      (query('[title="Paper settings"]') as HTMLElement).click();
    });

    const buttons = queryAll('.segment-btn');
    const dotBtn = buttons.find((b) => b.textContent?.trim() === 'Dot') as HTMLElement;
    const ruledBtn = buttons.find((b) => b.textContent?.trim() === 'Ruled') as HTMLElement;

    expect(dotBtn.getAttribute('aria-pressed')).toBe('true');
    expect(ruledBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('popover has 6 tone dot buttons', () => {
    renderToolbar();
    act(() => {
      (query('[title="Paper settings"]') as HTMLElement).click();
    });
    const toneDots = queryAll('.tone-dot');
    expect(toneDots).toHaveLength(6);
  });

  it('selected tone dot has aria-pressed=true', () => {
    const paperStore = new PaperStore();
    // default tone is cream in test env (matchMedia returns false → light mode)
    renderToolbar({ paperStore });

    act(() => {
      (query('[title="Paper settings"]') as HTMLElement).click();
    });

    const creamDot = query('[title="Cream"]') as HTMLElement;
    expect(creamDot.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking a tone dot calls setPaperTone', () => {
    const paperStore = new PaperStore();
    const spy = vi.spyOn(paperStore, 'setPaperTone');
    renderToolbar({ paperStore });

    act(() => {
      (query('[title="Paper settings"]') as HTMLElement).click();
    });

    const sageDot = query('[title="Sage"]') as HTMLElement;
    act(() => {
      sageDot.click();
    });
    expect(spy).toHaveBeenCalledWith('sage');
  });
});

// ---------------------------------------------------------------------------
// History buttons
// ---------------------------------------------------------------------------

describe('Toolbar — history buttons', () => {
  it('Undo button is disabled when store has no undo history', () => {
    renderToolbar();
    const undoBtn = getByLabel('Undo');
    expect((undoBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Redo button is disabled when store has no redo history', () => {
    renderToolbar();
    const redoBtn = getByLabel('Redo');
    expect((redoBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Clear button is disabled when store has no strokes', () => {
    renderToolbar();
    const clearBtn = getByLabel('Clear canvas');
    expect((clearBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
