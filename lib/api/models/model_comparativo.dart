
import 'dart:convert';

List<ModelComparativo> comparativoFromJson(String str) => List<ModelComparativo>.from(json.decode(str).map((e) => ModelComparativo.fromJson(e)));


class ModelComparativo {
  String? uNEMID;
  String? gRPONOME;
  String? iTFTVLRCONTABIL;
  String? iTFTQTDE;
  String? iTFTVLRCONTABILANT;
  String? iTFTQTDEANT;
  String? cRECIMENTO;

  ModelComparativo(
      {this.uNEMID,
        this.gRPONOME,
        this.iTFTVLRCONTABIL,
        this.iTFTQTDE,
        this.iTFTVLRCONTABILANT,
        this.iTFTQTDEANT,
        this.cRECIMENTO});

  ModelComparativo.fromJson(Map<String, dynamic> json) {
    uNEMID = json['UNEM_ID'];
    gRPONOME = json['GRPO_NOME'];
    iTFTVLRCONTABIL = json['ITFT_VLR_CONTABIL'];
    iTFTQTDE = json['ITFT_QTDE'];
    iTFTVLRCONTABILANT = json['ITFT_VLR_CONTABIL_ANT'];
    iTFTQTDEANT = json['ITFT_QTDE_ANT'];
    cRECIMENTO = json['CRECIMENTO'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['UNEM_ID'] = this.uNEMID;
    data['GRPO_NOME'] = this.gRPONOME;
    data['ITFT_VLR_CONTABIL'] = this.iTFTVLRCONTABIL;
    data['ITFT_QTDE'] = this.iTFTQTDE;
    data['ITFT_VLR_CONTABIL_ANT'] = this.iTFTVLRCONTABILANT;
    data['ITFT_QTDE_ANT'] = this.iTFTQTDEANT;
    data['CRECIMENTO'] = this.cRECIMENTO;
    return data;
  }
}