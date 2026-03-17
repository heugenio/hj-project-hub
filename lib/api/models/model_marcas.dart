
import 'dart:convert';

List<ModelMarcas> marcasListFromJsonString(str) => List<ModelMarcas>.from(json.decode(str).map((e) => ModelMarcas.fromJson(e)));

class ModelMarcas {
  String? marcId;
  String? marcNome;

  ModelMarcas({this.marcId, this.marcNome});

  ModelMarcas.fromJson(Map<String, dynamic> json) {
    marcId = json['marc_id'];
    marcNome = json['marc_Nome'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['marc_id'] = this.marcId;
    data['marc_Nome'] = this.marcNome;
    return data;
  }
}