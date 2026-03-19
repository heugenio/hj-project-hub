import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Wrench, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdemServicos, type OrdemServico as OrdemServicoType } from "@/lib/api";
import { toast } from "sonner";
import OrdemServicoForm from "@/components/ordem-servico/OrdemServicoForm";

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

  const handleSearch = async () => {
    if (!auth?.unidade?.unem_Id) {
      toast.error("Selecione uma unidade empresarial.");
      return;
    }
    setLoading(true);
    try {
      const result = await getOrdemServicos(auth.unidade.unem_Id);
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

  if (showForm) {
    return (
      <OrdemServicoForm
        onBack={() => {
          setShowForm(false);
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
          <Button onClick={handleSearch} disabled={loading} size="sm" variant="outline">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
            Consultar
          </Button>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova O.S
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nº OS</TableHead>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">CPF/CNPJ</TableHead>
                <TableHead className="text-xs">Veículo</TableHead>
                <TableHead className="text-xs">Placa</TableHead>
                <TableHead className="text-xs">Hodômetro</TableHead>
                <TableHead className="text-xs text-right">Vlr Total</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground text-sm py-8">
                    {searched ? "Nenhuma OS encontrada." : "Clique em Consultar para buscar as ordens de serviço."}
                  </TableCell>
                </TableRow>
              )}
              {data.map((os, idx) => (
                <TableRow key={os.oRSV_ID + idx} className={idx % 2 === 0 ? "" : "bg-muted/40"}>
                  <TableCell className="font-mono text-xs font-medium">{os.oRSV_NUMERO}</TableCell>
                  <TableCell className="text-xs">{formatDate(os.oRSV_DATA)}</TableCell>
                  <TableCell className="text-xs">{os.oRSV_NOME}</TableCell>
                  <TableCell className="text-xs font-mono">{os.oRSV_CPFCNPJ}</TableCell>
                  <TableCell className="text-xs">{os.vEIC_MARCA} {os.vEIC_MODELO}</TableCell>
                  <TableCell className="text-xs font-mono">{os.vEIC_PLACA}</TableCell>
                  <TableCell className="text-xs text-right">{os.oRSV_HODOMETRO}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(os.oRSV_VLR_TOTAL)}</TableCell>
                  <TableCell>
                    <Badge className={(statusColor[os.oRSV_STATUS] || "bg-muted text-muted-foreground") + " text-xs"}>
                      {os.oRSV_STATUS}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
