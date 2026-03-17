
import 'package:flutter/material.dart';
import 'package:hjsystems/route/router_name.dart';
import 'package:hjsystems/screens/ordem_servico/ordem_de_servico_screen.dart';
import 'package:hjsystems/screens/principal/principal_screen.dart';
import 'package:hjsystems/screens/relatorios/movement%20summary_screen.dart';
import 'package:hjsystems/screens/relatorios/sales_demo_screen.dart';
import 'package:hjsystems/screens/splash/splash_screen.dart';

import '../screens/auth/login_screen.dart';
import '../screens/estoque/estoque_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/settings/settings_screen.dart';

class RoutesController {
  static MaterialPageRoute gerenateRoute(RouteSettings routeSettings) {
    switch (routeSettings.name) {
      case RouterNames.splash:
        return MaterialPageRoute(
            builder: (BuildContext context) => const SplashScreen());
      case RouterNames.auth:
        return MaterialPageRoute(
            builder: (BuildContext context) => LoginScreen());
      case RouterNames.home:
        return MaterialPageRoute(
            builder: (BuildContext context) => const HomeScreen());
      case RouterNames.produtos:
        return MaterialPageRoute(
            builder: (BuildContext context) => const PrincipalScreen());
      case RouterNames.settings:
        return MaterialPageRoute(
            builder: (BuildContext context) => const SettingsScreen());
      case RouterNames.sales_demo:
        return MaterialPageRoute(
            builder: (BuildContext context) => const SalesDemoScreen());
      case RouterNames.movement_summary:
        return MaterialPageRoute(
            builder: (BuildContext context) => const MovementResumeScreen());
      case RouterNames.estoque:
        return MaterialPageRoute(
            builder: (BuildContext context) => const EstoqueScreen());
      case RouterNames.ordem_servico:
        return MaterialPageRoute(
            builder: (BuildContext context) => const OrdemServicoScreen());
      default:
        return MaterialPageRoute(
            builder: (BuildContext context) => LoginScreen());
    }
  }
}