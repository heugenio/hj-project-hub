

import 'dart:convert';

List<ModelPedido> pedidosListFromJsonString(str) => List<ModelPedido>.from(json.decode(str).map((e) => ModelPedido.fromJson(e)));

class ModelPedido {
  String? vEICMARCA;
  String? oRSVDATA;
  String? vEICPLACA;
  String? oRSVOBSERVACOES;
  String? oRSVHODOMETRO;
  String? vENDNOME;
  String? oRSVDATACANC;
  String? oRSVCPFCNPJ;
  String? oRSVID;
  String? oRSVNUMERO;
  String? oRSVSTATUS;
  String? vEICMODELO;
  int? oRSVVLRTOTAL;
  String? oRSVMOTIVOCANC;
  String? oRSVNOME;

  ModelPedido(
      {this.vEICMARCA,
        this.oRSVDATA,
        this.vEICPLACA,
        this.oRSVOBSERVACOES,
        this.oRSVHODOMETRO,
        this.vENDNOME,
        this.oRSVDATACANC,
        this.oRSVCPFCNPJ,
        this.oRSVID,
        this.oRSVNUMERO,
        this.oRSVSTATUS,
        this.vEICMODELO,
        this.oRSVVLRTOTAL,
        this.oRSVMOTIVOCANC,
        this.oRSVNOME});

  ModelPedido.fromJson(Map<String, dynamic> json) {
    vEICMARCA = json['vEIC_MARCA'];
    oRSVDATA = json['oRSV_DATA'];
    vEICPLACA = json['vEIC_PLACA'];
    oRSVOBSERVACOES = json['oRSV_OBSERVACOES'];
    oRSVHODOMETRO = json['oRSV_HODOMETRO'];
    vENDNOME = json['vEND_NOME'];
    oRSVDATACANC = json['oRSV_DATA_CANC'];
    oRSVCPFCNPJ = json['oRSV_CPFCNPJ'];
    oRSVID = json['oRSV_ID'];
    oRSVNUMERO = json['oRSV_NUMERO'];
    oRSVSTATUS = json['oRSV_STATUS'];
    vEICMODELO = json['vEIC_MODELO'];
    oRSVVLRTOTAL = json['oRSV_VLR_TOTAL'];
    oRSVMOTIVOCANC = json['oRSV_MOTIVO_CANC'];
    oRSVNOME = json['oRSV_NOME'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['vEIC_MARCA'] = this.vEICMARCA;
    data['oRSV_DATA'] = this.oRSVDATA;
    data['vEIC_PLACA'] = this.vEICPLACA;
    data['oRSV_OBSERVACOES'] = this.oRSVOBSERVACOES;
    data['oRSV_HODOMETRO'] = this.oRSVHODOMETRO;
    data['vEND_NOME'] = this.vENDNOME;
    data['oRSV_DATA_CANC'] = this.oRSVDATACANC;
    data['oRSV_CPFCNPJ'] = this.oRSVCPFCNPJ;
    data['oRSV_ID'] = this.oRSVID;
    data['oRSV_NUMERO'] = this.oRSVNUMERO;
    data['oRSV_STATUS'] = this.oRSVSTATUS;
    data['vEIC_MODELO'] = this.vEICMODELO;
    data['oRSV_VLR_TOTAL'] = this.oRSVVLRTOTAL;
    data['oRSV_MOTIVO_CANC'] = this.oRSVMOTIVOCANC;
    data['oRSV_NOME'] = this.oRSVNOME;
    return data;
  }
}