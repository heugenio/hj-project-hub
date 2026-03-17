import { Card, CardContent } from "@/components/ui/card";
import { Warehouse } from "lucide-react";

export default function ConsultaEstoque() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consulta Estoque</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta de estoque por unidade</p>
      </div>
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-20">
          <div className="text-center text-muted-foreground">
            <Warehouse className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Em desenvolvimento</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
