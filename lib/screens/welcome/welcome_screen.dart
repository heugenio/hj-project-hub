import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_comparativo_resumo.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syncfusion_flutter_charts/charts.dart';

import '../../api/models/model_comparativo.dart';
import '../../api/models/model_unidade_empresarial.dart';
import '../../api/models/model_user.dart';
import '../components/my_custom_text.dart';
import 'package:http/http.dart' as http;

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({Key? key}) : super(key: key);

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

Future<String> getBaseUrl() async {
  SharedPreferences sharedPreferences = await SharedPreferences.getInstance();
  String key = "hj_system_url_base";
  String defaultValue = "http://hjsystems.dynns.com:8085";

  if (sharedPreferences.containsKey(key)) {
    return sharedPreferences.getString(key) ?? defaultValue;
  } else {
    return defaultValue;
  }
}

Future<List<ModelComparativoResumo>> fetchComparativoResumoList(
    String unemId) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getComparativoResumo?unem_id=$unemId",
      ),
      headers: {'Authorization': basicAuth});

  if (response.statusCode == 200) {
    List<ModelComparativoResumo> comparativoList = comparativoResumoFromJson(response.body);

    if(comparativoList.isNotEmpty) {
      print("salvei os dados - resumo");
      saveModelComparativoResumoToSharedPreferences("comparativoResumoData", response.body);
    }

    return comparativoResumoFromJson(response.body);
  } else {
    throw Exception("Erro aao chamar getComparativoResumo.");
  }
}

Future<List<ModelComparativo>> fetchComparativoList(String unemId) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getComparativo?unem_id=$unemId",
      ),
      headers: {'Authorization': basicAuth});

  if (response.statusCode == 200) {
    List<ModelComparativo> comparativoList = comparativoFromJson(response.body);

    if(comparativoList.isNotEmpty) {
      print("salvei os dados - comparativo list");
      saveModelComparativoToSharedPreferences("comparativoData", response.body);
    }

    return comparativoFromJson(response.body);
  } else {
    throw Exception("Erro ao chamar getComparativo.");
  }
}

Future<void> saveModelComparativoResumoToSharedPreferences(
    String key, String jsonData) async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  sp.setString(key, jsonData);
}

Future<void> saveModelComparativoToSharedPreferences(
    String key, String jsonData) async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  sp.setString(key, jsonData);
}

Future<ModelUnidadeEmpresarial> getUnidadeEmpresarial() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? unidade = sp.getString("unidade");
  ModelUnidadeEmpresarial unidadeSelecionada =
      ModelUnidadeEmpresarial.fromJson(jsonDecode(unidade!));
  return unidadeSelecionada;
}

Future<List<ModelComparativoResumo>> getComparativoResumoLocal() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  if (sp.containsKey("comparativoResumoData")) {
    String? data = sp.getString("comparativoResumoData");
    return comparativoResumoFromJson(data!);
  } else {
    return List.empty();
  }
}

Future<List<ModelComparativo>> getComparativoLocal() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  if (sp.containsKey("comparativoData")) {
    String? data = sp.getString("comparativoData");
    return comparativoFromJson(data!);
  } else {
    return List.empty();
  }
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  List<ModelComparativoResumo>? comparativoResumoList;
  List<ModelComparativo>? comparativoList;
  ModelUnidadeEmpresarial? unidadeEmpresarial;
  late bool isLoading = true;
  late bool isLoadingResume = true;
  late bool isLoadingComparative = true;
  ModelUser? user;
  bool isSyncing = false;

  @override
  void initState() {
    super.initState();
    getUserData();
    getComparativoListFromDatabase();
    getComparativoResumoFromDatabase();
  }

  getUserData() async {
    isLoading = true;
    await getUnidadeEmpresarial().then((value) {
      setState(() {
        unidadeEmpresarial = value;
        isLoading = false;
      });
    });
  }

  getComparativoResumoFromDatabase() async {
    isLoadingResume = true;
    await getComparativoResumoLocal().then((value) {
      setState(() {
        comparativoResumoList = value;
        isLoadingResume = false;
      });
    });
  }

  getComparativoListFromDatabase() async {
    isLoadingComparative = true;
    await getComparativoLocal().then((value) {
      setState(() {
        comparativoList = value;
        isLoadingComparative = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          isLoadingResume
              ? const Center(
                  child: CircularProgressIndicator(),
                )
              : (comparativoResumoList == null)
                  ? Container()
                  : buildResume(comparativoResumoList),
          isLoadingComparative
              ? Container()
              : (comparativoList == null)
                  ? Container()
                  : Expanded(child: buildComparative(comparativoList)),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.black,
        onPressed: isSyncing
            ? null
            : () async {
          setState(() {
            isLoadingComparative = true;
            isLoadingResume = true;
            isSyncing = true;
          });

          await fetchComparativoResumoList(unidadeEmpresarial!.unemId!);
          await fetchComparativoList(unidadeEmpresarial!.unemId!);

          await getComparativoResumoFromDatabase();
          await getComparativoListFromDatabase();

          setState(() {
            isLoadingComparative = false;
            isLoadingResume = false;
            isSyncing = false;
          });
        },
        child: const Icon(Icons.sync),
      ),
    );
  }

  Widget buildResume(List<ModelComparativoResumo>? data) {
    final currencyFormat =
        NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0);

    List<ChartData> getChartData() {
      return [
        ChartData(
            name: 'Ano atual', value: int.parse(data![0].iTFTVLRCONTABIL!)),
        ChartData(
            name: 'Ano anterior',
            value: int.parse(data![0].iTFTVLRCONTABILANT!)),
      ];
    }

    List<ChartData> getEmptyChartData() {
      return [
        ChartData(name: 'Ano atual', value: 50),
        ChartData(name: 'Ano anterior', value: 50),
      ];
    }

    if (data?.length == 0) {
      return Column(
        children: [
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        height: 150,
                        child: SfCircularChart(
                          legend: Legend(isVisible: true),
                          series: <DoughnutSeries<ChartData, String>>[
                            DoughnutSeries<ChartData, String>(
                              dataSource: getEmptyChartData(),
                              xValueMapper: (ChartData data, _) => data.name,
                              yValueMapper: (ChartData data, _) => data.value,
                              dataLabelSettings:
                                  const DataLabelSettings(isVisible: false),
                            ),
                          ],
                        ),
                      )
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      Column(
                        children: [
                          const Text("Ano atual"),
                          const Divider(),
                          MyCustomTextWithTitleAndDescription("Qtd: ", "-"),
                          MyCustomTextWithTitleAndDescription("Valor: ", "-")
                        ],
                      ),
                      Container(
                        height: 50,
                        width: 1,
                        color: Colors.black,
                      ),
                      Column(
                        children: [
                          const Text("Ano anterior"),
                          const Divider(),
                          MyCustomTextWithTitleAndDescription(
                            "Qtd: ",
                            "-",
                          ),
                          MyCustomTextWithTitleAndDescription("Valor: ", "-")
                        ],
                      )
                    ],
                  )
                ],
              ),
            ),
          )
        ],
      );
    } else {
      return Column(
        children: [
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        height: 150,
                        child: SfCircularChart(
                          legend: Legend(isVisible: true),
                          series: <DoughnutSeries<ChartData, String>>[
                            DoughnutSeries<ChartData, String>(
                              dataSource: getChartData(),
                              xValueMapper: (ChartData data, _) => data.name,
                              yValueMapper: (ChartData data, _) => data.value,
                              dataLabelSettings:
                                  const DataLabelSettings(isVisible: false),
                            ),
                          ],
                        ),
                      )
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      Column(
                        children: [
                          const Text("Ano atual"),
                          const Divider(),
                          MyCustomTextWithTitleAndDescription(
                              "Qtd: ", data![0].iTFTQTDE!),
                          MyCustomTextWithTitleAndDescription(
                              "Valor: ",
                              currencyFormat.format(double.parse(data[0]
                                  .iTFTVLRCONTABIL!
                                  .replaceAll(",", "."))))
                        ],
                      ),
                      Container(
                        height: 50,
                        width: 1,
                        color: Colors.black,
                      ),
                      Column(
                        children: [
                          const Text("Ano anterior"),
                          const Divider(),
                          MyCustomTextWithTitleAndDescription(
                              "Qtd: ", data[0].iTFTQTDEANT!),
                          MyCustomTextWithTitleAndDescription(
                              "Valor: ",
                              currencyFormat.format(double.parse(data[0]
                                  .iTFTVLRCONTABILANT!
                                  .replaceAll(",", "."))))
                        ],
                      )
                    ],
                  )
                ],
              ),
            ),
          )
        ],
      );
    }
  }

  Widget buildComparative(List<ModelComparativo>? data) {
    final currencyFormat =
        NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0);

    return ListView.builder(
        padding: const EdgeInsets.all(0),
        itemCount: data?.length,
        itemBuilder: (BuildContext context, int index) {
          return Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      MyCustomTextWithTitleAndDescription(
                          "", data![index].gRPONOME!),
                      MyCustomTextWithTitleAndDescription(
                          "", "${data[index].cRECIMENTO!} %")
                    ],
                  ),
                  const SizedBox(
                    height: 10,
                  ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      MyCustomTextWithTitleAndDescription(
                          "Qtd atual: ", data[index].iTFTQTDE!),
                      MyCustomTextWithTitleAndDescription(
                          "Valor atual: ",
                          currencyFormat.format(double.parse(data[index]
                              .iTFTVLRCONTABIL!
                              .replaceAll(",", ".")))!)
                    ],
                  ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      MyCustomTextWithTitleAndDescription(
                          "Qtd anterior: ", data[index].iTFTQTDEANT!),
                      MyCustomTextWithTitleAndDescription(
                          "Valor anterior: ",
                          currencyFormat.format(double.parse(data[index]
                              .iTFTVLRCONTABILANT!
                              .replaceAll(",", ".")))!)
                    ],
                  )
                ],
              ),
            ),
          );
        });
  }
}

class ChartData {
  String? name;
  int? value;

  ChartData({this.name, this.value});

  ChartData.fromJson(Map<String, dynamic> json) {
    name = json['name'];
    value = json['value'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['name'] = this.name;
    data['value'] = this.value;
    return data;
  }
}
