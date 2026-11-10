// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'conversation.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ConversationVacancy {

 String get id; String get title;
/// Create a copy of ConversationVacancy
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConversationVacancyCopyWith<ConversationVacancy> get copyWith => _$ConversationVacancyCopyWithImpl<ConversationVacancy>(this as ConversationVacancy, _$identity);

  /// Serializes this ConversationVacancy to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConversationVacancy&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title);

@override
String toString() {
  return 'ConversationVacancy(id: $id, title: $title)';
}


}

/// @nodoc
abstract mixin class $ConversationVacancyCopyWith<$Res>  {
  factory $ConversationVacancyCopyWith(ConversationVacancy value, $Res Function(ConversationVacancy) _then) = _$ConversationVacancyCopyWithImpl;
@useResult
$Res call({
 String id, String title
});




}
/// @nodoc
class _$ConversationVacancyCopyWithImpl<$Res>
    implements $ConversationVacancyCopyWith<$Res> {
  _$ConversationVacancyCopyWithImpl(this._self, this._then);

  final ConversationVacancy _self;
  final $Res Function(ConversationVacancy) _then;

/// Create a copy of ConversationVacancy
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ConversationVacancy].
extension ConversationVacancyPatterns on ConversationVacancy {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConversationVacancy value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConversationVacancy() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConversationVacancy value)  $default,){
final _that = this;
switch (_that) {
case _ConversationVacancy():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConversationVacancy value)?  $default,){
final _that = this;
switch (_that) {
case _ConversationVacancy() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConversationVacancy() when $default != null:
return $default(_that.id,_that.title);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title)  $default,) {final _that = this;
switch (_that) {
case _ConversationVacancy():
return $default(_that.id,_that.title);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title)?  $default,) {final _that = this;
switch (_that) {
case _ConversationVacancy() when $default != null:
return $default(_that.id,_that.title);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConversationVacancy extends ConversationVacancy {
  const _ConversationVacancy({required this.id, required this.title}): super._();
  factory _ConversationVacancy.fromJson(Map<String, dynamic> json) => _$ConversationVacancyFromJson(json);

@override final  String id;
@override final  String title;

/// Create a copy of ConversationVacancy
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConversationVacancyCopyWith<_ConversationVacancy> get copyWith => __$ConversationVacancyCopyWithImpl<_ConversationVacancy>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConversationVacancyToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConversationVacancy&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title);

@override
String toString() {
  return 'ConversationVacancy(id: $id, title: $title)';
}


}

/// @nodoc
abstract mixin class _$ConversationVacancyCopyWith<$Res> implements $ConversationVacancyCopyWith<$Res> {
  factory _$ConversationVacancyCopyWith(_ConversationVacancy value, $Res Function(_ConversationVacancy) _then) = __$ConversationVacancyCopyWithImpl;
@override @useResult
$Res call({
 String id, String title
});




}
/// @nodoc
class __$ConversationVacancyCopyWithImpl<$Res>
    implements _$ConversationVacancyCopyWith<$Res> {
  __$ConversationVacancyCopyWithImpl(this._self, this._then);

  final _ConversationVacancy _self;
  final $Res Function(_ConversationVacancy) _then;

/// Create a copy of ConversationVacancy
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,}) {
  return _then(_ConversationVacancy(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ConversationCompany {

 String get id; String get name; String get slug; String? get logoUrl;
/// Create a copy of ConversationCompany
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConversationCompanyCopyWith<ConversationCompany> get copyWith => _$ConversationCompanyCopyWithImpl<ConversationCompany>(this as ConversationCompany, _$identity);

  /// Serializes this ConversationCompany to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConversationCompany&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,logoUrl);

@override
String toString() {
  return 'ConversationCompany(id: $id, name: $name, slug: $slug, logoUrl: $logoUrl)';
}


}

/// @nodoc
abstract mixin class $ConversationCompanyCopyWith<$Res>  {
  factory $ConversationCompanyCopyWith(ConversationCompany value, $Res Function(ConversationCompany) _then) = _$ConversationCompanyCopyWithImpl;
@useResult
$Res call({
 String id, String name, String slug, String? logoUrl
});




}
/// @nodoc
class _$ConversationCompanyCopyWithImpl<$Res>
    implements $ConversationCompanyCopyWith<$Res> {
  _$ConversationCompanyCopyWithImpl(this._self, this._then);

  final ConversationCompany _self;
  final $Res Function(ConversationCompany) _then;

/// Create a copy of ConversationCompany
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? logoUrl = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ConversationCompany].
extension ConversationCompanyPatterns on ConversationCompany {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConversationCompany value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConversationCompany() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConversationCompany value)  $default,){
final _that = this;
switch (_that) {
case _ConversationCompany():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConversationCompany value)?  $default,){
final _that = this;
switch (_that) {
case _ConversationCompany() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? logoUrl)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConversationCompany() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.logoUrl);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? logoUrl)  $default,) {final _that = this;
switch (_that) {
case _ConversationCompany():
return $default(_that.id,_that.name,_that.slug,_that.logoUrl);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String slug,  String? logoUrl)?  $default,) {final _that = this;
switch (_that) {
case _ConversationCompany() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.logoUrl);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConversationCompany extends ConversationCompany {
  const _ConversationCompany({required this.id, required this.name, required this.slug, this.logoUrl}): super._();
  factory _ConversationCompany.fromJson(Map<String, dynamic> json) => _$ConversationCompanyFromJson(json);

@override final  String id;
@override final  String name;
@override final  String slug;
@override final  String? logoUrl;

/// Create a copy of ConversationCompany
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConversationCompanyCopyWith<_ConversationCompany> get copyWith => __$ConversationCompanyCopyWithImpl<_ConversationCompany>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConversationCompanyToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConversationCompany&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,logoUrl);

@override
String toString() {
  return 'ConversationCompany(id: $id, name: $name, slug: $slug, logoUrl: $logoUrl)';
}


}

/// @nodoc
abstract mixin class _$ConversationCompanyCopyWith<$Res> implements $ConversationCompanyCopyWith<$Res> {
  factory _$ConversationCompanyCopyWith(_ConversationCompany value, $Res Function(_ConversationCompany) _then) = __$ConversationCompanyCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String slug, String? logoUrl
});




}
/// @nodoc
class __$ConversationCompanyCopyWithImpl<$Res>
    implements _$ConversationCompanyCopyWith<$Res> {
  __$ConversationCompanyCopyWithImpl(this._self, this._then);

  final _ConversationCompany _self;
  final $Res Function(_ConversationCompany) _then;

/// Create a copy of ConversationCompany
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? logoUrl = freezed,}) {
  return _then(_ConversationCompany(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$Conversation {

 String get id; String get applicationId; ConversationVacancy get vacancy; ConversationCompany get company; Person get seeker; String get side; Message? get lastMessage; DateTime? get lastMessageAt; int get unread; int get readUpTo; DateTime get createdAt;
/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConversationCopyWith<Conversation> get copyWith => _$ConversationCopyWithImpl<Conversation>(this as Conversation, _$identity);

  /// Serializes this Conversation to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Conversation&&(identical(other.id, id) || other.id == id)&&(identical(other.applicationId, applicationId) || other.applicationId == applicationId)&&(identical(other.vacancy, vacancy) || other.vacancy == vacancy)&&(identical(other.company, company) || other.company == company)&&(identical(other.seeker, seeker) || other.seeker == seeker)&&(identical(other.side, side) || other.side == side)&&(identical(other.lastMessage, lastMessage) || other.lastMessage == lastMessage)&&(identical(other.lastMessageAt, lastMessageAt) || other.lastMessageAt == lastMessageAt)&&(identical(other.unread, unread) || other.unread == unread)&&(identical(other.readUpTo, readUpTo) || other.readUpTo == readUpTo)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,applicationId,vacancy,company,seeker,side,lastMessage,lastMessageAt,unread,readUpTo,createdAt);

@override
String toString() {
  return 'Conversation(id: $id, applicationId: $applicationId, vacancy: $vacancy, company: $company, seeker: $seeker, side: $side, lastMessage: $lastMessage, lastMessageAt: $lastMessageAt, unread: $unread, readUpTo: $readUpTo, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $ConversationCopyWith<$Res>  {
  factory $ConversationCopyWith(Conversation value, $Res Function(Conversation) _then) = _$ConversationCopyWithImpl;
@useResult
$Res call({
 String id, String applicationId, ConversationVacancy vacancy, ConversationCompany company, Person seeker, String side, Message? lastMessage, DateTime? lastMessageAt, int unread, int readUpTo, DateTime createdAt
});


$ConversationVacancyCopyWith<$Res> get vacancy;$ConversationCompanyCopyWith<$Res> get company;$PersonCopyWith<$Res> get seeker;$MessageCopyWith<$Res>? get lastMessage;

}
/// @nodoc
class _$ConversationCopyWithImpl<$Res>
    implements $ConversationCopyWith<$Res> {
  _$ConversationCopyWithImpl(this._self, this._then);

  final Conversation _self;
  final $Res Function(Conversation) _then;

/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? applicationId = null,Object? vacancy = null,Object? company = null,Object? seeker = null,Object? side = null,Object? lastMessage = freezed,Object? lastMessageAt = freezed,Object? unread = null,Object? readUpTo = null,Object? createdAt = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,applicationId: null == applicationId ? _self.applicationId : applicationId // ignore: cast_nullable_to_non_nullable
as String,vacancy: null == vacancy ? _self.vacancy : vacancy // ignore: cast_nullable_to_non_nullable
as ConversationVacancy,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as ConversationCompany,seeker: null == seeker ? _self.seeker : seeker // ignore: cast_nullable_to_non_nullable
as Person,side: null == side ? _self.side : side // ignore: cast_nullable_to_non_nullable
as String,lastMessage: freezed == lastMessage ? _self.lastMessage : lastMessage // ignore: cast_nullable_to_non_nullable
as Message?,lastMessageAt: freezed == lastMessageAt ? _self.lastMessageAt : lastMessageAt // ignore: cast_nullable_to_non_nullable
as DateTime?,unread: null == unread ? _self.unread : unread // ignore: cast_nullable_to_non_nullable
as int,readUpTo: null == readUpTo ? _self.readUpTo : readUpTo // ignore: cast_nullable_to_non_nullable
as int,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}
/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConversationVacancyCopyWith<$Res> get vacancy {
  
  return $ConversationVacancyCopyWith<$Res>(_self.vacancy, (value) {
    return _then(_self.copyWith(vacancy: value));
  });
}/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConversationCompanyCopyWith<$Res> get company {
  
  return $ConversationCompanyCopyWith<$Res>(_self.company, (value) {
    return _then(_self.copyWith(company: value));
  });
}/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonCopyWith<$Res> get seeker {
  
  return $PersonCopyWith<$Res>(_self.seeker, (value) {
    return _then(_self.copyWith(seeker: value));
  });
}/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MessageCopyWith<$Res>? get lastMessage {
    if (_self.lastMessage == null) {
    return null;
  }

  return $MessageCopyWith<$Res>(_self.lastMessage!, (value) {
    return _then(_self.copyWith(lastMessage: value));
  });
}
}


/// Adds pattern-matching-related methods to [Conversation].
extension ConversationPatterns on Conversation {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Conversation value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Conversation() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Conversation value)  $default,){
final _that = this;
switch (_that) {
case _Conversation():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Conversation value)?  $default,){
final _that = this;
switch (_that) {
case _Conversation() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String applicationId,  ConversationVacancy vacancy,  ConversationCompany company,  Person seeker,  String side,  Message? lastMessage,  DateTime? lastMessageAt,  int unread,  int readUpTo,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Conversation() when $default != null:
return $default(_that.id,_that.applicationId,_that.vacancy,_that.company,_that.seeker,_that.side,_that.lastMessage,_that.lastMessageAt,_that.unread,_that.readUpTo,_that.createdAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String applicationId,  ConversationVacancy vacancy,  ConversationCompany company,  Person seeker,  String side,  Message? lastMessage,  DateTime? lastMessageAt,  int unread,  int readUpTo,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _Conversation():
return $default(_that.id,_that.applicationId,_that.vacancy,_that.company,_that.seeker,_that.side,_that.lastMessage,_that.lastMessageAt,_that.unread,_that.readUpTo,_that.createdAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String applicationId,  ConversationVacancy vacancy,  ConversationCompany company,  Person seeker,  String side,  Message? lastMessage,  DateTime? lastMessageAt,  int unread,  int readUpTo,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _Conversation() when $default != null:
return $default(_that.id,_that.applicationId,_that.vacancy,_that.company,_that.seeker,_that.side,_that.lastMessage,_that.lastMessageAt,_that.unread,_that.readUpTo,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Conversation extends Conversation {
  const _Conversation({required this.id, required this.applicationId, required this.vacancy, required this.company, required this.seeker, required this.side, this.lastMessage, this.lastMessageAt, this.unread = 0, this.readUpTo = 0, required this.createdAt}): super._();
  factory _Conversation.fromJson(Map<String, dynamic> json) => _$ConversationFromJson(json);

@override final  String id;
@override final  String applicationId;
@override final  ConversationVacancy vacancy;
@override final  ConversationCompany company;
@override final  Person seeker;
@override final  String side;
@override final  Message? lastMessage;
@override final  DateTime? lastMessageAt;
@override@JsonKey() final  int unread;
@override@JsonKey() final  int readUpTo;
@override final  DateTime createdAt;

/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConversationCopyWith<_Conversation> get copyWith => __$ConversationCopyWithImpl<_Conversation>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConversationToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Conversation&&(identical(other.id, id) || other.id == id)&&(identical(other.applicationId, applicationId) || other.applicationId == applicationId)&&(identical(other.vacancy, vacancy) || other.vacancy == vacancy)&&(identical(other.company, company) || other.company == company)&&(identical(other.seeker, seeker) || other.seeker == seeker)&&(identical(other.side, side) || other.side == side)&&(identical(other.lastMessage, lastMessage) || other.lastMessage == lastMessage)&&(identical(other.lastMessageAt, lastMessageAt) || other.lastMessageAt == lastMessageAt)&&(identical(other.unread, unread) || other.unread == unread)&&(identical(other.readUpTo, readUpTo) || other.readUpTo == readUpTo)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,applicationId,vacancy,company,seeker,side,lastMessage,lastMessageAt,unread,readUpTo,createdAt);

@override
String toString() {
  return 'Conversation(id: $id, applicationId: $applicationId, vacancy: $vacancy, company: $company, seeker: $seeker, side: $side, lastMessage: $lastMessage, lastMessageAt: $lastMessageAt, unread: $unread, readUpTo: $readUpTo, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$ConversationCopyWith<$Res> implements $ConversationCopyWith<$Res> {
  factory _$ConversationCopyWith(_Conversation value, $Res Function(_Conversation) _then) = __$ConversationCopyWithImpl;
@override @useResult
$Res call({
 String id, String applicationId, ConversationVacancy vacancy, ConversationCompany company, Person seeker, String side, Message? lastMessage, DateTime? lastMessageAt, int unread, int readUpTo, DateTime createdAt
});


@override $ConversationVacancyCopyWith<$Res> get vacancy;@override $ConversationCompanyCopyWith<$Res> get company;@override $PersonCopyWith<$Res> get seeker;@override $MessageCopyWith<$Res>? get lastMessage;

}
/// @nodoc
class __$ConversationCopyWithImpl<$Res>
    implements _$ConversationCopyWith<$Res> {
  __$ConversationCopyWithImpl(this._self, this._then);

  final _Conversation _self;
  final $Res Function(_Conversation) _then;

/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? applicationId = null,Object? vacancy = null,Object? company = null,Object? seeker = null,Object? side = null,Object? lastMessage = freezed,Object? lastMessageAt = freezed,Object? unread = null,Object? readUpTo = null,Object? createdAt = null,}) {
  return _then(_Conversation(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,applicationId: null == applicationId ? _self.applicationId : applicationId // ignore: cast_nullable_to_non_nullable
as String,vacancy: null == vacancy ? _self.vacancy : vacancy // ignore: cast_nullable_to_non_nullable
as ConversationVacancy,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as ConversationCompany,seeker: null == seeker ? _self.seeker : seeker // ignore: cast_nullable_to_non_nullable
as Person,side: null == side ? _self.side : side // ignore: cast_nullable_to_non_nullable
as String,lastMessage: freezed == lastMessage ? _self.lastMessage : lastMessage // ignore: cast_nullable_to_non_nullable
as Message?,lastMessageAt: freezed == lastMessageAt ? _self.lastMessageAt : lastMessageAt // ignore: cast_nullable_to_non_nullable
as DateTime?,unread: null == unread ? _self.unread : unread // ignore: cast_nullable_to_non_nullable
as int,readUpTo: null == readUpTo ? _self.readUpTo : readUpTo // ignore: cast_nullable_to_non_nullable
as int,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConversationVacancyCopyWith<$Res> get vacancy {
  
  return $ConversationVacancyCopyWith<$Res>(_self.vacancy, (value) {
    return _then(_self.copyWith(vacancy: value));
  });
}/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConversationCompanyCopyWith<$Res> get company {
  
  return $ConversationCompanyCopyWith<$Res>(_self.company, (value) {
    return _then(_self.copyWith(company: value));
  });
}/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonCopyWith<$Res> get seeker {
  
  return $PersonCopyWith<$Res>(_self.seeker, (value) {
    return _then(_self.copyWith(seeker: value));
  });
}/// Create a copy of Conversation
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MessageCopyWith<$Res>? get lastMessage {
    if (_self.lastMessage == null) {
    return null;
  }

  return $MessageCopyWith<$Res>(_self.lastMessage!, (value) {
    return _then(_self.copyWith(lastMessage: value));
  });
}
}

// dart format on
