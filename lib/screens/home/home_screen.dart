import 'dart:convert';
import 'dart:typed_data';

import 'package:bottom_navy_bar/bottom_navy_bar.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_unidade_empresarial.dart';
import 'package:hjsystems/api/models/model_user.dart';
import 'package:hjsystems/screens/adicionar/adicionar_screen.dart';
import 'package:hjsystems/screens/pedidos/pedidos_screen.dart';
import 'package:hjsystems/screens/welcome/welcome_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../api/models/model_grupos.dart';
import '../../api/models/model_marcas.dart';
import '../../apptexts.dart';
import '../../route/router_name.dart';
import 'package:http/http.dart' as http;

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

Future<ModelUser> getUsername() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? usuario = sp.getString("user");
  ModelUser user = ModelUser.fromJson(jsonDecode(usuario!));
  return user;
}

Future<ModelUnidadeEmpresarial> getUnidadeEmpresarial() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  String? unidade_db = sp.getString("unidade");
  ModelUnidadeEmpresarial unidade = ModelUnidadeEmpresarial.fromJson(jsonDecode(unidade_db!));
  return unidade;
}

Future<Uint8List> fetchLogo() async {

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(Uri.parse('http://hjsystems.dynns.com:8085/getLogo'), headers: {'Authorization': basicAuth});

  if (response.statusCode == 200) {
    return response.bodyBytes;
  } else {
    throw Exception('Failed to load logo');
  }
}

class _HomeScreenState extends State<HomeScreen> {

  int _currentIndex = 0;
  PageController _pageController = PageController();
  ModelUser? user;
  ModelUnidadeEmpresarial? unidadeEmpresarial;

  late bool loadingData = true;
  late bool loadingUnidade = true;

  late bool loadingImage = true;
  Uint8List? image;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    getUserdata();
    getUnidadeData();
    getLogo();
  }

  getUserdata() async {
    loadingData = true;
    getUsername().then((value){
      setState(() {
        user = value;
        loadingData = false;
      });
    });
  }

  getUnidadeData() async {
    loadingUnidade = true;
    getUnidadeEmpresarial().then((value){
      setState(() {
        unidadeEmpresarial = value;
        loadingUnidade = false;
      });
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  getLogo() async {
    loadingImage = true;
    fetchLogo().then((value) {
      setState(() {
        image = value;
        loadingImage = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView(
        controller: _pageController,
        children: const <Widget>[WelcomeScreen(), PedidosScreen(), AdicionarScreen()],
        onPageChanged: (index) {
          setState(() => _currentIndex = index);
        },
      ),
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: loadingUnidade ? const Text("") : Text(unidadeEmpresarial!.unemFantasia!),
      ),
      drawer: Drawer(
        child: Column(
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(
                color: Colors.black,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children:[
                      const Text("Olá,", style: TextStyle(color: Colors.white),),
                      loadingData ? const CircularProgressIndicator(): Text(user!.usrsNomeLogin!, style: const TextStyle(color: Colors.white),)
                    ],
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.shopping_bag),
              title: const Text('Ajuste de Estoque'),
              onTap: () {
                Navigator.pushNamed(context, RouterNames.estoque);
              },
            ),
            ExpansionTile(
              leading: const Icon(Icons.area_chart),
              title: const Text('Relatórios'),
              children: [
                ListTile(
                  title: const Text('Demonstrativo de venda'),
                  onTap: () {
                    Navigator.pushNamed(context, RouterNames.sales_demo);
                  },
                ),
                ListTile(
                  title: const Text('Resumo do movimento'),
                  onTap: () {
                    Navigator.pushNamed(context, RouterNames.movement_summary);
                  },
                ),
              ],
            ),
            ListTile(
              leading: const Icon(Icons.build),
              title: const Text('Ordem de Serviço'),
              onTap: () {
                Navigator.pushNamed(context, RouterNames.ordem_servico);
              },
            ),
            ListTile(
              leading: const Icon(Icons.local_offer),
              title: const Text('Produtos'),
              onTap: () {
                Navigator.pushNamed(context, RouterNames.produtos);
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings),
              title: const Text('Configurações'),
              onTap: () {
                Navigator.pushNamed(context, RouterNames.settings);
              },
            ),
            Expanded(child: Container()),

            const SizedBox(height: 20,),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: InkWell(
                    onTap: () {
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
                                  padding: EdgeInsets.all(16.0),
                                  child: Column(
                                    children: const [
                                      CircularProgressIndicator(),
                                      Padding(
                                        padding: EdgeInsets.all(8.0),
                                        child: Text("Estamos desconetando sua conta, por favor, aguarde."),
                                      )
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      );
                      Future.delayed(const Duration(seconds: 2), () async {
                        Navigator.of(context).pop();
                        SharedPreferences sp = await SharedPreferences.getInstance();
                        sp.clear();
                        Navigator.of(context).pop();
                        Navigator.popAndPushNamed(context, RouterNames.auth);
                      });
                    },
                    child: const Text("Sair", style: TextStyle(fontWeight: FontWeight.bold),),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20,)
          ],
        ),
      ),
      bottomNavigationBar: BottomNavyBar(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        backgroundColor: Colors.black,
        selectedIndex: _currentIndex,
        showElevation: true,
        itemCornerRadius: 24,
        curve: Curves.easeIn,
        onItemSelected: (index) => setState(() {
          _currentIndex = index;
          _pageController.animateToPage(index,
              duration: const Duration(milliseconds: 300), curve: Curves.ease);
        }),
        items: <BottomNavyBarItem>[
          BottomNavyBarItem(
            icon: const Icon(Icons.home),
            title:  Text(AppTexts.textHomeNavbar,),
            activeColor: Colors.grey[200]!,
            textAlign: TextAlign.center,
          ),
          BottomNavyBarItem(
            icon: const Icon(Icons.list),
            title:  Text(AppTexts.textPedidosNavbar),
            activeColor: Colors.grey[200]!,
            textAlign: TextAlign.center,
          ),
          BottomNavyBarItem(
            icon: const Icon(Icons.add_circle),
            title: Text(AppTexts.textAddNavbar),
            activeColor: Colors.grey[200]!,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
