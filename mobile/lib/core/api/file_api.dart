import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';
import 'api_providers.dart';

/// Upload purpose as enforced by the backend.
enum FilePurpose {
  avatar,
  companyLogo,
  chatImage,
  chatFile,
  chatVoice,
}

extension on FilePurpose {
  String get apiValue => switch (this) {
    FilePurpose.avatar => 'avatar',
    FilePurpose.companyLogo => 'company_logo',
    FilePurpose.chatImage => 'chat_image',
    FilePurpose.chatFile => 'chat_file',
    FilePurpose.chatVoice => 'chat_voice',
  };
}

/// Presigned upload instructions returned by `POST /files`.
class UploadInstructions {
  const UploadInstructions({required this.fileId, required this.url, required this.method, required this.fields});

  final String fileId;
  final String url;
  final String method;
  final Map<String, String> fields;
}

/// Completed file record returned by `POST /files/{id}/complete`.
class UploadedFile {
  const UploadedFile({
    required this.id,
    required this.contentType,
    required this.size,
    required this.name,
    this.url,
    this.meta,
  });

  final String id;
  final String contentType;
  final int size;
  final String name;
  final String? url;
  final Map<String, Object?>? meta;

  factory UploadedFile.fromJson(Map<String, Object?> json) => UploadedFile(
    id: json['id'] as String,
    contentType: json['content_type'] as String,
    size: (json['size'] as num).toInt(),
    name: json['name'] as String,
    url: json['url'] as String?,
    meta: json['meta'] as Map<String, Object?>?,
  );
}

abstract interface class FileApi {
  Future<UploadInstructions> createUpload({
    required FilePurpose purpose,
    required String contentType,
    required int size,
    String? name,
    Map<String, Object?>? meta,
  });

  Future<void> uploadBytes({
    required String url,
    required Map<String, String> fields,
    required Uint8List bytes,
    required String name,
    ProgressCallback? onProgress,
  });

  Future<UploadedFile> complete(String fileId);
}

class HttpFileApi implements FileApi {
  HttpFileApi(this._api);
  final ApiClient _api;

  @override
  Future<UploadInstructions> createUpload({
    required FilePurpose purpose,
    required String contentType,
    required int size,
    String? name,
    Map<String, Object?>? meta,
  }) async {
    final data = await _api.post<Map<String, Object?>>(
      '/files',
      decode: decodeObject((d) => d),
      body: {
        'purpose': purpose.apiValue,
        'content_type': contentType,
        'size': size,
        if (name != null && name.isNotEmpty) 'name': name,
        if (meta != null && meta.isNotEmpty) 'meta': meta,
      },
    );
    final file = data['file']! as Map<String, Object?>;
    final upload = data['upload']! as Map<String, Object?>;
    final rawFields = upload['fields'] as Map<String, Object?>? ?? {};
    return UploadInstructions(
      fileId: file['id'] as String,
      url: upload['url'] as String,
      method: upload['method'] as String,
      fields: {for (final e in rawFields.entries) e.key: e.value as String},
    );
  }

  @override
  Future<void> uploadBytes({
    required String url,
    required Map<String, String> fields,
    required Uint8List bytes,
    required String name,
    ProgressCallback? onProgress,
  }) async {
    final form = FormData();
    for (final entry in fields.entries) {
      form.fields.add(MapEntry(entry.key, entry.value));
    }
    form.files.add(MapEntry('file', MultipartFile.fromBytes(bytes, filename: name)));
    await _api.upload(url, form, onProgress: onProgress);
  }

  @override
  Future<UploadedFile> complete(String fileId) async {
    final data = await _api.post<Map<String, Object?>>(
      '/files/$fileId/complete',
      decode: decodeObject((d) => d),
    );
    return UploadedFile.fromJson(data['file']! as Map<String, Object?>);
  }
}

final fileApiProvider = Provider<FileApi>((ref) => HttpFileApi(ref.watch(apiClientProvider)));
