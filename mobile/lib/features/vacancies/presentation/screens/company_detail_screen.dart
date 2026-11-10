import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/submit.dart';
import '../../data/api/vacancy_api.dart';
import '../../data/models/company.dart';
import '../../data/models/vacancy.dart';
import '../../data/repositories/vacancy_repository.dart';
import '../../providers/company_detail_provider.dart';
import '../widgets/report_sheet.dart';
import '../widgets/vacancy_card.dart';

class CompanyDetailScreen extends ConsumerWidget {
  const CompanyDetailScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final companyAsync = ref.watch(companyDetailProvider(slug));
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(l.navCompanies)),
      body: companyAsync.when(
        data: (company) => _Body(company: company),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorBody(error: e, onRetry: () => ref.invalidate(companyDetailProvider(slug))),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.company});
  final Company company;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  final _items = <VacancyCard>[];
  String? _cursor;
  bool _hasMore = true;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final page = await ref.read(vacancyRepositoryProvider).search(
        VacancySearchParams(companyId: widget.company.id),
        cursor: _cursor,
      );
      setState(() {
        _items.addAll(page.items);
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
      });
    } on Exception catch (e) {
      if (mounted) showApiError(context, e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Header(company: widget.company),
              const SizedBox(height: AppSpace.lg),
              _InfoCard(company: widget.company),
              if (widget.company.about != null && widget.company.about!.isNotEmpty) ...[
                const SizedBox(height: AppSpace.lg),
                _About(about: widget.company.about!),
              ],
              const SizedBox(height: AppSpace.lg),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpace.lg),
                child: Text(l.vacancyOpenVacancies, style: context.text.titleMedium?.copyWith(color: c.ink)),
              ),
              const SizedBox(height: AppSpace.md),
            ],
          ),
        ),
        if (_items.isEmpty && !_loading)
          SliverFillRemaining(
            child: Center(
              child: Text(l.commonNoResults, style: context.text.bodyLarge?.copyWith(color: c.ink2)),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpace.lg, 0, AppSpace.lg, 120),
            sliver: SliverList.builder(
              itemCount: _items.length + (_hasMore || _loading ? 1 : 0),
              itemBuilder: (_, i) {
                if (i == _items.length) {
                  _loadMore();
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpace.lg),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpace.md),
                  child: VacancyListCard(vacancy: _items[i]),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.company});
  final Company company;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Stack(
      children: [
        if (company.coverUrl != null)
          CachedNetworkImage(
            imageUrl: company.coverUrl!,
            height: 140,
            width: double.infinity,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(height: 140, color: c.sunken),
            errorWidget: (_, __, ___) => Container(height: 140, color: c.sunken),
          )
        else
          Container(height: 140, color: c.lapisSoft),
        Positioned(
          left: AppSpace.lg,
          bottom: -30,
          child: Container(
            decoration: BoxDecoration(
              color: c.surface,
              shape: BoxShape.circle,
              border: Border.all(color: c.surface, width: 4),
            ),
            child: CircleAvatar(
              radius: 40,
              backgroundColor: c.sunken,
              backgroundImage: company.logoUrl != null ? CachedNetworkImageProvider(company.logoUrl!) : null,
              child: company.logoUrl == null ? Icon(Icons.business, size: 36, color: c.ink3) : null,
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoCard extends ConsumerWidget {
  const _InfoCard({required this.company});
  final Company company;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 36),
          Row(
            children: [
              Expanded(
                child: Text(company.name, style: context.text.headlineSmall?.copyWith(color: c.ink)),
              ),
              if (company.verified) Icon(Icons.verified, color: c.firuza),
              IconButton(
                icon: Icon(Icons.flag_outlined, color: c.anorInk),
                onPressed: () {
                  if (user == null) {
                    context.push(Routes.login);
                    return;
                  }
                  _showReport(context, company);
                },
              ),
            ],
          ),
          if (company.website != null)
            TextButton(
              onPressed: () async {
                final url = Uri.parse(company.website!);
                if (await canLaunchUrl(url)) await launchUrl(url, mode: LaunchMode.externalApplication);
              },
              child: Text(company.website!),
            ),
          if (company.address != null)
            Text(company.address!, style: context.text.bodyMedium?.copyWith(color: c.ink2)),
          if (company.foundedYear != null)
            Text('${l.companyFounded}: ${company.foundedYear}', style: context.text.bodyMedium?.copyWith(color: c.ink2)),
          if (company.size != null)
            Text('${l.companySize}: ${company.size}', style: context.text.bodyMedium?.copyWith(color: c.ink2)),
        ],
      ),
    );
  }
}

void _showReport(BuildContext context, Company company) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.colors.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
    builder: (_) => ReportSheet(targetType: 'company', targetId: company.id),
  );
}

class _About extends StatelessWidget {
  const _About({required this.about});
  final String about;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.l10n.companyAbout, style: context.text.titleMedium?.copyWith(color: c.ink)),
          const SizedBox(height: AppSpace.md),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.lg),
              child: MarkdownBody(
                data: about,
                selectable: true,
                styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                  p: context.text.bodyMedium?.copyWith(color: c.ink),
                ),
              ),
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
