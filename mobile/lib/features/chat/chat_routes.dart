import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'presentation/screens/chat_screen.dart';
import 'presentation/screens/messages_screen.dart';

final GoRoute messagesRoute = GoRoute(path: Routes.messages, builder: (_, __) => const MessagesScreen());

final GoRoute chatRoute = GoRoute(
  path: '${Routes.chat}/:id',
  builder: (_, s) => ChatScreen(conversationId: s.pathParameters['id']!),
);

final List<RouteBase> chatRoutes = [chatRoute];
