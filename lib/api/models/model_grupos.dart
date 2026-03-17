
import 'dart:convert';

List<ModelGrupos> gruposFromJson(String str) => List<ModelGrupos>.from(json.decode(str).map((e) => ModelGrupos.fromJson(e)));

class ModelGrupos {
  String? grpoId;
  String? grpoNome;

  ModelGrupos({this.grpoId, this.grpoNome});

  ModelGrupos.fromJson(Map<String, dynamic> json) {
    grpoId = json['grpo_id'];
    grpoNome = json['grpo_Nome'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['grpo_id'] = this.grpoId;
    data['grpo_Nome'] = this.grpoNome;
    return data;
  }
}
