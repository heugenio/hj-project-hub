import 'dart:convert';
import 'dart:io';

import 'exception/app_exception.dart';
import 'package:http/http.dart' as http;
import 'base_api_service.dart';

class NetworkApiService extends BaseApiService {

  @override
  Future getResponse(String url) async {
    dynamic responseJson;
    try {

      final String basicAuth = 'Basic ' + base64Encode(utf8.encode('hjsystems:11032011'));

      final response = await http.get(Uri.parse(baseUrl + url), headers: {'Authorization': basicAuth});
      responseJson = returnResponse(response);
    } on SocketException {
      throw FetchDataException('No Internet Connection');
    }
    return responseJson;
  }

  @override
  Future postResponse(String url, Map<String, String> JsonBody) async{
    dynamic responseJson;
    try {
      final response = await http.post(Uri.parse(baseUrl + url),body: JsonBody);
      responseJson = returnResponse(response);
    } on SocketException {
      throw FetchDataException('No Internet Connection');
    }
    return responseJson;
  }

  dynamic returnResponse(http.Response response) {
    switch (response.statusCode) {
      case 200:
        dynamic responseJson = jsonDecode(response.body);
        return responseJson;
      case 400:
        throw BadRequestException(response.toString());
      case 401:
      case 403:
        throw UnauthorisedException(response.body.toString());
      case 404:
        throw UnauthorisedException(response.body.toString());
      case 500:
      default:
        throw FetchDataException(
            'Error occured while communication with server' +
                ' with status code : ${response.statusCode}');
    }
  }
}