import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/repositories/resume_repository.dart';

Future<void> shareResumePdf(BuildContext context, WidgetRef ref, {required String id, required String title}) async {
  try {
    final bytes = await ref.read(resumeRepositoryProvider).pdf(id, lang: context.languageTag);
    if (bytes.isEmpty) throw Exception('empty pdf');

    final dir = await getTemporaryDirectory();
    final safe = title.replaceAll(RegExp(r'[^\w\s-]'), '').trim().replaceAll(RegExp(r'\s+'), '_');
    final file = File('${dir.path}/resume_${safe}_${id.substring(0, 8)}.pdf');
    await file.writeAsBytes(bytes, flush: true);

    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
  } on Exception catch (e) {
    if (context.mounted) showApiError(context, e);
  }
}
