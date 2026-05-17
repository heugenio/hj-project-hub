import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, RefreshCw, Eraser, Download, FileText, Eye, Printer, Send, Share2,
  MoreVertical, FileX, FileEdit, FileArchive, Receipt, AlertTriangle, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import {
  getDocumentosFiscais,
  setCancelamentoDocumentoFiscal,
  setCartaCorrecaoDocumentoFiscal,
  setInutilizacaoDocumentoFiscal,
  getItensFaturados,
  getDanfe,
  type DocumentoFiscal,
  type ItemFaturado,
} from "@/lib/api-os";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { format, subDays, parse } from "date-fns";

type TabKey = "saidas" | "entradas";

const MODELOS: Record<string, { label: string; full: string; color: string }> = {
  "55": { label: "NF-e", full: "Nota Fiscal Eletrônica", color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  "65": { label: "NFC-e", full: "Nota Fiscal Consumidor", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  "57": { label: "CT-e", full: "Conhecimento Transporte", color: "bg-amber-500/10 text-amber-700 border-amber-300" },
  "03": { label: "NFS-e", full: "Nota Fiscal Serviço", color: "bg-purple-500/10 text-purple-700 border-purple-300" },
  XX: { label: "Gerencial", full: "Nota Gerencial", color: "bg-slate-500/10 text-slate-700 border-slate-300" },
};

const ELECTRONIC_MODELS = ["55", "65", "57", "03"];

function modeloInfo(m?: string) {
  const key = (m || "").toUpperCase();
  return MODELOS[key] || { label: key || "—", full: key || "—", color: "bg-muted text-muted-foreground border-border" };
}

function situacaoBadge(s?: string) {
  const v = (s || "").toLowerCase();
  if (v.includes("autoriz") || v === "válido" || v === "valido")
    return <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-300 gap-1 text-[10px] px-1.5 py-0"><CheckCircle2 className="h-3 w-3" />{v.includes("autoriz") ? "Autorizada" : "Válido"}</Badge>;
  if (v.includes("cancel")) return <Badge className="bg-red-500/10 text-red-700 border border-red-300 gap-1 text-[10px] px-1.5 py-0"><XCircle className="h-3 w-3" />Cancelada</Badge>;
  if (v.includes("deneg")) return <Badge className="bg-orange-500/10 text-orange-700 border border-orange-300 gap-1 text-[10px] px-1.5 py-0"><AlertTriangle className="h-3 w-3" />Denegada</Badge>;
  if (v.includes("erro") || v.includes("rejei")) return <Badge className="bg-rose-500/10 text-rose-700 border border-rose-300 gap-1 text-[10px] px-1.5 py-0"><AlertTriangle className="h-3 w-3" />Erro</Badge>;
  if (v.includes("pend") || v.includes("process")) return <Badge className="bg-amber-500/10 text-amber-700 border border-amber-300 gap-1 text-[10px] px-1.5 py-0"><Clock className="h-3 w-3" />Pendente</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{s || "—"}</Badge>;
}

function fmtMoney(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(",", "."));
  if (Number.isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(v?: string) {
  if (!v) return "—";
  // Formato BR vindo da API: "dd/MM/yyyy HH:mm:ss"
  const brMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (brMatch) {
    const [, d, m, y, hh, mm] = brMatch;
    return hh ? `${d}/${m}/${y} ${hh}:${mm}` : `${d}/${m}/${y}`;
  }
  const tries = ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd", "yyyy/MM/dd"];
  for (const f of tries) {
    try {
      const d = parse(v.slice(0, f.length), f, new Date());
      if (!Number.isNaN(d.getTime())) return format(d, "dd/MM/yyyy");
    } catch {}
  }
  return v;
}

// Helpers para lidar com a resposta real da API (vários nomes de campo)
const getValor = (d: any) => d?.DCFS_VLR_TOTAL ?? d?.DCFS_VALOR_TOTAL ?? 0;
const getData = (d: any) => d?.DCFS_DATA_NOTA ?? d?.DCFS_DATA_EMISSAO ?? d?.DCFS_DATA_SAIDA ?? "";
const getStatus = (d: any) => d?.DCFS_STATUS ?? d?.DCFS_SITUACAO ?? "";
const getChave = (d: any) => d?.DCFS_CHAVE_ACESSO_NFE ?? d?.DCFS_CHAVE ?? "";
const getSerie = (d: any) => d?.DCFS_SERIE_NOTA ?? d?.DCFS_SERIE ?? "";

function parseXmlFromB64(b64: string): string {
  try {
    // pode vir base64 ou já texto xml
    if (/^\s*</.test(b64)) return b64;
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    try { return atob(b64); } catch { return b64; }
  }
}

function fmtMoneyStr(v: any) {
  const n = parseFloat(String(v ?? "0").replace(",", "."));
  if (Number.isNaN(n)) return "0,00";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Parser do XML NF-e (campos completos para DANFE oficial) ----------
function parseFullNfeXml(xmlStr: string) {
  const out: any = {
    chave: "", numero: "", serie: "", modelo: "55", dEmi: "", dSaiEnt: "", natOp: "", tpNF: "1",
    tpAmb: "", protocolo: "", dhRecbto: "",
    emit: { nome: "", fant: "", cnpj: "", ie: "", iest: "", end: "", nro: "", bairro: "", mun: "", uf: "", cep: "", fone: "" },
    dest: { nome: "", doc: "", ie: "", end: "", nro: "", bairro: "", mun: "", uf: "", cep: "", fone: "", inscMun: "" },
    transp: { modFrete: "", nome: "", cnpj: "", ie: "", end: "", mun: "", uf: "", placa: "", ufPlaca: "", antt: "", qVol: "", esp: "", marca: "", nVol: "", pesoB: "", pesoL: "" },
    totais: { vBC: "0", vICMS: "0", vBCST: "0", vST: "0", vProd: "0", vFrete: "0", vSeg: "0", vDesc: "0", vOutro: "0", vIPI: "0", vNF: "0", vServ: "0", vBCISS: "0", vISS: "0", inscMun: "" },
    cobr: [] as Array<{ nFat: string; vOrig: string; vDesc: string; vLiq: string }>,
    dup: [] as Array<{ nDup: string; dVenc: string; vDup: string }>,
    itens: [] as any[],
    infAdic: "", infFisco: "",
    vendedor: "",
  };
  if (!xmlStr) return out;
  try {
    const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
    const infNFe = doc.querySelector("infNFe");
    if (!infNFe) return out;
    const id = infNFe.getAttribute("Id") || "";
    out.chave = id.replace(/^NFe/i, "");
    const g = (n: Element | null | undefined, s: string) => n?.querySelector(s)?.textContent?.trim() || "";
    const ide = infNFe.querySelector("ide");
    out.numero = g(ide, "nNF");
    out.serie = g(ide, "serie");
    out.modelo = g(ide, "mod") || "55";
    out.dEmi = g(ide, "dhEmi") || g(ide, "dEmi");
    out.dSaiEnt = g(ide, "dhSaiEnt") || g(ide, "dSaiEnt");
    out.natOp = g(ide, "natOp");
    out.tpNF = g(ide, "tpNF") || "1";
    out.tpAmb = g(ide, "tpAmb");
    const emit = infNFe.querySelector("emit");
    out.emit.nome = g(emit, "xNome");
    out.emit.fant = g(emit, "xFant");
    out.emit.cnpj = g(emit, "CNPJ") || g(emit, "CPF");
    out.emit.ie = g(emit, "IE");
    out.emit.iest = g(emit, "IEST");
    out.emit.end = g(emit, "enderEmit xLgr");
    out.emit.nro = g(emit, "enderEmit nro");
    out.emit.bairro = g(emit, "enderEmit xBairro");
    out.emit.mun = g(emit, "enderEmit xMun");
    out.emit.uf = g(emit, "enderEmit UF");
    out.emit.cep = g(emit, "enderEmit CEP");
    out.emit.fone = g(emit, "enderEmit fone");
    const dest = infNFe.querySelector("dest");
    out.dest.nome = g(dest, "xNome");
    out.dest.doc = g(dest, "CNPJ") || g(dest, "CPF");
    out.dest.ie = g(dest, "IE");
    out.dest.end = g(dest, "enderDest xLgr");
    out.dest.nro = g(dest, "enderDest nro");
    out.dest.bairro = g(dest, "enderDest xBairro");
    out.dest.mun = g(dest, "enderDest xMun");
    out.dest.uf = g(dest, "enderDest UF");
    out.dest.cep = g(dest, "enderDest CEP");
    out.dest.fone = g(dest, "enderDest fone");
    out.dest.inscMun = g(dest, "IM");
    const transp = infNFe.querySelector("transp");
    out.transp.modFrete = g(transp, "modFrete");
    const transporta = transp?.querySelector("transporta");
    out.transp.nome = g(transporta as Element, "xNome");
    out.transp.cnpj = g(transporta as Element, "CNPJ") || g(transporta as Element, "CPF");
    out.transp.ie = g(transporta as Element, "IE");
    out.transp.end = g(transporta as Element, "xEnder");
    out.transp.mun = g(transporta as Element, "xMun");
    out.transp.uf = g(transporta as Element, "UF");
    const veicTransp = transp?.querySelector("veicTransp");
    out.transp.placa = g(veicTransp as Element, "placa");
    out.transp.ufPlaca = g(veicTransp as Element, "UF");
    out.transp.antt = g(veicTransp as Element, "RNTC");
    const vol = transp?.querySelector("vol");
    out.transp.qVol = g(vol as Element, "qVol");
    out.transp.esp = g(vol as Element, "esp");
    out.transp.marca = g(vol as Element, "marca");
    out.transp.nVol = g(vol as Element, "nVol");
    out.transp.pesoB = g(vol as Element, "pesoB");
    out.transp.pesoL = g(vol as Element, "pesoL");
    const tot = infNFe.querySelector("total ICMSTot");
    out.totais.vBC = g(tot, "vBC");
    out.totais.vICMS = g(tot, "vICMS");
    out.totais.vBCST = g(tot, "vBCST");
    out.totais.vST = g(tot, "vST");
    out.totais.vProd = g(tot, "vProd");
    out.totais.vFrete = g(tot, "vFrete");
    out.totais.vSeg = g(tot, "vSeg");
    out.totais.vDesc = g(tot, "vDesc");
    out.totais.vOutro = g(tot, "vOutro");
    out.totais.vIPI = g(tot, "vIPI");
    out.totais.vNF = g(tot, "vNF");
    const issqn = infNFe.querySelector("total ISSQNtot");
    out.totais.vServ = g(issqn, "vServ");
    out.totais.vBCISS = g(issqn, "vBC");
    out.totais.vISS = g(issqn, "vISS");
    const cobr = infNFe.querySelector("cobr");
    const fat = cobr?.querySelector("fat");
    if (fat) out.cobr.push({ nFat: g(fat as Element, "nFat"), vOrig: g(fat as Element, "vOrig"), vDesc: g(fat as Element, "vDesc"), vLiq: g(fat as Element, "vLiq") });
    Array.from(cobr?.querySelectorAll("dup") || []).forEach((d) => {
      out.dup.push({ nDup: g(d, "nDup"), dVenc: g(d, "dVenc"), vDup: g(d, "vDup") });
    });
    out.itens = Array.from(infNFe.querySelectorAll("det")).map((det) => {
      const icms = det.querySelector("ICMS");
      const ipi = det.querySelector("IPI");
      const orig = icms?.querySelector("orig")?.textContent?.trim() || "";
      const cst = icms?.querySelector("CST")?.textContent?.trim() || icms?.querySelector("CSOSN")?.textContent?.trim() || "";
      const vProd = parseFloat(g(det, "prod vProd").replace(",", ".")) || 0;
      const vDesc = parseFloat(g(det, "prod vDesc").replace(",", ".")) || 0;
      return {
        n: det.getAttribute("nItem") || "",
        cod: g(det, "prod cProd"),
        desc: g(det, "prod xProd"),
        ncm: g(det, "prod NCM"),
        cst: (orig + cst).padStart(3, "0").slice(-3),
        cfop: g(det, "prod CFOP"),
        un: g(det, "prod uCom"),
        qtd: g(det, "prod qCom"),
        vUn: g(det, "prod vUnCom"),
        vTot: g(det, "prod vProd"),
        vDesc: vDesc ? vDesc.toFixed(2) : "0",
        vLiq: (vProd - vDesc).toFixed(2),
        vBC: g(icms as Element, "vBC"),
        vICMS: g(icms as Element, "vICMS"),
        vIPI: g(ipi as Element, "vIPI"),
        pICMS: g(icms as Element, "pICMS"),
        pIPI: g(ipi as Element, "pIPI"),
      };
    });
    out.protocolo = g(doc.documentElement, "infProt nProt");
    out.dhRecbto = g(doc.documentElement, "infProt dhRecbto");
    out.infAdic = g(infNFe, "infAdic infCpl");
    out.infFisco = g(infNFe, "infAdic infAdFisco");
  } catch { /* ignore */ }
  return out;
}

const danfeBaseStyles = `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#000;padding:4mm}
  .noprint{display:flex;gap:6px;justify-content:flex-end;margin-bottom:4px}
  .noprint button{padding:4px 12px;cursor:pointer;border:1px solid #444;background:#f5f5f5;border-radius:3px}
  .sheet{display:flex;flex-direction:column;min-height:calc(297mm - 12mm)}
  .grow{flex:1 1 auto;display:flex;flex-direction:column}
  table{border-collapse:collapse;width:100%;table-layout:fixed}
  td,th{border:1px solid #000;padding:1px 3px;vertical-align:top;overflow:hidden;word-wrap:break-word}
  .lbl{font-size:6px;text-transform:uppercase;color:#000;letter-spacing:.2px;line-height:1;font-weight:normal}
  .val{font-size:9px;font-weight:bold;line-height:1.15}
  .center{text-align:center}.right{text-align:right}.bold{font-weight:bold}
  .nb,.nb td,.nb th{border:none!important;padding:0!important}
  .sec-title{font-size:7px;text-transform:uppercase;font-weight:bold;color:#000;background:#fff;padding:2px 0 1px;margin-top:3px;letter-spacing:.3px}
  .chave{font-family:'Courier New',monospace;font-size:11px;letter-spacing:1px;text-align:center;font-weight:bold;line-height:1.2}
  .homolog{border:2px solid #c00;color:#c00;text-align:center;padding:6px;font-weight:bold;margin:4px 0;font-size:12px}
  .items-table{flex:1 1 auto}
  .items-table table{height:100%}
  .items-table tbody td{vertical-align:top}
  .items-table tr.filler td{border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none;height:100%}
  .items-table thead th{font-size:7px;font-weight:bold;text-align:center;padding:2px}
  .footer-print{display:flex;justify-content:space-between;font-size:7px;border-top:1px solid #000;padding-top:2px;margin-top:2px}
  @media print{ .noprint{display:none} body{padding:4mm} @page{ size: A4; margin: 0 } }
`;

function fmtDateBr(s: string) {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  } catch {}
  return s;
}
function fmtDateTimeBr(s: string) {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("pt-BR");
  } catch {}
  return s;
}

// ============ DANFE Oficial Modelo 55 (NF-e) ============
function buildDanfeOficial55(xmlStr: string): string {
  const p = parseFullNfeXml(xmlStr);
  const chaveFmt = (p.chave || "").replace(/(.{4})/g, "$1 ").trim();
  const homolog = p.tpAmb === "2" ? `<div class="homolog">SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO</div>` : "";

  const itensRows = p.itens.map((i: any) => `
    <tr>
      <td>${i.cod || ""}</td>
      <td>${i.desc || ""}</td>
      <td class="center">${i.ncm || ""}</td>
      <td class="center">${i.cst || ""}</td>
      <td class="center">${i.cfop || ""}</td>
      <td class="center">${i.un || ""}</td>
      <td class="right">${fmtMoneyStr(i.qtd)}</td>
      <td class="right">${fmtMoneyStr(i.vUn)}</td>
      <td class="right">${fmtMoneyStr(i.vDesc)}</td>
      <td class="right">${fmtMoneyStr(i.vLiq || i.vTot)}</td>
      <td class="right">${fmtMoneyStr(i.vBC)}</td>
      <td class="right">${fmtMoneyStr(i.vICMS)}</td>
      <td class="right">${fmtMoneyStr(i.vIPI)}</td>
      <td class="right">${i.pICMS || "0,00"}</td>
      <td class="right">${i.pIPI || "0,00"}</td>
    </tr>`).join("");

  const dupRows = p.dup.length
    ? `<table><tr>${p.dup.map((d: any) => `<td style="width:33%"><span class="lbl">NÚM.</span> <span class="bold">${d.nDup}</span> &nbsp; <span class="lbl">VENC.</span> ${fmtDateBr(d.dVenc)} &nbsp; <span class="lbl">VALOR</span> ${fmtMoneyStr(d.vDup)}</td>`).join("")}</tr></table>`
    : `<table><tr><td style="height:14px"></td></tr></table>`;

  const tpNFLabel = p.tpNF === "0" ? "0 - ENTRADA" : "1 - SAÍDA";
  const printedAt = new Date().toLocaleString("pt-BR");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>DANFE NF-e ${p.numero}</title>
<style>${danfeBaseStyles}</style></head><body>
<div class="noprint"><button onclick="window.print()">Imprimir</button><button onclick="window.close()">Fechar</button></div>

<div class="sheet">

<!-- CANHOTO -->
<table>
  <tr>
    <td style="width:75%">
      <div style="font-size:8px">Recebemos de <b>${p.emit.fant || p.emit.nome}</b> os produtos e/ou serviços constantes da Nota Fiscal Eletrônica indicada ao lado.</div>
      <div style="font-size:8px">Emissão: ${fmtDateBr(p.dEmi)} &nbsp; Dest/Reme: ${p.dest.nome} &nbsp; Valor Total: ${fmtMoneyStr(p.totais.vNF)}</div>
      <table style="margin-top:2px">
        <tr>
          <td style="width:30%"><div class="lbl">DATA DO RECEBIMENTO</div><div style="height:16px"></div></td>
          <td><div class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div><div style="height:16px"></div></td>
        </tr>
      </table>
    </td>
    <td class="center" style="width:25%;border-style:dashed">
      <div class="bold" style="font-size:13px">NF-e</div>
      <div style="font-size:9px"><b>Nº ${(p.numero || "").toString().padStart(9,"0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")}</b></div>
      <div style="font-size:9px"><b>Série ${(p.serie || "").toString().padStart(3,"0")}</b></div>
    </td>
  </tr>
</table>

<div style="height:3px"></div>

<!-- CABEÇALHO -->
<table>
  <tr>
    <td rowspan="3" style="width:35%" class="center">
      <div class="bold" style="font-size:14px;margin:2px 0">${p.emit.fant || p.emit.nome}</div>
      <div style="font-size:8px">${p.emit.end}${p.emit.nro ? ", " + p.emit.nro : ""}</div>
      <div style="font-size:8px">${p.emit.bairro ? p.emit.bairro + " - " : ""}${p.emit.mun}${p.emit.uf ? " - " + p.emit.uf : ""}${p.emit.cep ? " - CEP: " + p.emit.cep : ""}</div>
      ${p.emit.fone ? `<div style="font-size:8px">Fone: ${p.emit.fone}</div>` : ""}
    </td>
    <td rowspan="3" class="center" style="width:25%">
      <div class="bold" style="font-size:13px">DANFE</div>
      <div style="font-size:7px">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>
      <table class="nb" style="margin-top:4px"><tr>
        <td class="nb" style="text-align:left;font-size:8px;padding-right:6px!important">${p.tpNF === "0" ? "<b>0 - ENTRADA</b>" : "0 - ENTRADA"}<br/>${p.tpNF === "1" ? "<b>1 - SAÍDA</b>" : "1 - SAÍDA"}</td>
        <td class="nb" style="border:1px solid #000!important;padding:2px 6px!important;font-size:11px;font-weight:bold">${p.tpNF || "1"}</td>
      </tr></table>
      <div style="margin-top:4px;font-size:9px"><b>Nº ${(p.numero || "").toString().padStart(9,"0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")}</b></div>
      <div style="font-size:9px"><b>SÉRIE ${(p.serie || "").toString().padStart(3,"0")}</b></div>
      <div style="font-size:9px"><b>FOLHA 1/1</b></div>
    </td>
    <td class="center" style="width:40%">
      <div class="lbl" style="text-align:left">CHAVE DE ACESSO</div>
      <div class="chave">${chaveFmt}</div>
    </td>
  </tr>
  <tr>
    <td class="center" style="font-size:8px">Consulta de autenticidade no portal nacional da NF-e<br/>www.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora</td>
  </tr>
  <tr>
    <td>
      <table class="nb"><tr>
        <td class="nb" style="width:50%"><div class="lbl">NATUREZA DA OPERAÇÃO</div><div class="val">${p.natOp || "—"}</div></td>
        <td class="nb"><div class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</div><div class="val">${p.protocolo || "—"}${p.dhRecbto ? " " + fmtDateTimeBr(p.dhRecbto) : ""}</div></td>
      </tr></table>
    </td>
  </tr>
  <tr>
    <td><div class="lbl">INSCRIÇÃO ESTADUAL</div><div class="val">${p.emit.ie || "—"}</div></td>
    <td><div class="lbl">INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO</div><div class="val">${p.emit.iest || ""}</div></td>
    <td><div class="lbl">CNPJ</div><div class="val">${p.emit.cnpj || ""}</div></td>
  </tr>
</table>

${homolog}

<div class="sec-title">DESTINATÁRIO / REMETENTE</div>
<table>
  <tr>
    <td style="width:55%"><div class="lbl">NOME / RAZÃO SOCIAL</div><div class="val">${p.dest.nome || ""}</div></td>
    <td style="width:23%"><div class="lbl">CNPJ / CPF</div><div class="val">${p.dest.doc || ""}</div></td>
    <td style="width:22%"><div class="lbl">DATA EMISSÃO</div><div class="val">${fmtDateBr(p.dEmi)}</div></td>
  </tr>
  <tr>
    <td><div class="lbl">ENDEREÇO</div><div class="val">${p.dest.end || ""}${p.dest.nro ? ", " + p.dest.nro : ""}</div></td>
    <td>
      <table class="nb"><tr>
        <td class="nb" style="width:70%"><div class="lbl">BAIRRO / DISTRITO</div><div class="val">${p.dest.bairro || ""}</div></td>
        <td class="nb"><div class="lbl">CEP</div><div class="val">${p.dest.cep || ""}</div></td>
      </tr></table>
    </td>
    <td><div class="lbl">DATA DA SAÍDA</div><div class="val">${fmtDateBr(p.dSaiEnt) || fmtDateBr(p.dEmi)}</div></td>
  </tr>
  <tr>
    <td>
      <table class="nb"><tr>
        <td class="nb" style="width:80%"><div class="lbl">MUNICÍPIO</div><div class="val">${p.dest.mun || ""}</div></td>
        <td class="nb"><div class="lbl">UF</div><div class="val">${p.dest.uf || ""}</div></td>
      </tr></table>
    </td>
    <td>
      <table class="nb"><tr>
        <td class="nb" style="width:55%"><div class="lbl">TELEFONE / FAX</div><div class="val">${p.dest.fone || ""}</div></td>
        <td class="nb"><div class="lbl">INSCRIÇÃO ESTADUAL</div><div class="val">${p.dest.ie || ""}</div></td>
      </tr></table>
    </td>
    <td><div class="lbl">HORA DA SAÍDA</div><div class="val">${p.dSaiEnt ? new Date(p.dSaiEnt).toLocaleTimeString("pt-BR") : ""}</div></td>
  </tr>
</table>

${p.dup.length ? `<div class="sec-title">FATURA / DUPLICATAS</div>${dupRows}` : ""}

<div class="sec-title">CÁLCULO DO IMPOSTO</div>
<table>
  <tr>
    <td style="width:20%"><div class="lbl">BASE DE CÁLCULO DO ICMS</div><div class="val right">${fmtMoneyStr(p.totais.vBC)}</div></td>
    <td style="width:20%"><div class="lbl">VALOR DO ICMS</div><div class="val right">${fmtMoneyStr(p.totais.vICMS)}</div></td>
    <td style="width:20%"><div class="lbl">BASE DE CÁLCULO DO ICMS SUBST.</div><div class="val right">${fmtMoneyStr(p.totais.vBCST)}</div></td>
    <td style="width:20%"><div class="lbl">VALOR DO ICMS SUBST.</div><div class="val right">${fmtMoneyStr(p.totais.vST)}</div></td>
    <td style="width:20%"><div class="lbl">VALOR TOTAL DOS PRODUTOS</div><div class="val right">${fmtMoneyStr(p.totais.vProd)}</div></td>
  </tr>
  <tr>
    <td><div class="lbl">VALOR DO FRETE</div><div class="val right">${fmtMoneyStr(p.totais.vFrete)}</div></td>
    <td><div class="lbl">VALOR DO SEGURO</div><div class="val right">${fmtMoneyStr(p.totais.vSeg)}</div></td>
    <td><div class="lbl">DESCONTO</div><div class="val right">${fmtMoneyStr(p.totais.vDesc)}</div></td>
    <td><div class="lbl">OUTRAS DESPESAS ACESSÓRIAS</div><div class="val right">${fmtMoneyStr(p.totais.vOutro)}</div></td>
    <td><div class="lbl">VALOR DO IPI</div><div class="val right">${fmtMoneyStr(p.totais.vIPI)}</div></td>
  </tr>
  <tr>
    <td colspan="4" style="border:none"></td>
    <td><div class="lbl">VALOR TOTAL DA NOTA</div><div class="val right" style="font-size:11px">${fmtMoneyStr(p.totais.vNF)}</div></td>
  </tr>
</table>

<div class="sec-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
<table>
  <tr>
    <td style="width:32%"><div class="lbl">NOME / RAZÃO SOCIAL</div><div class="val">${p.transp.nome || "—"}</div></td>
    <td style="width:13%"><div class="lbl">FRETE POR CONTA</div><div class="val">${p.transp.modFrete === "0" ? "0 - REMETENTE" : p.transp.modFrete === "1" ? "1 - DESTINATÁRIO" : p.transp.modFrete === "2" ? "2 - TERCEIROS" : p.transp.modFrete === "9" ? "9 - SEM FRETE" : "—"}</div></td>
    <td style="width:10%"><div class="lbl">CÓDIGO ANTT</div><div class="val">${p.transp.antt || "—"}</div></td>
    <td style="width:13%"><div class="lbl">PLACA DO VEÍCULO</div><div class="val">${p.transp.placa || "—"}</div></td>
    <td style="width:5%"><div class="lbl">UF</div><div class="val">${p.transp.ufPlaca || "—"}</div></td>
    <td><div class="lbl">CNPJ / CPF</div><div class="val">${p.transp.cnpj || "—"}</div></td>
  </tr>
  <tr>
    <td><div class="lbl">ENDEREÇO</div><div class="val">${p.transp.end || "—"}</div></td>
    <td colspan="3"><div class="lbl">MUNICÍPIO</div><div class="val">${p.transp.mun || "—"}</div></td>
    <td><div class="lbl">UF</div><div class="val">${p.transp.uf || "—"}</div></td>
    <td><div class="lbl">INSCRIÇÃO ESTADUAL</div><div class="val">${p.transp.ie || "—"}</div></td>
  </tr>
  <tr>
    <td><div class="lbl">QUANTIDADE</div><div class="val right">${p.transp.qVol || "—"}</div></td>
    <td><div class="lbl">ESPÉCIE</div><div class="val">${p.transp.esp || "—"}</div></td>
    <td><div class="lbl">MARCA</div><div class="val">${p.transp.marca || "—"}</div></td>
    <td colspan="2"><div class="lbl">NUMERAÇÃO</div><div class="val">${p.transp.nVol || "—"}</div></td>
    <td><div class="lbl">PESO BRUTO</div><div class="val right">${p.transp.pesoB || "—"}</div></td>
    <td><div class="lbl">PESO LÍQUIDO</div><div class="val right">${p.transp.pesoL || "—"}</div></td>
  </tr>
</table>

<div class="sec-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
<div class="items-table grow">
<table>
  <colgroup>
    <col style="width:7%"/><col style="width:24%"/><col style="width:6%"/><col style="width:3%"/><col style="width:4%"/><col style="width:3%"/>
    <col style="width:5%"/><col style="width:7%"/><col style="width:6%"/><col style="width:7%"/><col style="width:7%"/><col style="width:6%"/><col style="width:5%"/><col style="width:4%"/><col style="width:3%"/><col style="width:3%"/>
  </colgroup>
  <thead>
    <tr>
      <th rowspan="2">CÓDIGO<br/>PRODUTO</th>
      <th rowspan="2">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
      <th rowspan="2">NCM/SH</th>
      <th rowspan="2">CST</th>
      <th rowspan="2">CFOP</th>
      <th rowspan="2">UNID.</th>
      <th rowspan="2">QTDE.</th>
      <th rowspan="2">VALOR<br/>UNITÁRIO</th>
      <th rowspan="2">VALOR<br/>DESCONTO</th>
      <th rowspan="2">VALOR<br/>LÍQUIDO</th>
      <th rowspan="2">BASE DE<br/>CÁLC. ICMS</th>
      <th rowspan="2">VALOR<br/>ICMS</th>
      <th rowspan="2">VALOR<br/>IPI</th>
      <th colspan="2">ALÍQ. %</th>
    </tr>
    <tr>
      <th>ICMS</th>
      <th>IPI</th>
    </tr>
  </thead>
  <tbody>
    ${itensRows || `<tr><td colspan="15" class="center" style="padding:6px">— Sem itens —</td></tr>`}
    <tr class="filler"><td colspan="15"></td></tr>
  </tbody>
</table>
</div>

${p.totais.vServ && parseFloat(p.totais.vServ) > 0 ? `
<div class="sec-title">CÁLCULO DO ISSQN</div>
<table>
  <tr>
    <td style="width:25%"><div class="lbl">INSCRIÇÃO MUNICIPAL</div><div class="val">${p.totais.inscMun || "—"}</div></td>
    <td style="width:25%"><div class="lbl">VALOR TOTAL DOS SERVIÇOS</div><div class="val right">${fmtMoneyStr(p.totais.vServ)}</div></td>
    <td style="width:25%"><div class="lbl">BASE DE CÁLCULO DO ISSQN</div><div class="val right">${fmtMoneyStr(p.totais.vBCISS)}</div></td>
    <td style="width:25%"><div class="lbl">VALOR DO ISSQN</div><div class="val right">${fmtMoneyStr(p.totais.vISS)}</div></td>
  </tr>
</table>` : ""}

<div class="sec-title">DADOS ADICIONAIS</div>
<table>
  <tr>
    <td style="width:70%"><div class="lbl">INFORMAÇÕES COMPLEMENTARES</div><div style="min-height:50px;white-space:pre-wrap;font-size:8px">${p.infAdic || ""}</div></td>
    <td><div class="lbl">RESERVADO AO FISCO</div><div style="min-height:50px;font-size:8px">${p.infFisco || ""}</div></td>
  </tr>
</table>

<div class="footer-print">
  <div>DATA E HORA DA IMPRESSÃO: ${printedAt}</div>
  <div>www.gestaosolution.com.br</div>
</div>

</div>

<script>setTimeout(()=>window.print(),400)</script>
</body></html>`;
}

// ============ DANFE Modelo 65 (NFC-e) — cupom simplificado ============
function buildDanfeNfce65(xmlStr: string): string {
  const p = parseFullNfeXml(xmlStr);
  const chaveFmt = (p.chave || "").replace(/(.{4})/g, "$1 ").trim();
  const homolog = p.tpAmb === "2" ? `<div class="homolog">SEM VALOR FISCAL — HOMOLOGAÇÃO</div>` : "";
  const rows = p.itens.map((i: any, idx: number) => `
    <tr>
      <td style="width:6%">${String(idx + 1).padStart(3, "0")}</td>
      <td>${i.desc}</td>
      <td class="right" style="width:14%">${fmtMoneyStr(i.qtd)} ${i.un}</td>
      <td class="right" style="width:18%">${fmtMoneyStr(i.vUn)}</td>
      <td class="right" style="width:18%">${fmtMoneyStr(i.vTot)}</td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>NFC-e ${p.numero}</title>
<style>${danfeBaseStyles}
  body{max-width:80mm;font-size:9px;margin:6px auto}
  table td,table th{padding:1px 2px}
  .head{text-align:center;font-size:8px}
  .head h2{font-size:11px;margin:2px 0}
</style></head><body>
<div class="noprint"><button onclick="window.print()">Imprimir</button><button onclick="window.close()">Fechar</button></div>
<div class="head">
  <h2>${p.emit.fant || p.emit.nome}</h2>
  <div>CNPJ ${p.emit.cnpj} &nbsp; IE ${p.emit.ie}</div>
  <div>${p.emit.end}, ${p.emit.nro} - ${p.emit.bairro}</div>
  <div>${p.emit.mun}/${p.emit.uf}</div>
  <div style="border-top:1px dashed #000;margin:3px 0;padding-top:2px"><b>DANFE NFC-e</b> — Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
</div>
${homolog}
<table>
  <thead><tr style="background:#eee"><th>#</th><th>DESCRIÇÃO</th><th class="right">QTD x UN</th><th class="right">VL UNIT</th><th class="right">VL TOT</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="5" class="center">— Sem itens —</td></tr>`}</tbody>
</table>
<table style="margin-top:3px">
  <tr><td>QTD. TOTAL DE ITENS</td><td class="right">${p.itens.length}</td></tr>
  <tr><td>VALOR TOTAL R$</td><td class="right bold" style="font-size:11px">${fmtMoneyStr(p.totais.vNF)}</td></tr>
  ${p.totais.vDesc && parseFloat(p.totais.vDesc) > 0 ? `<tr><td>DESCONTO R$</td><td class="right">${fmtMoneyStr(p.totais.vDesc)}</td></tr>` : ""}
</table>
<div style="text-align:center;margin-top:4px;border-top:1px dashed #000;padding-top:3px">
  <div style="font-size:7px">Consulte pela Chave de Acesso em:</div>
  <div style="font-size:7px;font-weight:bold">www.nfce.fazenda.${(p.emit.uf || "").toLowerCase()}.gov.br</div>
  <div class="chave" style="font-size:8px;margin-top:2px">${chaveFmt}</div>
  <div style="margin-top:4px;font-size:8px">Nº ${p.numero} Série ${p.serie}</div>
  <div style="font-size:7px">Emissão: ${fmtDateTimeBr(p.dEmi)}</div>
  <div style="font-size:7px">Protocolo: ${p.protocolo}</div>
</div>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`;
}

// ============ DANFE Gerencial — quando não tem XML (usa getItensFaturados) ============
function buildDanfeGerencial(
  doc: DocumentoFiscal,
  itens: ItemFaturado[],
  unidade: { nome: string; cnpj?: string; endereco?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string; fone?: string },
): string {
  const valor = parseFloat(String(doc.DCFS_VLR_TOTAL ?? doc.DCFS_VALOR_TOTAL ?? "0").replace(",", "."));
  const rows = itens.map((it, idx) => {
    const desc = it.PROD_DESCRICAO || it.ITFT_DESCRICAO || "—";
    const qtd = it.ITFT_QTDE || "0";
    const vUn = it.ITFT_VLR_UNITARIO || "0";
    const vTot = it.ITFT_VLR_TOTAL || "0";
    const un = it.UNID_NOME || it.ITFT_UNIDADE || "UN";
    return `<tr>
      <td class="center">${String(idx + 1).padStart(3, "0")}</td>
      <td>${it.PROD_CODIGO || "—"}</td>
      <td>${desc}</td>
      <td class="center">${un}</td>
      <td class="right">${fmtMoneyStr(qtd)}</td>
      <td class="right">${fmtMoneyStr(vUn)}</td>
      <td class="right">${fmtMoneyStr(vTot)}</td>
    </tr>`;
  }).join("");
  const totalItens = itens.reduce((a, it) => a + (parseFloat(String(it.ITFT_VLR_TOTAL ?? "0").replace(",", ".")) || 0), 0);

  const data = doc.DCFS_DATA_NOTA || doc.DCFS_DATA_EMISSAO || "";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Nota Gerencial ${doc.DCFS_NUMERO_NOTA}</title>
<style>${danfeBaseStyles}
  body{font-size:10px}
</style></head><body>
<div class="noprint"><button onclick="window.print()">Imprimir</button><button onclick="window.close()">Fechar</button></div>

<table>
  <tr>
    <td style="width:60%">
      <div class="bold" style="font-size:13px">${unidade.nome}</div>
      ${unidade.cnpj ? `<div style="font-size:8px">CNPJ: ${unidade.cnpj}</div>` : ""}
      ${unidade.endereco ? `<div style="font-size:8px">${unidade.endereco}${unidade.numero ? ", " + unidade.numero : ""}</div>` : ""}
      ${(unidade.bairro || unidade.cidade) ? `<div style="font-size:8px">${unidade.bairro || ""}${unidade.bairro && unidade.cidade ? " - " : ""}${unidade.cidade || ""}${unidade.uf ? "/" + unidade.uf : ""}</div>` : ""}
      ${(unidade.cep || unidade.fone) ? `<div style="font-size:8px">${unidade.cep ? "CEP: " + unidade.cep : ""}${unidade.cep && unidade.fone ? " - " : ""}${unidade.fone ? "Fone: " + unidade.fone : ""}</div>` : ""}
      <div style="font-size:8px;margin-top:2px;font-weight:bold">DOCUMENTO SEM VALOR FISCAL</div>
    </td>
    <td class="center" style="width:40%">
      <div class="bold" style="font-size:13px">NOTA GERENCIAL</div>
      <div style="margin-top:4px"><span class="lbl">Nº</span> <span class="bold" style="font-size:12px">${doc.DCFS_NUMERO_NOTA || "—"}</span></div>
      <div><span class="lbl">EMISSÃO</span> <span class="bold">${fmtDate(data)}</span></div>
    </td>
  </tr>
</table>

<div class="sec-title">CLIENTE</div>
<table>
  <tr>
    <td style="width:65%"><div class="lbl">NOME</div><div class="val">${doc.DCFS_NOME || "—"}</div></td>
    <td><div class="lbl">CPF/CNPJ</div><div class="val">${doc.DCFS_CPFCNPJ || "—"}</div></td>
  </tr>
  ${(doc as any).DCFS_FONE ? `<tr><td colspan="2"><div class="lbl">TELEFONE</div><div class="val">${(doc as any).DCFS_FONE}</div></td></tr>` : ""}
</table>

<div class="sec-title">ITENS</div>
<table>
  <thead>
    <tr style="background:#eee">
      <th class="center" style="width:6%">#</th>
      <th style="width:12%">CÓD.</th>
      <th>DESCRIÇÃO</th>
      <th class="center" style="width:8%">UN</th>
      <th class="right" style="width:10%">QTD</th>
      <th class="right" style="width:14%">VLR UNIT</th>
      <th class="right" style="width:14%">VLR TOT</th>
    </tr>
  </thead>
  <tbody>${rows || `<tr><td colspan="7" class="center" style="padding:6px">— Sem itens —</td></tr>`}</tbody>
  <tfoot>
    <tr style="background:#eee">
      <td colspan="6" class="right bold">TOTAL DOS ITENS</td>
      <td class="right bold">${fmtMoneyStr(totalItens || valor)}</td>
    </tr>
    <tr style="background:#000;color:#fff">
      <td colspan="6" class="right bold" style="font-size:11px">VALOR TOTAL DA NOTA</td>
      <td class="right bold" style="font-size:12px">${fmtMoneyStr(valor || totalItens)}</td>
    </tr>
  </tfoot>
</table>

<div style="margin-top:20px;border-top:1px solid #000;padding-top:4px;text-align:center;font-size:8px">
  Documento gerencial — não substitui documento fiscal eletrônico
</div>

<script>setTimeout(()=>window.print(),400)</script>
</body></html>`;
}

function abrirHtmlImpressao(html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function abrirPdfBase64(base64: string, nome = "danfe.pdf") {
  try {
    const clean = base64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
    const bin = atob(clean);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      // popup bloqueado -> força download
      const a = document.createElement("a");
      a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}


const STORAGE_KEY = "verttice_docfiscal_filters";

export default function DocumentosFiscais() {
  const { auth } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabKey>("saidas");
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [filters, setFilters] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return { ...JSON.parse(cached) };
    } catch {}
    return {
      dtInicio: sevenAgo,
      dtFinal: today,
      DCFS_NUMERO_NOTA: "",
      DCFS_NOME: "",
      DCFS_CPFCNPJ: "",
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const unemId = auth?.unidade?.unem_Id || "";
  const unemNome = auth?.unidade?.unem_Fantasia || auth?.unidade?.unem_Razao_Social || "LOJA";

  const [docs, setDocs] = useState<DocumentoFiscal[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const tipoMovimento = tab === "saidas" ? "Saída" : "Entrada";

  const fetchDocs = useCallback(async () => {
    if (!unemId) {
      toast({ title: "Loja não identificada", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await getDocumentosFiscais({
        UNEM_ID: unemId,
        dtInicio: filters.dtInicio,
        dtFinal: filters.dtFinal,
        DCFS_NUMERO_NOTA: filters.DCFS_NUMERO_NOTA || undefined,
        DCFS_NOME: filters.DCFS_NOME || undefined,
        DCFS_CPFCNPJ: filters.DCFS_CPFCNPJ || undefined,
        DCFS_TIPO_MOVIMENTO: tipoMovimento,
      });
      setDocs(data);
      setPage(1);
    } catch (e: any) {
      toast({ title: "Erro ao consultar", description: e?.message || String(e), variant: "destructive" });
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [unemId, filters, tipoMovimento, toast]);

  useEffect(() => {
    if (unemId) fetchDocs();
  }, [tab, unemId]);

  const totals = useMemo(() => {
    const total = docs.length;
    const valor = docs.reduce((a, d) => {
      const raw = getValor(d);
      const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0").replace(",", "."));
      return a + (Number.isNaN(n) ? 0 : n);
    }, 0);
    let autorizadas = 0, canceladas = 0, erros = 0, pendentes = 0;
    for (const d of docs) {
      const s = getStatus(d).toLowerCase();
      if (s.includes("autoriz") || s === "válido" || s === "valido") autorizadas++;
      else if (s.includes("cancel")) canceladas++;
      else if (s.includes("erro") || s.includes("rejei") || s.includes("deneg")) erros++;
      else pendentes++;
    }
    return { total, valor, autorizadas, canceladas, erros, pendentes };
  }, [docs]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return docs.slice(start, start + pageSize);
  }, [docs, page]);
  const totalPages = Math.max(1, Math.ceil(docs.length / pageSize));

  const [viewDoc, setViewDoc] = useState<DocumentoFiscal | null>(null);
  const [cancelDoc, setCancelDoc] = useState<DocumentoFiscal | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cceDoc, setCceDoc] = useState<DocumentoFiscal | null>(null);
  const [cceTexto, setCceTexto] = useState("");
  const [inutOpen, setInutOpen] = useState(false);
  const [inut, setInut] = useState({ serie: "", numeroInicial: "", numeroFinal: "", motivo: "" });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSel, setExportSel] = useState<Record<string, boolean>>({ "55": true, "65": true, "57": true, "03": true });
  const [exporting, setExporting] = useState(false);

  const downloadXml = (doc: DocumentoFiscal) => {
    const xml = doc.DCFS_ARQUIVO_NFE ? parseXmlFromB64(doc.DCFS_ARQUIVO_NFE) : "";
    if (!xml) {
      toast({ title: "XML indisponível", variant: "destructive" });
      return;
    }
    const blob = new Blob([xml], { type: "text/xml;charset=utf-8" });
    const nome = `${getChave(doc) || doc.DCFS_NUMERO_NOTA || "documento"}.xml`;
    saveAs(blob, nome);
  };

  const visualizarXml = (doc: DocumentoFiscal) => {
    setViewDoc(doc);
  };

  const handleCancelar = async () => {
    if (!cancelDoc) return;
    if (cancelMotivo.trim().length < 15) {
      toast({ title: "Motivo deve ter ao menos 15 caracteres", variant: "destructive" });
      return;
    }
    try {
      await setCancelamentoDocumentoFiscal({
        DCFS_ID: cancelDoc.DCFS_ID || "",
        CHAVE: getChave(cancelDoc),
        MOTIVO: cancelMotivo.toUpperCase(),
      });
      toast({ title: "Cancelamento enviado", description: "Documento processado pela SEFAZ" });
      setCancelDoc(null);
      setCancelMotivo("");
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleCce = async () => {
    if (!cceDoc) return;
    if (cceTexto.trim().length < 15) {
      toast({ title: "Texto da CC-e deve ter ao menos 15 caracteres", variant: "destructive" });
      return;
    }
    try {
      await setCartaCorrecaoDocumentoFiscal({
        DCFS_ID: cceDoc.DCFS_ID || "",
        CHAVE: getChave(cceDoc),
        CORRECAO: cceTexto.toUpperCase(),
      });
      toast({ title: "Carta de Correção enviada" });
      setCceDoc(null);
      setCceTexto("");
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro na CC-e", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleInutilizar = async () => {
    if (!inut.serie || !inut.numeroInicial || !inut.numeroFinal || inut.motivo.trim().length < 15) {
      toast({ title: "Preencha todos os campos (motivo ≥ 15 caracteres)", variant: "destructive" });
      return;
    }
    try {
      await setInutilizacaoDocumentoFiscal({
        UNEM_ID: unemId,
        SERIE: inut.serie,
        NUMERO_INICIAL: inut.numeroInicial,
        NUMERO_FINAL: inut.numeroFinal,
        MOTIVO: inut.motivo.toUpperCase(),
      });
      toast({ title: "Inutilização enviada" });
      setInutOpen(false);
      setInut({ serie: "", numeroInicial: "", numeroFinal: "", motivo: "" });
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro na inutilização", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const compartilhar = async (doc: DocumentoFiscal) => {
    const url = `Nota ${doc.DCFS_NUMERO_NOTA} - Chave: ${getChave(doc) || "—"}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Documento Fiscal", text: url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copiado para área de transferência" });
    } catch {
      toast({ title: "Compartilhamento não disponível", variant: "destructive" });
    }
  };

  const enviarWhatsApp = (doc: DocumentoFiscal) => {
    const fone = (doc as any).DCFS_FONE || "";
    const txt = `Olá! Segue sua nota fiscal Nº ${doc.DCFS_NUMERO_NOTA}. Chave: ${getChave(doc)}`;
    const url = `https://wa.me/${fone}?text=${encodeURIComponent(txt)}`;
    window.open(url, "_blank", "noopener");
  };

  const imprimir = () => window.print();

  // Roteia DANFE: XML disponível -> tenta PDF oficial via getDanfe (backend), fallback HTML; sem XML -> gerencial
  const imprimirDanfe = async (doc: DocumentoFiscal) => {
    const modelo = (doc.DCFS_MODELO_NOTA || "").toUpperCase();
    const xml = doc.DCFS_ARQUIVO_NFE ? parseXmlFromB64(doc.DCFS_ARQUIVO_NFE) : "";
    if (xml) {
      // 1) Tenta PDF oficial do backend (getDanfe?ID=DCFS_ID)
      if (doc.DCFS_ID) {
        try {
          toast({ title: "Gerando DANFE...", description: `Documento Nº ${doc.DCFS_NUMERO_NOTA}` });
          const pdfB64 = await getDanfe(doc.DCFS_ID);
          if (pdfB64 && abrirPdfBase64(pdfB64, `DANFE-${doc.DCFS_NUMERO_NOTA || doc.DCFS_ID}.pdf`)) {
            return;
          }
        } catch { /* fallback abaixo */ }
      }
      // 2) Fallback: gera DANFE local a partir do XML
      if (modelo === "65") return abrirHtmlImpressao(buildDanfeNfce65(xml));
      return abrirHtmlImpressao(buildDanfeOficial55(xml));
    }
    // Sem XML -> gerencial. Busca detalhe completo do documento + itens
    try {
      toast({ title: "Carregando dados...", description: `Documento Nº ${doc.DCFS_NUMERO_NOTA}` });
      const [detalheArr, itens] = await Promise.all([
        doc.DCFS_ID
          ? getDocumentosFiscais({ ID: doc.DCFS_ID, UNEM_ID: unemId }).catch(() => [] as DocumentoFiscal[])
          : Promise.resolve([] as DocumentoFiscal[]),
        doc.DCFS_ID ? getItensFaturados(doc.DCFS_ID) : Promise.resolve([] as ItemFaturado[]),
      ]);
      const full: any = (detalheArr && detalheArr[0]) || doc;
      const u = auth?.unidade || ({} as any);
      const unidade = {
        nome: full.UNEM_FANTASIA || full.UNEM_NOME || full.UNEM_RAZAO_SOCIAL || u.unem_Fantasia || u.unem_Razao_Social || "LOJA",
        cnpj: full.UNEM_CNPJ || u.unem_CNPJ,
        endereco: full.UNEM_ENDERECO || full.ENDE_LOGRADOURO || u.unem_Endereco,
        numero: full.UNEM_NUMERO || full.ENDE_NUMERO,
        bairro: full.UNEM_BAIRRO || full.BAIR_NOME,
        cidade: full.UNEM_CIDADE || full.MUNI_NOME,
        uf: full.UNEM_UF || full.ESTA_UF || u.unem_Uf,
        cep: full.UNEM_CEP || full.ENDE_CEP,
        fone: full.UNEM_FONE || u.unem_Fone,
      };
      abrirHtmlImpressao(buildDanfeGerencial({ ...doc, ...full }, itens, unidade));
    } catch (e: any) {
      toast({ title: "Erro ao gerar nota gerencial", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const exportarXmls = async () => {
    const modelos = Object.entries(exportSel).filter(([, v]) => v).map(([k]) => k);
    if (modelos.length === 0) {
      toast({ title: "Selecione ao menos um modelo", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      let count = 0;
      for (const d of docs) {
        const modelo = (d.DCFS_MODELO_NOTA || "").toUpperCase();
        if (modelo === "XX") continue;
        if (!modelos.includes(modelo)) continue;
        const xml = d.DCFS_ARQUIVO_NFE ? parseXmlFromB64(d.DCFS_ARQUIVO_NFE) : "";
        if (!xml) continue;
        const nome = `${getChave(d) || `${d.DCFS_NUMERO_NOTA}_${getSerie(d)}`}.xml`;
        zip.file(nome, xml);
        count++;
      }
      if (count === 0) {
        toast({ title: "Nenhum XML encontrado no período selecionado", variant: "destructive" });
        return;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const tipo = tab === "saidas" ? "SAIDAS" : "ENTRADAS";
      const data = format(new Date(), "yyyyMMdd");
      const lojaNome = String(unemNome).replace(/\W+/g, "_").toUpperCase();
      saveAs(blob, `XML_CONTABILIDADE_${lojaNome}_${tipo}_${data}.zip`);
      toast({ title: `${count} XML(s) exportados` });
      setExportOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const limparFiltros = () => {
    setFilters({
      dtInicio: sevenAgo,
      dtFinal: today,
      DCFS_NUMERO_NOTA: "",
      DCFS_NOME: "",
      DCFS_CPFCNPJ: "",
    });
  };

  return (
    <div className="p-6 mx-0 px-2.5 py-2 my-0 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Documentos Fiscais
          </h1>
          <p className="text-sm text-muted-foreground">
            Loja: <span className="font-medium text-foreground uppercase">{unemNome}</span>
            {" · "}
            UNEM_ID: <span className="font-mono">{unemId || "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setInutOpen(true)}>
            <FileX className="h-4 w-4 mr-1" /> Inutilização
          </Button>
          <Button variant="default" size="sm" onClick={() => setExportOpen(true)}>
            <FileArchive className="h-4 w-4 mr-1" /> Exportar XMLs Contabilidade
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <KPI label="Quantidade" value={String(totals.total)} />
        <KPI label="Valor Total" value={fmtMoney(totals.valor)} />
        <KPI label="Autorizadas" value={String(totals.autorizadas)} tone="emerald" />
        <KPI label="Canceladas" value={String(totals.canceladas)} tone="red" />
        <KPI label="Erro Autorização" value={String(totals.erros)} tone="amber" />
      </div>

      <Card className="border-border/60">
        <CardContent className="px-2.5 py-2">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-1.5 items-end">
            <div className="md:col-span-2">
              <Label className="text-[9px] uppercase text-muted-foreground">Data Inicial</Label>
              <Input type="date" value={filters.dtInicio} className="h-7 text-[11px] px-1.5"
                onChange={(e) => setFilters({ ...filters, dtInicio: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[9px] uppercase text-muted-foreground">Data Final</Label>
              <Input type="date" value={filters.dtFinal} className="h-7 text-[11px] px-1.5"
                onChange={(e) => setFilters({ ...filters, dtFinal: e.target.value })} />
            </div>
            <div className="md:col-span-1">
              <Label className="text-[9px] uppercase text-muted-foreground">Nº Nota</Label>
              <Input value={filters.DCFS_NUMERO_NOTA} className="h-7 text-[11px] px-1.5"
                onChange={(e) => setFilters({ ...filters, DCFS_NUMERO_NOTA: e.target.value.toUpperCase() })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-[9px] uppercase text-muted-foreground">Nome</Label>
              <Input value={filters.DCFS_NOME} className="h-7 text-[11px] px-1.5 uppercase"
                onChange={(e) => setFilters({ ...filters, DCFS_NOME: e.target.value.toUpperCase() })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[9px] uppercase text-muted-foreground">CPF/CNPJ</Label>
              <Input value={filters.DCFS_CPFCNPJ} className="h-7 text-[11px] px-1.5"
                onChange={(e) => setFilters({ ...filters, DCFS_CPFCNPJ: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div className="md:col-span-2 flex gap-1">
              <Button size="sm" className="h-7 px-2 text-[11px]" onClick={fetchDocs} disabled={loading}>
                <Search className="h-3.5 w-3.5 mr-1" /> Pesquisar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={limparFiltros}>
                <Eraser className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fetchDocs} disabled={loading} title="Atualizar">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Modelo</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Nº / Série</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Emissão</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Nome</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">CPF/CNPJ</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground text-right">Valor Total</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Situação</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Chave</TableHead>
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:nth-child(even)]:bg-muted/30 [&_tr:hover]:bg-primary/5 [&_td]:py-1.5 [&_td]:px-2 [&_tr]:border-b [&_tr]:border-border/40">
                {loading && (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                )}
                {!loading && paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && paged.map((d, idx) => {
                  const mod = modeloInfo(d.DCFS_MODELO_NOTA);
                  const isGerencial = (d.DCFS_MODELO_NOTA || "").toUpperCase() === "XX";
                  const hasXml = !isGerencial && !!d.DCFS_ARQUIVO_NFE;
                  const chave = getChave(d);
                  const status = getStatus(d);
                  return (
                    <TableRow key={`${d.DCFS_ID || idx}-${chave || idx}`}>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${mod.color}`}>
                          {mod.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.DCFS_NUMERO_NOTA} / {getSerie(d) || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{fmtDate(getData(d))}</TableCell>
                      <TableCell className="text-xs uppercase max-w-[200px] truncate">{d.DCFS_NOME || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{d.DCFS_CPFCNPJ || "—"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmtMoney(getValor(d))}</TableCell>
                      <TableCell>{situacaoBadge(status)}</TableCell>
                      <TableCell className="text-[10px] font-mono max-w-[180px] truncate" title={chave}>
                        {chave || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-popover">
                            <DropdownMenuItem onClick={() => visualizarXml(d)}>
                              <Eye className="h-4 w-4 mr-2" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => imprimirDanfe(d)}>
                              <FileText className="h-4 w-4 mr-2" />
                              {hasXml ? "DANFE / PDF" : "Nota Gerencial"}
                            </DropdownMenuItem>
                            {hasXml && (
                              <>
                                <DropdownMenuItem onClick={() => downloadXml(d)}>
                                  <Download className="h-4 w-4 mr-2" /> Download XML
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => enviarWhatsApp(d)}>
                                  <Send className="h-4 w-4 mr-2" /> Enviar WhatsApp
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {hasXml && (d.DCFS_MODELO_NOTA || "") === "55" && (
                              <DropdownMenuItem onClick={() => setCceDoc(d)}>
                                <FileEdit className="h-4 w-4 mr-2" /> Carta Correção
                              </DropdownMenuItem>
                            )}
                            {hasXml && !(getStatus(d).toLowerCase().includes("cancel")) && (
                              <DropdownMenuItem onClick={() => setCancelDoc(d)} className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" /> Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {docs.length > pageSize && (
            <div className="flex items-center justify-between p-2 border-t text-xs">
              <span className="text-muted-foreground">
                Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, docs.length)} de {docs.length}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="px-2 py-1">Pág. {page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-5 pt-4 pb-2 border-b">
            <DialogTitle className="text-base">
              Documento Nº {viewDoc?.DCFS_NUMERO_NOTA} — {modeloInfo(viewDoc?.DCFS_MODELO_NOTA).full}
            </DialogTitle>
            <DialogDescription className="text-xs">Visualização da NF-e</DialogDescription>
          </DialogHeader>
          {viewDoc && (() => {
            const xml = viewDoc.DCFS_ARQUIVO_NFE ? parseXmlFromB64(viewDoc.DCFS_ARQUIVO_NFE) : "";
            const p = parseNfeXml(xml);
            const chaveFmt = (p.chave || getChave(viewDoc) || "").replace(/(.{4})/g, "$1.").replace(/\.$/, "");
            return (
              <div className="px-5 py-3 space-y-3 text-[12px]">
                <DanfeRow>
                  <DanfeField label="Chave de Acesso" value={chaveFmt || "—"} mono className="flex-[3]" />
                  <DanfeField label="Número NF-e" value={p.numero || viewDoc.DCFS_NUMERO_NOTA || "—"} />
                  <DanfeField label="Versão" value={p.versao || "—"} />
                </DanfeRow>

                <DanfeSection title="Dados da NFe">
                  <DanfeRow>
                    <DanfeField label="Natureza da operação" value={p.natOp || "—"} className="flex-[2]" />
                    <DanfeField label="Tipo da operação" value={p.tpNF === "0" ? "0 - Entrada" : "1 - Saída"} />
                    <DanfeField label="Chave de acesso" value={chaveFmt || "—"} mono className="flex-[2]" />
                  </DanfeRow>
                  <DanfeRow>
                    <DanfeField label="Modelo" value={p.modelo || "—"} />
                    <DanfeField label="Série" value={p.serie || "—"} />
                    <DanfeField label="Número" value={p.numero || "—"} />
                    <DanfeField label="Data/Hora da emissão" value={p.dEmi ? new Date(p.dEmi).toLocaleString("pt-BR") : "—"} className="flex-[2]" />
                  </DanfeRow>
                </DanfeSection>

                <DanfeSection title="Emitente">
                  <DanfeRow>
                    <DanfeField label="CNPJ" value={p.emit.cnpj || "—"} mono />
                    <DanfeField label="IE" value={p.emit.ie || "—"} mono />
                    <DanfeField label="Nome/Razão Social" value={p.emit.nome || "—"} className="flex-[3]" />
                  </DanfeRow>
                  <DanfeRow>
                    <DanfeField label="Município" value={p.emit.mun || "—"} className="flex-[3]" />
                    <DanfeField label="UF" value={p.emit.uf || "—"} />
                  </DanfeRow>
                </DanfeSection>

                <DanfeSection title="Destinatário">
                  <DanfeRow>
                    <DanfeField label="CNPJ/CPF" value={p.dest.doc || "—"} mono />
                    <DanfeField label="IE" value={p.dest.ie || "—"} mono />
                    <DanfeField label="Nome/Razão Social" value={p.dest.nome || "—"} className="flex-[3]" />
                  </DanfeRow>
                  <DanfeRow>
                    <DanfeField label="Município" value={p.dest.mun || "—"} className="flex-[2]" />
                    <DanfeField label="UF" value={p.dest.uf || "—"} />
                    <DanfeField label="País" value={p.dest.pais || "BRASIL"} />
                  </DanfeRow>
                </DanfeSection>

                <DanfeSection title="Produtos">
                  <div className="border border-[hsl(40_50%_70%)] rounded-sm overflow-hidden bg-[hsl(40_50%_96%)]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[hsl(40_50%_88%)] text-[hsl(25_60%_35%)]">
                        <tr className="[&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:border-r [&_th]:border-[hsl(40_50%_70%)] last:[&_th]:border-r-0">
                          <th className="w-8">#</th>
                          <th>Descrição</th>
                          <th className="w-24 text-right">Quantidade</th>
                          <th className="w-24">Unid. Com.</th>
                          <th className="w-28 text-right">Valor Unit.</th>
                          <th className="w-28 text-right">Valor Prod.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.itens.length === 0 && (
                          <tr><td colSpan={6} className="text-center text-muted-foreground py-3">— Sem itens —</td></tr>
                        )}
                        {p.itens.map((it, i) => (
                          <tr key={i} className="[&_td]:px-2 [&_td]:py-1 [&_td]:border-t [&_td]:border-[hsl(40_50%_75%)] [&_td]:border-r last:[&_td]:border-r-0 odd:bg-[hsl(40_50%_93%)]">
                            <td>{it.n}</td>
                            <td className="truncate max-w-[280px]" title={it.desc}>{it.desc}</td>
                            <td className="text-right font-mono">{it.qtd}</td>
                            <td>{it.un}</td>
                            <td className="text-right font-mono">{fmtMoneyStr(it.vUn)}</td>
                            <td className="text-right font-mono">{fmtMoneyStr(it.vTot)}</td>
                          </tr>
                        ))}
                        <tr className="bg-[hsl(40_50%_88%)] font-semibold">
                          <td colSpan={5} className="px-2 py-1.5 text-right border-t border-[hsl(40_50%_70%)]">Valor total</td>
                          <td className="px-2 py-1.5 text-right font-mono border-t border-[hsl(40_50%_70%)]">{fmtMoneyStr(p.totais.vNF || p.totais.vProd)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </DanfeSection>

                <DanfeSection title="Eventos e Serviços">
                  <div className="border border-[hsl(40_50%_70%)] rounded-sm overflow-hidden bg-[hsl(40_50%_96%)]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[hsl(40_50%_88%)] text-[hsl(25_60%_35%)]">
                        <tr className="[&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:border-r [&_th]:border-[hsl(40_50%_70%)] last:[&_th]:border-r-0">
                          <th>Evento</th>
                          <th>Protocolo</th>
                          <th>Data autorização</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="[&_td]:px-2 [&_td]:py-1 [&_td]:border-t [&_td]:border-[hsl(40_50%_75%)] [&_td]:border-r last:[&_td]:border-r-0">
                          <td>Autorização de Uso</td>
                          <td className="font-mono">{p.protocolo || viewDoc.DCFS_PROTOCOLO || "—"}</td>
                          <td>{fmtDate(viewDoc.DCFS_DATA_AUTORIZACAO) || (p.dEmi ? new Date(p.dEmi).toLocaleString("pt-BR") : "—")}</td>
                          <td>{getStatus(viewDoc) || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </DanfeSection>
              </div>
            );
          })()}
          <DialogFooter className="px-5 py-3 border-t bg-muted/30">
            {viewDoc?.DCFS_ARQUIVO_NFE && (
              <Button variant="outline" size="sm" onClick={() => downloadXml(viewDoc)}>
                <Download className="h-4 w-4 mr-1" /> Download XML
              </Button>
            )}
            {viewDoc && (
              <Button variant="outline" size="sm" onClick={() => imprimirDanfe(viewDoc)}>
                <FileText className="h-4 w-4 mr-1" />
                {viewDoc.DCFS_ARQUIVO_NFE ? "DANFE / PDF" : "Nota Gerencial"}
              </Button>
            )}
            <Button size="sm" onClick={() => setViewDoc(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelDoc} onOpenChange={(o) => { if (!o) { setCancelDoc(null); setCancelMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Documento Nº {cancelDoc?.DCFS_NUMERO_NOTA}</DialogTitle>
            <DialogDescription>
              Chave: <span className="font-mono text-[10px]">{getChave(cancelDoc)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase">Motivo (mínimo 15 caracteres)</Label>
            <Textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value.toUpperCase())}
              rows={4}
              className="uppercase"
              placeholder="INFORME O MOTIVO DO CANCELAMENTO"
            />
            <p className="text-[10px] text-muted-foreground">{cancelMotivo.length}/255</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDoc(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCancelar}>Confirmar Cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cceDoc} onOpenChange={(o) => { if (!o) { setCceDoc(null); setCceTexto(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carta de Correção — NF-e Nº {cceDoc?.DCFS_NUMERO_NOTA}</DialogTitle>
            <DialogDescription>Eventos fiscais (modelo 55)</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase">Texto da Correção (mín. 15 caracteres)</Label>
            <Textarea
              value={cceTexto}
              onChange={(e) => setCceTexto(e.target.value.toUpperCase())}
              rows={5}
              className="uppercase"
              placeholder="DESCREVA A CORREÇÃO"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCceDoc(null)}>Cancelar</Button>
            <Button onClick={handleCce}>Enviar CC-e</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inutOpen} onOpenChange={setInutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inutilização de Numeração</DialogTitle>
            <DialogDescription>Eventos fiscais — inutilizar faixa de numeração</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs uppercase">Série</Label>
              <Input value={inut.serie} className="uppercase"
                onChange={(e) => setInut({ ...inut, serie: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label className="text-xs uppercase">Nº Inicial</Label>
              <Input value={inut.numeroInicial}
                onChange={(e) => setInut({ ...inut, numeroInicial: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div>
              <Label className="text-xs uppercase">Nº Final</Label>
              <Input value={inut.numeroFinal}
                onChange={(e) => setInut({ ...inut, numeroFinal: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase">Motivo (mín. 15 caracteres)</Label>
            <Textarea value={inut.motivo} rows={4} className="uppercase"
              onChange={(e) => setInut({ ...inut, motivo: e.target.value.toUpperCase() })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInutOpen(false)}>Cancelar</Button>
            <Button onClick={handleInutilizar}>Inutilizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar XMLs para Contabilidade</DialogTitle>
            <DialogDescription>
              Loja: <span className="font-medium uppercase">{unemNome}</span> · Tipo:{" "}
              <span className="font-medium">{tipoMovimento}</span> · Período:{" "}
              <span className="font-medium">{filters.dtInicio} a {filters.dtFinal}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase">Modelos a Exportar</Label>
            <div className="grid grid-cols-2 gap-2">
              {ELECTRONIC_MODELS.map((m) => (
                <label key={m} className="flex items-center gap-2 border rounded px-2 py-1 cursor-pointer">
                  <Checkbox
                    checked={!!exportSel[m]}
                    onCheckedChange={(v) => setExportSel({ ...exportSel, [m]: !!v })}
                  />
                  <Badge variant="outline" className={`text-[10px] ${modeloInfo(m).color}`}>{modeloInfo(m).label}</Badge>
                  <span className="text-xs">{modeloInfo(m).full}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Notas gerenciais (XX) não são exportadas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>Cancelar</Button>
            <Button onClick={exportarXmls} disabled={exporting}>
              {exporting ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Gerando...</> : <><Download className="h-4 w-4 mr-1" /> Baixar ZIP</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "red" | "amber" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" :
    tone === "red" ? "text-red-600" :
    tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="px-2 py-1.5">
        <p className="text-[9px] uppercase text-muted-foreground leading-tight truncate">{label}</p>
        <p className={`text-sm font-bold leading-tight ${toneClass} truncate`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "font-mono break-all" : ""}`}>{value || "—"}</p>
    </div>
  );
}

// ============== DANFE Visualização (estilo formulário NF-e) ==============
function parseNfeXml(xmlStr: string) {
  const empty = {
    chave: "", numero: "", serie: "", modelo: "", versao: "", dEmi: "", natOp: "", tpNF: "",
    protocolo: "",
    emit: { cnpj: "", ie: "", nome: "", mun: "", uf: "" },
    dest: { doc: "", ie: "", nome: "", mun: "", uf: "", pais: "" },
    totais: { vNF: "", vProd: "" },
    itens: [] as Array<{ n: string; desc: string; qtd: string; un: string; vUn: string; vTot: string }>,
  };
  if (!xmlStr) return empty;
  try {
    const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
    const infNFe = doc.querySelector("infNFe");
    if (!infNFe) return empty;
    const id = infNFe.getAttribute("Id") || "";
    const versao = infNFe.getAttribute("versao") || "";
    const ide = infNFe.querySelector("ide");
    const emitEl = infNFe.querySelector("emit");
    const destEl = infNFe.querySelector("dest");
    const tot = infNFe.querySelector("total ICMSTot");
    const get = (n: Element | null, s: string) => n?.querySelector(s)?.textContent?.trim() || "";
    const itens = Array.from(infNFe.querySelectorAll("det")).map((det) => ({
      n: det.getAttribute("nItem") || "",
      desc: get(det, "prod xProd"),
      qtd: get(det, "prod qCom"),
      un: get(det, "prod uCom"),
      vUn: get(det, "prod vUnCom"),
      vTot: get(det, "prod vProd"),
    }));
    return {
      chave: id.replace(/^NFe/i, ""),
      numero: get(ide, "nNF"),
      serie: get(ide, "serie"),
      modelo: get(ide, "mod"),
      versao,
      dEmi: get(ide, "dhEmi") || get(ide, "dEmi"),
      natOp: get(ide, "natOp"),
      tpNF: get(ide, "tpNF"),
      protocolo: get(doc.documentElement, "infProt nProt"),
      emit: {
        cnpj: get(emitEl, "CNPJ") || get(emitEl, "CPF"),
        ie: get(emitEl, "IE"),
        nome: get(emitEl, "xNome"),
        mun: get(emitEl, "enderEmit xMun"),
        uf: get(emitEl, "enderEmit UF"),
      },
      dest: {
        doc: get(destEl, "CNPJ") || get(destEl, "CPF"),
        ie: get(destEl, "IE"),
        nome: get(destEl, "xNome"),
        mun: get(destEl, "enderDest xMun"),
        uf: get(destEl, "enderDest UF"),
        pais: get(destEl, "enderDest xPais") || "BRASIL",
      },
      totais: { vNF: get(tot, "vNF"), vProd: get(tot, "vProd") },
      itens,
    };
  } catch {
    return empty;
  }
}

function DanfeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[13px] font-semibold text-[hsl(25_60%_35%)] tracking-wide">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DanfeRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-1">{children}</div>;
}

function DanfeField({
  label, value, mono, className,
}: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={`flex-1 border border-[hsl(40_50%_70%)] rounded-sm bg-[hsl(40_50%_96%)] overflow-hidden ${className || ""}`}>
      <div className="px-2 py-0.5 text-[10px] text-[hsl(25_60%_35%)] bg-[hsl(40_50%_92%)] border-b border-[hsl(40_50%_75%)]">
        {label}
      </div>
      <div className={`px-2 py-1 text-[12px] text-foreground truncate ${mono ? "font-mono" : ""}`} title={value}>
        {value || "—"}
      </div>
    </div>
  );
}
