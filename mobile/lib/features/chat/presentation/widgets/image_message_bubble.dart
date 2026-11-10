import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/tokens.dart';
import '../../data/models/chat_file.dart';

class ImageMessageBubble extends StatelessWidget {
  const ImageMessageBubble({super.key, this.file, this.caption});
  final ChatFile? file;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final url = file?.url;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (url != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.control),
            child: CachedNetworkImage(
              imageUrl: url,
              placeholder: (_, __) => const SizedBox(width: 120, height: 120, child: Center(child: CircularProgressIndicator())),
              errorWidget: (_, __, ___) => const Icon(Icons.broken_image),
              fit: BoxFit.cover,
            ),
          )
        else
          const Icon(Icons.image, size: 64),
        if (caption != null && caption!.isNotEmpty) ...[
          const SizedBox(height: AppSpace.xs),
          Text(caption!, style: context.text.bodyMedium),
        ],
      ],
    );
  }
}
