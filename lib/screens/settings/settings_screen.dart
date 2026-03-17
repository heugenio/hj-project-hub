import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hjsystems/screens/components/my_button.dart';
import 'package:hjsystems/screens/components/my_textfield.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _controller = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  void _saveUrl() async {
    if (_formKey.currentState!.validate()) {
      SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setString('hj_system_url_base', _controller.text);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('URL salva com sucesso!')));
    }
  }

  Future<void> _testUrl() async {
    if (_formKey.currentState!.validate()) {
      try {
        final String basicAuth = 'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

        final response = await http.get(Uri.parse('${_controller.text}/getLogo'), headers: {'Authorization': basicAuth});

        if (response.statusCode == 200) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('URL válida!')));
        } else {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Falha ao testar a URL. Verifique o endereço.')));
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao testar a URL. Verifique sua conexão e tente novamente.')));
      }
    }
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


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Configuração"),
        backgroundColor: Colors.black,
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              MyTextField(
                controller: _controller,
                hintText: "Insira a URL base",
                obscureText: false,
                isPhone: false,
                keyboardType: TextInputType.text,
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8.0),
                    child: FutureBuilder<String>(
                      future: getBaseUrl(),
                      builder: (BuildContext context, AsyncSnapshot<String> snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const CircularProgressIndicator();
                        } else if (snapshot.hasError) {
                          return const Text('Erro ao buscar a URL base.');
                        } else {
                          return Text('URL atual: ${snapshot.data}');
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: MyButton(
                      onTap: _testUrl,
                      buttonText: 'TESTAR URL',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: MyButton(
                      onTap: _saveUrl,
                      buttonText: 'SALVAR',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
