import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/base-url";
import {
  Plus, Calendar, Clock, RefreshCw, Trash2, Play, Pause,
  CheckCircle2, AlertCircle, Send, Pencil
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CampanhaAgendada {
  id: string;
  nome: string;
  tipo: string;
  canal: string;
  recorrencia: string;
  dia_semana: number;
  horario: string;
  mensagem: string;
  imagem_url: string | null;
  filtro_grupo: string | null;
  filtro_produto: string | null;
  filtro_unem_id: string | null;
  todas_unidades: boolean;
  ativo: boolean;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  total_enviados: number;
  total_erros: number;
  created_at: string;
  empr_id: string | null;
  base_url: string | null;
}

const diasSemana = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const tiposCampanha = [
  { value: "RODIZIO", label: "Rodízio de Pneus" },
  { value: "ANIVERSARIO", label: "Aniversário" },
  { value: "VENDAS", label: "Promoção / Marketing" },
];

// Map campaign tipo to MSWA_TIPO for getMenssagensWhts
const tipoToMswaTipo: Record<string, string> = {
  RODIZIO: "RODIZIO",
  ANIVERSARIO: "ANIVERSARIO",
  VENDAS: "VENDAS",
};

interface Props {
  unidades: { unem_Id: string; unem_Fantasia: string }[];
}

const defaultForm = {
  nome: "",
  tipo: "RODIZIO",
  canal: "whatsapp",
  recorrencia: "semanal",
  dia_semana: 1,
  horario: "09:00",
  mensagem: "",
  imagem_url: "",
  filtro_grupo: "",
  filtro_produto: "",
  filtro_unem_id: "__todas__",
  todas_unidades: true,
};

export default function CampanhasAgendadas({ unidades }: Props) {
  const { auth } = useAuth();
  const [campanhas, setCampanhas] = useState<CampanhaAgendada[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({ ...defaultForm });
  const [loadingMsg, setLoadingMsg] = useState(false);

  function getBaseUrl(): string {
    return getApiBaseUrl();
  }

  // Track tipo changes to auto-fetch template
  const [lastFetchedTipo, setLastFetchedTipo] = useState<string | null>(null);

  // Auto-fetch message template when tipo changes
  useEffect(() => {
    if (!dialogOpen) return;
    // For editing, only fetch if user changed the tipo from what was loaded
    if (editingId && form.tipo === lastFetchedTipo) return;
    // For new, always fetch
    if (!editingId && form.tipo === lastFetchedTipo) return;

    const fetchMensagem = async () => {
      setLoadingMsg(true);
      try {
        const mswaTipo = tipoToMswaTipo[form.tipo] || form.tipo;
        const endpoint = `/getMenssagensWhts?MSWA_TIPO=${encodeURIComponent(mswaTipo)}`;
        console.log('[CampanhasAgendadas] Buscando template:', endpoint);
        const { data, error } = await supabase.functions.invoke('api-proxy', {
          body: { baseUrl: getBaseUrl(), endpoint, method: 'GET' },
        });
        if (error) throw new Error(error.message);
        console.log('[CampanhasAgendadas] Resposta getMenssagensWhts:', JSON.stringify(data));

        // Parse response - data may be string, array, or object
        let parsed: any = data;
        if (typeof data === 'string') {
          try { parsed = JSON.parse(data); } catch { parsed = data; }
        }

        let result: any = null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          result = parsed[0];
        } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // Could be a single object or wrapped response
          if (parsed.MSWA_MENSAGEM) {
            result = parsed;
          }
        }

        if (result?.MSWA_MENSAGEM) {
          setForm(f => ({ ...f, mensagem: result.MSWA_MENSAGEM }));
          setLastFetchedTipo(form.tipo);
        } else {
          console.warn('[CampanhasAgendadas] MSWA_MENSAGEM não encontrado na resposta');
        }
      } catch (err: any) {
        console.error('Erro ao buscar mensagem template:', err);
      } finally {
        setLoadingMsg(false);
      }
    };
    fetchMensagem();
  }, [form.tipo, dialogOpen]);

  const fetchCampanhas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campanhas_agendadas' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCampanhas((data as any[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar campanhas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampanhas(); }, [fetchCampanhas]);

  useEffect(() => {
    const interval = setInterval(() => { fetchCampanhas(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchCampanhas]);

  const calcularProximaExecucao = (rec: string, diaSem: number, horario: string): string => {
    const now = new Date();
    const [h, m] = horario.split(':').map(Number);
    const next = new Date(now);

    if (rec === 'diaria') {
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
    } else {
      const currentDay = now.getDay();
      let daysUntil = diaSem - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0) {
        next.setHours(h, m, 0, 0);
        if (next <= now) daysUntil = 7;
      }
      next.setDate(now.getDate() + daysUntil);
      next.setHours(h, m, 0, 0);
    }
    return next.toISOString();
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setLastFetchedTipo(null);
    setDialogOpen(true);
  };

  const openEdit = (c: CampanhaAgendada) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      canal: c.canal,
      recorrencia: c.recorrencia,
      dia_semana: c.dia_semana,
      horario: (c.horario || '09:00:00').slice(0, 5),
      mensagem: c.mensagem,
      imagem_url: c.imagem_url || "",
      filtro_grupo: c.filtro_grupo || "",
      filtro_produto: c.filtro_produto || "",
      filtro_unem_id: c.todas_unidades ? "__todas__" : (c.filtro_unem_id || "__todas__"),
      todas_unidades: c.todas_unidades,
    });
    setLastFetchedTipo(c.tipo);
    setDialogOpen(true);
  };

  const salvarCampanha = async () => {
    if (!form.nome.trim()) { toast.warning("Informe o nome da campanha"); return; }
    if (!form.mensagem.trim()) { toast.warning("Informe a mensagem da campanha"); return; }

    setSaving(true);
    try {
      // Use substring(Unem_Id logada, 0, 8) as empr_id
      const unemIdLogada = auth?.unidade?.unem_Id || '';
      const emprId = unemIdLogada.substring(0, 8);

      const baseUrl = getBaseUrl();
      const proxExec = calcularProximaExecucao(form.recorrencia, form.dia_semana, form.horario);

      const record = {
        nome: form.nome,
        tipo: form.tipo,
        canal: form.canal,
        recorrencia: form.recorrencia,
        dia_semana: form.dia_semana,
        horario: form.horario + ':00',
        mensagem: form.mensagem,
        imagem_url: form.imagem_url || null,
        filtro_grupo: form.filtro_grupo || null,
        filtro_produto: form.filtro_produto || null,
        filtro_unem_id: form.todas_unidades ? null : (form.filtro_unem_id === '__todas__' ? null : form.filtro_unem_id),
        todas_unidades: form.todas_unidades,
        base_url: baseUrl,
        empr_id: emprId,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        // Update
        const { error } = await supabase
          .from('campanhas_agendadas' as any)
          .update({ ...record, proxima_execucao: proxExec } as any)
          .eq('id', editingId);
        if (error) throw error;
        toast.success("Campanha atualizada com sucesso!");
      } else {
        // Insert
        const { error } = await supabase
          .from('campanhas_agendadas' as any)
          .insert({ ...record, ativo: true, proxima_execucao: proxExec } as any);
        if (error) throw error;
        toast.success("Campanha agendada com sucesso!");
      }

      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...defaultForm });
      fetchCampanhas();
    } catch (err: any) {
      console.error('Erro ao salvar campanha:', err);
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('campanhas_agendadas' as any)
        .update({ ativo: !ativo, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success(ativo ? "Campanha pausada" : "Campanha ativada");
      fetchCampanhas();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const excluirCampanha = async (id: string) => {
    try {
      const { error } = await supabase
        .from('campanhas_agendadas' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success("Campanha excluída");
      fetchCampanhas();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const formatDateTime = (dt: string | null) => {
    if (!dt) return "—";
    try {
      const d = new Date(dt);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return "—"; }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Campanhas Agendadas
            </CardTitle>
            <CardDescription className="text-[10px] mt-1">
              Campanhas recorrentes executam automaticamente sem interação manual
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchCampanhas} disabled={loading} className="h-7 text-[10px] gap-1">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" className="h-7 text-[10px] gap-1" onClick={openNew}>
              <Plus className="h-3 w-3" />
              Nova Campanha
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {campanhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs font-medium">Nenhuma campanha agendada</p>
            <p className="text-[10px] mt-0.5">Clique em "Nova Campanha" para criar</p>
          </div>
        ) : (
          <ScrollArea className="max-h-fit">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-[10px]">Nome</TableHead>
                  <TableHead className="text-[10px]">Tipo</TableHead>
                  <TableHead className="text-[10px]">Recorrência</TableHead>
                  <TableHead className="text-[10px]">Horário</TableHead>
                  <TableHead className="text-[10px]">Unidades</TableHead>
                  <TableHead className="text-[10px]">Última Exec.</TableHead>
                  <TableHead className="text-[10px]">Próxima Exec.</TableHead>
                  <TableHead className="text-[10px] text-center">Enviados</TableHead>
                  <TableHead className="text-[10px] text-center">Status</TableHead>
                  <TableHead className="text-[10px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campanhas.map(c => (
                  <TableRow key={c.id} className="text-xs">
                    <TableCell className="font-medium text-[11px]">{c.nome}</TableCell>
                    <TableCell className="text-[10px]">
                      <Badge variant="outline" className="text-[9px]">{c.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] capitalize">
                      {c.recorrencia}
                      {c.recorrencia === 'semanal' && ` (${diasSemana.find(d => d.value === c.dia_semana)?.label || ''})`}
                    </TableCell>
                    <TableCell className="text-[10px]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {(c.horario || '').slice(0, 5)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {c.todas_unidades ? (
                        <Badge variant="secondary" className="text-[9px]">Todas</Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {unidades.find(u => u.unem_Id === c.filtro_unem_id)?.unem_Fantasia || c.filtro_unem_id || '—'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{formatDateTime(c.ultima_execucao)}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{formatDateTime(c.proxima_execucao)}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-[10px]">
                        <span className="text-green-600">{c.total_enviados}</span>
                        {c.total_erros > 0 && <span className="text-destructive ml-1">/ {c.total_erros} err</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {c.ativo ? (
                        <Badge className="text-[9px] bg-green-500/10 text-green-600 border-green-500/20" variant="outline">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Ativo
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20" variant="outline">
                          <AlertCircle className="h-3 w-3 mr-0.5" /> Pausado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openEdit(c)}
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleAtivo(c.id, c.ativo)}
                          title={c.ativo ? "Pausar" : "Ativar"}
                        >
                          {c.ativo ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => excluirCampanha(c.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      {/* Dialog for New / Edit */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingId ? "Editar Campanha" : "Agendar Nova Campanha"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Nome da Campanha</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Rodízio Semanal" className="h-8 text-xs mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tiposCampanha.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={form.canal} onValueChange={v => setForm(f => ({ ...f, canal: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp" className="text-xs">WhatsApp</SelectItem>
                    <SelectItem value="email" className="text-xs">E-mail</SelectItem>
                    <SelectItem value="sms" className="text-xs">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Recorrência</Label>
                <Select value={form.recorrencia} onValueChange={v => setForm(f => ({ ...f, recorrencia: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria" className="text-xs">Diária</SelectItem>
                    <SelectItem value="semanal" className="text-xs">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.recorrencia === 'semanal' && (
                <div>
                  <Label className="text-xs">Dia da Semana</Label>
                  <Select value={String(form.dia_semana)} onValueChange={v => setForm(f => ({ ...f, dia_semana: parseInt(v) }))}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {diasSemana.map(d => <SelectItem key={d.value} value={String(d.value)} className="text-xs">{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} className="h-8 text-xs mt-1" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.todas_unidades} onCheckedChange={v => setForm(f => ({ ...f, todas_unidades: v }))} />
              <Label className="text-xs">Todas as Unidades</Label>
            </div>

            {!form.todas_unidades && (
              <div>
                <Label className="text-xs">Unidade Específica</Label>
                <Select value={form.filtro_unem_id} onValueChange={v => setForm(f => ({ ...f, filtro_unem_id: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unidades.map(u => <SelectItem key={u.unem_Id} value={u.unem_Id} className="text-xs">{u.unem_Fantasia}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={form.mensagem}
                onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                rows={4}
                placeholder="Use variáveis: {NOME_CLIENTE}, {EMPR}, {NOME_LOJA}, {URL_LOJA}, {ENDLOJA}"
                className="text-xs mt-1 resize-none"
              />
            </div>

            <div>
              <Label className="text-xs">URL da Imagem (opcional)</Label>
              <Input value={form.imagem_url} onChange={e => setForm(f => ({ ...f, imagem_url: e.target.value }))} placeholder="https://..." className="h-8 text-xs mt-1" />
            </div>

            <Button onClick={salvarCampanha} disabled={saving} className="w-full gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {editingId ? "Salvar Alterações" : "Agendar Campanha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
