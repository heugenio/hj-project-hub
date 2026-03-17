

import 'dart:convert';

List<ModelEstoqueItem> estoqueItemListFromJson(String str) => List<ModelEstoqueItem>.from(json.decode(str).map((e) => ModelEstoqueItem.fromJson(e)));

class ModelEstoqueItem {
  String? pRODCODIGO;
  int? gRPOACRESCIMOPERMITIDO;
  int? gRPODESCONTOPERMITIDO;
  String? pRODUSARDESCCOMPLEMENTAR;
  String? tESTID;
  String? gRPOID;
  String? pRODACEITASALDONEGATIVO;
  int? pCPRPRECOMINPROD;
  String? pRODID;
  String? nCMSCODIGO;
  int? pRODPESOBRUTO;
  String? pRODNATUREZAECONOMICA;
  String? pRODLOCALEST;
  double? tESTCUSTOMEDIO;
  String? gRPONOME;
  int? pCPRPRECO;
  String? pRODREFERENCIA;
  String? pRODNOME;
  String? mARCID;
  int? uEPDESTOQUEMAXIMO;
  String? pRODCARACTERISTICAS;
  String? nCMSNOME;
  int? pRODPESO;
  String? uNIDSIGLA;
  String? pRODMOVIMENTAESTOQUE;
  int? tESTRESERVA;
  String? mARCNOME;
  String? uNEMSIGLA;
  int? sESTQTDSALDO;
  int? tESTREQUISICOES;

  ModelEstoqueItem(
      {this.pRODCODIGO,
        this.gRPOACRESCIMOPERMITIDO,
        this.gRPODESCONTOPERMITIDO,
        this.pRODUSARDESCCOMPLEMENTAR,
        this.tESTID,
        this.gRPOID,
        this.pRODACEITASALDONEGATIVO,
        this.pCPRPRECOMINPROD,
        this.pRODID,
        this.nCMSCODIGO,
        this.pRODPESOBRUTO,
        this.pRODNATUREZAECONOMICA,
        this.pRODLOCALEST,
        this.tESTCUSTOMEDIO,
        this.gRPONOME,
        this.pCPRPRECO,
        this.pRODREFERENCIA,
        this.pRODNOME,
        this.mARCID,
        this.uEPDESTOQUEMAXIMO,
        this.pRODCARACTERISTICAS,
        this.nCMSNOME,
        this.pRODPESO,
        this.uNIDSIGLA,
        this.pRODMOVIMENTAESTOQUE,
        this.tESTRESERVA,
        this.mARCNOME,
        this.uNEMSIGLA,
        this.sESTQTDSALDO,
        this.tESTREQUISICOES});

  ModelEstoqueItem.fromJson(Map<String, dynamic> json) {
    pRODCODIGO = json['pROD_CODIGO'];
    gRPOACRESCIMOPERMITIDO = json['gRPO_ACRESCIMO_PERMITIDO'];
    gRPODESCONTOPERMITIDO = json['gRPO_DESCONTO_PERMITIDO'];
    pRODUSARDESCCOMPLEMENTAR = json['pROD_USAR_DESC_COMPLEMENTAR'];
    tESTID = json['tEST_ID'];
    gRPOID = json['gRPO_ID'];
    pRODACEITASALDONEGATIVO = json['pROD_ACEITA_SALDO_NEGATIVO'];
    pCPRPRECOMINPROD = json['pCPR_PRECO_MIN_PROD'];
    pRODID = json['pROD_ID'];
    nCMSCODIGO = json['nCMS_CODIGO'];
    pRODPESOBRUTO = json['pROD_PESO_BRUTO'];
    pRODNATUREZAECONOMICA = json['pROD_NATUREZA_ECONOMICA'];
    pRODLOCALEST = json['pROD_LOCAL_EST'];
    tESTCUSTOMEDIO = double.parse(json['tEST_CUSTO_MEDIO'].toString());
    gRPONOME = json['gRPO_NOME'];
    pCPRPRECO = json['pCPR_PRECO'];
    pRODREFERENCIA = json['pROD_REFERENCIA'];
    pRODNOME = json['pROD_NOME'];
    mARCID = json['mARC_ID'];
    uEPDESTOQUEMAXIMO = json['uEPD_ESTOQUE_MAXIMO'];
    pRODCARACTERISTICAS = json['pROD_CARACTERISTICAS'];
    nCMSNOME = json['nCMS_NOME'];
    pRODPESO = json['pROD_PESO'];
    uNIDSIGLA = json['uNID_SIGLA'];
    pRODMOVIMENTAESTOQUE = json['pROD_MOVIMENTA_ESTOQUE'];
    tESTRESERVA = json['tEST_RESERVA'];
    mARCNOME = json['mARC_NOME'];
    uNEMSIGLA = json['uNEM_SIGLA'];
    sESTQTDSALDO = json['sEST_QTD_SALDO'];
    tESTREQUISICOES = json['tEST_REQUISICOES'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['pROD_CODIGO'] = this.pRODCODIGO;
    data['gRPO_ACRESCIMO_PERMITIDO'] = this.gRPOACRESCIMOPERMITIDO;
    data['gRPO_DESCONTO_PERMITIDO'] = this.gRPODESCONTOPERMITIDO;
    data['pROD_USAR_DESC_COMPLEMENTAR'] = this.pRODUSARDESCCOMPLEMENTAR;
    data['tEST_ID'] = this.tESTID;
    data['gRPO_ID'] = this.gRPOID;
    data['pROD_ACEITA_SALDO_NEGATIVO'] = this.pRODACEITASALDONEGATIVO;
    data['pCPR_PRECO_MIN_PROD'] = this.pCPRPRECOMINPROD;
    data['pROD_ID'] = this.pRODID;
    data['nCMS_CODIGO'] = this.nCMSCODIGO;
    data['pROD_PESO_BRUTO'] = this.pRODPESOBRUTO;
    data['pROD_NATUREZA_ECONOMICA'] = this.pRODNATUREZAECONOMICA;
    data['pROD_LOCAL_EST'] = this.pRODLOCALEST;
    data['tEST_CUSTO_MEDIO'] = this.tESTCUSTOMEDIO;
    data['gRPO_NOME'] = this.gRPONOME;
    data['pCPR_PRECO'] = this.pCPRPRECO;
    data['pROD_REFERENCIA'] = this.pRODREFERENCIA;
    data['pROD_NOME'] = this.pRODNOME;
    data['mARC_ID'] = this.mARCID;
    data['uEPD_ESTOQUE_MAXIMO'] = this.uEPDESTOQUEMAXIMO;
    data['pROD_CARACTERISTICAS'] = this.pRODCARACTERISTICAS;
    data['nCMS_NOME'] = this.nCMSNOME;
    data['pROD_PESO'] = this.pRODPESO;
    data['uNID_SIGLA'] = this.uNIDSIGLA;
    data['pROD_MOVIMENTA_ESTOQUE'] = this.pRODMOVIMENTAESTOQUE;
    data['tEST_RESERVA'] = this.tESTRESERVA;
    data['mARC_NOME'] = this.mARCNOME;
    data['uNEM_SIGLA'] = this.uNEMSIGLA;
    data['sEST_QTD_SALDO'] = this.sESTQTDSALDO;
    data['tEST_REQUISICOES'] = this.tESTREQUISICOES;
    return data;
  }
}