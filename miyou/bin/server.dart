import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';

void main() async {
  final router = Router();

  // Hello World endpoint
  router.get('/helloWorld', (Request request) {
    return Response.ok(
      'Hello from Dart Functions!',
      headers: {'Content-Type': 'text/plain'},
    );
  });

  // Health check
  router.get('/', (Request request) {
    return Response.ok('OK');
  });

  final handler = const Pipeline()
      .addMiddleware(logRequests())
      .addHandler(router.call);

  final port = int.parse(Platform.environment['PORT'] ?? '8080');
  final server = await shelf_io.serve(handler, InternetAddress.anyIPv4, port);
  print('Server running on port ${server.port}');
}
