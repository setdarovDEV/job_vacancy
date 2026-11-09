import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The device clock, injectable so token expiry can be tested with a skewed clock.
typedef Clock = DateTime Function();

final clockProvider = Provider<Clock>((_) => DateTime.now);
