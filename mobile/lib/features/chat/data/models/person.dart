import 'package:freezed_annotation/freezed_annotation.dart';

part 'person.freezed.dart';
part 'person.g.dart';

@freezed
abstract class Person with _$Person {
  const factory Person({
    required String id,
    required String fullName,
    String? avatarUrl,
  }) = _Person;

  const Person._();

  factory Person.fromJson(Map<String, Object?> json) => _$PersonFromJson(json);
}
