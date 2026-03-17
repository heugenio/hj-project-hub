import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_estoque.dart';
import 'package:hjsystems/api/models/model_grupos.dart';
import 'package:hjsystems/api/models/model_marcas.dart';
import 'package:hjsystems/api/models/model_unidade_empresarial.dart';
import 'package:hjsystems/screens/components/my_custom_text.dart';
import 'package:hjsystems/screens/principal/principal_viewmodel.dart';
import 'package:hjsystems/screens/principal/view_product_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../api/response/api_response.dart';

class PrincipalScreen extends StatefulWidget {
  const PrincipalScreen({Key? key}) : super(key: key);

  @override
  State<PrincipalScreen> createState() => _PrincipalScreenState();
}

Future<ModelUnidadeEmpresarial> getUnidadeEmpresarial() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? unidade = sp.getString("unidade");
  ModelUnidadeEmpresarial unidadeSelecionada =
      ModelUnidadeEmpresarial.fromJson(jsonDecode(unidade!));
  return unidadeSelecionada;
}

class _PrincipalScreenState extends State<PrincipalScreen> {
  PrincipalViewModel viewModel = PrincipalViewModel();
  ModelUnidadeEmpresarial? unidadeEmpresarial;
  late bool loadingData = true;

  String _searchValue = '';

  List<ModelGrupos> listGrupos = [
    ModelGrupos(grpoId: "000640010000000009", grpoNome: "ATIVO IMOBILIZADO"),
    ModelGrupos(grpoId: "000640010000000002", grpoNome: "BFGOODRICH"),
    ModelGrupos(grpoId: "000640010000000007", grpoNome: "BRINDE PROMOCIONAL"),
    ModelGrupos(grpoId: "000640010000000008", grpoNome: "LUBRIFICANTES"),
    ModelGrupos(grpoId: "000640010000000001", grpoNome: "MICHELIN"),
    ModelGrupos(grpoId: "000640010000000003", grpoNome: "OUTROS"),
    ModelGrupos(grpoId: "000640010000000006", grpoNome: "PECAS"),
    ModelGrupos(grpoId: "000640010000006232", grpoNome: "PNEUS MOTO"),
    ModelGrupos(grpoId: "000640010000000005", grpoNome: "SERVICOS"),
  ];

  ModelGrupos? grupoSelected;

  List<ModelMarcas> listMarcas = [
    ModelMarcas(marcId: "000640010000000002", marcNome: "BFG"),
    ModelMarcas(marcId: "000640010000006233", marcNome: "BOSCH"),
    ModelMarcas(marcId: "000640010000006232", marcNome: "CONTINENTAL"),
    ModelMarcas(marcId: "000640010000006234", marcNome: "DUNLOP"),
    ModelMarcas(marcId: "000640010000000006", marcNome: "GERAL"),
    ModelMarcas(marcId: "000640010000000005", marcNome: "GRIFFE"),
    ModelMarcas(marcId: "000640010000006235", marcNome: "GT RADIAL"),
    ModelMarcas(marcId: "000640010000000001", marcNome: "MICHELIN"),
    ModelMarcas(marcId: "000640010000000003", marcNome: "OUTROS"),
  ];
  ModelMarcas? marcaSelected;

  @override
  void initState() {
    super.initState();
    getUserdata();
  }

  getUserdata() async {
    loadingData = true;
    await getUnidadeEmpresarial().then((value) {
      setState(() {
        unidadeEmpresarial = value;
        viewModel.getEstoqueFilianList(unidadeEmpresarial!.emprId!, "", "");
        loadingData = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text("Produtos"),
      ),
      body: ChangeNotifierProvider<PrincipalViewModel>(
          create: (BuildContext context) => viewModel,
          child: Consumer<PrincipalViewModel>(builder: (context, viewModel, _) {
            switch (viewModel.estoqueResponse.status) {
              case Status.LOADING:
                return Center(
                    child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    CircularProgressIndicator(),
                    Padding(
                      padding: EdgeInsets.all(8.0),
                      child: Text("Aguarde, carregando base de dados..."),
                    )
                  ],
                ));
              case Status.ERROR:
                return const Text("erro");
              case Status.COMPLETED:
                return Container(
                    padding: const EdgeInsets.all(8),
                    child: buildCategoriesView(viewModel.estoqueResponse.data));
              default:
                return const Text("erro");
            }
          })),
      endDrawer: buildEndDrawer(),
    );
  }

  Drawer buildEndDrawer() {
    return Drawer(
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          children: [
            const SizedBox(
              height: 50,
            ),
            const Text('Filtrar por'),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 25.0, vertical: 5.0),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 24.0, vertical: 15.0),
                decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey, width: 1),
                    borderRadius: BorderRadius.circular(4)),
                child: DropdownButton<ModelGrupos>(
                  elevation: 16,
                  hint: Text("Grupo"),
                  icon: const Icon(Icons.keyboard_arrow_down),
                  isExpanded: true,
                  isDense: true,
                  value: grupoSelected,
                  underline: const SizedBox(),
                  style: const TextStyle(color: Colors.black),
                  onChanged: (ModelGrupos? value) {
                    setState(() {
                      grupoSelected = value!;
                    });
                  },
                  items: listGrupos.map<DropdownMenuItem<ModelGrupos>>(
                    (ModelGrupos value) {
                      return DropdownMenuItem<ModelGrupos>(
                        value: value,
                        child: Text(value.grpoNome!),
                      );
                    },
                  ).toList(),
                ),
              ),
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 24.0, vertical: 5.0),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 25.0, vertical: 15.0),
                decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey, width: 1),
                    borderRadius: BorderRadius.circular(4)),
                child: DropdownButton<ModelMarcas>(
                  elevation: 16,
                  hint: Text("Marca"),
                  icon: const Icon(Icons.keyboard_arrow_down),
                  isExpanded: true,
                  isDense: true,
                  value: marcaSelected,
                  underline: const SizedBox(),
                  style: const TextStyle(color: Colors.black),
                  onChanged: (ModelMarcas? value) {
                    setState(() {
                      marcaSelected = value!;
                    });
                  },
                  items: listMarcas.map<DropdownMenuItem<ModelMarcas>>(
                    (ModelMarcas value) {
                      return DropdownMenuItem<ModelMarcas>(
                        value: value,
                        child: Text(value.marcNome!),
                      );
                    },
                  ).toList(),
                ),
              ),
            ),
            const SizedBox(
              height: 25,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ElevatedButton(
                      style: ButtonStyle(
                        backgroundColor:
                            MaterialStateProperty.all<Color>(Colors.black),
                      ),
                      onPressed: () {
                        setState(() {
                          grupoSelected = null;
                          marcaSelected = null;
                          viewModel.getEstoqueFilianList(
                              unidadeEmpresarial!.emprId!, "", "");
                        });
                      },
                      child: const Text("Limpar filtro")),
                  ElevatedButton(
                      style: ButtonStyle(
                        backgroundColor:
                            MaterialStateProperty.all<Color>(Colors.black),
                      ),
                      onPressed: () {
                        viewModel.getEstoqueFilianList(
                            unidadeEmpresarial!.emprId!,
                            grupoSelected?.grpoId,
                            marcaSelected?.marcId);
                      },
                      child: const Text("Aplicar")),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  String getValueForUnidadeEmpresarial(
      String unidadeEmpresarial, ModelEstoque data) {
    switch (unidadeEmpresarial) {
      case 'g01':
        return data.g01!;
      case 'g02':
        return data.g02!;
      case 'g03':
        return data.g03!;
      case 'g04':
        return data.g04!;
      case 'g05':
        return data.g05!;
      case 'g06':
        return data.g06!;
      case 'g07':
        return data.g07!;
      case 'g08':
        return data.g08!;
      case 'g09':
        return data.g09!;
      case 'g10':
        return data.g10!;
      case 'g11':
        return data.g11!;
      case 'go':
        return data.gO!;
      case 'df':
        return data.dF!;
      case 'geral':
        return data.geral!;
      default:
        return "";
    }
  }

  buildCategoriesView(List<ModelEstoque>? data) {
    List<ModelEstoque> _filteredProducts = data!.where((product) {
      return product.nome!.toLowerCase().contains(_searchValue.toLowerCase()) ||
          product.codigo!.toLowerCase().contains(_searchValue.toLowerCase());
    }).toList();

    return CustomScrollView(
      slivers: [
        SliverList(
          delegate: SliverChildListDelegate(
            [
              Padding(
                padding: const EdgeInsets.all(8.0),
                child: TextField(
                  decoration: const InputDecoration(
                    hintText: 'Filtrar por nome ou código',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onSubmitted: (value) {
                    setState(() {
                      _searchValue = value;
                    });
                  },
                ),
              ),
            ],
          ),
        ),
        _filteredProducts.isEmpty
            ? const SliverFillRemaining(
                child: Center(
                  child: Text("Nenhum produto encontrado."),
                ),
              )
            : buildProductsList(_filteredProducts),
      ],
    );
  }

  SliverList buildProductsList(List<ModelEstoque> filteredProducts) {
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (BuildContext context, int index) {
          return InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ViewProductScreen(
                    product: filteredProducts[index],
                  ),
                ),
              );
            },
            child: Card(
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(filteredProducts[index].nome!)),
                      ],
                    ),
                    const SizedBox(
                      height: 10,
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        MyCustomTextWithTitleAndDescription(
                            "Código: ", filteredProducts[index].codigo!),
                        MyCustomTextWithTitleAndDescription(
                            "${unidadeEmpresarial!.unemSigla!}: ",
                            getValueForUnidadeEmpresarial(
                                unidadeEmpresarial!.unemSigla!.toLowerCase(),
                                filteredProducts[index])),
                      ],
                    )
                  ],
                ),
              ),
            ),
          );
        },
        childCount: filteredProducts.length,
      ),
    );
  }
}
