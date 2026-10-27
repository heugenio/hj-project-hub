import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const mocks = vi.hoisted(() => ({
  userId: "user-a",
  comparativo: vi.fn(),
  resumo: vi.fn(),
  vendas: vi.fn(),
  unidades: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: {
    user: { usrs_ID: mocks.userId, GRUS_PERFIL: "ADM" },
    unidade: { unem_Id: "000640010004" },
  } }),
}));
vi.mock("@/lib/api", () => ({
  getComparativo: mocks.comparativo,
  getComparativoResumo: mocks.resumo,
  getDemonstrativoVendas: mocks.vendas,
  getUnidadesEmpresariais: mocks.unidades,
  parseValorBR: (value: unknown) => Number(value) || 0,
}));
vi.mock("recharts", () => {
  const Empty = () => null;
  return Object.fromEntries([
    "BarChart", "Bar", "XAxis", "YAxis", "CartesianGrid", "Tooltip",
    "ResponsiveContainer", "PieChart", "Pie", "Cell",
  ].map((name) => [name, Empty]));
});

function open(client: QueryClient) {
  return render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = "user-a";
  mocks.comparativo.mockResolvedValue([{ UNEM_ID: "000640010004", GRPO_NOME: "MICHELIN", GRPO_TIPO: "Pneus", ITFT_VLR_CONTABIL: "100", ITFT_QTDE: "1", ITFT_VLR_CONTABIL_ANT: "50", ITFT_QTDE_ANT: "1", CRECIMENTO: "100" }]);
  mocks.vendas.mockResolvedValue([]);
  mocks.resumo.mockImplementation(() => new Promise(() => {}));
  mocks.unidades.mockImplementation(() => new Promise(() => {}));
});
afterEach(cleanup);

describe("Dashboard request loading", () => {
  it("loads actual sales from both periods when the comparative endpoint is empty", async () => {
    mocks.comparativo.mockResolvedValue([]);
    mocks.vendas.mockResolvedValue([{ GRPO_ID: "michelin", GRUPO: "0001 - MICHELIN", ITFT_VLR_CONTABIL: "3350", ITFT_QTDE_FATURADA: "5" }]);
    const client = new QueryClient();
    open(client);
    await screen.findByRole("heading", { name: "Dashboard" });
    const comparison = client.getQueryCache().getAll().find((query) => String(query.queryKey.at(-1)).startsWith("comparativo:v2:"));
    expect(comparison?.state.data).toEqual([expect.objectContaining({
      UNEM_ID: "000640010004", GRPO_NOME: "MICHELIN", ITFT_VLR_CONTABIL: "3.350", ITFT_VLR_CONTABIL_ANT: "3.350", ITFT_QTDE: "5",
    })]);
    expect(mocks.vendas).toHaveBeenCalledTimes(2);
  });

  it("shows the current branch without waiting for slow summaries or branch metadata", async () => {
    open(new QueryClient());
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(mocks.comparativo).toHaveBeenCalledTimes(1);
    expect(mocks.comparativo).toHaveBeenCalledWith("000640010004");
  });

  it("reuses fresh branch data and pending metadata when reopening", async () => {
    const client = new QueryClient();
    const first = open(client);
    await screen.findByRole("heading", { name: "Dashboard" });
    first.unmount();
    open(client);
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(mocks.comparativo).toHaveBeenCalledTimes(1);
    expect(mocks.vendas).toHaveBeenCalledTimes(1);
    expect(mocks.unidades).toHaveBeenCalledTimes(1);
  });

  it("does not reuse another user's branch data", async () => {
    const client = new QueryClient();
    const first = open(client);
    await screen.findByRole("heading", { name: "Dashboard" });
    first.unmount();
    mocks.userId = "user-b";
    open(client);
    await waitFor(() => expect(mocks.comparativo).toHaveBeenCalledTimes(2));
    expect(mocks.vendas).toHaveBeenCalledTimes(2);
  });
});