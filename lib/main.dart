import 'package:flutter/material.dart';
import 'package:hjsystems/route/router_controller.dart';
import 'package:hjsystems/route/router_name.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  /* insert url base on app created */
  SharedPreferences sharedPreferences = await SharedPreferences.getInstance();
  String key = "hj_system_url_base";
  String defaultValue = "http://hjsystems.dynns.com:8085";

  if (!sharedPreferences.containsKey(key)) {
    print("url base added.");
    await sharedPreferences.setString(key, defaultValue);
  } else {
    print("url base exist.");
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'HJ Systems',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      initialRoute: RouterNames.splash,
      onGenerateRoute: RoutesController.gerenateRoute,
    );
  }
}