import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The color behind the glass (web: body::before): soft lapis / firuza / saffron light,
/// painted once in a RepaintBoundary so scrolling never repaints it.
class Backdrop extends StatelessWidget {
  const Backdrop({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    RadialGradient blob(Alignment at, Color color) =>
        RadialGradient(center: at, radius: 0.9, colors: [color, color.withValues(alpha: 0)], stops: const [0, 1]);
    return ColoredBox(
      color: c.paper,
      child: Stack(
        fit: StackFit.expand,
        children: [
          RepaintBoundary(
            child: IgnorePointer(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  DecoratedBox(decoration: BoxDecoration(gradient: blob(const Alignment(-1.1, -1), c.blobs[0]))),
                  DecoratedBox(decoration: BoxDecoration(gradient: blob(const Alignment(1.2, -0.3), c.blobs[1]))),
                  DecoratedBox(decoration: BoxDecoration(gradient: blob(const Alignment(-0.2, 1.2), c.blobs[2]))),
                ],
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// Frosted bar for content that scrolls underneath (app bar, bottom navigation).
class GlassBar extends StatelessWidget {
  const GlassBar({super.key, required this.child, this.top = false});
  final Widget child;

  /// Hairline on the bottom edge (app bar) instead of the top edge (bottom nav).
  final bool top;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final edge = BorderSide(color: c.line);
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: c.glassBar,
            border: top ? Border(bottom: edge) : Border(top: edge),
          ),
          child: child,
        ),
      ),
    );
  }
}
