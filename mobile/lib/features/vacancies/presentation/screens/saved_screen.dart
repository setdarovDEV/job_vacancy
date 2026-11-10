import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/models/saved_search.dart';
import '../../data/repositories/vacancy_repository.dart';
import '../../providers/saved_ids_provider.dart';
import '../../providers/saved_searches_controller.dart';
import '../../providers/saved_vacancies_controller.dart';
import '../widgets/vacancy_card.dart';

class SavedScreen extends ConsumerWidget {
  const SavedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(l.navSaved)),
      body: user == null
          ? _GuestBody()
          : RefreshIndicator(
              onRefresh: () async {
                await ref.read(savedVacanciesControllerProvider.notifier).refresh();
                await ref.read(savedSearchesControllerProvider.notifier).refresh();
              },
              child: CustomScrollView(
                slivers: [
                  const SliverToBoxAdapter(child: _SavedVacanciesSection()),
                  const SliverToBoxAdapter(child: SizedBox(height: AppSpace.lg)),
                  const SliverToBoxAdapter(child: _SavedSearchesSection()),
                  const SliverPadding(padding: EdgeInsets.only(bottom: 120)),
                ],
              ),
            ),
    );
  }
}

class _GuestBody extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l.savedGuestTitle, style: context.text.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: AppSpace.sm),
            Text(l.savedGuestBody, textAlign: TextAlign.center, style: context.text.bodyMedium?.copyWith(color: context.colors.ink2)),
            const SizedBox(height: AppSpace.lg),
            FilledButton(
              onPressed: () => context.push(Routes.login),
              child: Text(l.navSignIn),
            ),
          ],
        ),
      ),
    );
  }
}

class _SavedVacanciesSection extends ConsumerWidget {
  const _SavedVacanciesSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final state = ref.watch(savedVacanciesControllerProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.savedVacanciesTitle, style: context.text.titleMedium?.copyWith(color: context.colors.ink)),
          const SizedBox(height: AppSpace.md),
          state.when(
            data: (items) => items.isEmpty
                ? Text(l.savedVacanciesEmpty, style: context.text.bodyMedium?.copyWith(color: context.colors.ink2))
                : Column(
                    children: [
                      for (final v in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpace.md),
                          child: VacancyListCard(
                            vacancy: v,
                            isSaved: true,
                            onToggleSave: () => _unsave(context, ref, v.slug),
                          ),
                        ),
                    ],
                  ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _ErrorTile(error: e, onRetry: () => ref.read(savedVacanciesControllerProvider.notifier).refresh()),
          ),
        ],
      ),
    );
  }

  Future<void> _unsave(BuildContext context, WidgetRef ref, String slug) async {
    try {
      await ref.read(vacancyRepositoryProvider).unsave(slug);
      ref.invalidate(savedVacancyIdsProvider);
      await ref.read(savedVacanciesControllerProvider.notifier).refresh();
    } on Exception catch (e) {
      if (context.mounted) showApiError(context, e);
    }
  }
}

class _SavedSearchesSection extends ConsumerWidget {
  const _SavedSearchesSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final state = ref.watch(savedSearchesControllerProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(l.savedSearchesTitle, style: context.text.titleMedium?.copyWith(color: context.colors.ink)),
              // Save current search is triggered from the jobs screen filter bar; kept simple here.
            ],
          ),
          const SizedBox(height: AppSpace.md),
          state.when(
            data: (items) => items.isEmpty
                ? Text(l.savedSearchesEmpty, style: context.text.bodyMedium?.copyWith(color: context.colors.ink2))
                : Column(
                    children: [for (final s in items) _SavedSearchTile(search: s)],
                  ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _ErrorTile(error: e, onRetry: () => ref.read(savedSearchesControllerProvider.notifier).refresh()),
          ),
        ],
      ),
    );
  }
}

class _SavedSearchTile extends ConsumerWidget {
  const _SavedSearchTile({required this.search});
  final SavedSearch search;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    return Card(
      child: ListTile(
        title: Text(search.name),
        subtitle: Text(search.params, maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: Icon(search.notify ? Icons.notifications_active : Icons.notifications_off_outlined, color: c.lapis),
              onPressed: () => ref.read(savedSearchesControllerProvider.notifier).updateSearch(search.id, notify: !search.notify),
            ),
            IconButton(
              icon: Icon(Icons.delete_outline, color: c.anorInk),
              onPressed: () => _confirmDelete(context, ref),
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
        title: Text(l.savedSearchDeleteTitle),
        content: Text(l.savedSearchDeleteBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(l.commonCancel)),
          FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(l.commonDelete)),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(savedSearchesControllerProvider.notifier).delete(search.id);
    }
  }
}

class _ErrorTile extends StatelessWidget {
  const _ErrorTile({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(Icons.error_outline, color: context.colors.anor),
      title: Text(ErrorTexts.of(context).message(error) ?? context.l10n.errorsInternalError),
      trailing: IconButton(icon: const Icon(Icons.refresh), onPressed: onRetry),
    );
  }
}
