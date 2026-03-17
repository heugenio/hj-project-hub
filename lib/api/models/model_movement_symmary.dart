
import 'dart:convert';

List<ModelMovementSummary> movementlistFromJson(String str) => List<ModelMovementSummary>.from(json.decode(str).map((e) => ModelMovementSummary.fromJson(e)));

class ModelMovementSummary {
  String? oPCMNOMECLIENTE;
  String? dCFSDATASAIDA;
  String? dCFSNUMERONOTA;
  String? dCFSMODELONOTA;
  String? dCFSVLRTOTAL;
  String? DCFS_NOME;

  ModelMovementSummary(
      {this.oPCMNOMECLIENTE,
        this.dCFSDATASAIDA,
        this.dCFSNUMERONOTA,
        this.dCFSMODELONOTA,
        this.dCFSVLRTOTAL,
        this.DCFS_NOME,
      });

  ModelMovementSummary.fromJson(Map<String, dynamic> json) {
    oPCMNOMECLIENTE = json['OPCM_NOME_CLIENTE'];
    dCFSDATASAIDA = json['DCFS_DATA_SAIDA'];
    dCFSNUMERONOTA = json['DCFS_NUMERO_NOTA'];
    dCFSMODELONOTA = json['DCFS_MODELO_NOTA'];
    dCFSVLRTOTAL = json['DCFS_VLR_TOTAL'];
    DCFS_NOME = json['DCFS_NOME'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['OPCM_NOME_CLIENTE'] = this.oPCMNOMECLIENTE;
    data['DCFS_DATA_SAIDA'] = this.dCFSDATASAIDA;
    data['DCFS_NUMERO_NOTA'] = this.dCFSNUMERONOTA;
    data['DCFS_MODELO_NOTA'] = this.dCFSMODELONOTA;
    data['DCFS_VLR_TOTAL'] = this.dCFSVLRTOTAL;
    data['DCFS_NOME'] = this.DCFS_NOME;
    return data;
  }
}