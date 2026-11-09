import 'package:dio/dio.dart';
import 'package:json_annotation/json_annotation.dart' show CheckedFromJsonException;

import 'api_exception.dart';

/// Turns the `data` of a success envelope into a model.
typedef Decode<T> = T Function(Object? data);

/// One page of a cursor-paginated list (`{"data": [...], "meta": {"next_cursor"}}`).
class Page<T> {
  const Page(this.items, this.nextCursor);
  final List<T> items;

  /// Pass back as `cursor` for the next page; null on the last page.
  final String? nextCursor;

  bool get hasMore => nextCursor != null;
}

/// Thin layer over Dio that speaks the API's envelope. Every outcome is either a decoded
/// value or an [ApiException]: HTTP errors, network errors and unexpected bodies alike.
///
/// Calls that return a model take a required [Decode]; calls made for their effect use the
/// `…Void` variants, so a missing decoder can't compile.
///
/// File uploads: the API's flow is POST /files (presigned form) → multipart POST to the
/// storage URL → POST /files/{id}/complete; [upload] covers the multipart step.
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  /// Request option read by the auth layer: send without an access token.
  static const anonymousKey = 'jv.anonymous';

  Future<T> get<T>(String path, {required Decode<T> decode, Map<String, Object?>? query, CancelToken? cancel}) =>
      _typed('GET', path, decode, query: query, cancel: cancel);

  /// A cursor-paginated list; [item] decodes one element of `data`.
  Future<Page<T>> getPage<T>(
    String path, {
    required T Function(Map<String, Object?> json) item,
    Map<String, Object?>? query,
    CancelToken? cancel,
  }) async {
    final res = await _raw('GET', path, query: query, cancel: cancel);
    return _decoding(() {
      final body = res.data! as Map<String, Object?>;
      final items = (body['data']! as List<Object?>).map((e) => item(e! as Map<String, Object?>)).toList();
      final meta = body['meta'] as Map<String, Object?>?;
      return Page(items, meta?['next_cursor'] as String?);
    });
  }

  Future<T> post<T>(String path, {required Decode<T> decode, Object? body, bool anonymous = false}) =>
      _typed('POST', path, decode, body: body, anonymous: anonymous);

  Future<T> put<T>(String path, {required Decode<T> decode, Object? body}) => _typed('PUT', path, decode, body: body);

  Future<T> patch<T>(String path, {required Decode<T> decode, Object? body}) =>
      _typed('PATCH', path, decode, body: body);

  Future<void> postVoid(String path, {Object? body, bool anonymous = false}) =>
      _void('POST', path, body: body, anonymous: anonymous);

  Future<void> putVoid(String path, {Object? body}) => _void('PUT', path, body: body);

  Future<void> deleteVoid(String path) => _void('DELETE', path);

  /// Multipart upload, e.g. to a presigned storage URL (absolute [url] skips the base URL).
  Future<void> upload(String url, FormData form, {ProgressCallback? onProgress, CancelToken? cancel}) async {
    try {
      await _dio.post<Object?>(
        url,
        data: form,
        options: Options(extra: {anonymousKey: true}, responseType: ResponseType.plain),
        onSendProgress: onProgress,
        cancelToken: cancel,
      );
    } on DioException catch (e) {
      throw failureFrom(e);
    }
  }

  Future<T> _typed<T>(
    String method,
    String path,
    Decode<T> decode, {
    Object? body,
    Map<String, Object?>? query,
    bool anonymous = false,
    CancelToken? cancel,
  }) async {
    final res = await _raw(method, path, body: body, query: query, anonymous: anonymous, cancel: cancel);
    final data = dataOf(res);
    return _decoding(() => decode(data));
  }

  Future<void> _void(String method, String path, {Object? body, bool anonymous = false}) async {
    dataOf(await _raw(method, path, body: body, anonymous: anonymous)); // still rejects non-API bodies
  }

  Future<Response<Object?>> _raw(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    bool anonymous = false,
    CancelToken? cancel,
  }) async {
    try {
      return await _dio.request<Object?>(
        path,
        data: body,
        queryParameters: query,
        cancelToken: cancel,
        options: Options(method: method, extra: {if (anonymous) anonymousKey: true}),
      );
    } on DioException catch (e) {
      throw failureFrom(e);
    }
  }

  /// The `data` member of a success envelope; null for 204. Any other 2xx body (an HTML
  /// login page from a captive portal, say) is a [DecodeFailure], not a crash.
  static Object? dataOf(Response<Object?> res) {
    final body = res.data;
    if (res.statusCode == 204 || body == null || body == '') return null;
    if (body is Map && body.containsKey('data')) return body['data'];
    throw DecodeFailure('unexpected ${res.statusCode} body: ${body.runtimeType}');
  }

  static T _decoding<T>(T Function() decode) {
    try {
      return decode();
    } on ApiException {
      rethrow;
    } on CheckedFromJsonException catch (e) {
      throw DecodeFailure(e);
    } on FormatException catch (e) {
      throw DecodeFailure(e);
    } on TypeError catch (e) {
      throw DecodeFailure(e);
    }
  }

  static ApiException failureFrom(DioException e) {
    final inner = e.error;
    if (inner is ApiException) return inner; // raised by an interceptor (e.g. offline refresh)
    final res = e.response;
    if (res == null) return NetworkFailure(e);
    if (e.type == DioExceptionType.badResponse) return ApiFailure.fromBody(res.statusCode ?? 0, res.data);
    return NetworkFailure(e);
  }
}

/// Decoder for an object-shaped `data`.
Decode<T> decodeObject<T>(T Function(Map<String, Object?> json) fromJson) =>
    (data) => fromJson(data! as Map<String, Object?>);
