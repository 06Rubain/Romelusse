import { Component, type ErrorInfo, type ReactNode } from 'react';

// Filet de sécurité : une erreur d'affichage montre un message et un bouton, jamais une page vide
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur d\'affichage :', error, info.componentStack);
  }

  // Recharge en repartant d'une version propre : l'ancienne copie hors ligne est effacée
  reload = async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch { /* cache indisponible : simple rechargement */ }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash-page">
        <img src="/omnicom-logo-dark.png" alt="OmniCom" />
        <h1>Un souci d'affichage</h1>
        <p>La page n'a pas pu s'afficher. Rechargez-la : vos données sont en sécurité sur le serveur.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={this.reload}>Recharger</button>
        <a href="/login" className="muted small">Revenir à l'écran de connexion</a>
      </div>
    );
  }
}
