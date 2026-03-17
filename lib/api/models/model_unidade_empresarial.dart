

import 'dart:convert';

List<ModelUnidadeEmpresarial> unidadeEmpresarialFromJson(String str) => List<ModelUnidadeEmpresarial>.from(json.decode(str).map((e) => ModelUnidadeEmpresarial.fromJson(e)));

class ModelUnidadeEmpresarial {
  String? unemMail;
  String? emprId;
  String? unemFone;
  String? unemFantasia;
  String? unemCNPJ;
  String? unemRazaoSocial;
  String? unemId;
  String? unemSigla;

  ModelUnidadeEmpresarial(
      {this.unemMail,
        this.emprId,
        this.unemFone,
        this.unemFantasia,
        this.unemCNPJ,
        this.unemRazaoSocial,
        this.unemId,
        this.unemSigla});

  ModelUnidadeEmpresarial.fromJson(Map<String, dynamic> json) {
    unemMail = json['unem_Mail'];
    emprId = json['empr_id'];
    unemFone = json['unem_Fone'];
    unemFantasia = json['unem_Fantasia'];
    unemCNPJ = json['unem_CNPJ'];
    unemRazaoSocial = json['unem_Razao_Social'];
    unemId = json['unem_Id'];
    unemSigla = json['unem_Sigla'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['unem_Mail'] = this.unemMail;
    data['empr_id'] = this.emprId;
    data['unem_Fone'] = this.unemFone;
    data['unem_Fantasia'] = this.unemFantasia;
    data['unem_CNPJ'] = this.unemCNPJ;
    data['unem_Razao_Social'] = this.unemRazaoSocial;
    data['unem_Id'] = this.unemId;
    data['unem_Sigla'] = this.unemSigla;
    return data;
  }
}