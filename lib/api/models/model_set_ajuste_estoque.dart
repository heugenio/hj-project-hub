class ModelAjusteEstoqueItem {
  String? testId;
  String? newSaldo;
  String? prodId;
  String? saldo;
  String? unemId;
  String? usrsId;

  ModelAjusteEstoqueItem(
      {this.testId,
        this.newSaldo,
        this.prodId,
        this.saldo,
        this.unemId,
        this.usrsId});

  ModelAjusteEstoqueItem.fromJson(Map<String, dynamic> json) {
    testId = json['test_id'];
    newSaldo = json['new_Saldo'];
    prodId = json['prod_id'];
    saldo = json['saldo'];
    unemId = json['unem_id'];
    usrsId = json['usrs_id'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['test_id'] = this.testId;
    data['new_Saldo'] = this.newSaldo;
    data['prod_id'] = this.prodId;
    data['saldo'] = this.saldo;
    data['unem_id'] = this.unemId;
    data['usrs_id'] = this.usrsId;
    return data;
  }
}