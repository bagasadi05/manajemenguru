
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// In development, ensure no stale Service Worker or caches interfere with Vite HMR
if (import.meta && (import.meta as any).env && (import.meta as any).env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((names) => {
      names
        .filter((name) => name.startsWith('guru-pwa-cache-'))
        .forEach((name) => caches.delete(name));
    }).catch(() => {});
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
