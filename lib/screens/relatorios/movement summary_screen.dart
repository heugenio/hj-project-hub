import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_movement_symmary.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../api/models/model_unidade_empresarial.dart';
import 'package:http/http.dart' as http;

import '../components/my_custom_text.dart';

class MovementResumeScreen extends StatefulWidget {
  const MovementResumeScreen({Key? key}) : super(key: key);

  @override
  State<MovementResumeScreen> createState() => _MovementResumeScreenState();
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

Future<ModelUnidadeEmpresarial> fetchUnidadeEmpresarial() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? unidade = sp.getString("unidade");
  ModelUnidadeEmpresarial unidadeSelecionada =
  ModelUnidadeEmpresarial.fromJson(jsonDecode(unidade!));
  return unidadeSelecionada;
}

Future<List<ModelMovementSummary>> getMovementList(String unemId, String dtInicial, String dtFinal, String tipoOperacao) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getResumoMovimento?unem_id=$unemId&dtInicial=$dtInicial&dtFinal=$dtFinal&tipooperacao=$tipoOperacao",
      ),
      headers: {'Authorization': basicAuth});

  if (response.statusCode == 200) {
    return movementlistFromJson(response.body);
  } else {
    throw Exception("Erro ao buscar unidade empresarial.");
  }
}

class _MovementResumeScreenState extends State<MovementResumeScreen> {
  ModelUnidadeEmpresarial? unidadeEmpresarial;
  List<ModelMovementSummary>? movementList;
  DateTime? _startDate;
  DateTime? _endDate;
  bool isLoading = false;
  final DateFormat _dateFormat = DateFormat('yyyy/MM/dd');
  List<String> _tipoMovimentoOptions = ['Saida', 'Entrada', 'Todas'];
  String? _tipoMovimentoSelected;

  @override
  void initState() {
    super.initState();
    getUnidadeEmpresarial();
  }

  getUnidadeEmpresarial() async {
    await fetchUnidadeEmpresarial().then((value) {
      setState(() {
        unidadeEmpresarial = value;
      });
    });
  }

  Future<void> _selectDate(BuildContext context, bool isStartDate) async {
    final DateTime? pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );

    if (pickedDate != null) {
      setState(() {
        if (isStartDate) {
          _startDate = pickedDate;
        } else {
          _endDate = pickedDate;
        }
      });
    }
  }

  void _onSubmit() {
    if (_startDate != null && _endDate != null && _tipoMovimentoSelected != null && _tipoMovimentoSelected != "") {
      setState(() {
        isLoading = true;
        movementList = null;
      });
      _getMovementList(unidadeEmpresarial!.unemId!, _startDate.toString(), _endDate.toString(), _tipoMovimentoSelected);

    } else {
      buildAlert(context, "Por favor, preecha todos os campos.");
    }
  }

  _getMovementList(String unemId, String dtInicial, dtFinal, tipoOperacao) async {
    await getMovementList(unemId, dtInicial, dtFinal, tipoOperacao).then((value) {
      setState(() {
        movementList = value;
        isLoading = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text("Resumo do movimento"),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Expanded(child: _buildDateField(context, 'Data Inicial', _startDate, true)),
                const SizedBox(width: 10,),
                Expanded(child: _buildDateField(context, 'Data Final', _endDate, false)),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Expanded(child: _buildTipoMovimentoField(context)),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: MediaQuery.of(context).size.width/2,
                  child: ElevatedButton(
                    onPressed: () {
                      _onSubmit();
                    },
                    child: const Text('Buscar'),
                  ),
                ),
              ],
            ),
            isLoading ? Container() : (movementList == null) ? Container() : buildSummaryTop(movementList),
            isLoading ? const Center(
              child: CircularProgressIndicator(),
            ) : (movementList == null) ? Container() : Expanded(child: buildSalesView(movementList))

          ],
        ),
      ),
    );
  }

  Widget buildSalesView(List<ModelMovementSummary>? data) {
    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0);

    return ListView.builder(
        padding: const EdgeInsets.all(0),
        itemCount:data?.length,
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
                      Text(data![index].dCFSDATASAIDA!),
                      MyCustomTextWithTitleAndDescription("Código: ", data[index].dCFSNUMERONOTA!),
                      MyCustomTextWithTitleAndDescription("Valor: ", currencyFormat.format(double.parse(data[index].dCFSVLRTOTAL!.replaceAll(",", "."))))
                    ],
                  ),
                  const SizedBox(height: 10,),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(child: MyCustomTextWithTitleAndDescription("Nome: ", data[index].DCFS_NOME!)),
                      MyCustomTextWithTitleAndDescription("Modelo: ", data[index].dCFSMODELONOTA!)
                    ],
                  )
                ],
              ),
            ),
          );
        }
    );
  }

  Widget _buildDateField(
      BuildContext context, String label, DateTime? date, bool isStartDate) {
    return InkWell(
      onTap: () => _selectDate(context, isStartDate),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 12.0),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey),
          borderRadius: BorderRadius.circular(4.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(date == null ? label : _dateFormat.format(date)),
            const SizedBox(width: 8.0),
            const Icon(Icons.calendar_today, size: 20.0),
          ],
        ),
      ),
    );
  }

  Widget _buildTipoMovimentoField(BuildContext context) {
    return DropdownButton(
      value: _tipoMovimentoSelected,
      onChanged: (String? newValue) {
        setState(() {
          _tipoMovimentoSelected = newValue;
        });
      },
      items: _tipoMovimentoOptions
          .map<DropdownMenuItem<String>>((String value) {
        return DropdownMenuItem<String>(
          value: value,
          child: Text(value),
        );
      })
          .toList(),
      hint: const Text('Tipo de operacao'),
    );
  }

  void buildAlert(BuildContext context, String message) {
    showDialog(context: context, builder: (BuildContext context) {
      return AlertDialog(
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: const Text("OK"),
          ),
        ],
      );
    });
  }

  String calculateTotal(List<ModelMovementSummary> data) {
    double totalVlrContabil = 0.0;

    for (ModelMovementSummary item in data) {
      double vlrContabil = double.tryParse(item.dCFSVLRTOTAL ?? '0.0') ?? 0.0;

      totalVlrContabil += vlrContabil;
    }

    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0);

    return currencyFormat.format(totalVlrContabil);
  }


  buildSummaryTop(List<ModelMovementSummary>? data) {
    return Card(
      elevation: 2,
      color: Colors.grey[400],
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                MyCustomTextWithTitleAndDescription("Tipo: ", _tipoMovimentoSelected!.toString()),
                MyCustomTextWithTitleAndDescription("Valor: ", calculateTotal(data!))
              ],
            ),
          ],
        ),
      ),
    );
  }

}
