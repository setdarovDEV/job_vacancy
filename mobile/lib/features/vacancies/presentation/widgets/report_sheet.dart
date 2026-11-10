import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/models/report.dart';
import '../../data/repositories/report_repository.dart';
import 'vacancy_helpers.dart';

class ReportSheet extends ConsumerStatefulWidget {
  const ReportSheet({super.key, required this.targetType, required this.targetId});
  final String targetType;
  final String targetId;

  @override
  ConsumerState<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<ReportSheet> {
  ReportReason? _reason;
  final _commentController = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l.errorsUnauthorized, style: context.text.bodyMedium),
            const SizedBox(height: AppSpace.lg),
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                context.push(Routes.login);
              },
              child: Text(l.navSignIn),
            ),
          ],
        ),
      );
    }

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.reportTitle, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.lg),
            Wrap(
              spacing: AppSpace.sm,
              runSpacing: AppSpace.sm,
              children: [
                for (final r in ReportReason.values)
                  ChoiceChip(
                    label: Text(l.reportReason(r)),
                    selected: _reason == r,
                    onSelected: (checked) => setState(() => _reason = checked ? r : null),
                  ),
              ],
            ),
            const SizedBox(height: AppSpace.lg),
            AppTextField(
              label: l.reportComment,
              controller: _commentController,
              helper: l.reportCommentHint,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
            ),
            const SizedBox(height: AppSpace.lg),
            PrimaryButton(
              label: l.reportSubmit,
              loading: _sending,
              onPressed: _reason == null ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_reason == null) return;
    final comment = _commentController.text.trim();
    setState(() => _sending = true);
    try {
      await ref.read(reportRepositoryProvider).report(
        targetType: widget.targetType,
        targetId: widget.targetId,
        reason: _reason!,
        comment: comment.isEmpty ? null : comment,
      );
      if (mounted) {
        Navigator.pop(context);
        showMessage(context, context.l10n.reportSent);
      }
    } on Exception catch (e) {
      if (mounted) showApiError(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }
}
