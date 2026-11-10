import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/api/vacancy_api.dart';
import '../../providers/saved_searches_controller.dart';

class SaveSearchSheet extends ConsumerStatefulWidget {
  const SaveSearchSheet({super.key, required this.params});
  final VacancySearchParams params;

  @override
  ConsumerState<SaveSearchSheet> createState() => _SaveSearchSheetState();
}

class _SaveSearchSheetState extends ConsumerState<SaveSearchSheet> {
  final _nameController = TextEditingController();
  bool _notify = true;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
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
            Text(l.savedSearchTitle, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.lg),
            AppTextField(
              label: l.savedSearchName,
              controller: _nameController,
              hint: l.savedSearchNameHint,
            ),
            const SizedBox(height: AppSpace.md),
            SwitchListTile(
              title: Text(l.savedSearchNotify),
              value: _notify,
              onChanged: (v) => setState(() => _notify = v),
            ),
            const SizedBox(height: AppSpace.lg),
            PrimaryButton(
              label: l.commonSave,
              loading: _saving,
              onPressed: _nameController.text.trim().isEmpty ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;
    final query = widget.params.toQuery();
    final params = Uri(
      queryParameters: {for (final e in query.entries) e.key: e.value?.toString()},
    ).query;
    setState(() => _saving = true);
    try {
      await ref.read(savedSearchesControllerProvider.notifier).create(
        name: name,
        params: params,
        notify: _notify,
      );
      if (mounted) {
        Navigator.pop(context);
        showMessage(context, context.l10n.savedSearchCreated);
      }
    } on Exception catch (e) {
      if (mounted) showApiError(context, e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
