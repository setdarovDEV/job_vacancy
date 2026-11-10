import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/tokens.dart';
import '../../data/models/chat_file.dart';

class FileMessageBubble extends StatelessWidget {
  const FileMessageBubble({super.key, required this.file, this.caption, this.foregroundColor});
  final ChatFile file;
  final String? caption;
  final Color? foregroundColor;

  String get _readableSize {
    final size = file.size;
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  Future<void> _open(BuildContext context) async {
    final url = file.url;
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = foregroundColor ?? c.ink;
    return InkWell(
      onTap: () => _open(context),
      borderRadius: BorderRadius.circular(AppRadii.control),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: Icon(Icons.insert_drive_file, color: color),
          ),
          const SizedBox(width: AppSpace.md),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  file.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.bodyMedium?.copyWith(color: color, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: AppSpace.xs),
                Text(
                  _readableSize,
                  style: context.text.bodySmall?.copyWith(color: color.withValues(alpha: 0.8)),
                ),
                if (caption != null && caption!.isNotEmpty) ...[
                  const SizedBox(height: AppSpace.xs),
                  Text(caption!, style: context.text.bodyMedium?.copyWith(color: color)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
