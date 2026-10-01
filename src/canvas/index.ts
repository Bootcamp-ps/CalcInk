// canvas module — re-exports

export { StrokeStore } from './strokeStore';
export type { StrokeStoreEvent, StrokeStoreListener } from './strokeStore';

export { ToolStore, WIDTH_PRESETS } from './toolState';
export type { ToolType, ToolState, WidthPreset } from './toolState';

export { PaperStore } from './paperStore';
export type { PaperState, PaperStoreListener } from './paperStore';

export {
  TONE_SPECS,
  LIGHT_PALETTE,
  DARK_PALETTE,
  RULED_SPACING,
  DOT_SPACING,
  DOT_RADIUS,
  getToneSpec,
  getPaletteForFamily,
  getDefaultPaperSpec,
  drawPaper,
} from './paperSpec';
export type {
  PaperType,
  PaperTone,
  PaperFamily,
  PaperSpec,
  ToneSpec,
  InkPalette,
} from './paperSpec';

export { applyPaperCSS, GRAIN_TILE } from './paperTexture';

export { ensureFontsReady } from './fontsReady';
