import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../data/models/company.dart';
import '../../data/models/vacancy.dart';
import '../widgets/vacancy_helpers.dart';

class VacancyListCard extends StatelessWidget {
  const VacancyListCard({super.key, required this.vacancy, this.onToggleSave, this.isSaved = false});

  final VacancyCard vacancy;
  final VoidCallback? onToggleSave;
  final bool isSaved;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('${Routes.vacancy}/${vacancy.slug}'),
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(vacancy.title, style: context.text.titleMedium?.copyWith(color: c.ink)),
                        const SizedBox(height: AppSpace.xs),
                        _CompanyRow(company: vacancy.company),
                      ],
                    ),
                  ),
                  if (onToggleSave != null)
                    IconButton(
                      onPressed: onToggleSave,
                      icon: Icon(isSaved ? Icons.bookmark : Icons.bookmark_border, color: c.lapis),
                    ),
                ],
              ),
              const SizedBox(height: AppSpace.md),
              Wrap(
                spacing: AppSpace.sm,
                runSpacing: AppSpace.sm,
                children: [
                  _Chip(icon: Icons.work_outline, text: l.employmentType(vacancy.employmentType)),
                  _Chip(icon: Icons.location_on_outlined, text: l.workFormat(vacancy.workFormat)),
                  _Chip(icon: Icons.schedule_outlined, text: l.experience(vacancy.experience)),
                  if (vacancy.salary != null && !vacancy.salary!.isNegotiable)
                    _Chip(
                      icon: Icons.payments_outlined,
                      text: salaryText(context, vacancy.salary),
                      background: c.firuzaSoft,
                      foreground: c.firuzaInk,
                    ),
                ],
              ),
              if (vacancy.skills.isNotEmpty) ...[
                const SizedBox(height: AppSpace.md),
                _SkillsRow(skills: vacancy.skills.map((s) => s.name).toList()),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CompanyRow extends StatelessWidget {
  const _CompanyRow({required this.company});
  final CompanySummary company;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: [
        if (company.logoUrl != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.control / 2),
            child: CachedNetworkImage(
              imageUrl: company.logoUrl!,
              width: 20,
              height: 20,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(width: 20, height: 20, color: c.sunken),
              errorWidget: (_, __, ___) => Icon(Icons.business, size: 18, color: c.ink3),
            ),
          )
        else
          Icon(Icons.business, size: 18, color: c.ink3),
        const SizedBox(width: AppSpace.sm),
        Expanded(
          child: Text(
            company.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.text.bodyMedium?.copyWith(color: c.ink2),
          ),
        ),
        if (company.verified)
          Icon(Icons.verified, size: 16, color: c.firuza),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.text, this.background, this.foreground});

  final IconData icon;
  final String text;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background ?? c.sunken,
        borderRadius: BorderRadius.circular(AppRadii.control),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foreground ?? c.ink3),
          const SizedBox(width: 4),
          Text(text, style: context.text.bodySmall?.copyWith(color: foreground ?? c.ink2)),
        ],
      ),
    );
  }
}

class _SkillsRow extends StatelessWidget {
  const _SkillsRow({required this.skills});
  final List<String> skills;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Wrap(
      spacing: AppSpace.sm,
      runSpacing: AppSpace.sm,
      children: [
        for (final s in skills.take(5))
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: c.lapisSoft,
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: Text(s, style: context.text.bodySmall?.copyWith(color: c.lapisInk)),
          ),
        if (skills.length > 5)
          Text('+${skills.length - 5}', style: context.text.bodySmall?.copyWith(color: c.ink3)),
      ],
    );
  }
}
