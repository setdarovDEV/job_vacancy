import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/form_widgets.dart';
import '../../../../core/widgets/submit.dart';
import '../../../vacancies/data/models/category.dart';
import '../../../vacancies/data/models/region.dart';
import '../../../vacancies/data/models/vacancy.dart';
import '../../../vacancies/data/repositories/catalog_repository.dart';
import '../../../vacancies/presentation/widgets/vacancy_helpers.dart';
import '../../data/models/resume.dart';
import '../widgets/resume_l10n.dart';
import '../../providers/my_resumes_controller.dart';
import '../../providers/resume_detail_provider.dart';
import '../../providers/resume_edit_controller.dart';

class ResumeEditorScreen extends ConsumerStatefulWidget {
  const ResumeEditorScreen({super.key, this.id});
  final String? id;

  @override
  ConsumerState<ResumeEditorScreen> createState() => _ResumeEditorScreenState();
}

class _ResumeEditorScreenState extends ConsumerState<ResumeEditorScreen> with SubmitState {
  late ResumeInput _input;
  final _titleController = TextEditingController();
  final _aboutController = TextEditingController();
  final _salaryController = TextEditingController();
  var _currency = 'UZS';
  var _relocate = false;
  var _visibility = ResumeVisibility.hidden;
  Category? _category;
  Region? _region;
  final _employmentTypes = <EmploymentType>{};
  final _workFormats = <WorkFormat>{};
  final _experiences = <ResumeExperience>[];
  final _educations = <ResumeEducation>[];
  final _skills = <String>[];
  final _languages = <ResumeLanguage>[];
  final _skillController = TextEditingController();

  bool get _isEdit => widget.id != null;

  @override
  Set<String> get shownFields => {
    'title',
    'about',
    'category_id',
    'region_id',
    'desired_salary',
    'currency',
    'employment_types',
    'work_formats',
    'experiences',
    'educations',
    'skills',
    'languages',
  };

  @override
  void initState() {
    super.initState();
    _input = const ResumeInput(title: '');
  }

  @override
  void dispose() {
    _titleController.dispose();
    _aboutController.dispose();
    _salaryController.dispose();
    _skillController.dispose();
    super.dispose();
  }

  void _loadFromDetail(ResumeDetail detail) {
    _input = ResumeInput.fromDetail(detail);
    _titleController.text = _input.title;
    _aboutController.text = _input.about ?? '';
    _salaryController.text = _input.desiredSalary?.toString() ?? '';
    _currency = _input.currency;
    _relocate = _input.relocate;
    _visibility = _input.visibility;
    _employmentTypes.addAll(_input.employmentTypes);
    _workFormats.addAll(_input.workFormats);
    _experiences.addAll(_input.experiences);
    _educations.addAll(_input.educations);
    _skills.addAll(_input.skills);
    _languages.addAll(_input.languages);
    _resolveCatalog();
  }

  Future<void> _resolveCatalog() async {
    if (_input.categoryId == null && _input.regionId == null) return;
    try {
      final categories = await ref.read(catalogRepositoryProvider).categories();
      final regions = await ref.read(catalogRepositoryProvider).regions();
      if (!mounted) return;
      setState(() {
        _category = _findCategory(categories, _input.categoryId);
        _region = _findRegion(regions, _input.regionId);
      });
    } on Exception {
      // Category/region names are optional in the editor; ignore catalog failures here.
    }
  }

  static Category? _findCategory(List<Category> list, int? id) {
    if (id == null) return null;
    for (final c in list) {
      if (c.id == id) return c;
      final found = _findCategory(c.children, id);
      if (found != null) return found;
    }
    return null;
  }

  static Region? _findRegion(List<Region> list, int? id) {
    if (id == null) return null;
    for (final r in list) {
      if (r.id == id) return r;
      final found = _findRegion(r.children, id);
      if (found != null) return found;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final saveAsync = ref.watch(resumeEditControllerProvider);

    if (_isEdit) {
      final detailAsync = ref.watch(resumeDetailProvider(widget.id!));
      return detailAsync.when(
        data: (detail) {
          if (_titleController.text.isEmpty) _loadFromDetail(detail);
          return _scaffold(l, saveAsync);
        },
        loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (e, _) => Scaffold(
          appBar: AppBar(title: Text(l.resumeEditResume)),
          body: _ErrorBody(error: e, onRetry: () => ref.invalidate(resumeDetailProvider(widget.id!))),
        ),
      );
    }

    return _scaffold(l, saveAsync);
  }

  Widget _scaffold(AppLocalizations l, AsyncValue<ResumeDetail?> saveAsync) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(_isEdit ? l.resumeEditResume : l.resumeNewResume)),
      body: Form(
        key: formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, 120),
          children: [
            FormErrorBanner(formError),
            if (formError != null) const SizedBox(height: AppSpace.lg),
            _BasicSection(
              titleController: _titleController,
              aboutController: _aboutController,
              salaryController: _salaryController,
              currency: _currency,
              onCurrencyChanged: (v) => setState(() => _currency = v),
              relocate: _relocate,
              onRelocateChanged: (v) => setState(() => _relocate = v),
              category: _category,
              region: _region,
              onPickCategory: _pickCategory,
              onPickRegion: _pickRegion,
              fieldErrors: fieldErrors,
            ),
            const SizedBox(height: AppSpace.lg),
            _VisibilitySection(value: _visibility, onChanged: (v) => setState(() => _visibility = v)),
            const SizedBox(height: AppSpace.lg),
            _EmploymentSection(
              employmentTypes: _employmentTypes,
              workFormats: _workFormats,
              onToggleEmployment: (t) => setState(() => _employmentTypes.contains(t) ? _employmentTypes.remove(t) : _employmentTypes.add(t)),
              onToggleWorkFormat: (f) => setState(() => _workFormats.contains(f) ? _workFormats.remove(f) : _workFormats.add(f)),
            ),
            const SizedBox(height: AppSpace.lg),
            _ExperienceSection(
              experiences: _experiences,
              onChanged: (list) => setState(() => _experiences..clear()..addAll(list)),
              fieldErrors: fieldErrors,
            ),
            const SizedBox(height: AppSpace.lg),
            _EducationSection(
              educations: _educations,
              onChanged: (list) => setState(() => _educations..clear()..addAll(list)),
              fieldErrors: fieldErrors,
            ),
            const SizedBox(height: AppSpace.lg),
            _SkillsSection(
              skills: _skills,
              controller: _skillController,
              onAdded: _addSkill,
              onRemoved: (i) => setState(() => _skills.removeAt(i)),
              fieldError: fieldErrors['skills'],
            ),
            const SizedBox(height: AppSpace.lg),
            _LanguagesSection(
              languages: _languages,
              onChanged: (list) => setState(() => _languages..clear()..addAll(list)),
              fieldErrors: fieldErrors,
            ),
            const SizedBox(height: AppSpace.xl),
            PrimaryButton(
              label: l.commonSave,
              loading: pending || saveAsync.isLoading,
              onPressed: _save,
            ),
            const SizedBox(height: AppSpace.xl),
          ],
        ),
      ),
    );
  }

  void _addSkill(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    if (_skills.length >= 30) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.l10n.resumeMaxSkills)));
      return;
    }
    if (!_skills.contains(trimmed)) {
      setState(() => _skills.add(trimmed));
    }
    _skillController.clear();
  }

  Future<void> _pickCategory() async {
    final categories = await ref.read(catalogRepositoryProvider).categories();
    if (!mounted) return;
    final flat = _flattenCategories(categories);
    final picked = await showModalBottomSheet<Category>(
      context: context,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => _PickerSheet<Category>(
        title: context.l10n.filterCategory,
        items: flat,
        label: (c) => localizedName(context, c.name),
      ),
    );
    if (picked != null) setState(() => _category = picked);
  }

  Future<void> _pickRegion() async {
    final regions = await ref.read(catalogRepositoryProvider).regions();
    if (!mounted) return;
    final flat = _flattenRegions(regions);
    final picked = await showModalBottomSheet<Region>(
      context: context,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => _PickerSheet<Region>(
        title: context.l10n.filterRegion,
        items: flat,
        label: (r) => localizedName(context, r.name),
      ),
    );
    if (picked != null) setState(() => _region = picked);
  }

  List<Category> _flattenCategories(List<Category> list) {
    final out = <Category>[];
    for (final c in list) {
      out.add(c);
      out.addAll(_flattenCategories(c.children));
    }
    return out;
  }

  List<Region> _flattenRegions(List<Region> list) {
    final out = <Region>[];
    for (final r in list) {
      out.add(r);
      out.addAll(_flattenRegions(r.children));
    }
    return out;
  }

  Future<void> _save() async {
    final salaryText = _salaryController.text.trim();
    final input = ResumeInput(
      title: _titleController.text.trim(),
      about: _aboutController.text.trim().isEmpty ? null : _aboutController.text.trim(),
      categoryId: _category?.id,
      regionId: _region?.id,
      relocate: _relocate,
      desiredSalary: salaryText.isEmpty ? null : int.tryParse(salaryText),
      currency: _currency,
      employmentTypes: _employmentTypes.toList(),
      workFormats: _workFormats.toList(),
      visibility: _visibility,
      experiences: _experiences,
      educations: _educations,
      skills: _skills,
      languages: _languages,
    );
    await submit(() async {
      final detail = await ref.read(resumeEditControllerProvider.notifier).save(id: widget.id, input: input);
      if (mounted && detail != null) {
        ref.invalidate(myResumesControllerProvider);
        if (context.mounted) {
          context.pop();
          showMessage(context, context.l10n.resumeUpdated);
        }
      }
    });
  }
}

class _BasicSection extends StatelessWidget {
  const _BasicSection({
    required this.titleController,
    required this.aboutController,
    required this.salaryController,
    required this.currency,
    required this.onCurrencyChanged,
    required this.relocate,
    required this.onRelocateChanged,
    this.category,
    this.region,
    required this.onPickCategory,
    required this.onPickRegion,
    required this.fieldErrors,
  });

  final TextEditingController titleController;
  final TextEditingController aboutController;
  final TextEditingController salaryController;
  final String currency;
  final ValueChanged<String> onCurrencyChanged;
  final bool relocate;
  final ValueChanged<bool> onRelocateChanged;
  final Category? category;
  final Region? region;
  final VoidCallback onPickCategory;
  final VoidCallback onPickRegion;
  final Map<String, String> fieldErrors;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppTextField(
              label: l.resumeTitle,
              controller: titleController,
              serverError: fieldErrors['title'],
              validator: (v) => v == null || v.trim().isEmpty ? ErrorTexts.of(context).ruleText('required') : null,
            ),
            const SizedBox(height: AppSpace.lg),
            AppTextField(
              label: l.resumeAbout,
              controller: aboutController,
              serverError: fieldErrors['about'],
              hint: l.resumeAboutHint,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
            ),
            const SizedBox(height: AppSpace.lg),
            _PickerTile(
              label: l.filterCategory,
              value: category == null ? null : localizedName(context, category!.name),
              onTap: onPickCategory,
              error: fieldErrors['category_id'],
            ),
            const SizedBox(height: AppSpace.lg),
            _PickerTile(
              label: l.filterRegion,
              value: region == null ? null : localizedName(context, region!.name),
              onTap: onPickRegion,
              error: fieldErrors['region_id'],
            ),
            const SizedBox(height: AppSpace.lg),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l.resumeRelocate),
              value: relocate,
              onChanged: onRelocateChanged,
            ),
            const SizedBox(height: AppSpace.lg),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: AppTextField(
                    label: l.resumeSalary,
                    controller: salaryController,
                    serverError: fieldErrors['desired_salary'],
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                ),
                const SizedBox(width: AppSpace.md),
                Expanded(
                  child: _CurrencyPicker(value: currency, onChanged: onCurrencyChanged),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _VisibilitySection extends StatelessWidget {
  const _VisibilitySection({required this.value, required this.onChanged});
  final ResumeVisibility value;
  final ValueChanged<ResumeVisibility> onChanged;

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
            Text(l.resumeVisibilityLabel, style: context.text.titleSmall),
            const SizedBox(height: AppSpace.sm),
            ...ResumeVisibility.values.map((v) {
              final selected = value == v;
              return InkWell(
                onTap: () => onChanged(v),
                borderRadius: BorderRadius.circular(AppRadii.control),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpace.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                        color: selected ? c.lapis : c.ink3,
                        size: 20,
                      ),
                      const SizedBox(width: AppSpace.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l.resumeVisibilityText(v), style: context.text.bodyMedium?.copyWith(fontWeight: selected ? FontWeight.w600 : null)),
                            Text(l.resumeVisibilityHintText(v), style: context.text.bodySmall?.copyWith(color: c.ink2)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _EmploymentSection extends StatelessWidget {
  const _EmploymentSection({
    required this.employmentTypes,
    required this.workFormats,
    required this.onToggleEmployment,
    required this.onToggleWorkFormat,
  });

  final Set<EmploymentType> employmentTypes;
  final Set<WorkFormat> workFormats;
  final ValueChanged<EmploymentType> onToggleEmployment;
  final ValueChanged<WorkFormat> onToggleWorkFormat;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.resumeEmploymentTypes, style: context.text.titleSmall),
            const SizedBox(height: AppSpace.sm),
            Wrap(
              spacing: AppSpace.sm,
              runSpacing: AppSpace.sm,
              children: [
                for (final t in EmploymentType.values)
                  FilterChip(
                    label: Text(l.employmentType(t)),
                    selected: employmentTypes.contains(t),
                    onSelected: (_) => onToggleEmployment(t),
                  ),
              ],
            ),
            const SizedBox(height: AppSpace.lg),
            Text(l.resumeWorkFormats, style: context.text.titleSmall),
            const SizedBox(height: AppSpace.sm),
            Wrap(
              spacing: AppSpace.sm,
              runSpacing: AppSpace.sm,
              children: [
                for (final f in WorkFormat.values)
                  FilterChip(
                    label: Text(l.workFormat(f)),
                    selected: workFormats.contains(f),
                    onSelected: (_) => onToggleWorkFormat(f),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ExperienceSection extends StatelessWidget {
  const _ExperienceSection({required this.experiences, required this.onChanged, required this.fieldErrors});
  final List<ResumeExperience> experiences;
  final ValueChanged<List<ResumeExperience>> onChanged;
  final Map<String, String> fieldErrors;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l.resumeExperiences, style: context.text.titleSmall),
                TextButton.icon(
                  onPressed: () => _edit(context),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(l.resumeAddExperience),
                ),
              ],
            ),
            const SizedBox(height: AppSpace.sm),
            if (experiences.isEmpty)
              Text(l.resumeNoExperiences, style: context.text.bodyMedium?.copyWith(color: context.colors.ink2))
            else
              ...experiences.asMap().entries.map((entry) {
                final i = entry.key;
                final e = entry.value;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(e.position),
                  subtitle: Text('${e.company} · ${e.start} – ${e.end ?? context.l10n.resumeExperienceCurrent}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(icon: const Icon(Icons.edit), onPressed: () => _edit(context, index: i)),
                      IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () {
                          final list = [...experiences]..removeAt(i);
                          onChanged(list);
                        },
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

  Future<void> _edit(BuildContext context, {int? index}) async {
    final updated = await showModalBottomSheet<ResumeExperience>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => _ExperienceEditor(experience: index != null ? experiences[index] : null),
    );
    if (updated == null) return;
    final list = [...experiences];
    if (index != null) {
      list[index] = updated;
    } else {
      list.insert(0, updated);
    }
    onChanged(list);
  }
}

class _ExperienceEditor extends StatefulWidget {
  const _ExperienceEditor({this.experience});
  final ResumeExperience? experience;

  @override
  State<_ExperienceEditor> createState() => _ExperienceEditorState();
}

class _ExperienceEditorState extends State<_ExperienceEditor> {
  final _companyController = TextEditingController();
  final _positionController = TextEditingController();
  final _startController = TextEditingController();
  final _endController = TextEditingController();
  final _descriptionController = TextEditingController();
  var _current = false;

  @override
  void initState() {
    super.initState();
    final e = widget.experience;
    if (e != null) {
      _companyController.text = e.company;
      _positionController.text = e.position;
      _startController.text = e.start;
      _endController.text = e.end ?? '';
      _descriptionController.text = e.description ?? '';
      _current = e.end == null;
    }
  }

  @override
  void dispose() {
    _companyController.dispose();
    _positionController.dispose();
    _startController.dispose();
    _endController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.experience == null ? l.resumeAddExperience : l.resumeEditExperience, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.lg),
            AppTextField(label: l.resumeExperiencePosition, controller: _positionController),
            const SizedBox(height: AppSpace.lg),
            AppTextField(label: l.resumeExperienceCompany, controller: _companyController),
            const SizedBox(height: AppSpace.lg),
            Row(
              children: [
                Expanded(child: AppTextField(label: l.resumeExperienceStart, controller: _startController, hint: 'YYYY-MM')),
                const SizedBox(width: AppSpace.md),
                Expanded(
                  child: AppTextField(
                    label: l.resumeExperienceEnd,
                    controller: _endController,
                    hint: 'YYYY-MM',
                    enabled: !_current,
                  ),
                ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l.resumeExperienceCurrent),
              value: _current,
              onChanged: (v) => setState(() => _current = v),
            ),
            const SizedBox(height: AppSpace.lg),
            AppTextField(
              label: l.resumeExperienceDescription,
              controller: _descriptionController,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
            ),
            const SizedBox(height: AppSpace.lg),
            FilledButton(
              onPressed: () {
                final end = _current ? null : _endController.text.trim();
                Navigator.pop(
                  context,
                  ResumeExperience(
                    company: _companyController.text.trim(),
                    position: _positionController.text.trim(),
                    start: _startController.text.trim(),
                    end: end,
                    description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
                  ),
                );
              },
              child: Text(l.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}

class _EducationSection extends StatelessWidget {
  const _EducationSection({required this.educations, required this.onChanged, required this.fieldErrors});
  final List<ResumeEducation> educations;
  final ValueChanged<List<ResumeEducation>> onChanged;
  final Map<String, String> fieldErrors;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l.resumeEducations, style: context.text.titleSmall),
                TextButton.icon(
                  onPressed: () => _edit(context),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(l.resumeAddEducation),
                ),
              ],
            ),
            const SizedBox(height: AppSpace.sm),
            if (educations.isEmpty)
              Text(l.resumeNoEducations, style: context.text.bodyMedium?.copyWith(color: context.colors.ink2))
            else
              ...educations.asMap().entries.map((entry) {
                final i = entry.key;
                final e = entry.value;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(e.institution),
                  subtitle: Text('${context.l10n.resumeEducationLevelText(e.level)}${e.field != null ? ' · ${e.field}' : ''}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(icon: const Icon(Icons.edit), onPressed: () => _edit(context, index: i)),
                      IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () {
                          final list = [...educations]..removeAt(i);
                          onChanged(list);
                        },
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

  Future<void> _edit(BuildContext context, {int? index}) async {
    final updated = await showModalBottomSheet<ResumeEducation>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => _EducationEditor(education: index != null ? educations[index] : null),
    );
    if (updated == null) return;
    final list = [...educations];
    if (index != null) {
      list[index] = updated;
    } else {
      list.add(updated);
    }
    onChanged(list);
  }
}

class _EducationEditor extends StatefulWidget {
  const _EducationEditor({this.education});
  final ResumeEducation? education;

  @override
  State<_EducationEditor> createState() => _EducationEditorState();
}

class _EducationEditorState extends State<_EducationEditor> {
  final _institutionController = TextEditingController();
  final _fieldController = TextEditingController();
  final _startController = TextEditingController();
  final _endController = TextEditingController();
  var _level = ResumeEducationLevel.secondary;

  @override
  void initState() {
    super.initState();
    final e = widget.education;
    if (e != null) {
      _institutionController.text = e.institution;
      _fieldController.text = e.field ?? '';
      _startController.text = e.startYear?.toString() ?? '';
      _endController.text = e.endYear?.toString() ?? '';
      _level = e.level;
    }
  }

  @override
  void dispose() {
    _institutionController.dispose();
    _fieldController.dispose();
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.education == null ? l.resumeAddEducation : l.resumeEditEducation, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.lg),
            AppTextField(label: l.resumeEducationInstitution, controller: _institutionController),
            const SizedBox(height: AppSpace.lg),
            DropdownButtonFormField<ResumeEducationLevel>(
              initialValue: _level,
              decoration: InputDecoration(labelText: l.resumeEducationLevel),
              items: [
                for (final level in ResumeEducationLevel.values)
                  DropdownMenuItem(value: level, child: Text(l.resumeEducationLevelText(level))),
              ],
              onChanged: (v) => setState(() => _level = v!),
            ),
            const SizedBox(height: AppSpace.lg),
            AppTextField(label: l.resumeEducationField, controller: _fieldController),
            const SizedBox(height: AppSpace.lg),
            Row(
              children: [
                Expanded(child: AppTextField(label: l.resumeEducationStartYear, controller: _startController, keyboardType: TextInputType.number)),
                const SizedBox(width: AppSpace.md),
                Expanded(child: AppTextField(label: l.resumeEducationEndYear, controller: _endController, keyboardType: TextInputType.number)),
              ],
            ),
            const SizedBox(height: AppSpace.lg),
            FilledButton(
              onPressed: () {
                Navigator.pop(
                  context,
                  ResumeEducation(
                    institution: _institutionController.text.trim(),
                    level: _level,
                    field: _fieldController.text.trim().isEmpty ? null : _fieldController.text.trim(),
                    startYear: int.tryParse(_startController.text.trim()),
                    endYear: int.tryParse(_endController.text.trim()),
                  ),
                );
              },
              child: Text(l.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}

class _SkillsSection extends StatelessWidget {
  const _SkillsSection({required this.skills, required this.controller, required this.onAdded, required this.onRemoved, this.fieldError});
  final List<String> skills;
  final TextEditingController controller;
  final ValueChanged<String> onAdded;
  final ValueChanged<int> onRemoved;
  final String? fieldError;

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
            Text(l.resumeSkills, style: context.text.titleSmall),
            const SizedBox(height: AppSpace.sm),
            Text(l.resumeSkillsHint, style: context.text.bodySmall?.copyWith(color: c.ink2)),
            const SizedBox(height: AppSpace.sm),
            TextFormField(
              controller: controller,
              decoration: InputDecoration(
                hintText: l.resumeSkillsHint,
                errorText: fieldError,
                suffixIcon: IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: () => onAdded(controller.text),
                ),
              ),
              onFieldSubmitted: onAdded,
            ),
            const SizedBox(height: AppSpace.sm),
            Wrap(
              spacing: AppSpace.sm,
              runSpacing: AppSpace.sm,
              children: [
                for (var i = 0; i < skills.length; i++)
                  Chip(
                    label: Text(skills[i]),
                    onDeleted: () => onRemoved(i),
                    deleteIconColor: c.anorInk,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LanguagesSection extends StatelessWidget {
  const _LanguagesSection({required this.languages, required this.onChanged, required this.fieldErrors});
  final List<ResumeLanguage> languages;
  final ValueChanged<List<ResumeLanguage>> onChanged;
  final Map<String, String> fieldErrors;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l.resumeLanguages, style: context.text.titleSmall),
                TextButton.icon(
                  onPressed: () => _edit(context),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(l.resumeAddLanguage),
                ),
              ],
            ),
            const SizedBox(height: AppSpace.sm),
            if (languages.isEmpty)
              Text(l.resumeNoLanguages, style: context.text.bodyMedium?.copyWith(color: context.colors.ink2))
            else
              ...languages.asMap().entries.map((entry) {
                final i = entry.key;
                final lang = entry.value;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(lang.language.toUpperCase()),
                  subtitle: Text(context.l10n.resumeLanguageLevelText(lang.level)),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () {
                      final list = [...languages]..removeAt(i);
                      onChanged(list);
                    },
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Future<void> _edit(BuildContext context) async {
    final updated = await showModalBottomSheet<ResumeLanguage>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (_) => const _LanguageEditor(),
    );
    if (updated == null) return;
    onChanged([...languages, updated]);
  }
}

class _LanguageEditor extends StatefulWidget {
  const _LanguageEditor();

  @override
  State<_LanguageEditor> createState() => _LanguageEditorState();
}

class _LanguageEditorState extends State<_LanguageEditor> {
  final _languageController = TextEditingController();
  var _level = ResumeLanguageLevel.a1;

  @override
  void dispose() {
    _languageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, MediaQuery.viewInsetsOf(context).bottom + AppSpace.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.resumeAddLanguage, style: context.text.headlineSmall),
          const SizedBox(height: AppSpace.lg),
          AppTextField(label: l.resumeLanguageCode, controller: _languageController, hint: 'uz, ru, en…'),
          const SizedBox(height: AppSpace.lg),
          DropdownButtonFormField<ResumeLanguageLevel>(
            initialValue: _level,
            decoration: InputDecoration(labelText: l.resumeLanguageLevel),
            items: [
              for (final level in ResumeLanguageLevel.values)
                DropdownMenuItem(value: level, child: Text(l.resumeLanguageLevelText(level))),
            ],
            onChanged: (v) => setState(() => _level = v!),
          ),
          const SizedBox(height: AppSpace.lg),
          FilledButton(
            onPressed: () {
              Navigator.pop(
                context,
                ResumeLanguage(
                  language: _languageController.text.trim().toLowerCase(),
                  level: _level,
                ),
              );
            },
            child: Text(l.commonSave),
          ),
        ],
      ),
    );
  }
}

class _CurrencyPicker extends StatelessWidget {
  const _CurrencyPicker({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(labelText: context.l10n.resumeCurrency),
      items: const [
        DropdownMenuItem(value: 'UZS', child: Text('UZS')),
        DropdownMenuItem(value: 'USD', child: Text('USD')),
      ],
      onChanged: (v) => onChanged(v!),
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({required this.label, this.value, required this.onTap, this.error});
  final String label;
  final String? value;
  final VoidCallback onTap;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: context.text.titleSmall),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.control),
          child: InputDecorator(
            decoration: InputDecoration(
              hintText: label,
              errorText: error,
              suffixIcon: const Icon(Icons.chevron_right),
            ),
            child: Text(value ?? '', style: context.text.bodyMedium?.copyWith(color: value == null ? c.ink3 : c.ink)),
          ),
        ),
      ],
    );
  }
}

class _PickerSheet<T> extends StatelessWidget {
  const _PickerSheet({required this.title, required this.items, required this.label});
  final String title;
  final List<T> items;
  final String Function(T) label;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpace.lg),
            child: Text(title, style: context.text.headlineSmall),
          ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return ListTile(
                  title: Text(label(item)),
                  onTap: () => Navigator.pop(context, item),
                );
              },
            ),
          ),
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
