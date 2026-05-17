import { useEffect, useState } from "react";
import { CreditCard, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TefBus, type TefStatusEvent, type TefFase, type TefProvider } from "@/lib/tef";

interface Props {
  open: boolean;
  provider: TefProvider;
  parcelaAtual?: number;
  totalParcelas?: number;
  onCancelar?: () => void;
  /** true enquanto qualquer TEF está rodando — bloqueia modais ao redor */
  cancelDisabled?: boolean;
}

const faseLabel: Record<TefFase, string> = {
  iniciando: "INICIANDO",
  aguardando_pinpad: "AGUARDANDO PINPAD",
  insira_cartao: "INSIRA / APROXIME O CARTÃO",
  digitando_senha: "DIGITE A SENHA",
  processando: "PROCESSANDO TRANSAÇÃO",
  aprovado: "APROVADO",
  negado: "NEGADO",
  cancelado: "CANCELADO",
  erro: "ERRO",
  timeout: "TEMPO ESGOTADO",
};

const isFinal = (f?: TefFase) =>
  f === "aprovado" || f === "negado" || f === "cancelado" || f === "erro" || f === "timeout";

export default function TefStatusOverlay({
  open,
  provider,
  parcelaAtual,
  totalParcelas,
  onCancelar,
  cancelDisabled,
}: Props) {
  const [eventos, setEventos] = useState<TefStatusEvent[]>([]);
  const ultimo = eventos[eventos.length - 1];

  useEffect(() => {
    if (!open) {
      setEventos([]);
      return;
    }
    const unsub = TefBus.subscribe((ev) => setEventos((prev) => [...prev, ev]));
    return () => { unsub(); };
  }, [open]);

  // Bloqueia ESC / clique fora enquanto rodando
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;

  const fase = ultimo?.fase || "iniciando";
  const aprovado = fase === "aprovado";
  const erro = fase === "negado" || fase === "erro" || fase === "timeout" || fase === "cancelado";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2 bg-muted/40">
          <CreditCard className="h-4 w-4 text-primary" />
          <div className="font-semibold text-sm uppercase tracking-wide">
            INTEGRAÇÃO TEF
          </div>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {provider.toUpperCase()}
          </Badge>
          {totalParcelas && totalParcelas > 1 && (
            <Badge variant="secondary" className="text-[10px]">
              {parcelaAtual}/{totalParcelas}
            </Badge>
          )}
        </div>

        <div className="px-5 py-6 flex flex-col items-center gap-4">
          <div className="relative">
            {!isFinal(fase) && (
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            )}
            <div
              className={`relative h-20 w-20 rounded-full flex items-center justify-center ${
                aprovado
                  ? "bg-emerald-500/20 text-emerald-500"
                  : erro
                  ? "bg-destructive/20 text-destructive"
                  : "bg-primary/15 text-primary"
              }`}
            >
              {aprovado ? (
                <CheckCircle2 className="h-10 w-10" />
              ) : fase === "negado" || fase === "cancelado" ? (
                <XCircle className="h-10 w-10" />
              ) : fase === "erro" || fase === "timeout" ? (
                <AlertTriangle className="h-10 w-10" />
              ) : (
                <Loader2 className="h-10 w-10 animate-spin" />
              )}
            </div>
          </div>

          <div className="text-center">
            <div className="text-base font-bold uppercase tracking-wider">
              {faseLabel[fase]}
            </div>
            <div className="text-xs text-muted-foreground mt-1 min-h-[16px]">
              {ultimo?.mensagem || "Conectando ao PinPad..."}
            </div>
          </div>

          {/* Histórico */}
          <div className="w-full max-h-32 overflow-auto rounded border border-border/40 bg-muted/20 p-2 text-[10px] font-mono space-y-0.5">
            {eventos.map((e, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  e.fase === "aprovado"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : e.fase === "negado" || e.fase === "erro" || e.fase === "timeout"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                <span className="opacity-60">
                  {new Date(e.ts).toLocaleTimeString("pt-BR")}
                </span>
                <span>›</span>
                <span className="uppercase">{e.fase}</span>
                <span className="opacity-80 truncate">— {e.mensagem}</span>
              </div>
            ))}
            {eventos.length === 0 && (
              <div className="text-muted-foreground italic">Aguardando eventos...</div>
            )}
          </div>

          <div className="w-full flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelar}
              disabled={cancelDisabled || isFinal(fase)}
            >
              Cancelar Transação
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
