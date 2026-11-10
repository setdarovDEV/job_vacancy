import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../data/models/notification.dart';
import '../../providers/notifications_controller.dart';
import '../../providers/unread_notifications_count_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text(l.notificationsTitle),
        actions: [
          TextButton(
            onPressed: () => ref.read(notificationsControllerProvider.notifier).markAllRead(),
            child: Text(l.notificationsMarkAllRead),
          ),
        ],
      ),
      body: user == null ? const _GuestBody() : const _NotificationsBody(),
    );
  }
}

class _GuestBody extends StatelessWidget {
  const _GuestBody();

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l.errorsUnauthorized, textAlign: TextAlign.center, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.lg),
            FilledButton(onPressed: () => context.push(Routes.login), child: Text(l.navSignIn)),
          ],
        ),
      ),
    );
  }
}

class _NotificationsBody extends ConsumerStatefulWidget {
  const _NotificationsBody();

  @override
  ConsumerState<_NotificationsBody> createState() => _NotificationsBodyState();
}

class _NotificationsBodyState extends ConsumerState<_NotificationsBody> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(notificationsControllerProvider.notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationsControllerProvider);
    return state.when(
      data: (data) => RefreshIndicator(
        onRefresh: () => ref.read(notificationsControllerProvider.notifier).refresh(),
        child: data.items.isEmpty
            ? const _EmptyBody()
            : ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, 120),
                itemCount: data.items.length + (data.hasMore || data.isLoadingMore ? 1 : 0),
                itemBuilder: (_, i) {
                  if (i == data.items.length) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: AppSpace.lg),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                  return _NotificationTile(notification: data.items[i]);
                },
              ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorBody(error: e),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});
  final AppNotification notification;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final c = context.colors;
    final presenter = NotificationPresenter(l);
    final (icon, title, subtitle) = presenter.present(notification);
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.md),
      color: notification.isUnread ? c.surface : c.sunken.withValues(alpha: 0.3),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: c.lapis.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(AppRadii.control),
          ),
          child: Icon(icon, color: c.lapis),
        ),
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (subtitle.isNotEmpty) Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis),
            Text(
              _formatTime(context, notification.createdAt),
              style: context.text.bodySmall?.copyWith(color: c.ink3),
            ),
          ],
        ),
        trailing: notification.isUnread ? Container(width: 8, height: 8, decoration: BoxDecoration(color: c.lapis, shape: BoxShape.circle)) : null,
        onTap: () {
          ref.read(notificationsControllerProvider.notifier).markRead(notification.id);
          ref.read(unreadNotificationsCountProvider.notifier).refresh().ignore();
          _handleTap(context);
        },
      ),
    );
  }

  void _handleTap(BuildContext context) {
    final payload = notification.payload;
    switch (notification.type) {
      case 'application.new':
      case 'application.status':
      case 'application.invited':
        final id = payload['application_id'] as String?;
        if (id != null) context.push(Routes.applicationDetail(id));
      case 'vacancy.approved':
      case 'vacancy.rejected':
      case 'vacancy.taken_down':
        final id = payload['vacancy_id'] as String?;
        if (id != null) context.push('${Routes.vacancy}/$id');
    }
  }

  String _formatTime(BuildContext context, DateTime date) {
    final now = DateTime.now();
    final locale = context.l10n.localeName;
    if (date.year == now.year && date.month == now.month && date.day == now.day) {
      return DateFormat.Hm(locale).format(date);
    }
    return DateFormat.MMMd(locale).format(date);
  }
}

class NotificationPresenter {
  const NotificationPresenter(this.l);
  final AppLocalizations l;

  (IconData, String, String) present(AppNotification n) {
    final p = n.payload;
    return switch (n.type) {
      'application.new' => (Icons.person_add, l.notificationApplicationNew, '${p['vacancy_title'] ?? ''} • ${p['candidate_name'] ?? ''}'),
      'application.status' => (Icons.update, l.notificationApplicationStatus, '${p['vacancy_title'] ?? ''} • ${p['company_name'] ?? ''}'),
      'application.invited' => (Icons.event_available, l.notificationApplicationInvited, '${p['vacancy_title'] ?? ''} • ${p['company_name'] ?? ''}'),
      'vacancy.approved' => (Icons.check_circle, l.notificationVacancyApproved, p['vacancy_title'] as String? ?? ''),
      'vacancy.rejected' => (Icons.cancel, l.notificationVacancyRejected, p['vacancy_title'] as String? ?? ''),
      'vacancy.taken_down' => (Icons.report, l.notificationVacancyTakenDown, p['vacancy_title'] as String? ?? ''),
      'search.alert' => (Icons.search, l.notificationSearchAlert, p['search_name'] as String? ?? ''),
      'report.resolved' => (Icons.gavel, l.notificationReportResolved, p['target_name'] as String? ?? ''),
      'report.dismissed' => (Icons.gavel, l.notificationReportDismissed, p['target_name'] as String? ?? ''),
      _ => (Icons.notifications, n.type, ''),
    };
  }
}

class _EmptyBody extends StatelessWidget {
  const _EmptyBody();

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
            Icon(Icons.notifications_none, size: 48, color: c.ink3),
            const SizedBox(height: AppSpace.lg),
            Text(l.notificationsEmpty, textAlign: TextAlign.center, style: context.text.bodyLarge),
          ],
        ),
      ),
    );
  }
}

class _ErrorBody extends ConsumerWidget {
  const _ErrorBody({required this.error});
  final Object error;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(ErrorTexts.of(context).message(error) ?? l.errorsInternalError, textAlign: TextAlign.center),
            const SizedBox(height: AppSpace.lg),
            FilledButton.icon(
              onPressed: () => ref.read(notificationsControllerProvider.notifier).refresh(),
              icon: const Icon(Icons.refresh),
              label: Text(l.commonRetry),
            ),
          ],
        ),
      ),
    );
  }
}
