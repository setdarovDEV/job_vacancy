import 'package:freezed_annotation/freezed_annotation.dart';

part 'skill.freezed.dart';
part 'skill.g.dart';

@freezed
abstract class Skill with _$Skill {
  const factory Skill({required int id, required String name}) = _Skill;

  const Skill._();

  factory Skill.fromJson(Map<String, Object?> json) => _$SkillFromJson(json);
}
