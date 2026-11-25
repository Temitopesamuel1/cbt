import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      const scriptUrl =
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL ||
        '';
      if (import.meta.env.DEV || scriptUrl.includes('dev-sw.js')) {
        registration.unregister().catch(() => {});
      }
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
