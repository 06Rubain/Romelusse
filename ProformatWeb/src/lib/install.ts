import { useEffect, useState } from 'react';

// Événement non standard de Chrome, Edge et Samsung Internet : proposer l'installation au bon moment
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

// Nouvelle version prête : l'application propose de la lancer (au lieu de changer en pleine saisie)
let waitingWorker: ServiceWorker | null = null;
const markWaiting = (worker: ServiceWorker | null) => { waitingWorker = worker; notify(); };

export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) markWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) markWaiting(worker);
        });
      });
      // Vérifie les mises à jour quand l'application revient au premier plan
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch { /* l'application marche aussi sans */ }
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !waitingWorker) return;
    reloading = true;
    window.location.reload();
  });
};

export const applyUpdate = () => waitingWorker?.postMessage('SKIP_WAITING');

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// canPrompt : le navigateur propose l'installation en un clic ; sinon on affiche la marche à suivre
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return {
    installed: isStandalone(),
    updateReady: Boolean(waitingWorker),
    canPrompt: Boolean(deferred),
    ios: isIos(),
    install: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
  };
}
