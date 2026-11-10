import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/models/resume.dart';
import '../../providers/apply_controller.dart';
import '../../providers/my_resumes_controller.dart';

class ApplySheet extends ConsumerStatefulWidget {
  const ApplySheet({super.key, required this.vacancySlug});
  final String vacancySlug;

  @override
  ConsumerState<ApplySheet> createState() => _ApplySheetState();
}

class _ApplySheetState extends ConsumerState<ApplySheet> {
  String? _selectedResumeId;
  final _coverLetterController = TextEditingController();

  @override
  void dispose() {
    _coverLetterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final resumesAsync = ref.watch(myResumesControllerProvider);
    final applyAsync = ref.watch(applyControllerProvider);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.applyTitle, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.lg),
            resumesAsync.when(
              data: (resumes) {
                if (resumes.isEmpty) {
                  return _NoResumesPrompt(onCreate: () {
                    Navigator.pop(context);
                    context.push(Routes.resumeNew);
                  });
                }
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ResumePicker(
                      resumes: resumes,
                      selectedId: _selectedResumeId ?? resumes.first.id,
                      onSelected: (id) => setState(() => _selectedResumeId = id),
                    ),
                    const SizedBox(height: AppSpace.lg),
                    AppTextField(
                      label: l.applicationCoverLetter,
                      controller: _coverLetterController,
                      hint: l.applyCoverLetterHint,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                    ),
                    const SizedBox(height: AppSpace.lg),
                    PrimaryButton(
                      label: l.applySubmit,
                      loading: applyAsync.isLoading,
                      onPressed: _submit,
                    ),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _ErrorBody(error: e, onRetry: () => ref.invalidate(myResumesControllerProvider)),
            ),
            if (applyAsync case AsyncError(:final error))
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.md),
                child: _ApplyError(error: error),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final resumesAsync = ref.read(myResumesControllerProvider);
    final resumes = resumesAsync.value;
    if (resumes == null || resumes.isEmpty) return;

    final resumeId = _selectedResumeId ?? resumes.first.id;
    final coverLetter = _coverLetterController.text.trim();
    final application = await ref.read(applyControllerProvider.notifier).apply(
      vacancySlug: widget.vacancySlug,
      resumeId: resumeId,
      coverLetter: coverLetter.isEmpty ? null : coverLetter,
    );
    if (mounted && application != null) {
      Navigator.pop(context);
      showMessage(context, context.l10n.applicationSubmitted);
    }
  }
}

class _ResumePicker extends StatelessWidget {
  const _ResumePicker({required this.resumes, required this.selectedId, required this.onSelected});

  final List<ResumeCard> resumes;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.applicationSelectResume, style: context.text.titleSmall),
        const SizedBox(height: AppSpace.sm),
        ...resumes.map((resume) {
          final selected = resume.id == selectedId;
          return Card(
            margin: const EdgeInsets.only(bottom: AppSpace.sm),
            color: selected ? c.lapisSoft : null,
            child: InkWell(
              onTap: () => onSelected(resume.id),
              borderRadius: BorderRadius.circular(AppRadii.panel),
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.md),
                child: Row(
                  children: [
                    Icon(
                      selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                      color: selected ? c.lapis : c.ink3,
                    ),
                    const SizedBox(width: AppSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(resume.title, style: context.text.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                          Text(
                            resume.skills.map((s) => s.name).take(3).join(', '),
                            style: context.text.bodySmall?.copyWith(color: c.ink2),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _NoResumesPrompt extends StatelessWidget {
  const _NoResumesPrompt({required this.onCreate});
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l.applyNoResumes, textAlign: TextAlign.center),
        const SizedBox(height: AppSpace.lg),
        FilledButton.icon(onPressed: onCreate, icon: const Icon(Icons.add), label: Text(l.applyCreateResume)),
      ],
    );
  }
}

class _ApplyError extends StatelessWidget {
  const _ApplyError({required this.error});
  final Object error;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    final e = error;
    final isContactError = e is ApiFailure && e.code == 'contact_not_verified';
    final message = ErrorTexts.of(context).message(error) ?? l.errorsInternalError;
    return Container(
      padding: const EdgeInsets.all(AppSpace.md),
      decoration: BoxDecoration(color: c.anorSoft, borderRadius: BorderRadius.circular(AppRadii.control)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.error_outline, size: 18, color: c.anorInk),
              const SizedBox(width: AppSpace.sm),
              Expanded(child: Text(message, style: context.text.bodyMedium?.copyWith(color: c.anorInk))),
            ],
          ),
          if (isContactError) ...[
            const SizedBox(height: AppSpace.sm),
            Text(l.applicationContactNotVerifiedHint, style: context.text.bodySmall?.copyWith(color: c.anorInk)),
            const SizedBox(height: AppSpace.sm),
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                context.push(Routes.verifyEmailAndSend);
              },
              child: Text(l.settingsVerify),
            ),
          ],
        ],
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(ErrorTexts.of(context).message(error) ?? context.l10n.errorsInternalError, textAlign: TextAlign.center),
        const SizedBox(height: AppSpace.lg),
        FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: Text(context.l10n.commonRetry)),
      ],
    );
  }
}
