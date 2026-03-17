
import 'dart:convert';

List<ModelEstoque> estoqueListFromJson(String str) => List<ModelEstoque>.from(json.decode(str).map((e) => ModelEstoque.fromJson(e)));

class ModelEstoque {
  String? codigo;
  String? nome;
  String? referencia;
  String? g01;
  String? g02;
  String? g03;
  String? g04;
  String? g08;
  String? g11;
  String? g12;
  String? gO;
  String? g05;
  String? g06;
  String? g07;
  String? g09;
  String? g10;
  String? dF;
  String? geral;

  ModelEstoque(
      {this.codigo,
        this.nome,
        this.referencia,
        this.g01,
        this.g02,
        this.g03,
        this.g04,
        this.g08,
        this.g11,
        this.g12,
        this.gO,
        this.g05,
        this.g06,
        this.g07,
        this.g09,
        this.g10,
        this.dF,
        this.geral});

  ModelEstoque.fromJson(Map<String, dynamic> json) {
    codigo = json['Codigo'];
    nome = json['Nome'];
    referencia = json['Referencia'];
    g01 = json['G01'];
    g02 = json['G02'];
    g03 = json['G03'];
    g04 = json['G04'];
    g08 = json['G08'];
    g11 = json['G11'];
    g12 = json['G12'];
    gO = json['GO'];
    g05 = json['G05'];
    g06 = json['G06'];
    g07 = json['G07'];
    g09 = json['G09'];
    g10 = json['G10'];
    dF = json['DF'];
    geral = json['Geral'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['Codigo'] = this.codigo;
    data['Nome'] = this.nome;
    data['Referencia'] = this.referencia;
    data['G01'] = this.g01;
    data['G02'] = this.g02;
    data['G03'] = this.g03;
    data['G04'] = this.g04;
    data['G08'] = this.g08;
    data['G11'] = this.g11;
    data['G12'] = this.g12;
    data['GO'] = this.gO;
    data['G05'] = this.g05;
    data['G06'] = this.g06;
    data['G07'] = this.g07;
    data['G09'] = this.g09;
    data['G10'] = this.g10;
    data['DF'] = this.dF;
    data['Geral'] = this.geral;
    return data;
  }
}