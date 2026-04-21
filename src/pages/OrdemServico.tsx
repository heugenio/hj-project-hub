import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Wrench, Plus, Pencil, Eye, Ban, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdemServicos, type OrdemServico as OrdemServicoType } from "@/lib/api";
import { setCancelarOrdemServico } from "@/lib/api-os";
import { toast } from "sonner";
import OrdemServicoForm from "@/components/ordem-servico/OrdemServicoForm";
import FinalizarOSDialog from "@/components/ordem-servico/FinalizarOSDialog";

const statusColor: Record<string, string> = {
  Aberto: "bg-primary text-primary-foreground",
  Faturado: "bg-accent text-accent-foreground",
  Cancelado: "bg-destructive text-destructive-foreground",
};

export default function OrdemServico() {
  const { auth } = useAuth();
  const [data, setData] = useState<OrdemServicoType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingOS, setEditingOS] = useState<OrdemServicoType | null>(null);
  const [viewMode, setViewMode] = useState(false);

  // Cancel dialog state
  const [cancelOS, setCancelOS] = useState<OrdemServicoType | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Finalizar dialog state
  const [finalizarOS, setFinalizarOS] = useState<OrdemServicoType | null>(null);

  const today = new Date();
  const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const [dtInicial, setDtInicial] = useState(toISO(sevenDaysAgo));
  const [dtFinal, setDtFinal] = useState(toISO(today));
  const [status, setStatus] = useState<string>("Abertos");

  const handleSearch = async () => {
    if (!auth?.unidade?.unem_Id) {
      toast.error("Selecione uma unidade empresarial.");
      return;
    }
    setLoading(true);
    try {
      const result = await getOrdemServicos(auth.unidade.unem_Id, {
        status,
        dtInicial,
        dtFinal,
      });
      setData(result);
      setSearched(true);
      if (result.length === 0) toast.info("Nenhuma OS encontrada.");
    } catch (e: any) {
      toast.error("Erro ao buscar ordens de serviço: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  };

  const handleConfirmCancel = async () => {
    if (!cancelOS) return;
    const motivo = cancelMotivo.trim();
    if (!motivo) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }
    const usrsId = auth?.user?.usrs_ID;
    if (!usrsId) {
      toast.error("Usuário não identificado.");
      return;
    }
    setCancelling(true);
    try {
      await setCancelarOrdemServico(cancelOS.oRSV_ID, motivo, usrsId);
      toast.success(`OS #${cancelOS.oRSV_NUMERO} cancelada com sucesso.`);
      setCancelOS(null);
      setCancelMotivo("");
      handleSearch();
    } catch (e: any) {
      toast.error("Erro ao cancelar OS: " + e.message);
    } finally {
      setCancelling(false);
    }
  };

  if (showForm) {
    return (
      <OrdemServicoForm
        editingOS={editingOS}
        viewMode={viewMode}
        onBack={() => {
          setShowForm(false);
          setEditingOS(null);
          setViewMode(false);
          if (searched) handleSearch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Ordem de Serviço
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciamento de ordens de serviço</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingOS(null); setViewMode(false); setShowForm(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova O.S
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Data Inicial</Label>
              <Input
                type="date"
                value={dtInicial}
                onChange={(e) => setDtInicial(e.target.value)}
                className="h-8 text-xs w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Data Final</Label>
              <Input
                type="date"
                value={dtFinal}
                onChange={(e) => setDtFinal(e.target.value)}
                className="h-8 text-xs w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
              <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Abertos">Abertos</SelectItem>
                  <SelectItem value="Faturados">Faturados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={loading} size="sm" className="h-8">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="[&>th]:h-7 [&>th]:px-2 [&>th]:py-1">
                <TableHead className="text-[10px] uppercase">Nº OS</TableHead>
                <TableHead className="text-[10px] uppercase">Data</TableHead>
                <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                <TableHead className="text-[10px] uppercase">CPF/CNPJ</TableHead>
                <TableHead className="text-[10px] uppercase">Veículo</TableHead>
                <TableHead className="text-[10px] uppercase">Placa</TableHead>
                <TableHead className="text-[10px] uppercase">Hod.</TableHead>
                <TableHead className="text-[10px] uppercase text-right">Vlr Total</TableHead>
                <TableHead className="text-[10px] uppercase">Status</TableHead>
                <TableHead className="text-[10px] uppercase text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground text-sm py-8">
                    {searched ? "Nenhuma OS encontrada." : "Clique em Consultar para buscar as ordens de serviço."}
                  </TableCell>
                </TableRow>
              )}
              {data.map((os, idx) => {
                const rowStatus = String(
                  os.oRSV_STATUS ?? (os as any).ORSV_STATUS ?? (os as any).orsv_status ?? ""
                );
                const st = rowStatus
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .trim();
                const isAberto = st.includes("abert");
                const isFaturado = st.includes("fatur");

                return (
                  <TableRow
                    key={os.oRSV_ID + idx}
                    className={`[&>td]:px-2 [&>td]:py-1 ${idx % 2 === 0 ? "" : "bg-muted/40"}`}
                  >
                    <TableCell className="font-mono text-[10px] font-medium whitespace-nowrap">{os.oRSV_NUMERO}</TableCell>
                    <TableCell className="text-[10px] whitespace-nowrap">{formatDate(os.oRSV_DATA)}</TableCell>
                    <TableCell className="text-[10px] max-w-[180px] truncate" title={os.oRSV_NOME}>{os.oRSV_NOME}</TableCell>
                    <TableCell className="text-[10px] font-mono whitespace-nowrap">{os.oRSV_CPFCNPJ}</TableCell>
                    <TableCell className="text-[10px] max-w-[120px] truncate" title={`${os.vEIC_MARCA} ${os.vEIC_MODELO}`}>{os.vEIC_MARCA} {os.vEIC_MODELO}</TableCell>
                    <TableCell className="text-[10px] font-mono whitespace-nowrap">{os.vEIC_PLACA}</TableCell>
                    <TableCell className="text-[10px] text-right whitespace-nowrap">{os.oRSV_HODOMETRO}</TableCell>
                    <TableCell className="text-[10px] text-right whitespace-nowrap">{formatCurrency(os.oRSV_VLR_TOTAL)}</TableCell>
                    <TableCell>
                      <Badge className={(statusColor[rowStatus] || "bg-muted text-muted-foreground") + " text-[9px] px-1.5 py-0 whitespace-nowrap"}>
                        {rowStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        {isAberto && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => {
                                setEditingOS(os);
                                setViewMode(false);
                                setShowForm(true);
                              }}
                              title="Editar OS"
                              aria-label="Editar OS"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-primary hover:text-primary"
                              onClick={() => setFinalizarOS(os)}
                              title="Finalizar OS"
                              aria-label="Finalizar OS"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                setCancelOS(os);
                                setCancelMotivo("");
                              }}
                              title="Cancelar OS"
                              aria-label="Cancelar OS"
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {isFaturado && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                              setEditingOS(os);
                              setViewMode(true);
                              setShowForm(true);
                            }}
                            title="Visualizar OS"
                            aria-label="Visualizar OS"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancel OS Dialog */}
      <Dialog
        open={!!cancelOS}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setCancelOS(null);
            setCancelMotivo("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" /> Cancelar Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              {cancelOS && (
                <>Você está cancelando a OS <span className="font-mono font-semibold">#{cancelOS.oRSV_NUMERO}</span> do cliente <span className="font-semibold">{cancelOS.oRSV_NOME}</span>. Esta ação não pode ser desfeita.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Motivo do Cancelamento *</Label>
            <Textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value.toUpperCase())}
              placeholder="DESCREVA O MOTIVO DO CANCELAMENTO"
              rows={4}
              maxLength={500}
              className="text-sm"
              autoFocus
            />
            <div className="text-[10px] text-muted-foreground text-right">{cancelMotivo.length}/500</div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCancelOS(null);
                setCancelMotivo("");
              }}
              disabled={cancelling}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelling || !cancelMotivo.trim()}
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Ban className="h-4 w-4 mr-1" />
              )}
              Gravar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalizar OS Dialog */}
      {finalizarOS && (
        <FinalizarOSDialog
          open={!!finalizarOS}
          onClose={() => setFinalizarOS(null)}
          orsvId={finalizarOS.oRSV_ID}
          orsvNumero={finalizarOS.oRSV_NUMERO}
          valorTotal={Number(finalizarOS.oRSV_VLR_TOTAL) || 0}
          unemId={auth?.unidade?.unem_Id}
          usrsId={auth?.user?.usrs_ID || ""}
          onFinalized={() => {
            setFinalizarOS(null);
            handleSearch();
          }}
        />
      )}
    </div>
  );
}
