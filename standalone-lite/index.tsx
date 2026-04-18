import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { primeAppStorageCache } from './features/shorts-lab/services/appStorageService';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const bootstrap = async () => {
  try {
    await primeAppStorageCache();
  } catch (error) {
    console.warn('[standalone-lite] Failed to prime app storage before render.', error);
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

void bootstrap();
