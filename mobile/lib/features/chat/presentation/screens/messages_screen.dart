import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/tokens.dart';
import '../../data/models/conversation.dart';
import '../../data/models/message.dart';
import '../../providers/conversations_controller.dart';

class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(l.navMessages)),
      body: user == null ? const _GuestBody() : const _ConversationsBody(),
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

class _ConversationsBody extends ConsumerStatefulWidget {
  const _ConversationsBody();

  @override
  ConsumerState<_ConversationsBody> createState() => _ConversationsBodyState();
}

class _ConversationsBodyState extends ConsumerState<_ConversationsBody> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(conversationsControllerProvider.notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(conversationsControllerProvider);
    return state.when(
      data: (data) => RefreshIndicator(
        onRefresh: () => ref.read(conversationsControllerProvider.notifier).refresh(),
        child: data.items.isEmpty
            ? _EmptyBody()
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
                  return _ConversationTile(conversation: data.items[i]);
                },
              ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorBody(error: e),
    );
  }
}

class _ConversationTile extends ConsumerWidget {
  const _ConversationTile({required this.conversation});
  final Conversation conversation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final myId = user?.id ?? '';
    final name = conversation.counterpartName(myId);
    final avatar = conversation.counterpartAvatar(myId);
    final last = conversation.lastMessage;
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.md),
      child: InkWell(
        onTap: () => context.push('${Routes.chat}/${conversation.id}'),
        borderRadius: BorderRadius.circular(AppRadii.panel),
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Row(
            children: [
              _Avatar(avatar: avatar, name: name),
              const SizedBox(width: AppSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: context.text.titleMedium?.copyWith(color: c.ink)),
                    const SizedBox(height: AppSpace.xs),
                    Text(
                      last == null
                          ? l.chatNoMessages
                          : switch (last.kind) {
                              MessageKind.image => '[${l.chatImage}]',
                              MessageKind.file => '[${l.chatFile}]',
                              MessageKind.voice => '[${l.chatVoice}]',
                              MessageKind.location => '[${l.chatLocation}]',
                              _ when last.deleted => '[${l.chatDeleted}]',
                              _ => last.body,
                            },
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.bodyMedium?.copyWith(
                        color: conversation.unread > 0 ? c.ink : c.ink2,
                        fontWeight: conversation.unread > 0 ? FontWeight.w600 : null,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (last != null)
                    Text(
                      _formatTime(last.createdAt, l.localeName),
                      style: context.text.bodySmall?.copyWith(color: c.ink3),
                    ),
                  if (conversation.unread > 0) ...[
                    const SizedBox(height: AppSpace.xs),
                    Badge(
                      backgroundColor: c.lapis,
                      label: Text('${conversation.unread}', style: context.text.labelSmall?.copyWith(color: c.onLapis)),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

}

String _formatTime(DateTime date, String locale) {
  final now = DateTime.now();
  if (date.year == now.year && date.month == now.month && date.day == now.day) {
    return DateFormat.Hm(locale).format(date);
  }
  return DateFormat.Md(locale).format(date);
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.avatar, required this.name});
  final String? avatar;
  final String name;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return CircleAvatar(
      radius: 26,
      backgroundColor: c.sunken,
      backgroundImage: avatar != null ? NetworkImage(avatar!) : null,
      child: avatar == null ? Text(name.isEmpty ? '?' : name[0].toUpperCase()) : null,
    );
  }
}

class _EmptyBody extends StatelessWidget {
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
            Icon(Icons.chat_bubble_outline, size: 48, color: c.ink3),
            const SizedBox(height: AppSpace.lg),
            Text(l.chatEmpty, textAlign: TextAlign.center, style: context.text.bodyLarge),
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
              onPressed: () => ref.read(conversationsControllerProvider.notifier).refresh(),
              icon: const Icon(Icons.refresh),
              label: Text(l.commonRetry),
            ),
          ],
        ),
      ),
    );
  }
}
