import { describe, expect, it } from "vitest";
import { comparativoFromSales, previousSalesPeriod } from "./dashboard-comparativo";
import type { SalesDemo } from "./api";

const sale = (value: string, qty: string, id = "michelin"): SalesDemo => ({
  GRPO_ID: id, GRUPO: `0001 - ${id}`, ITFT_VLR_CONTABIL: value, ITFT_QTDE_FATURADA: qty,
  DCFS_QTD: "1", ITFT_CUSTO_NA_OPERACAO: "0", VLR_DEV: "0", QTDE_DEV: "0", ITFT_PARTICIPACAO: "0",
});
describe("sales fallback comparison", () => {
  it("aggregates both real periods and retains groups sold only previously", () => {
    const rows = comparativoFromSales("G03", [sale("3350", "5"), sale("2480", "4")], [sale("1.000,50", "2"), sale("200", "1", "other")]);
    expect(rows[0]).toMatchObject({ UNEM_ID: "G03", ITFT_VLR_CONTABIL: "5.830", ITFT_QTDE: "9", ITFT_VLR_CONTABIL_ANT: "1.000,5", ITFT_QTDE_ANT: "2" });
    expect(rows[1]).toMatchObject({ ITFT_VLR_CONTABIL: "0", ITFT_VLR_CONTABIL_ANT: "200" });
  });
  it("uses the same elapsed days of the previous month, clamping shorter months", () => {
    expect(previousSalesPeriod(new Date(2026, 9, 27))).toEqual({ dtInicial: "2026/09/01", dtFinal: "2026/09/27" });
    expect(previousSalesPeriod(new Date(2026, 2, 31))).toEqual({ dtInicial: "2026/02/01", dtFinal: "2026/02/28" });
  });
});