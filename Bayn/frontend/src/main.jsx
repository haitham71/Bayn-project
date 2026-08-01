import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import Providers from './app/providers.jsx';
import './styles/variables.css';
import './styles/globals.css';
import './styles/enter.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
