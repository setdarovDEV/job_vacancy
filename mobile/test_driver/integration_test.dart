import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// `flutter drive` host side: saves screenshots taken by the test into $SHOTS (or build/shots).
Future<void> main() => integrationDriver(
  onScreenshot: (name, bytes, [args]) async {
    final dir = Directory(Platform.environment['SHOTS'] ?? 'build/shots')..createSync(recursive: true);
    File('${dir.path}/$name.png').writeAsBytesSync(bytes);
    return true;
  },
);
