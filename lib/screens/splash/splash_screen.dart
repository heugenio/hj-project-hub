import 'package:flutter/material.dart';
import 'package:hjsystems/route/router_name.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

Future<bool?> fetchIsUserLogged() async {
  SharedPreferences sp = await SharedPreferences.getInstance();

  bool? logged = sp.getBool("isLogged");

  return logged;
}

class _SplashScreenState extends State<SplashScreen> {

  @override
  void initState() {
    getIsUserLogged();
    super.initState();
  }

  getIsUserLogged() async {
    fetchIsUserLogged().then((value) {
      if(value == true) {
        Future.delayed(const Duration(seconds: 2), () async {
          Navigator.popAndPushNamed(context, RouterNames.home);
        });
      } else {
        Future.delayed(const Duration(seconds: 2), () async {
          Navigator.popAndPushNamed(context, RouterNames.auth);
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Container(
          height: 120,
          width: 200,
          decoration: const BoxDecoration(
            color: Colors.transparent,
            image: DecorationImage(
                image: AssetImage(
                  'lib/assets/image/logo2.png',
                )),
          ),
        ),
      ),
    );
  }
}
