import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:hjsystems/api/models/model_estoque.dart';
import 'package:hjsystems/api/repository/app_repository_impl.dart';

import '../../api/response/api_response.dart';

class PrincipalViewModel extends ChangeNotifier {

  final _repository = AppRepositoryImpl();

  ApiResponse<List<ModelEstoque>?> estoqueResponse = ApiResponse.loading();

  void _setEstoqueList(ApiResponse<List<ModelEstoque>?> response) {
    estoqueResponse = response;
    notifyListeners();
  }

  Future<void> getEstoqueFilianList(String id, grupoFilter, marcaFilter) async {
    _setEstoqueList(ApiResponse.loading());
    _repository
        .getEstoqueList(id, grupoFilter, marcaFilter)
        .then((value) => _setEstoqueList(ApiResponse.completed(value)))
        .onError((error, stackTrace) => _setEstoqueList(ApiResponse.error(error.toString())));
  }
}