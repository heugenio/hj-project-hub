import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaScope } from "@/lib/empresa-scope";
import { enviarMensagemWhatsapp, sugerirRespostaIA, toggleIAConversa } from "@/lib/whatsapp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageCircle, Search, Send, Sparkles, Bot, BotOff } from "lucide-react";
import { toast } from "sonner";

type Conversa = {
  id: string; telefone: string; nome_contato: string | null; foto_url: string | null;
  status: string; ultima_mensagem: string | null; ultima_mensagem_em: string | null;
  ultima_direcao: "recebida" | "enviada" | null; nao_lidas: number; ia_ativa: boolean;
  oportunidade_id: string | null;
};
type Msg = {
  id: string; direcao: "recebida" | "enviada"; tipo: string; conteudo: string | null;
  midia_url: string | null; status: string; enviada_em: string; gerada_por_ia: boolean;
};

export default function Inbox() {
  const { empresa_id, isReady, usrs_id } = useEmpresaScope();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [pedindoIA, setPedindoIA] = useState(false);
  const [togglingIA, setTogglingIA] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversas } = useQuery({
    queryKey: ["wa-conversas", empresa_id], enabled: isReady,
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_conversas").select("*")
        .eq("empresa_id", empresa_id).order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(200);
      return (data ?? []) as Conversa[];
    },
  });

  const { data: mensagens } = useQuery({
    queryKey: ["wa-msgs", selectedId], enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_mensagens").select("*")
        .eq("conversa_id", selectedId!).order("enviada_em", { ascending: true }).limit(500);
      return (data ?? []) as Msg[];
    },
  });

  const selected = useMemo(() => conversas?.find((c) => c.id === selectedId) ?? null, [conversas, selectedId]);

  useEffect(() => {
    if (!isReady) return;
    const ch = supabase.channel(`inbox-${empresa_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensagens", filter: `empresa_id=eq.${empresa_id}` },
        () => { qc.invalidateQueries({ queryKey: ["wa-conversas"] }); qc.invalidateQueries({ queryKey: ["wa-msgs"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversas", filter: `empresa_id=eq.${empresa_id}` },
        () => qc.invalidateQueries({ queryKey: ["wa-conversas"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresa_id, isReady, qc]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [mensagens?.length, selectedId]);

  useEffect(() => {
    if (!selectedId || !selected || selected.nao_lidas === 0) return;
    void supabase.from("whatsapp_conversas").update({ nao_lidas: 0 }).eq("id", selectedId);
  }, [selectedId, selected]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas ?? [];
    return (conversas ?? []).filter((c) => (c.nome_contato ?? "").toLowerCase().includes(q) || c.telefone.includes(q));
  }, [conversas, busca]);

  const handleEnviar = async () => {
    if (!selectedId || !texto.trim()) return;
    setEnviando(true);
    try {
      await enviarMensagemWhatsapp({ empresa_id, conversa_id: selectedId, texto: texto.trim(), enviada_por: usrs_id });
      setTexto(""); setSugestoes([]);
      qc.invalidateQueries({ queryKey: ["wa-msgs"] });
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally { setEnviando(false); }
  };

  const handleSugerir = async () => {
    if (!selectedId) return;
    setPedindoIA(true);
    try {
      const res = await sugerirRespostaIA({ empresa_id, conversa_id: selectedId });
      if (res?.sugestoes) setSugestoes(res.sugestoes);
      else toast.error(res?.error ?? "IA indisponível");
    } catch (e: any) { toast.error(e?.message ?? "Erro IA"); } finally { setPedindoIA(false); }
  };

  const handleToggleIA = async () => {
    if (!selected) return;
    setTogglingIA(true);
    try {
      await toggleIAConversa(selected.id, !selected.ia_ativa, usrs_id);
      toast.success(selected.ia_ativa ? "IA pausada" : "IA reativada");
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); } finally { setTogglingIA(false); }
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[320px_1fr] overflow-hidden">
      <aside className="flex flex-col border-r bg-card">
        <div className="border-b p-3">
          <div className="mb-2 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Conversas</h2>
            <Badge variant="outline" className="ml-auto">{conversas?.length ?? 0}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="h-8 pl-7 text-xs" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtradas.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa ainda.</p>}
          {filtradas.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`flex w-full items-center gap-3 border-b border-border/50 p-3 text-left transition-colors hover:bg-muted/50 ${selectedId === c.id ? "bg-muted" : ""}`}>
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={c.foto_url ?? undefined} />
                <AvatarFallback>{(c.nome_contato ?? c.telefone).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.nome_contato ?? c.telefone}</p>
                  {c.ultima_mensagem_em && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(c.ultima_mensagem_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{c.ultima_mensagem ?? "—"}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.ia_ativa && <Bot className="h-3 w-3 text-primary" />}
                    {c.nao_lidas > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full bg-primary px-1.5 text-[10px]">{c.nao_lidas}</Badge>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden bg-background">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageCircle className="h-12 w-12 opacity-30" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={selected.foto_url ?? undefined} />
                <AvatarFallback>{(selected.nome_contato ?? selected.telefone).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">{selected.nome_contato ?? selected.telefone}</p>
                <p className="text-xs text-muted-foreground">{selected.telefone}</p>
              </div>
              {selected.ia_ativa && <Badge variant="outline" className="gap-1 border-primary/40 text-primary"><Bot className="h-3 w-3" /> IA ativa</Badge>}
              <Button variant={selected.ia_ativa ? "outline" : "default"} size="sm" onClick={handleToggleIA} disabled={togglingIA}>
                {togglingIA ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : selected.ia_ativa ? <BotOff className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                <span className="ml-1 hidden md:inline">{selected.ia_ativa ? "Assumir" : "Reativar IA"}</span>
              </Button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/20 px-4 py-4">
              {(mensagens ?? []).map((m) => (
                <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.direcao === "enviada" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                    {m.gerada_por_ia && <div className="mb-1 flex items-center gap-1 text-[10px] opacity-80"><Sparkles className="h-3 w-3" /> IA</div>}
                    <p className="whitespace-pre-wrap break-words">{m.conteudo ?? `[${m.tipo}]`}</p>
                    <div className="mt-1 text-right text-[10px] opacity-70">
                      {new Date(m.enviada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sugestoes.length > 0 && (
              <div className="border-t bg-muted/40 px-4 py-2 space-y-1">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Sugestões IA</p>
                <div className="flex flex-wrap gap-1">
                  {sugestoes.map((s, i) => (
                    <button key={i} onClick={() => { setTexto(s); setSugestoes([]); }}
                      className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            )}

            <footer className="border-t bg-card px-3 py-2">
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" onClick={handleSugerir} disabled={pedindoIA} className="gap-1">
                  {pedindoIA ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Sugerir</span>
                </Button>
                <Input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
                  placeholder="Mensagem..." className="h-9" />
                <Button onClick={handleEnviar} disabled={enviando || !texto.trim()} size="sm" className="gap-1">
                  {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
