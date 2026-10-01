import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/variables.css';

// Self-hosted fonts (offline-safe, OFL licence via npm)
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/caveat/400.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
