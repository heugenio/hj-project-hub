import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_estoque_item.dart';
import 'package:hjsystems/api/models/model_set_ajuste_estoque.dart';
import 'package:hjsystems/api/models/model_user.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../api/models/model_unidade_empresarial.dart';

class EstoqueScreen extends StatefulWidget {
  const EstoqueScreen({Key? key}) : super(key: key);

  @override
  State<EstoqueScreen> createState() => _EstoqueScreenState();
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

Future<List<ModelEstoqueItem>> fetchProduct(String unidId, String productCode) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getConsultaEstoque?unem_id=$unidId&pROD_CODIGO=$productCode",
      ),
      headers: {'Authorization': basicAuth});

  if (response.statusCode == 200) {
    return estoqueItemListFromJson(response.body);
  } else {
    throw Exception("Erro ao buscar usuarios.");
  }
}

Future<void> postAjusteEstoque(BuildContext context, List<ModelAjusteEstoqueItem> itemList) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth = 'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  String jsonBody = jsonEncode(itemList.map((item) => item.toJson()).toList());

  final response = await http.post(
    Uri.parse("$urlBase/setAjusteEstoque"),
    headers: {
      'Authorization': basicAuth,
      'Content-Type': 'application/json',
    },
    body: jsonBody,
  );

  //limpar o show loading da pilha
  print(jsonBody);
  Navigator.of(context).pop();

  if (response.statusCode == 200) {
    showMessageDialog(context, 'Sucesso', 'Itens enviados com sucesso');
  } else {
    showMessageDialog(context, 'Erro', 'Erro ao enviar itens');
    throw Exception("Erro ao buscar usuarios.");
  }
}

void showMessageDialog(BuildContext context, String title, String message) {
  showDialog(
    context: context,
    builder: (BuildContext context) {
      return AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: const Text('OK'),
          ),
        ],
      );
    },
  );
}

Future<ModelUnidadeEmpresarial> getUnidadeEmpresarial() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? unidade = sp.getString("unidade");
  ModelUnidadeEmpresarial unidadeSelecionada =
  ModelUnidadeEmpresarial.fromJson(jsonDecode(unidade!));
  return unidadeSelecionada;
}


Future<ModelUser> fetchuserDataFromDatabase() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? usuario = sp.getString("user");
  ModelUser usuarioLogado = ModelUser.fromJson(jsonDecode(usuario!));
  return usuarioLogado;
}

class _EstoqueScreenState extends State<EstoqueScreen> {

  ModelUser? usuario;
  ModelUnidadeEmpresarial? unidadeEmpresarial;

  late bool loadingData = true;
  bool isSetAjusteEstoqueLoading = true;

  late ModelEstoqueItem atualModelEstoqueItem;
  List<ModelEstoqueItem> itemList = [];
  List<ModelAjusteEstoqueItem> updateList = [];

  final TextEditingController nameController = TextEditingController();
  final TextEditingController undController = TextEditingController();
  final TextEditingController saldoController = TextEditingController();
  final TextEditingController newSaldoController = TextEditingController();

  String _productCodeSearchValue = '';


  @override
  void initState() {
    super.initState();
    getUnidadeData();
    getUserData();
  }

  getUnidadeData() async {
    loadingData = true;
    await getUnidadeEmpresarial().then((value) {
      setState(() {
        unidadeEmpresarial = value;
        loadingData = false;
      });
    });
  }

  getUserData() async {
    await fetchuserDataFromDatabase().then((value) {
      setState(() {
        usuario = value;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text("Ajuste de Estoque"),
        actions: [
          IconButton(
            icon: const Icon(Icons.save),
            onPressed: () {

              if(updateList.isEmpty) {
                buildAlert(context, "Adicione ao menos um item.");
              } else {
                showLoadingComponent(context, "Aguarde, enviando dados...");
                postAjusteEstoque(context, updateList);
                clearAllFields();
              }

            },
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          children: [
            TextField(
              decoration: InputDecoration(
                hintText: 'Código do produto',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: InkWell(
                  onTap: () {
                    setState(() {
                      nameController.clear();
                      undController.clear();
                      saldoController.clear();
                      newSaldoController.clear();
                    });
                  },
                  child: const Icon(Icons.close),
                )
              ),
              onChanged: (value) {
                setState(() {
                  _productCodeSearchValue = value;
                });
              },
              onSubmitted: (value) async {
                if (value.isNotEmpty) {
                  final productData = await fetchProduct(unidadeEmpresarial!.unemId!, value);

                  if(productData.isNotEmpty) {
                    atualModelEstoqueItem = productData[0];
                    nameController.text = productData[0].pRODNOME!;
                    undController.text = productData[0].uNIDSIGLA!;
                    saldoController.text = productData[0].sESTQTDSALDO!.toString();
                  } else {
                    buildAlert(context, "Nenhum produto encontrado com o código informado.");
                  }

                }
              },
            ),
            const SizedBox(
              height: 5,
            ),
            buildUserInfoEditField(
                nameController, 'Nome', TextInputType.number, false),
            const SizedBox(
              height: 5,
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: buildUserInfoEditField(
                      undController, 'Und', TextInputType.text, false),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: buildUserInfoEditField(
                      saldoController, 'Saldo', TextInputType.text, false),
                ),
              ],
            ),
            buildUserInfoEditField(
                newSaldoController, 'Saldo atual', TextInputType.number, true),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                ElevatedButton(onPressed: (){
                  if (nameController.text.isNotEmpty &&
                      undController.text.isNotEmpty &&
                      saldoController.text.isNotEmpty &&
                      newSaldoController.text.isNotEmpty) {
                    setState(() {
                      if(!itemExists(ModelEstoqueItem(pRODCODIGO: _productCodeSearchValue), itemList)) {
                        itemList.add(ModelEstoqueItem(pRODNOME: nameController.text, uNIDSIGLA: undController.text, sESTQTDSALDO: int.parse(saldoController.text), pRODCODIGO: _productCodeSearchValue));
                        updateList.add(ModelAjusteEstoqueItem(
                          testId: atualModelEstoqueItem.tESTID,
                          newSaldo: newSaldoController.text,
                          prodId: atualModelEstoqueItem.pRODID,
                          saldo: saldoController.text,
                          unemId: unidadeEmpresarial?.unemId!,
                          usrsId: usuario?.usrsID,
                        ));
                      } else {
                        buildAlert(context, "Só é possivel adicionar um item com o mesmo código.");
                      }

                    });
                  } else {
                    buildAlert(context, "Por favor, preencha o novo valor.");
                  }
                }, child: const Text("ADICIONAR"), style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black, // Define a cor do botão aqui
                ),),
              ],
            ),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey),
                ),
                child: ListView.builder(
                  itemCount: itemList.length,
                  itemBuilder: (context, index) {
                    ModelEstoqueItem item = itemList[index];
                    ModelAjusteEstoqueItem itemAjuste = updateList[index];
                    return ListTile(
                      title: Text(item.pRODNOME!),
                      subtitle: Text('Und: ${item.uNIDSIGLA}, Saldo: ${item.sESTQTDSALDO}, Novo Saldo:  ${itemAjuste.newSaldo}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete),
                        onPressed: () {
                          setState(() {
                            itemList.removeAt(index);
                            updateList.removeAt(index);
                          });
                        },
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void showLoadingComponent(BuildContext context, String message) {
    showDialog(
        context: context,
        barrierDismissible: false,
        builder: (BuildContext context) {
      return Dialog(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  const CircularProgressIndicator(),
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Text(message),
                  )
                ],
              ),
            ),
          ],
        ),
      );
    },
    );
  }


  void clearAllFields() {
    setState(() {
      nameController.clear();
      undController.clear();
      saldoController.clear();
      newSaldoController.clear();
      updateList.clear();
      itemList.clear();
    });
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

  bool itemExists(ModelEstoqueItem newItem, List<ModelEstoqueItem> itemList) {
    for (ModelEstoqueItem item in itemList) {
      if (item.pRODCODIGO.toString() == newItem.pRODCODIGO.toString()) {
        return true;
      }
    }
    return false;
  }


  Widget buildUserInfoEditField(TextEditingController controller, String label,
          TextInputType kType, bool isEnabled) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                    fontFamily: 'Nunito'),
              ),
              const SizedBox(
                height: 1,
              ),
              TextField(
                enabled: isEnabled,
                controller: controller,
                keyboardType: kType,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  focusedBorder: OutlineInputBorder(),
                ),
                style: const TextStyle(
                    fontSize: 16, height: 1.4, fontFamily: 'Nunito'),
              ),
            ],
          ));

}
