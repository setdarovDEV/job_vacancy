import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

/// Account role. Roles added on the server later decode as [unknown] instead of failing.
@JsonEnum()
enum UserRole { seeker, employer, admin, unknown }

/// The signed-in user, as `/me` and the auth endpoints return it.
@freezed
abstract class User with _$User {
  const factory User({
    required String id,
    required String fullName,
    @JsonKey(unknownEnumValue: UserRole.unknown) required UserRole role,
    required String locale,
    String? email,
    @Default(false) bool emailVerified,
    String? phone,
    @Default(false) bool phoneVerified,
    String? avatarUrl,
    @Default(false) bool hasPassword,
    @Default(false) bool googleLinked,
    DateTime? createdAt,
  }) = _User;

  const User._();

  factory User.fromJson(Map<String, Object?> json) => _$UserFromJson(json);

  bool get isSeeker => role == UserRole.seeker;

  /// Applying needs a confirmed email or phone (the API answers verification_required).
  bool get hasConfirmedContact => emailVerified || phoneVerified;
}
