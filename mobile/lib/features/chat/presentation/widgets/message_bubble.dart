import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../data/models/message.dart';
import 'file_message_bubble.dart';
import 'image_message_bubble.dart';
import 'location_message_bubble.dart';
import 'voice_message_bubble.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    required this.read,
    this.onRetry,
  });

  final Message message;
  final bool isMe;
  final bool read;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final alignment = isMe ? Alignment.centerRight : Alignment.centerLeft;
    final bubbleColor = isMe ? c.lapis : c.surface;
    final textColor = isMe ? c.onLapis : c.ink;
    final timeColor = isMe ? c.onLapis.withValues(alpha: 0.8) : c.ink3;

    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        child: Card(
          color: bubbleColor,
          margin: const EdgeInsets.only(bottom: AppSpace.sm),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(AppRadii.panel),
              topRight: const Radius.circular(AppRadii.panel),
              bottomLeft: Radius.circular(isMe ? AppRadii.panel : 4),
              bottomRight: Radius.circular(isMe ? 4 : AppRadii.panel),
            ),
          ),
          child: InkWell(
            onTap: message.failed ? onRetry : null,
            borderRadius: BorderRadius.circular(AppRadii.panel),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpace.md, vertical: AppSpace.sm),
              child: Column(
                crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  _Content(message: message, textColor: textColor),
                  const SizedBox(height: AppSpace.xs),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        DateFormat.Hm(context.l10n.localeName).format(message.createdAt),
                        style: context.text.bodySmall?.copyWith(color: timeColor),
                      ),
                      if (isMe) ...[
                        const SizedBox(width: 4),
                        if (message.pending)
                          SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(strokeWidth: 2, color: timeColor),
                          )
                        else if (message.failed)
                          Icon(Icons.error_outline, size: 14, color: c.anor)
                        else
                          Icon(
                            read ? Icons.done_all : Icons.done,
                            size: 14,
                            color: read ? c.firuza : timeColor,
                          ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.message, required this.textColor});
  final Message message;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    if (message.deleted) {
      return Text('[${l.chatDeleted}]', style: context.text.bodyMedium?.copyWith(color: textColor.withValues(alpha: 0.7), fontStyle: FontStyle.italic));
    }
    return switch (message.kind) {
      MessageKind.text => Text(message.body, style: context.text.bodyMedium?.copyWith(color: textColor)),
      MessageKind.image => ImageMessageBubble(file: message.file, caption: message.body),
      MessageKind.file => message.file == null
          ? Text('[${l.chatFile}] ${message.body}', style: context.text.bodyMedium?.copyWith(color: textColor))
          : FileMessageBubble(file: message.file!, caption: message.body, foregroundColor: textColor),
      MessageKind.voice => message.file == null
          ? Text('[${l.chatVoice}]', style: context.text.bodyMedium?.copyWith(color: textColor))
          : VoiceMessageBubble(file: message.file!, foregroundColor: textColor),
      MessageKind.location => message.location == null
          ? Text('[${l.chatLocation}] ${message.body}', style: context.text.bodyMedium?.copyWith(color: textColor))
          : LocationMessageBubble(location: message.location!, foregroundColor: textColor),
      MessageKind.system => Text(message.body, style: context.text.bodyMedium?.copyWith(color: textColor, fontStyle: FontStyle.italic)),
    };
  }
}
