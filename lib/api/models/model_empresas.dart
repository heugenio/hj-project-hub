import 'dart:convert';

List<ModelEmpresas> empresasFromJson(String str) => List<ModelEmpresas>.from(json.decode(str).map((e) => ModelEmpresas.fromJson(e)));

class ModelEmpresas {
  String? cprcId;
  String? emprId;
  String? emprNome;

  ModelEmpresas({this.cprcId, this.emprId, this.emprNome});

  ModelEmpresas.fromJson(Map<String, dynamic> json) {
    cprcId = json['cprc_id'];
    emprId = json['empr_id'];
    emprNome = json['empr_Nome'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['cprc_id'] = this.cprcId;
    data['empr_id'] = this.emprId;
    data['empr_Nome'] = this.emprNome;
    return data;
  }
}