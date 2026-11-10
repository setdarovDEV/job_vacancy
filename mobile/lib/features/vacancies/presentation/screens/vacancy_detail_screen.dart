import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/models/user.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/models/company.dart';
import '../../data/models/vacancy.dart';
import '../../data/repositories/vacancy_repository.dart';
import '../../providers/saved_ids_provider.dart';
import '../../providers/vacancy_detail_provider.dart';
import '../widgets/report_sheet.dart';
import '../widgets/vacancy_helpers.dart';

class VacancyDetailScreen extends ConsumerWidget {
  const VacancyDetailScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final detailAsync = ref.watch(vacancyDetailProvider(slug));
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(l.navVacancies)),
      body: detailAsync.when(
        data: (detail) => _Body(detail: detail),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorBody(error: e, onRetry: () => ref.invalidate(vacancyDetailProvider(slug))),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.detail});
  final VacancyDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final user = ref.watch(currentUserProvider);
    final savedIdsAsync = ref.watch(savedVacancyIdsProvider);
    final savedIds = savedIdsAsync.value ?? {};
    final isSaved = savedIds.contains(detail.id);

    return Stack(
      fit: StackFit.expand,
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, 120),
          children: [
            _Header(detail: detail),
            const SizedBox(height: AppSpace.md),
            _ActionsRow(detail: detail),
            const SizedBox(height: AppSpace.lg),
            _Conditions(detail: detail),
            const SizedBox(height: AppSpace.lg),
            _CompanyCard(company: detail.company),
            const SizedBox(height: AppSpace.lg),
            _Description(description: detail.description),
            const SizedBox(height: AppSpace.lg),
          ],
        ),
        Positioned(
          left: AppSpace.lg,
          right: AppSpace.lg,
          bottom: AppSpace.lg,
          child: Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _apply(context, user),
                  icon: const Icon(Icons.send_outlined),
                  label: Text(l.commonApply),
                ),
              ),
              const SizedBox(width: AppSpace.md),
              IconButton.filledTonal(
                onPressed: () => _toggleSave(context, ref, user, isSaved),
                icon: Icon(isSaved ? Icons.bookmark : Icons.bookmark_border),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _apply(BuildContext context, User? user) async {
    final l = context.l10n;
    if (user == null) {
      await context.push(Routes.login);
      return;
    }
    if (!user.emailVerified && !user.phoneVerified) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (d) => AlertDialog(
          title: Text(l.applicationContactNotVerified),
          content: Text(l.applicationContactNotVerifiedHint),
          actions: [
            TextButton(onPressed: () => Navigator.pop(d, false), child: Text(l.commonCancel)),
            FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(l.settingsVerify)),
          ],
        ),
      );
      if (ok == true && context.mounted) await context.push(Routes.verifyEmailAndSend);
      return;
    }
    if (!context.mounted) return;
    await context.push(Routes.applyToVacancy(detail.slug));
  }

  Future<void> _toggleSave(BuildContext context, WidgetRef ref, User? user, bool isSaved) async {
    if (user == null) {
      await context.push(Routes.login);
      return;
    }
    final repo = ref.read(vacancyRepositoryProvider);
    try {
      if (isSaved) {
        await repo.unsave(detail.slug);
      } else {
        await repo.save(detail.slug);
      }
      ref.invalidate(savedVacancyIdsProvider);
    } on Exception catch (e) {
      if (context.mounted) showApiError(context, e);
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.detail});
  final VacancyDetail detail;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (detail.isFeatured)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: c.zafaronSoft,
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: Text(
              context.l10n.commonFeatured,
              style: context.text.labelSmall?.copyWith(color: c.zafaronInk, fontWeight: FontWeight.bold),
            ),
          ),
        const SizedBox(height: AppSpace.sm),
        Text(detail.title, style: context.text.headlineSmall?.copyWith(color: c.ink)),
        const SizedBox(height: AppSpace.xs),
        Text(
          '${context.l10n.vacancyViews}: ${detail.viewsCount} · ${context.l10n.vacancyApplications}: ${detail.applicationsCount}',
          style: context.text.bodyMedium?.copyWith(color: c.ink2),
        ),
      ],
    );
  }
}

class _ActionsRow extends StatelessWidget {
  const _ActionsRow({required this.detail});
  final VacancyDetail detail;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => SharePlus.instance.share(ShareParams(text: 'https://jobvacancy.uz/vacancies/${detail.slug}')),
            icon: const Icon(Icons.share_outlined, size: 18),
            label: Text(l.vacancyShare),
          ),
        ),
        const SizedBox(width: AppSpace.md),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => _showReport(context, detail),
            icon: Icon(Icons.flag_outlined, size: 18, color: c.anorInk),
            label: Text(l.vacancyReport, style: TextStyle(color: c.anorInk)),
          ),
        ),
      ],
    );
  }

  void _showReport(BuildContext context, VacancyDetail detail) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => ReportSheet(targetType: 'vacancy', targetId: detail.id),
    );
  }
}

class _Conditions extends StatelessWidget {
  const _Conditions({required this.detail});
  final VacancyDetail detail;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ConditionRow(icon: Icons.payments_outlined, label: l.vacancySalary, value: salaryText(context, detail.salary)),
            const Divider(),
            _ConditionRow(
              icon: Icons.work_outline,
              label: l.vacancyEmploymentType,
              value: l.employmentType(detail.employmentType),
            ),
            const Divider(),
            _ConditionRow(
              icon: Icons.location_on_outlined,
              label: l.vacancyWorkFormat,
              value: l.workFormat(detail.workFormat),
            ),
            const Divider(),
            _ConditionRow(
              icon: Icons.schedule_outlined,
              label: l.vacancyExperience,
              value: l.experience(detail.experience),
            ),
            const Divider(),
            _ConditionRow(icon: Icons.timelapse_outlined, label: l.vacancySchedule, value: l.schedule(detail.schedule)),
            if (detail.address != null) ...[
              const Divider(),
              _ConditionRow(icon: Icons.place_outlined, label: l.vacancyAddress, value: detail.address!),
            ],
            if (detail.skills.isNotEmpty) ...[
              const Divider(),
              const SizedBox(height: AppSpace.sm),
              Text(l.vacancySkills, style: context.text.titleSmall),
              const SizedBox(height: AppSpace.sm),
              Wrap(
                spacing: AppSpace.sm,
                runSpacing: AppSpace.sm,
                children: [
                  for (final s in detail.skills)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: c.lapisSoft,
                        borderRadius: BorderRadius.circular(AppRadii.control),
                      ),
                      child: Text(s.name, style: context.text.bodySmall?.copyWith(color: c.lapisInk)),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ConditionRow extends StatelessWidget {
  const _ConditionRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpace.sm),
      child: Row(
        children: [
          Icon(icon, size: 20, color: c.ink3),
          const SizedBox(width: AppSpace.md),
          Expanded(child: Text(label, style: context.text.bodyMedium?.copyWith(color: c.ink2))),
          Text(value, style: context.text.bodyMedium?.copyWith(color: c.ink, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _CompanyCard extends StatelessWidget {
  const _CompanyCard({required this.company});
  final CompanySummary company;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Card(
      child: InkWell(
        onTap: () => context.push('${Routes.company}/${company.slug}'),
        borderRadius: BorderRadius.circular(AppRadii.panel),
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Row(
            children: [
              if (company.logoUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadii.control),
                  child: CachedNetworkImage(
                    imageUrl: company.logoUrl!,
                    width: 48,
                    height: 48,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(width: 48, height: 48, color: c.sunken),
                    errorWidget: (_, __, ___) => Icon(Icons.business, size: 28, color: c.ink3),
                  ),
                )
              else
                CircleAvatar(radius: 24, backgroundColor: c.sunken, child: Icon(Icons.business, color: c.ink3)),
              const SizedBox(width: AppSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(company.name, style: context.text.titleMedium?.copyWith(color: c.ink)),
                    if (company.verified)
                      Row(
                        children: [
                          Icon(Icons.verified, size: 14, color: c.firuza),
                          const SizedBox(width: 4),
                          Text(context.l10n.commonVerified, style: context.text.bodySmall?.copyWith(color: c.firuzaInk)),
                        ],
                      ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: c.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

class _Description extends StatelessWidget {
  const _Description({required this.description});
  final String description;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.vacancyDescription, style: context.text.titleMedium?.copyWith(color: c.ink)),
        const SizedBox(height: AppSpace.md),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpace.lg),
            child: MarkdownBody(
              data: description,
              selectable: true,
              styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                p: context.text.bodyMedium?.copyWith(color: c.ink),
                h1: context.text.titleLarge?.copyWith(color: c.ink),
                h2: context.text.titleMedium?.copyWith(color: c.ink),
                h3: context.text.titleSmall?.copyWith(color: c.ink),
                listBullet: context.text.bodyMedium?.copyWith(color: c.ink2),
              ),
            ),
          ),
        ),
      ],
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
