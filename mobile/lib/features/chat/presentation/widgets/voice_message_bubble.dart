import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/tokens.dart';
import '../../data/models/chat_file.dart';

class VoiceMessageBubble extends StatefulWidget {
  const VoiceMessageBubble({super.key, required this.file, this.foregroundColor});
  final ChatFile file;
  final Color? foregroundColor;

  @override
  State<VoiceMessageBubble> createState() => _VoiceMessageBubbleState();
}

class _VoiceMessageBubbleState extends State<VoiceMessageBubble> {
  final AudioPlayer _player = AudioPlayer();
  PlayerState _state = PlayerState.stopped;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  StreamSubscription<PlayerState>? _stateSub;
  StreamSubscription<Duration>? _positionSub;
  StreamSubscription<Duration>? _durationSub;

  @override
  void initState() {
    super.initState();
    _stateSub = _player.onPlayerStateChanged.listen((s) => setState(() => _state = s));
    _positionSub = _player.onPositionChanged.listen((p) => setState(() => _position = p));
    _durationSub = _player.onDurationChanged.listen((d) => setState(() => _duration = d));
  }

  Future<void> _toggle() async {
    final url = widget.file.url;
    if (url == null || url.isEmpty) return;
    if (_state == PlayerState.playing) {
      await _player.pause();
    } else {
      await _player.play(UrlSource(url));
    }
  }

  String _format(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  void dispose() {
    _stateSub?.cancel();
    _positionSub?.cancel();
    _durationSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = widget.foregroundColor ?? c.ink;
    final progress = _duration.inMilliseconds > 0
        ? _position.inMilliseconds / _duration.inMilliseconds
        : 0.0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          onTap: _toggle,
          borderRadius: BorderRadius.circular(24),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              _state == PlayerState.playing ? Icons.pause : Icons.play_arrow,
              color: color,
            ),
          ),
        ),
        const SizedBox(width: AppSpace.md),
        SizedBox(
          width: 120,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: color.withValues(alpha: 0.12),
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                  minHeight: 4,
                ),
              ),
              const SizedBox(height: AppSpace.xs),
              Text(
                '${_format(_position)} / ${_format(_duration)}',
                style: context.text.bodySmall?.copyWith(color: color.withValues(alpha: 0.8)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
