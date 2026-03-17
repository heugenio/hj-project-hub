import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_pedido.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../api/models/model_unidade_empresarial.dart';
import 'package:http/http.dart' as http;

import '../components/my_custom_text.dart';

class OrdemServicoScreen extends StatefulWidget {
  const OrdemServicoScreen({Key? key}) : super(key: key);

  @override
  State<OrdemServicoScreen> createState() => _OrdemServicoScreenState();
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

Future<List<ModelPedido>> fetchPedidosList(String unemId) async {
  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getOrdemServicos?unem_id=$unemId",
      ),
      headers: {'Authorization': basicAuth});

  if (response.statusCode == 200) {
    //List<ModelPedido> comparativoList = pedidosListFromJsonString(response.body);

    return pedidosListFromJsonString(response.body);
  } else {
    throw Exception("Erro ao chamar getComparativo.");
  }
}

Future<ModelUnidadeEmpresarial> getUnidadeEmpresarial() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? unidade = sp.getString("unidade");
  ModelUnidadeEmpresarial unidadeSelecionada =
  ModelUnidadeEmpresarial.fromJson(jsonDecode(unidade!));
  return unidadeSelecionada;
}

class _OrdemServicoScreenState extends State<OrdemServicoScreen> {
  ModelUnidadeEmpresarial? unidadeEmpresarial;
  late bool isLoading = true;

  List<ModelPedido>? pedidosList;
  late bool isLoadingData = true;

  @override
  void initState() {
    super.initState();
    getUserData();
  }

  getUserData() async {
    isLoading = true;
    await getUnidadeEmpresarial().then((value) {
      setState(() {
        unidadeEmpresarial = value;
        getPedidosList(unidadeEmpresarial!.unemId!);
        isLoading = false;
      });
    });
  }

  getPedidosList(String unemId) async {
    isLoadingData = true;
    await fetchPedidosList(unemId).then((value) {
      setState(() {
        pedidosList = value;
        isLoadingData = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Ordem de Serviço"),
        backgroundColor: Colors.black,
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.black,
        onPressed: () {},
        child: const Icon(Icons.add),
      ),
      body: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          isLoadingData
              ? const Center(child: CircularProgressIndicator(),)
              : (pedidosList == null)
              ? Container()
              : Expanded(child: buildComparative(pedidosList)),
        ],
      ),
    );
  }

  Widget buildComparative(List<ModelPedido>? data) {
    final currencyFormat =
    NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0);

    return ListView.builder(
        padding: const EdgeInsets.all(0),
        itemCount: data?.length,
        itemBuilder: (BuildContext context, int index) {
          return Card(
            elevation: 3,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      MyCustomTextWithTitleAndDescription(
                          "Vendedor: ", data![index].vENDNOME!),
                      MyCustomTextWithTitleAndDescription(
                          "Cliente: ", data![index].oRSVNOME!)
                    ],
                  ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      MyCustomTextWithTitleAndDescriptionWithColor(
                          "Status: ", data[index].oRSVSTATUS!, Colors.green),
                      MyCustomTextWithTitleAndDescriptionWithColor(
                          "",
                          currencyFormat.format(data[index]
                              .oRSVVLRTOTAL!.toDouble()), Colors.green)
                    ],
                  )
                ],
              ),
            ),
          );
        });
  }
}
