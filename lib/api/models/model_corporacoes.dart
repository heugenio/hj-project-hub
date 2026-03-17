class ModelCorporacoes {
  String? cprcId;
  String? cprcNome;

  ModelCorporacoes({this.cprcId, this.cprcNome});

  ModelCorporacoes.fromJson(Map<String, dynamic> json) {
    cprcId = json['cprc_id'];
    cprcNome = json['cprc_Nome'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['cprc_id'] = this.cprcId;
    data['cprc_Nome'] = this.cprcNome;
    return data;
  }
}