import { Component, ReactNode } from "react";

interface State { error: Error | null }

/**
 * Captura erros não tratados em qualquer árvore filha e mostra fallback
 * legível em vez de tela branca. Sem isso, um throw em qualquer page
 * derruba a app inteira.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center shadow-card">
          <h1 className="font-display text-2xl font-extrabold text-primary mb-2">
            Algo deu errado
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            Tivemos um problema ao mostrar esta página. Você pode tentar novamente
            ou voltar ao catálogo.
          </p>
          <pre className="text-left text-xs bg-muted/40 rounded p-3 mb-4 overflow-auto max-h-40">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.reset}
              className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition-colors"
            >
              Tentar novamente
            </button>
            <a
              href="/"
              className="h-10 px-4 rounded-full border border-input bg-background text-sm font-semibold inline-flex items-center hover:bg-accent transition-colors"
            >
              Ir ao catálogo
            </a>
          </div>
        </div>
      </div>
    );
  }
}
