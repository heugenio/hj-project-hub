import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_sales_demo.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../api/models/model_unidade_empresarial.dart';
import 'package:http/http.dart' as http;

class SalesDemoScreen extends StatefulWidget {
  const SalesDemoScreen({Key? key}) : super(key: key);

  @override
  State<SalesDemoScreen> createState() => _SalesDemoScreenState();
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

Future<List<ModelSalesDemo>> getSalesList(String unemId, String dtInicial, String dtFinal) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getDemonstrativoVendas?unem_id=$unemId&dtInicial=$dtInicial&dtFinal=$dtFinal",
      ),
      headers: {'Authorization': basicAuth});

  if (response.statusCode == 200) {
    return saleslistFromJson(response.body);
  } else {
    throw Exception("Erro ao buscar unidade empresarial.");
  }
}

class _SalesDemoScreenState extends State<SalesDemoScreen> {
  ModelUnidadeEmpresarial? unidadeEmpresarial;
  List<ModelSalesDemo>? salesList;
  DateTime? _startDate;
  DateTime? _endDate;
  bool isLoading = false;
  final DateFormat _dateFormat = DateFormat('yyyy/MM/dd');

  @override
  void initState() {
    super.initState();
    getUnidadeEmpresarial();
  }

  _getSalesList(String unemId, String dtInicial, dtFinal) async {
    await getSalesList(unemId, dtInicial, dtFinal).then((value) {
      setState(() {
        salesList = value;
        isLoading = false;
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
    if (_startDate != null && _endDate != null) {
      setState(() {
        isLoading = true;
        salesList = null;
      });
      _getSalesList(unidadeEmpresarial!.unemId!, _startDate.toString(), _endDate.toString());
    } else {
      buildAlert(context, "Por favor, preencha todos os campos.");
    }
  }

  getUnidadeEmpresarial() async {
    await fetchUnidadeEmpresarial().then((value) {
      setState(() {
        unidadeEmpresarial = value;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text("Demonstrativo de vendas"),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildDateField(context, 'Data Inicial', _startDate, true),
                    _buildDateField(context, 'Data Final', _endDate, false),
                    ElevatedButton(
                      onPressed: () {
                        _onSubmit();
                      },
                      child: const Text('Buscar'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          isLoading ? const Center(
            child: CircularProgressIndicator(),
          ) : (salesList == null) ? Container() : buildSalesView(salesList)
        ],
      ),
    );
  }

  Widget buildSalesView(List<ModelSalesDemo>? data) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
      Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text(
                  'Quantidade',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  calculateTotalItens(data!),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
            SizedBox(height: 40, width: 1, child: Container(color: Colors.black,),),
            Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text(
                  'Total de Vendas',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  calculateTotalSales(data!),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
            SizedBox(height: 40, width: 1, child: Container(color: Colors.black,),),
            Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text(
                  'Valor Líquido',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  calculateTotalDev(data!),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        )
      )
      ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columns: const [
               DataColumn(label: Text('Nome',)),
               DataColumn(label: Text('Quantidade')),
               DataColumn(label: Text('Valor')),
            ],
            rows: data.map(
                  (data) => DataRow(
                cells: [
                  DataCell(Text(data.gRUPO!, style: const TextStyle(fontSize: 12),)),
                  DataCell(Text(data.iTFTQTDEFATURADA!, style: const TextStyle(fontSize: 12), overflow: TextOverflow.fade,)),
                  DataCell(Text(data.iTFTVLRCONTABIL!, style: const TextStyle(fontSize: 12), overflow: TextOverflow.fade,)),
                ],
              ),
            ).toList(),
          ),
        ),
      ],
    );
  }

  String calculateTotalSales(List<ModelSalesDemo> salesData) {
    double totalVlrContabil = 0.0;

    for (ModelSalesDemo item in salesData) {
      double vlrContabil = double.tryParse(item.iTFTVLRCONTABIL ?? '0.0') ?? 0.0;

      totalVlrContabil += vlrContabil;
    }

    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0);

    return currencyFormat.format(totalVlrContabil);
  }

  String calculateTotalDev(List<ModelSalesDemo> salesData) {
    double totalVlrContabil = 0.0;
    double totalVlrDev = 0.0;

    for (ModelSalesDemo item in salesData) {
      double vlrContabil = double.tryParse(item.iTFTVLRCONTABIL ?? '0.0') ?? 0.0;
      double vlrDev = double.tryParse(item.vLRDEV ?? '0.0') ?? 0.0;

      totalVlrContabil += vlrContabil;
      totalVlrDev += vlrDev;
    }

    double totalResult = totalVlrContabil - totalVlrDev;

    final currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0);

    return currencyFormat.format(totalResult);
  }

  String calculateTotalItens(List<ModelSalesDemo> salesData) {
    int totalItens = 0;

    for (ModelSalesDemo item in salesData) {
      int? vlrDev = int.tryParse(item.dCFSQTD!);

     totalItens += vlrDev!;
    }

    return totalItens.toString();
  }

  Widget _buildDateField(
      BuildContext context, String label, DateTime? date, bool isStartDate) {
    return InkWell(
      onTap: () => _selectDate(context, isStartDate),
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 8.0, horizontal: 12.0),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey),
          borderRadius: BorderRadius.circular(4.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(date == null ? label : _dateFormat.format(date)),
            SizedBox(width: 8.0),
            Icon(Icons.calendar_today, size: 20.0),
          ],
        ),
      ),
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


}
