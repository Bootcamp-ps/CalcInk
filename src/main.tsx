import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/variables.css';

// Self-hosted fonts — offline-safe, OFL licence via npm (@fontsource).
// Latin subsets only; only the weights actually used.
// Inter: 400 (body), 500 (medium labels), 600 (headings/strong)
// Caveat: 600 (answer text on canvas)
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/caveat/latin-600.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
