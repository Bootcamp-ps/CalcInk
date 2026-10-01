import { useMemo } from 'react';
import { StrokeStore } from './canvas/strokeStore';
import { ToolStore } from './canvas/toolState';
import { CanvasPage } from './canvas/CanvasPage';
import { Toolbar } from './components/Toolbar';
import './App.css';

/** Root application shell. */
function App() {
  const store = useMemo(() => new StrokeStore(), []);
  const toolStore = useMemo(() => new ToolStore(), []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">CalcInk</h1>
        <Toolbar store={store} toolStore={toolStore} />
      </header>
      <main className="page">
        {/* Paper surface (CSS) */}
        <div className="paper" />
        {/* Stacked canvas layers and input handling */}
        <CanvasPage store={store} toolStore={toolStore} />
      </main>
    </div>
  );
}

export default App;
