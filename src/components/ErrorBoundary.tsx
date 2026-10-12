import { Component, type ErrorInfo, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

// Catches an error thrown while rendering what it wraps, so the player gets a message and a way out
// instead of a blank screen. Given a new `key` (the page's address), it starts clean again: moving
// to another page clears the error.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert">
        <EmptyState
          icon="info"
          title="Une erreur est survenue"
          description="Cette page n'a pas pu s'afficher. Rechargez-la pour réessayer."
        >
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </EmptyState>
      </div>
    );
  }
}
