import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/api/vacancy_api.dart';
import '../../data/models/vacancy.dart';
import '../../data/repositories/vacancy_repository.dart';
import '../../providers/saved_ids_provider.dart';
import '../../providers/vacancy_search_controller.dart';
import '../widgets/filter_bottom_sheet.dart';
import '../widgets/save_search_sheet.dart';
import '../widgets/vacancy_card.dart';
import '../widgets/vacancy_helpers.dart';

class JobsScreen extends ConsumerStatefulWidget {
  const JobsScreen({super.key});

  @override
  ConsumerState<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends ConsumerState<JobsScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(vacancySearchControllerProvider.notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final state = ref.watch(vacancySearchControllerProvider);
    final params = state.value?.params;
    final q = params?.q ?? '';
    if (_searchController.text != q) _searchController.text = q;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text(l.navVacancies),
        actions: [
          IconButton(
            icon: const Icon(Icons.bookmark_add_outlined),
            onPressed: () => _saveSearch(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(vacancySearchControllerProvider.notifier).refresh(),
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, AppSpace.md),
                child: SearchBar(
                  controller: _searchController,
                  hintText: l.commonSearch,
                  leading: const Icon(Icons.search),
                  trailing: [
                    if (params?.hasFilter ?? false)
                      IconButton(
                        onPressed: () => _showFilters(context),
                        icon: Badge(child: Icon(Icons.tune, color: context.colors.lapis)),
                      )
                    else
                      IconButton(onPressed: () => _showFilters(context), icon: const Icon(Icons.tune)),
                  ],
                  onSubmitted: (q) => ref.read(vacancySearchControllerProvider.notifier).setQuery(q.trim()),
                ),
              ),
            ),
            if (params != null && params.hasFilter)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpace.lg),
                  child: _FilterChips(params: params),
                ),
              ),
            state.when(
              data: (data) => _VacancyList(
                items: data.items,
                hasMore: data.hasMore,
                loadingMore: data.isLoadingMore,
                onToggleSave: _toggleSave,
              ),
              loading: () => const SliverFillRemaining(child: Center(child: CircularProgressIndicator())),
              error: (e, _) => SliverFillRemaining(
                child: _ErrorBody(
                  error: e,
                  onRetry: () => ref.read(vacancySearchControllerProvider.notifier).refresh(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showFilters(BuildContext context) async {
    final current = ref.read(vacancySearchControllerProvider).value?.params ?? const VacancySearchParams();
    final next = await showModalBottomSheet<VacancySearchParams>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => FilterBottomSheet(params: current),
    );
    if (next != null) {
      await ref.read(vacancySearchControllerProvider.notifier).applyParams(next);
    }
  }

  Future<void> _saveSearch(BuildContext context) async {
    final current = ref.read(vacancySearchControllerProvider).value?.params ?? const VacancySearchParams();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => SaveSearchSheet(params: current),
    );
  }

  Future<void> _toggleSave(String slug) async {
    final user = ref.read(currentUserProvider);
    if (user == null) {
      if (mounted) await context.push(Routes.login);
      return;
    }
    final repo = ref.read(vacancyRepositoryProvider);
    final ids = await ref.read(savedVacancyIdsProvider.future);
    final saved = ids.contains(slug);
    try {
      if (saved) {
        await repo.unsave(slug);
      } else {
        await repo.save(slug);
      }
      ref.invalidate(savedVacancyIdsProvider);
    } on Exception catch (e) {
      if (mounted) showApiError(context, e);
    }
  }
}

class _FilterChips extends ConsumerWidget {
  const _FilterChips({required this.params});
  final VacancySearchParams params;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    return Wrap(
      spacing: AppSpace.sm,
      runSpacing: AppSpace.sm,
      children: [
        if (params.regionId != null) _FilterChip(label: '${l.filterRegion} ${params.regionId}'),
        if (params.categoryId != null) _FilterChip(label: '${l.filterCategory} ${params.categoryId}'),
        if (params.employmentType != null) _FilterChip(label: l.employmentType(params.employmentType!)),
        if (params.workFormat != null) _FilterChip(label: l.workFormat(params.workFormat!)),
        if (params.experience != null) _FilterChip(label: l.experience(params.experience!)),
        if (params.schedule != null) _FilterChip(label: l.schedule(params.schedule!)),
        if (params.withSalary == true) _FilterChip(label: l.filterWithSalary),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Chip(
      label: Text(label),
      labelStyle: context.text.bodySmall?.copyWith(color: c.lapisInk),
      backgroundColor: c.lapisSoft,
      side: BorderSide.none,
    );
  }
}

class _VacancyList extends ConsumerWidget {
  const _VacancyList({
    required this.items,
    required this.hasMore,
    required this.loadingMore,
    required this.onToggleSave,
  });

  final List<VacancyCard> items;
  final bool hasMore;
  final bool loadingMore;
  final void Function(String slug) onToggleSave;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    if (items.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpace.xl),
            child: Text(l.commonNoResults, style: context.text.bodyLarge?.copyWith(color: context.colors.ink2)),
          ),
        ),
      );
    }
    final savedIdsAsync = ref.watch(savedVacancyIdsProvider);
    final savedIds = savedIdsAsync.value ?? {};
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, 120),
      sliver: SliverList.builder(
        itemCount: items.length + (hasMore || loadingMore ? 1 : 0),
        itemBuilder: (_, i) {
          if (i == items.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpace.lg),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final v = items[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpace.md),
            child: VacancyListCard(
              vacancy: v,
              isSaved: savedIds.contains(v.id),
              onToggleSave: () => onToggleSave(v.slug),
            ),
          );
        },
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
