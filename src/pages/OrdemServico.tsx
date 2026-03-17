import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";

const mockOS = [
  { id: "OS-001", descricao: "Manutenção preventiva servidor", responsavel: "Carlos Tech", data: "2026-03-15", prioridade: "Alta", status: "Em Andamento" },
  { id: "OS-002", descricao: "Instalação rede filial 2", responsavel: "Ana TI", data: "2026-03-14", prioridade: "Média", status: "Aberta" },
  { id: "OS-003", descricao: "Troca de HD estação 5", responsavel: "Pedro Suporte", data: "2026-03-13", prioridade: "Baixa", status: "Concluída" },
  { id: "OS-004", descricao: "Configuração firewall", responsavel: "Carlos Tech", data: "2026-03-12", prioridade: "Alta", status: "Em Andamento" },
  { id: "OS-005", descricao: "Backup mensal", responsavel: "Ana TI", data: "2026-03-11", prioridade: "Média", status: "Concluída" },
];

const prioridadeColor: Record<string, string> = {
  Alta: "bg-destructive text-destructive-foreground",
  Média: "bg-warning text-warning-foreground",
  Baixa: "bg-muted text-muted-foreground",
};

const statusColor: Record<string, string> = {
  Aberta: "bg-primary text-primary-foreground",
  "Em Andamento": "bg-warning text-warning-foreground",
  Concluída: "bg-accent text-accent-foreground",
};

export default function OrdemServico() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ordem de Serviço</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerenciamento de ordens de serviço</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº OS</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOS.map((os) => (
                <TableRow key={os.id}>
                  <TableCell className="font-mono text-sm font-medium">{os.id}</TableCell>
                  <TableCell>{os.descricao}</TableCell>
                  <TableCell>{os.responsavel}</TableCell>
                  <TableCell>{new Date(os.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell><Badge className={prioridadeColor[os.prioridade] + " text-xs"}>{os.prioridade}</Badge></TableCell>
                  <TableCell><Badge className={statusColor[os.status] + " text-xs"}>{os.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
