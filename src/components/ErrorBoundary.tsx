import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  erro: Error | null;
}

/**
 * Evita tela em branco: se qualquer tela quebrar ao renderizar
 * (ex.: servidor fora do ar devolvendo dados inesperados),
 * mostramos um aviso com botão para tentar de novo.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Erro na tela:", erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-foreground">
              A tela não pôde ser exibida
            </h1>
            <p className="text-sm text-muted-foreground">
              O sistema de gestão não está respondendo agora. Verifique a
              conexão e tente novamente.
            </p>
          </div>
          <p className="rounded-md bg-muted/60 p-2 text-[11px] font-mono text-muted-foreground break-all">
            {this.state.erro.message || "Erro inesperado"}
          </p>
          <Button size="sm" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
