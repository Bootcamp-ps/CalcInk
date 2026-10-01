import './App.css';

/** Root application shell. */
function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">CalcInk</h1>
      </header>
      <main className="page">
        {/* Paper surface — canvas layers will be added here in FR-1 */}
        <div className="paper" />
      </main>
    </div>
  );
}

export default App;
