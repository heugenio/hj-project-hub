abstract class BaseApiService {

  final String baseUrl = "http://3.214.255.198:8085";

  Future<dynamic> getResponse(String url);
  Future<dynamic> postResponse(String url,Map<String, String> jsonBody);

}