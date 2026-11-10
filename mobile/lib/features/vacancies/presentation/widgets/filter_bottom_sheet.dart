import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../data/api/vacancy_api.dart';
import '../../data/models/category.dart';
import '../../data/models/region.dart';
import '../../data/models/vacancy.dart';
import '../../data/repositories/catalog_repository.dart';
import '../widgets/vacancy_helpers.dart';

class FilterBottomSheet extends ConsumerStatefulWidget {
  const FilterBottomSheet({super.key, required this.params});
  final VacancySearchParams params;

  @override
  ConsumerState<FilterBottomSheet> createState() => _FilterBottomSheetState();
}

class _FilterBottomSheetState extends ConsumerState<FilterBottomSheet> {
  late VacancySearchParams _params;
  final _salaryFromController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _params = widget.params;
    _salaryFromController.text = _params.salaryFrom?.toString() ?? '';
  }

  @override
  void dispose() {
    _salaryFromController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final categoriesAsync = ref.watch(catalogCategoriesProvider);
    final regionsAsync = ref.watch(catalogRegionsProvider);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scroll) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, AppSpace.lg),
          child: Column(
            children: [
              Expanded(
                child: ListView(
                  controller: scroll,
                  children: [
                    Text(l.commonFilters, style: context.text.headlineSmall),
                    const SizedBox(height: AppSpace.lg),
                    _Section(
                      title: l.filterSort,
                      child: _ChoiceChips<String>(
                        values: const ['relevance', 'newest'],
                        labels: { 'relevance': l.sortRelevance, 'newest': l.sortNewest },
                        selected: _params.sort ?? 'newest',
                        onSelected: (v) => setState(() => _params = _params.copyWith(sort: v)),
                      ),
                    ),
                    _Section(
                      title: l.filterRegion,
                      child: regionsAsync.when(
                        data: (regions) => _TreeSelector(
                          items: regions.map((r) => _Selectable(id: r.id, label: localizedName(context, r.name))).toList(),
                          selectedId: _params.regionId,
                          onSelected: (id) => setState(() => _params = _params.copyWith(regionId: id, districtId: null)),
                        ),
                        loading: () => const Center(child: CircularProgressIndicator()),
                        error: (_, __) => Text(l.errorsInternalError),
                      ),
                    ),
                    if (_params.regionId != null)
                      _Section(
                        title: l.filterDistrict,
                        child: regionsAsync.when(
                        data: (regions) {
                          final region = regions.where((r) => r.id == _params.regionId).firstOrNull;
                          final districts = region?.children ?? [];
                          return _ChoiceChips<int>(
                            values: districts.map((d) => d.id).toList(),
                            labels: {for (final d in districts) d.id: localizedName(context, d.name)},
                            selected: _params.districtId,
                            onSelected: (id) => setState(() => _params = _params.copyWith(districtId: id)),
                          );
                        },
                          loading: () => const Center(child: CircularProgressIndicator()),
                          error: (_, __) => Text(l.errorsInternalError),
                        ),
                      ),
                    _Section(
                      title: l.filterCategory,
                      child: categoriesAsync.when(
                        data: (categories) => _TreeSelector(
                          items:
                              categories.map((c) => _Selectable(id: c.id, label: localizedName(context, c.name))).toList(),
                          selectedId: _params.categoryId,
                          onSelected: (id) => setState(() => _params = _params.copyWith(categoryId: id)),
                        ),
                        loading: () => const Center(child: CircularProgressIndicator()),
                        error: (_, __) => Text(l.errorsInternalError),
                      ),
                    ),
                    _Section(
                      title: l.filterSalary,
                      child: Row(
                        children: [
                          Expanded(
                            child: AppTextField(
                              label: l.filterSalaryFrom,
                              controller: _salaryFromController,
                              keyboardType: TextInputType.number,
                            ),
                          ),
                          const SizedBox(width: AppSpace.md),
                          _ChoiceChips<String>(
                            values: const ['UZS', 'USD'],
                            labels: const {'UZS': 'UZS', 'USD': 'USD'},
                            selected: _params.currency ?? 'UZS',
                            onSelected: (v) => setState(() => _params = _params.copyWith(currency: v)),
                          ),
                        ],
                      ),
                    ),
                    _Section(
                      title: l.filterWorkFormat,
                      child: _ChoiceChips<WorkFormat>(
                        values: WorkFormat.values,
                        labels: { for (final v in WorkFormat.values) v: l.workFormat(v) },
                        selected: _params.workFormat,
                        onSelected: (v) => setState(() => _params = _params.copyWith(workFormat: v)),
                      ),
                    ),
                    _Section(
                      title: l.filterExperience,
                      child: _ChoiceChips<Experience>(
                        values: Experience.values,
                        labels: { for (final v in Experience.values) v: l.experience(v) },
                        selected: _params.experience,
                        onSelected: (v) => setState(() => _params = _params.copyWith(experience: v)),
                      ),
                    ),
                    _Section(
                      title: l.filterSchedule,
                      child: _ChoiceChips<Schedule>(
                        values: Schedule.values,
                        labels: { for (final v in Schedule.values) v: l.schedule(v) },
                        selected: _params.schedule,
                        onSelected: (v) => setState(() => _params = _params.copyWith(schedule: v)),
                      ),
                    ),
                    _Section(
                      title: l.filterEmploymentType,
                      child: _ChoiceChips<EmploymentType>(
                        values: EmploymentType.values,
                        labels: { for (final v in EmploymentType.values) v: l.employmentType(v) },
                        selected: _params.employmentType,
                        onSelected: (v) => setState(() => _params = _params.copyWith(employmentType: v)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpace.md),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context, const VacancySearchParams()),
                      child: Text(l.commonClear),
                    ),
                  ),
                  const SizedBox(width: AppSpace.md),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        final salary = int.tryParse(_salaryFromController.text.trim());
                        Navigator.pop(
                          context,
                          _params.copyWith(salaryFrom: salary),
                        );
                      },
                      child: Text(l.commonDone),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: context.text.titleSmall),
          const SizedBox(height: AppSpace.sm),
          child,
        ],
      ),
    );
  }
}

class _ChoiceChips<T> extends StatelessWidget {
  const _ChoiceChips({required this.values, required this.labels, required this.selected, required this.onSelected});

  final List<T> values;
  final Map<T, String> labels;
  final T? selected;
  final ValueChanged<T?> onSelected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Wrap(
      spacing: AppSpace.sm,
      runSpacing: AppSpace.sm,
      children: [
        for (final v in values)
          ChoiceChip(
            label: Text(labels[v] ?? v.toString()),
            selected: selected == v,
            onSelected: (checked) => onSelected(checked ? v : null),
            selectedColor: c.lapis,
            labelStyle: context.text.bodySmall?.copyWith(
              color: selected == v ? c.onLapis : c.ink,
            ),
          ),
      ],
    );
  }
}

class _Selectable {
  const _Selectable({required this.id, required this.label});
  final int id;
  final String label;
}

class _TreeSelector extends StatelessWidget {
  const _TreeSelector({required this.items, required this.selectedId, required this.onSelected});

  final List<_Selectable> items;
  final int? selectedId;
  final ValueChanged<int?> onSelected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Wrap(
      spacing: AppSpace.sm,
      runSpacing: AppSpace.sm,
      children: [
        for (final item in items)
          ChoiceChip(
            label: Text(item.label),
            selected: selectedId == item.id,
            onSelected: (checked) => onSelected(checked ? item.id : null),
            selectedColor: c.lapis,
            labelStyle: context.text.bodySmall?.copyWith(color: selectedId == item.id ? c.onLapis : c.ink),
          ),
      ],
    );
  }
}

final catalogCategoriesProvider = FutureProvider<List<Category>>((ref) async {
  return ref.watch(catalogRepositoryProvider).categories();
});

final catalogRegionsProvider = FutureProvider<List<Region>>((ref) async {
  return ref.watch(catalogRepositoryProvider).regions();
});
