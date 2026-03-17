
import 'dart:convert';

List<ModelSalesDemo> saleslistFromJson(String str) => List<ModelSalesDemo>.from(json.decode(str).map((e) => ModelSalesDemo.fromJson(e)));

class ModelSalesDemo {
  String? gRPOID;
  String? gRUPO;
  String? dCFSQTD;
  String? iTFTQTDEFATURADA;
  String? iTFTVLRCONTABIL;
  String? iTFTCUSTONAOPERACAO;
  String? vLRDEV;
  String? qTDEDEV;
  String? iTFTPARTICIPACAO;

  ModelSalesDemo(
      {this.gRPOID,
        this.gRUPO,
        this.dCFSQTD,
        this.iTFTQTDEFATURADA,
        this.iTFTVLRCONTABIL,
        this.iTFTCUSTONAOPERACAO,
        this.vLRDEV,
        this.qTDEDEV,
        this.iTFTPARTICIPACAO});

  ModelSalesDemo.fromJson(Map<String, dynamic> json) {
    gRPOID = json['GRPO_ID'];
    gRUPO = json['GRUPO'];
    dCFSQTD = json['DCFS_QTD'];
    iTFTQTDEFATURADA = json['ITFT_QTDE_FATURADA'];
    iTFTVLRCONTABIL = json['ITFT_VLR_CONTABIL'];
    iTFTCUSTONAOPERACAO = json['ITFT_CUSTO_NA_OPERACAO'];
    vLRDEV = json['VLR_DEV'];
    qTDEDEV = json['QTDE_DEV'];
    iTFTPARTICIPACAO = json['ITFT_PARTICIPACAO'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['GRPO_ID'] = this.gRPOID;
    data['GRUPO'] = this.gRUPO;
    data['DCFS_QTD'] = this.dCFSQTD;
    data['ITFT_QTDE_FATURADA'] = this.iTFTQTDEFATURADA;
    data['ITFT_VLR_CONTABIL'] = this.iTFTVLRCONTABIL;
    data['ITFT_CUSTO_NA_OPERACAO'] = this.iTFTCUSTONAOPERACAO;
    data['VLR_DEV'] = this.vLRDEV;
    data['QTDE_DEV'] = this.qTDEDEV;
    data['ITFT_PARTICIPACAO'] = this.iTFTPARTICIPACAO;
    return data;
  }
}