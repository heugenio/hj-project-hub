import 'package:hjsystems/api/api_endpoints.dart';
import 'package:hjsystems/api/models/model_empresas.dart';
import 'package:hjsystems/api/models/model_estoque.dart';
import 'package:hjsystems/api/models/model_grupos.dart';
import 'package:hjsystems/api/models/model_marcas.dart';
import 'package:hjsystems/api/models/model_sales_demo.dart';
import 'package:hjsystems/api/models/model_unidade_empresarial.dart';

import '../api_service.dart';
import '../base_api_service.dart';
import 'app_repository.dart';

class AppRepositoryImpl implements AppRepository {
  final BaseApiService _apiService = NetworkApiService();

  @override
  Future<List<ModelUnidadeEmpresarial>> getCorporacoes() async {
    try {
      dynamic response =
          await _apiService.getResponse(ApiEndpoints().getCorporacoes);

      print(response);
      if (response != null) {
        List<ModelUnidadeEmpresarial> listModelCorporacoes = [];

        for (int i = 0; i < response.length; i++) {
          final jsonData = ModelUnidadeEmpresarial.fromJson(response[i]);
          listModelCorporacoes.add(jsonData);
        }

        return listModelCorporacoes;
      } else {
        return List.empty();
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<List<ModelEmpresas>> getEmpresas() async {
    try {
      dynamic response =
          await _apiService.getResponse(ApiEndpoints().getEmpresas);

      print(response);
      if (response != null) {
        List<ModelEmpresas> listModelCorporacoes = [];

        for (int i = 0; i < response.length; i++) {
          final jsonData = ModelEmpresas.fromJson(response[i]);
          listModelCorporacoes.add(jsonData);
        }

        return listModelCorporacoes;
      } else {
        return List.empty();
      }
    } catch (e) {
      rethrow;
    }
  }

  String createUrl(String id, String grupoFilter, String marcaFilter) {
    String baseUrl = "/getConsultaEstoqueFiliais";
    String queryParameters = "marc_id=$marcaFilter&grpo_id=$grupoFilter&empr_id=$id";
    String url = baseUrl + "?" + queryParameters;
    return url;
  }

  @override
  Future<List<ModelEstoque>> getEstoqueList(
      String id, grupoFilter, marcaFilter) async {
    try {
      dynamic response = await _apiService
          .getResponse(createUrl(id, grupoFilter, marcaFilter));

      if (response != null) {
        List<ModelEstoque> listSubCategories = [];

        for (int i = 0; i < response.length; i++) {
          final jsonData = ModelEstoque.fromJson(response[i]);
          listSubCategories.add(jsonData);
        }

        return listSubCategories;
      } else {
        return List.empty();
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<List<ModelGrupos>> getGrupos() async {
    try {
      dynamic response =
          await _apiService.getResponse(ApiEndpoints().getGrupos);

      if (response != null) {
        List<ModelGrupos> listSubCategories = [];

        for (int i = 0; i < response.length; i++) {
          final jsonData = ModelGrupos.fromJson(response[i]);
          listSubCategories.add(jsonData);
        }

        return listSubCategories;
      } else {
        return List.empty();
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<List<ModelMarcas>> getMarcas() async  {
    try {
      dynamic response =
          await _apiService.getResponse(ApiEndpoints().getMarcas);

      if (response != null) {
        List<ModelMarcas> listSubCategories = [];

        for (int i = 0; i < response.length; i++) {
          final jsonData = ModelMarcas.fromJson(response[i]);
          listSubCategories.add(jsonData);
        }

        return listSubCategories;
      } else {
        return List.empty();
      }
    } catch (e) {
      rethrow;
    }

  }

  @override
  Future<List<ModelSalesDemo>> getSalesList(String unemId) async  {
    try {
      dynamic response = await _apiService.getResponse("/getDemonstrativoVendas?unem_id=$unemId&dtInicial=2022/01/01&dtFinal=2022/12/01");

      print(response);
      if (response != null) {
        List<ModelSalesDemo> listSubCategories = [];

        for (int i = 0; i < response.length; i++) {
          final jsonData = ModelSalesDemo.fromJson(response[i]);
          listSubCategories.add(jsonData);
        }

        return listSubCategories;
      } else {
        return List.empty();
      }
    } catch (e) {
      rethrow;
    }

  }

  @override
  void getUnidadesEmpresariais() {
    // TODO: implement getUnidadesEmpresariais
  }

  @override
  void getUsuario() {
    // TODO: implement getUsuario
  }
}
