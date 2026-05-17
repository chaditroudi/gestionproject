import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleRecover = this.handleRecover.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Frontend runtime error:", error);
    this.tryAutoRecover();
  }

  tryAutoRecover() {
    try {
      const recoveryKey = "wm_ui_recovery_attempted";
      const alreadyAttempted = window.sessionStorage.getItem(recoveryKey) === "1";

      if (alreadyAttempted) {
        return;
      }

      window.sessionStorage.setItem(recoveryKey, "1");
      this.clearAppStorage();
      window.location.reload();
    } catch {
      // Ignore recovery errors and keep fallback UI visible.
    }
  }

  clearAppStorage() {
    try {
      const storageKeys = ["wm_token", "wm_user", "shell.sidebar.compact"];
      storageKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Ignore storage failures.
    }
  }

  handleRecover() {
    this.clearAppStorage();
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="screen-center">
          <div className="panel notice-panel" style={{ maxWidth: 560 }}>
            <span className="panel-eyebrow">Erreur d'affichage</span>
            <h3>L'interface a rencontre un probleme.</h3>
            <p>
              Recuperation automatique lancee. Si l'erreur reste visible, utilisez
              le bouton ci-dessous pour reinitialiser la session locale.
            </p>
            <button type="button" className="primary-button" onClick={this.handleRecover}>
              Reparer et recharger
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
