import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';

enum AttachmentChoice { gallery, camera, file, location }

class AttachmentBottomSheet extends StatelessWidget {
  const AttachmentBottomSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, AppSpace.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.chatAttachTitle, style: context.text.titleMedium),
            const SizedBox(height: AppSpace.lg),
            _Tile(
              icon: Icons.photo,
              label: l.chatAttachGallery,
              color: c.lapis,
              onTap: () => Navigator.pop(context, AttachmentChoice.gallery),
            ),
            _Tile(
              icon: Icons.camera_alt,
              label: l.chatAttachCamera,
              color: c.lapis,
              onTap: () => Navigator.pop(context, AttachmentChoice.camera),
            ),
            _Tile(
              icon: Icons.insert_drive_file,
              label: l.chatAttachFile,
              color: c.firuza,
              onTap: () => Navigator.pop(context, AttachmentChoice.file),
            ),
            _Tile(
              icon: Icons.location_on,
              label: l.chatAttachLocation,
              color: c.zafaron,
              // TODO(9D): enable when geolocator / manual location picker is added.
              onTap: () => Navigator.pop(context, AttachmentChoice.location),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.label, required this.color, required this.onTap});
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(AppRadii.control)),
        child: Icon(icon, color: color),
      ),
      title: Text(label, style: context.text.bodyLarge),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.control)),
      onTap: onTap,
      tileColor: c.surface,
    );
  }
}
