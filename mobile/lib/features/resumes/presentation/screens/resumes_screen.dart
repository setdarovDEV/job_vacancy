import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../data/models/resume.dart';
import '../../providers/my_resumes_controller.dart';
import '../widgets/pdf_download_helper.dart';
import '../widgets/resume_l10n.dart';

class ResumesScreen extends ConsumerWidget {
  const ResumesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(myResumesControllerProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text(l.resumeMyResumes),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: l.resumeNewResume,
            onPressed: () => context.push(Routes.resumeNew),
          ),
        ],
      ),
      body: async.when(
        data: (resumes) => _Body(resumes: resumes),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorBody(error: e, onRetry: () => ref.invalidate(myResumesControllerProvider)),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.resumes});
  final List<ResumeCard> resumes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (resumes.isEmpty) {
      return _EmptyBody(onCreate: () => context.push(Routes.resumeNew));
    }
    return RefreshIndicator(
      onRefresh: () => ref.read(myResumesControllerProvider.notifier).refresh(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, 120),
        itemCount: resumes.length,
        itemBuilder: (context, index) => _ResumeCard(resume: resumes[index]),
      ),
    );
  }
}

class _ResumeCard extends ConsumerWidget {
  const _ResumeCard({required this.resume});
  final ResumeCard resume;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final c = context.colors;
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.md),
      child: InkWell(
        onTap: () => context.push(Routes.resumeEdit(resume.id)),
        borderRadius: BorderRadius.circular(AppRadii.panel),
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(resume.title, style: context.text.titleMedium?.copyWith(color: c.ink)),
                        const SizedBox(height: AppSpace.xs),
                        Text(
                          '${l.resumeVisibilityLabel}: ${l.resumeVisibilityText(resume.visibility)} · ${_updatedAt(context)}',
                          style: context.text.bodySmall?.copyWith(color: c.ink2),
                        ),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    itemBuilder: (_) => [
                      PopupMenuItem(value: 'edit', child: Text(l.commonEdit)),
                      PopupMenuItem(value: 'pdf', child: Text(l.commonDownload)),
                      PopupMenuItem(value: 'visibility', child: Text(l.resumeChangeVisibility)),
                      PopupMenuItem(value: 'delete', child: Text(l.commonDelete)),
                    ],
                    onSelected: (value) => _onAction(context, ref, value),
                  ),
                ],
              ),
              if (resume.skills.isNotEmpty) ...[
                const SizedBox(height: AppSpace.md),
                Wrap(
                  spacing: AppSpace.sm,
                  runSpacing: AppSpace.sm,
                  children: [
                    for (final s in resume.skills.take(5))
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: c.lapisSoft, borderRadius: BorderRadius.circular(AppRadii.control)),
                        child: Text(s.name, style: context.text.bodySmall?.copyWith(color: c.lapisInk)),
                      ),
                    if (resume.skills.length > 5)
                      Text('+${resume.skills.length - 5}', style: context.text.bodySmall?.copyWith(color: c.ink3)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _updatedAt(BuildContext context) {
    final date = resume.updatedAt;
    return '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')}';
  }

  Future<void> _onAction(BuildContext context, WidgetRef ref, String value) async {
    switch (value) {
      case 'edit':
        await context.push(Routes.resumeEdit(resume.id));
      case 'pdf':
        await shareResumePdf(context, ref, id: resume.id, title: resume.title);
      case 'visibility':
        _pickVisibility(context, ref);
      case 'delete':
        await _confirmDelete(context, ref);
    }
  }

  void _pickVisibility(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpace.lg),
              child: Text(l.resumeChangeVisibility, style: sheet.text.headlineSmall),
            ),
            for (final v in ResumeVisibility.values)
              ListTile(
                title: Text(l.resumeVisibilityText(v)),
                subtitle: Text(l.resumeVisibilityHintText(v)),
                leading: Icon(
                  resume.visibility == v ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  color: resume.visibility == v ? context.colors.lapis : context.colors.ink3,
                ),
                onTap: () async {
                  Navigator.pop(sheet);
                  await ref.read(myResumesControllerProvider.notifier).setVisibility(resume.id, v);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(l.resumeDeleteTitle),
        content: Text(l.resumeDeleteBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(l.commonCancel)),
          FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(l.commonDelete)),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(myResumesControllerProvider.notifier).delete(resume.id);
  }
}

class _EmptyBody extends StatelessWidget {
  const _EmptyBody({required this.onCreate});
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.description_outlined, size: 48, color: c.ink3),
            const SizedBox(height: AppSpace.lg),
            Text(l.resumeNoResumes, textAlign: TextAlign.center, style: context.text.bodyLarge),
            const SizedBox(height: AppSpace.sm),
            Text(l.resumeNoResumesHint, textAlign: TextAlign.center, style: context.text.bodyMedium?.copyWith(color: c.ink2)),
            const SizedBox(height: AppSpace.lg),
            FilledButton.icon(onPressed: onCreate, icon: const Icon(Icons.add), label: Text(l.resumeCreateFirst)),
          ],
        ),
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
    final l = context.l10n;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(ErrorTexts.of(context).message(error) ?? l.errorsInternalError, textAlign: TextAlign.center),
            const SizedBox(height: AppSpace.lg),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: Text(l.commonRetry)),
          ],
        ),
      ),
    );
  }
}
