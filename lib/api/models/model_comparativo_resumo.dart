
import 'dart:convert';

List<ModelComparativoResumo> comparativoResumoFromJson(String str) => List<ModelComparativoResumo>.from(json.decode(str).map((e) => ModelComparativoResumo.fromJson(e)));

class ModelComparativoResumo {
  String? uNEMID;
  String? iTFTVLRCONTABIL;
  String? iTFTQTDE;
  String? iTFTVLRCONTABILANT;
  String? iTFTQTDEANT;
  String? cRECIMENTO;

  ModelComparativoResumo(
      {this.uNEMID,
        this.iTFTVLRCONTABIL,
        this.iTFTQTDE,
        this.iTFTVLRCONTABILANT,
        this.iTFTQTDEANT,
        this.cRECIMENTO});

  ModelComparativoResumo.fromJson(Map<String, dynamic> json) {
    uNEMID = json['UNEM_ID'];
    iTFTVLRCONTABIL = json['ITFT_VLR_CONTABIL'];
    iTFTQTDE = json['ITFT_QTDE'];
    iTFTVLRCONTABILANT = json['ITFT_VLR_CONTABIL_ANT'];
    iTFTQTDEANT = json['ITFT_QTDE_ANT'];
    cRECIMENTO = json['CRECIMENTO'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['UNEM_ID'] = this.uNEMID;
    data['ITFT_VLR_CONTABIL'] = this.iTFTVLRCONTABIL;
    data['ITFT_QTDE'] = this.iTFTQTDE;
    data['ITFT_VLR_CONTABIL_ANT'] = this.iTFTVLRCONTABILANT;
    data['ITFT_QTDE_ANT'] = this.iTFTQTDEANT;
    data['CRECIMENTO'] = this.cRECIMENTO;
    return data;
  }
}