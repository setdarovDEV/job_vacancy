import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/l10n/l10n.dart';

/// "Send the code again" with the server's 60-second cooldown counted down on screen.
class ResendButton extends StatefulWidget {
  const ResendButton({
    super.key,
    required this.onResend,
    this.cooldown = const Duration(seconds: 60),
    this.startCoolingDown = true,
  });

  /// Returns normally when a new code went out; throw to keep the button available.
  final Future<void> Function() onResend;
  final Duration cooldown;

  /// A code was just sent (e.g. at registration), so start with the countdown.
  final bool startCoolingDown;

  @override
  State<ResendButton> createState() => _ResendButtonState();
}

class _ResendButtonState extends State<ResendButton> {
  Timer? _timer;
  int _left = 0;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.startCoolingDown) _start();
  }

  void _start() {
    _left = widget.cooldown.inSeconds;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _left--);
      if (_left <= 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return TextButton(
      onPressed: _left > 0 || _busy
          ? null
          : () async {
              setState(() => _busy = true);
              try {
                await widget.onResend();
                if (mounted) setState(_start);
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
      child: Text(_left > 0 ? l.authResendIn('$_left') : l.authResend),
    );
  }
}
