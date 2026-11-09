import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The briefcase mark (web/public/favicon.svg): a rounded body with a handle and a seam
/// cut across the middle, drawn on a 32×32 grid.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 28, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: CustomPaint(painter: _BriefcasePainter(color ?? context.colors.lapis)),
  );
}

class _BriefcasePainter extends CustomPainter {
  _BriefcasePainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    // Uniform scale, centred, so a stretched box never distorts the mark.
    final s = size.shortestSide / 32;
    canvas
      ..translate((size.width - 32 * s) / 2, (size.height - 32 * s) / 2)
      ..scale(s);
    final paint = Paint()..color = color;
    // Handle: outer rounded rect minus inner rect, open at the bottom.
    final handle = Path()
      ..moveTo(11.5, 10)
      ..lineTo(11.5, 8.5)
      ..arcToPoint(const Offset(14.5, 5.5), radius: const Radius.circular(3))
      ..lineTo(17.5, 5.5)
      ..arcToPoint(const Offset(20.5, 8.5), radius: const Radius.circular(3))
      ..lineTo(20.5, 10)
      ..lineTo(18, 10)
      ..lineTo(18, 8.5)
      ..arcToPoint(const Offset(17.5, 8), radius: const Radius.circular(0.5), clockwise: false)
      ..lineTo(14.5, 8)
      ..arcToPoint(const Offset(14, 8.5), radius: const Radius.circular(0.5), clockwise: false)
      ..lineTo(14, 10)
      ..close();
    canvas.drawPath(handle, paint);
    final body = Path()..addRRect(RRect.fromLTRBR(4, 10, 28, 27, const Radius.circular(4)));
    final cut = Path()
      ..addRect(const Rect.fromLTWH(4, 16, 24, 2.25))
      ..addRRect(RRect.fromLTRBR(13.5, 14.5, 18.5, 19.75, const Radius.circular(1.25)));
    canvas.drawPath(Path.combine(PathOperation.difference, body, cut), paint);
  }

  @override
  bool shouldRepaint(_BriefcasePainter old) => old.color != color;
}

class Logo extends StatelessWidget {
  const Logo({super.key, this.size = 28});
  final double size;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      LogoMark(size: size),
      SizedBox(width: size * 0.36),
      Flexible(
        child: Text(
          'Job Vacancy',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.text.headlineSmall?.copyWith(fontSize: size * 0.62, letterSpacing: -0.3),
        ),
      ),
    ],
  );
}
