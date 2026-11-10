import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../data/models/message.dart';

class LocationMessageBubble extends StatelessWidget {
  const LocationMessageBubble({super.key, required this.location, this.foregroundColor});
  final MessageLocation location;
  final Color? foregroundColor;

  Future<void> _open() async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = foregroundColor ?? c.ink;
    return InkWell(
      onTap: _open,
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
            child: Icon(Icons.location_on, color: color),
          ),
          const SizedBox(width: AppSpace.md),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  location.name ?? context.l10n.chatLocation,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.bodyMedium?.copyWith(color: color, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: AppSpace.xs),
                Text(
                  '${location.lat.toStringAsFixed(5)}, ${location.lng.toStringAsFixed(5)}',
                  style: context.text.bodySmall?.copyWith(color: color.withValues(alpha: 0.8)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
