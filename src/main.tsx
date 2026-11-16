import { render } from 'preact';
import { App } from './app';
import { starten } from './store';
import './styles.css';

render(<App />, document.getElementById('app')!);
void starten();

// Service Worker für den Offline-Betrieb (nur im gebauten Zustand)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service Worker nicht registriert', e));
  });
}
