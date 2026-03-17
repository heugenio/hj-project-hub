
import 'dart:convert';

List<ModelUser> usuariosListFromJson(String str) => List<ModelUser>.from(json.decode(str).map((e) => ModelUser.fromJson(e)));

class ModelUser {
  String? usrsNomeLogin;
  String? pessNome;
  String? usrsID;
  String? usrsSenha;
  String? usrsSituacao;
  String? pessEmail;
  String? pessCodigo;
  String? pessID;

  ModelUser(
      {this.usrsNomeLogin,
        this.pessNome,
        this.usrsID,
        this.usrsSenha,
        this.usrsSituacao,
        this.pessEmail,
        this.pessCodigo,
        this.pessID});

  ModelUser.fromJson(Map<String, dynamic> json) {
    usrsNomeLogin = json['usrs_Nome_Login'];
    pessNome = json['pess_Nome'];
    usrsID = json['usrs_ID'];
    usrsSenha = json['usrs_Senha'];
    usrsSituacao = json['usrs_Situacao'];
    pessEmail = json['pess_Email'];
    pessCodigo = json['pess_Codigo'];
    pessID = json['pess_ID'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['usrs_Nome_Login'] = this.usrsNomeLogin;
    data['pess_Nome'] = this.pessNome;
    data['usrs_ID'] = this.usrsID;
    data['usrs_Senha'] = this.usrsSenha;
    data['usrs_Situacao'] = this.usrsSituacao;
    data['pess_Email'] = this.pessEmail;
    data['pess_Codigo'] = this.pessCodigo;
    data['pess_ID'] = this.pessID;
    return data;
  }
}