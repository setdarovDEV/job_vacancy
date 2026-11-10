import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/submit.dart';
import '../../../vacancies/presentation/widgets/vacancy_card.dart';
import '../../data/models/application.dart';
import '../widgets/resume_l10n.dart';
import '../../data/repositories/application_repository.dart';
import '../../providers/my_applications_controller.dart';

class ApplicationsScreen extends ConsumerWidget {
  const ApplicationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final stateAsync = ref.watch(myApplicationsControllerProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(l.navApplications)),
      body: stateAsync.when(
        data: (state) => _Body(state: state),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorBody(error: e, onRetry: () => ref.invalidate(myApplicationsControllerProvider)),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.state});
  final MyApplicationsState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        _StatusFilter(current: state.status),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.read(myApplicationsControllerProvider.notifier).refresh(),
            child: state.items.isEmpty
                ? _EmptyBody(status: state.status)
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, 120),
                    itemCount: state.items.length + (state.hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == state.items.length) {
                        if (!state.isLoadingMore) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            ref.read(myApplicationsControllerProvider.notifier).loadMore();
                          });
                        }
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: AppSpace.lg),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      return _ApplicationCard(application: state.items[index]);
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

class _StatusFilter extends ConsumerWidget {
  const _StatusFilter({required this.current});
  final ApplicationStatus? current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final c = context.colors;
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.lg),
        itemCount: ApplicationStatus.values.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: AppSpace.sm),
        itemBuilder: (context, index) {
          final all = index == 0;
          final status = all ? null : ApplicationStatus.values[index - 1];
          final selected = current == status;
          return ChoiceChip(
            label: Text(all ? l.commonAll : l.applicationStatusText(status!)),
            selected: selected,
            onSelected: (_) => ref.read(myApplicationsControllerProvider.notifier).applyStatus(status),
            selectedColor: c.lapisSoft,
            labelStyle: context.text.labelLarge?.copyWith(color: selected ? c.lapisInk : c.ink2),
          );
        },
      ),
    );
  }
}

class _ApplicationCard extends ConsumerWidget {
  const _ApplicationCard({required this.application});
  final Application application;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final c = context.colors;
    final canWithdraw = application.status != ApplicationStatus.withdrawn &&
        application.status != ApplicationStatus.hired &&
        application.status != ApplicationStatus.rejected;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.md),
      child: InkWell(
        onTap: () => context.push('${Routes.vacancy}/${application.vacancy.slug}'),
        borderRadius: BorderRadius.circular(AppRadii.panel),
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: _StatusBadge(status: application.status)),
                  if (canWithdraw)
                    IconButton(
                      icon: Icon(Icons.close, color: c.anorInk),
                      tooltip: l.commonWithdraw,
                      onPressed: () => _confirmWithdraw(context, ref),
                    ),
                ],
              ),
              const SizedBox(height: AppSpace.md),
              VacancyListCard(vacancy: application.vacancy),
              if (application.events.isNotEmpty) ...[
                const SizedBox(height: AppSpace.sm),
                TextButton.icon(
                  onPressed: () => _showHistory(context),
                  icon: const Icon(Icons.history, size: 18),
                  label: Text(l.applicationHistory),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmWithdraw(BuildContext context, WidgetRef ref) async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(l.applicationWithdrawTitle),
        content: Text(l.applicationWithdrawBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(l.commonCancel)),
          FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(l.commonWithdraw)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final updated = await ref.read(applicationRepositoryProvider).withdraw(application.id);
      ref.read(myApplicationsControllerProvider.notifier).patch(updated);
      if (context.mounted) showMessage(context, l.applicationWithdrawn);
    } on Exception catch (e) {
      if (context.mounted) showApiError(context, e);
    }
  }

  void _showHistory(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => _HistorySheet(events: application.events),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final ApplicationStatus status;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (bg, fg) = switch (status) {
      ApplicationStatus.sent => (c.lapisSoft, c.lapisInk),
      ApplicationStatus.viewed => (c.firuzaSoft, c.firuzaInk),
      ApplicationStatus.invited || ApplicationStatus.interview => (c.zafaronSoft, c.zafaronInk),
      ApplicationStatus.hired => (c.firuzaSoft, c.firuzaInk),
      ApplicationStatus.rejected || ApplicationStatus.withdrawn => (c.anorSoft, c.anorInk),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppRadii.control)),
      child: Text(
        context.l10n.applicationStatusText(status),
        style: context.text.labelMedium?.copyWith(color: fg, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _HistorySheet extends StatelessWidget {
  const _HistorySheet({required this.events});
  final List<ApplicationEvent> events;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, AppSpace.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.applicationHistory, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.lg),
            ...events.map((e) {
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpace.md),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      margin: const EdgeInsets.only(top: 6),
                      decoration: BoxDecoration(color: c.lapis, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: AppSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l.applicationStatusText(e.to),
                            style: context.text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          if (e.note != null && e.note!.isNotEmpty) ...[
                            const SizedBox(height: AppSpace.xs),
                            Text(e.note!, style: context.text.bodySmall?.copyWith(color: c.ink2)),
                          ],
                          const SizedBox(height: AppSpace.xs),
                          Text(_formatDate(context, e.at), style: context.text.bodySmall?.copyWith(color: c.ink3)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  String _formatDate(BuildContext context, DateTime date) {
    return '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}

class _EmptyBody extends StatelessWidget {
  const _EmptyBody({this.status});
  final ApplicationStatus? status;

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
            Text(l.applicationsEmpty, textAlign: TextAlign.center, style: context.text.bodyLarge),
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(ErrorTexts.of(context).message(error) ?? context.l10n.errorsInternalError, textAlign: TextAlign.center),
            const SizedBox(height: AppSpace.lg),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: Text(context.l10n.commonRetry)),
          ],
        ),
      ),
    );
  }
}
