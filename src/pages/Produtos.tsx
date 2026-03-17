import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoxesIcon } from "lucide-react";

export default function Produtos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <p className="text-muted-foreground text-sm mt-1">Cadastro e gestão de produtos</p>
      </div>
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-20">
          <div className="text-center text-muted-foreground">
            <BoxesIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Em desenvolvimento</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
