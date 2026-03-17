import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:hjsystems/api/models/model_empresas.dart';
import 'package:hjsystems/api/models/model_user.dart';
import 'package:hjsystems/route/router_name.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../api/models/model_unidade_empresarial.dart';
import '../../apptexts.dart';
import '../components/dropdown_button.dart';
import '../components/my_button.dart';
import 'package:http/http.dart' as http;

class LoginScreen extends StatefulWidget {
  LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
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

Future<List<ModelEmpresas>> getEmpresas() async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getEmpresas?cprc_id=00064",
      ),
      headers: {'Authorization': basicAuth});

  print("get empresas");
  print(response);

  if (response.statusCode == 200) {
    return empresasFromJson(response.body);
  } else {
    throw Exception("Erro ao buscar empresas.");
  }
}

Future<List<ModelUnidadeEmpresarial>> getUnidadesEmpresariais(
    String empresa_id) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getUnidadesEmpresariais?empr_id=$empresa_id",
      ),
      headers: {'Authorization': basicAuth});

  print("get unidade empresarial");
  print(response);

  if (response.statusCode == 200) {
    return unidadeEmpresarialFromJson(response.body);
  } else {
    throw Exception("Erro ao buscar unidade empresarial.");
  }
}

Future<List<ModelUser>> getUsuarios(String unidId) async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(
      Uri.parse(
        "$urlBase/getUsuario?unem_id=$unidId",
      ),
      headers: {'Authorization': basicAuth});

  print("get usuários");
  print(response);

  if (response.statusCode == 200) {
    return usuariosListFromJson(response.body);
  } else {
    throw Exception("Erro ao buscar usuarios.");
  }
}

Future<bool?> getIsUserlogged() async {
  SharedPreferences sp = await SharedPreferences.getInstance();
  bool? logged = sp.getBool("isLogged");
  return logged;
}

Future<Uint8List> fetchLogo() async {

  final String urlBase = await getBaseUrl();

  final String basicAuth =
      'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

  final response = await http.get(Uri.parse('$urlBase/getLogo'), headers: {'Authorization': basicAuth});

  print("get logo");
  print(response);

  if (response.statusCode == 200) {
    return response.bodyBytes;
  } else {
    throw Exception('Failed to load logo');
  }
}

class _LoginScreenState extends State<LoginScreen> {
  final _loginFormKey = GlobalKey<FormState>();
  final passwordController = TextEditingController();

  List<ModelUnidadeEmpresarial> unidadeEmpresarial = [];
  ModelUnidadeEmpresarial? unidadeEmpresarialSelected;
  late bool loadingUnidadeEmpresarial;
  late bool loadingUnidadeEmpresarialError = false;

  List<ModelEmpresas> empresas = [];
  ModelEmpresas? empresaSelected;
  late bool loadingEmpresas = false;
  late bool loadingEmpresaError = false;

  late bool isLogged;

  List<ModelUser> usuarios = [];
  ModelUser? usuarioSelected;

  late bool loadingImage = true;
  late bool loadingImageError = false;
  Uint8List? image;

  bool obscured = false;

  void _toggleObscured() {
    setState(() {
      obscured = !obscured;
    });
  }

  @override
  void initState() {
    super.initState();
    isUserLogged();
    getLogo();
  }

  isUserLogged() async {
    getIsUserlogged().then((value){
      if(value == true) {
        setState(() {
          Navigator.popAndPushNamed(context, RouterNames.home);
        });
      } else {
        setState(() {
          fetchEmpresasDropdown();
        });
      }
    });
  }

  fetchEmpresasDropdown() async {
    loadingEmpresas = true;
    await getEmpresas().then((value) {
      setState(() {
        empresas = value;
        loadingEmpresas = false;
      });
    }).catchError((onError, stackTrace) {
      setState(() {
        loadingEmpresas = false;
        loadingEmpresaError = true;
      });
    });
  }

  fetchUnidadesEmpresariais(String emprId) async {
    showLoadingDialog();
    await getUnidadesEmpresariais(emprId).then((value) {
      setState(() {
        unidadeEmpresarial = value;
        Navigator.of(context).pop();
      });
    });
  }

  fetchUsuarios(String unidadeId) async {
    showLoadingDialog();
    await getUsuarios(unidadeId).then((value) {
      setState(() {
        usuarios = value;
        Navigator.of(context).pop();
      });
    });
  }

  getLogo() async {
    loadingImage = true;
    fetchLogo().then((value) {
      setState(() {
        image = value;
        loadingImage = false;
      });
    }).catchError((onError, stackTrace) {
      setState(() {
        loadingImageError = true;
      });
    });
  }

  login(
      String password, ModelUser user, ModelUnidadeEmpresarial unidade) async {
    if (password == user.usrsSenha) {
      showLoginDialog();

      SharedPreferences sp = await SharedPreferences.getInstance();

      await sp.setString("user", jsonEncode(user));
      await sp.setString("unidade", jsonEncode(unidade));
      await sp.setBool("isLogged", true);

      Future.delayed(const Duration(seconds: 2), () {
        Navigator.of(context).pop();
        Navigator.popAndPushNamed(context, RouterNames.home);
      });
    } else {
      showMyCustomDialog("Oops!",
          "A senha informada está incorreta, por favor, tente novamente.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: Colors.white,
      body: Center(
        child: Form(
          key: _loginFormKey,
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 200,
                      child: Center(
                          child: loadingImage ? const CircularProgressIndicator() : loadingImageError ? Image.asset("assets/image/logo1.png") : Image.memory(image!)
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 25.0, vertical: 5.0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 25.0, vertical: 15.0),
                    decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey, width: 1),
                        borderRadius: BorderRadius.circular(4)),
                    child: DropdownButton<ModelEmpresas>(
                      elevation: 16,
                      hint: loadingEmpresas
                          ? Text("Carregando..")
                          : loadingEmpresaError
                              ? buildIconReloadEmpresas()
                              : Text("Empresa"),
                      icon: const Icon(Icons.keyboard_arrow_down),
                      isExpanded: true,
                      isDense: true,
                      value: empresaSelected,
                      underline: const SizedBox(),
                      style: const TextStyle(color: Colors.black),
                      onChanged: (ModelEmpresas? value) {
                        setState(() {
                          empresaSelected = value!;
                          fetchUnidadesEmpresariais(empresaSelected!.emprId!);
                        });
                      },
                      items: empresas.map<DropdownMenuItem<ModelEmpresas>>(
                        (ModelEmpresas value) {
                          return DropdownMenuItem<ModelEmpresas>(
                            value: value,
                            child: Text(value.emprNome!),
                          );
                        },
                      ).toList(),
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 25.0, vertical: 5.0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 25.0, vertical: 15.0),
                    decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey, width: 1),
                        borderRadius: BorderRadius.circular(4)),
                    child: DropdownButton<ModelUnidadeEmpresarial>(
                      elevation: 16,
                      hint: const Text("Unidade Empresarial"),
                      icon: const Icon(Icons.keyboard_arrow_down),
                      isExpanded: true,
                      isDense: true,
                      value: unidadeEmpresarialSelected,
                      underline: const SizedBox(),
                      style: const TextStyle(color: Colors.black),
                      onChanged: (ModelUnidadeEmpresarial? value) {
                        setState(() {
                          unidadeEmpresarialSelected = value!;
                          fetchUsuarios(unidadeEmpresarialSelected!.unemId!);
                        });
                      },
                      items: unidadeEmpresarial
                          .map<DropdownMenuItem<ModelUnidadeEmpresarial>>(
                        (ModelUnidadeEmpresarial value) {
                          return DropdownMenuItem<ModelUnidadeEmpresarial>(
                            value: value,
                            child: Text(value.unemFantasia!),
                          );
                        },
                      ).toList(),
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 25.0, vertical: 5.0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 25.0, vertical: 15.0),
                    decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey, width: 1),
                        borderRadius: BorderRadius.circular(4)),
                    child: DropdownButton<ModelUser>(
                      elevation: 16,
                      hint: const Text("Usuario"),
                      icon: const Icon(Icons.keyboard_arrow_down),
                      isExpanded: true,
                      isDense: true,
                      value: usuarioSelected,
                      underline: const SizedBox(),
                      style: const TextStyle(color: Colors.black),
                      onChanged: (ModelUser? value) {
                        setState(() {
                          usuarioSelected = value!;
                        });
                      },
                      items: usuarios.map<DropdownMenuItem<ModelUser>>(
                        (ModelUser value) {
                          return DropdownMenuItem<ModelUser>(
                            value: value,
                            child: Text(value.usrsNomeLogin!),
                          );
                        },
                      ).toList(),
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 25.0),
                  child: TextFormField(
                    keyboardType: TextInputType.text,
                    controller: passwordController,
                    obscureText: obscured,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Campo obrigatório.';
                      }
                      return null;
                    },
                    decoration: InputDecoration(
                      enabledBorder: const OutlineInputBorder(
                        borderSide: BorderSide(color: Colors.black26),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: Colors.grey.shade400),
                      ),
                      fillColor: Colors.grey.shade200,
                      filled: true,
                      hintText: AppTexts.hintPassword,
                      hintStyle: TextStyle(color: Colors.grey[500]),
                      suffixIcon: Padding(
                        padding: const EdgeInsets.fromLTRB(0, 0, 4, 0),
                        child: GestureDetector(
                          onTap: _toggleObscured,
                          child: Icon(
                            obscured
                                ? Icons.visibility_rounded
                                : Icons.visibility_off_rounded,
                            size: 24,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 25),
                // sign in button
                MyButton(
                  onTap: () {
                    if (_loginFormKey.currentState!.validate()) {
                      login(passwordController.text, usuarioSelected!,
                          unidadeEmpresarialSelected!);
                    }
                  },
                  buttonText: AppTexts.textButtonLogin,
                ),

                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children:[
                    InkWell(
                      onTap: () {
                        Navigator.pushNamed(context, RouterNames.settings);
                      },
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                        child: Text("É seu primeiro acesso?"),
                      ),
                    )
                  ],
                )
              ],
            ),
          ),
        ),
      ),
    );
  }

  void showLoadingDialog() {
    showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        });
  }

  void showLoginDialog() {
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
                  children: const [
                    CircularProgressIndicator(),
                    Padding(
                      padding: EdgeInsets.all(8.0),
                      child: Text("Aguarde..."),
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

  void showMyCustomDialog(String title, message) {
    showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return AlertDialog(
            title: Text(title),
            content: SingleChildScrollView(
              child: ListBody(
                children: <Widget>[
                  Text(message),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: const Text('Ok, entendi.'),
                onPressed: () {
                  Navigator.of(context).pop();
                },
              ),
            ],
          );
        });
  }

  buildEmpresaList(List<ModelEmpresas>? data) {
    final corporationsList =
        data?.map((corporation) => corporation.emprNome).toList();

    return MyDropdownButton(
      title: "Empresa",
      list: corporationsList,
    );
  }

  Widget buildIconReloadEmpresas() {
    return InkWell(
      onTap: () {
        fetchEmpresasDropdown();
      },
      child: const Icon(Icons.sync),
    );
  }

  Widget buildIconReloadUnidadeEmpresarial() {
    return InkWell(
      onTap: () {
        fetchUnidadesEmpresariais(empresaSelected!.emprId!);
      },
      child: const Icon(Icons.sync),
    );
  }

}
