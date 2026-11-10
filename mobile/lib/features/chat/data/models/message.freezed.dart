// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'message.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$MessageLocation {

 double get lat; double get lng; String? get name;
/// Create a copy of MessageLocation
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MessageLocationCopyWith<MessageLocation> get copyWith => _$MessageLocationCopyWithImpl<MessageLocation>(this as MessageLocation, _$identity);

  /// Serializes this MessageLocation to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MessageLocation&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,lat,lng,name);

@override
String toString() {
  return 'MessageLocation(lat: $lat, lng: $lng, name: $name)';
}


}

/// @nodoc
abstract mixin class $MessageLocationCopyWith<$Res>  {
  factory $MessageLocationCopyWith(MessageLocation value, $Res Function(MessageLocation) _then) = _$MessageLocationCopyWithImpl;
@useResult
$Res call({
 double lat, double lng, String? name
});




}
/// @nodoc
class _$MessageLocationCopyWithImpl<$Res>
    implements $MessageLocationCopyWith<$Res> {
  _$MessageLocationCopyWithImpl(this._self, this._then);

  final MessageLocation _self;
  final $Res Function(MessageLocation) _then;

/// Create a copy of MessageLocation
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? lat = null,Object? lng = null,Object? name = freezed,}) {
  return _then(_self.copyWith(
lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MessageLocation].
extension MessageLocationPatterns on MessageLocation {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MessageLocation value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MessageLocation() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MessageLocation value)  $default,){
final _that = this;
switch (_that) {
case _MessageLocation():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MessageLocation value)?  $default,){
final _that = this;
switch (_that) {
case _MessageLocation() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( double lat,  double lng,  String? name)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MessageLocation() when $default != null:
return $default(_that.lat,_that.lng,_that.name);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( double lat,  double lng,  String? name)  $default,) {final _that = this;
switch (_that) {
case _MessageLocation():
return $default(_that.lat,_that.lng,_that.name);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( double lat,  double lng,  String? name)?  $default,) {final _that = this;
switch (_that) {
case _MessageLocation() when $default != null:
return $default(_that.lat,_that.lng,_that.name);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MessageLocation extends MessageLocation {
  const _MessageLocation({required this.lat, required this.lng, this.name}): super._();
  factory _MessageLocation.fromJson(Map<String, dynamic> json) => _$MessageLocationFromJson(json);

@override final  double lat;
@override final  double lng;
@override final  String? name;

/// Create a copy of MessageLocation
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MessageLocationCopyWith<_MessageLocation> get copyWith => __$MessageLocationCopyWithImpl<_MessageLocation>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MessageLocationToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MessageLocation&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,lat,lng,name);

@override
String toString() {
  return 'MessageLocation(lat: $lat, lng: $lng, name: $name)';
}


}

/// @nodoc
abstract mixin class _$MessageLocationCopyWith<$Res> implements $MessageLocationCopyWith<$Res> {
  factory _$MessageLocationCopyWith(_MessageLocation value, $Res Function(_MessageLocation) _then) = __$MessageLocationCopyWithImpl;
@override @useResult
$Res call({
 double lat, double lng, String? name
});




}
/// @nodoc
class __$MessageLocationCopyWithImpl<$Res>
    implements _$MessageLocationCopyWith<$Res> {
  __$MessageLocationCopyWithImpl(this._self, this._then);

  final _MessageLocation _self;
  final $Res Function(_MessageLocation) _then;

/// Create a copy of MessageLocation
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? lat = null,Object? lng = null,Object? name = freezed,}) {
  return _then(_MessageLocation(
lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$Message {

 int get id; String get conversationId; Person? get sender; MessageKind get kind; String get body; ChatFile? get file; MessageLocation? get location; String get clientId; DateTime get createdAt; bool get deleted;/// Client-only: message is still being sent.
 bool get pending;/// Client-only: sending failed.
 bool get failed;
/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MessageCopyWith<Message> get copyWith => _$MessageCopyWithImpl<Message>(this as Message, _$identity);

  /// Serializes this Message to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Message&&(identical(other.id, id) || other.id == id)&&(identical(other.conversationId, conversationId) || other.conversationId == conversationId)&&(identical(other.sender, sender) || other.sender == sender)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.body, body) || other.body == body)&&(identical(other.file, file) || other.file == file)&&(identical(other.location, location) || other.location == location)&&(identical(other.clientId, clientId) || other.clientId == clientId)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.deleted, deleted) || other.deleted == deleted)&&(identical(other.pending, pending) || other.pending == pending)&&(identical(other.failed, failed) || other.failed == failed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,conversationId,sender,kind,body,file,location,clientId,createdAt,deleted,pending,failed);

@override
String toString() {
  return 'Message(id: $id, conversationId: $conversationId, sender: $sender, kind: $kind, body: $body, file: $file, location: $location, clientId: $clientId, createdAt: $createdAt, deleted: $deleted, pending: $pending, failed: $failed)';
}


}

/// @nodoc
abstract mixin class $MessageCopyWith<$Res>  {
  factory $MessageCopyWith(Message value, $Res Function(Message) _then) = _$MessageCopyWithImpl;
@useResult
$Res call({
 int id, String conversationId, Person? sender, MessageKind kind, String body, ChatFile? file, MessageLocation? location, String clientId, DateTime createdAt, bool deleted, bool pending, bool failed
});


$PersonCopyWith<$Res>? get sender;$ChatFileCopyWith<$Res>? get file;$MessageLocationCopyWith<$Res>? get location;

}
/// @nodoc
class _$MessageCopyWithImpl<$Res>
    implements $MessageCopyWith<$Res> {
  _$MessageCopyWithImpl(this._self, this._then);

  final Message _self;
  final $Res Function(Message) _then;

/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? conversationId = null,Object? sender = freezed,Object? kind = null,Object? body = null,Object? file = freezed,Object? location = freezed,Object? clientId = null,Object? createdAt = null,Object? deleted = null,Object? pending = null,Object? failed = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,conversationId: null == conversationId ? _self.conversationId : conversationId // ignore: cast_nullable_to_non_nullable
as String,sender: freezed == sender ? _self.sender : sender // ignore: cast_nullable_to_non_nullable
as Person?,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as MessageKind,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,file: freezed == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as ChatFile?,location: freezed == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as MessageLocation?,clientId: null == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,deleted: null == deleted ? _self.deleted : deleted // ignore: cast_nullable_to_non_nullable
as bool,pending: null == pending ? _self.pending : pending // ignore: cast_nullable_to_non_nullable
as bool,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}
/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonCopyWith<$Res>? get sender {
    if (_self.sender == null) {
    return null;
  }

  return $PersonCopyWith<$Res>(_self.sender!, (value) {
    return _then(_self.copyWith(sender: value));
  });
}/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ChatFileCopyWith<$Res>? get file {
    if (_self.file == null) {
    return null;
  }

  return $ChatFileCopyWith<$Res>(_self.file!, (value) {
    return _then(_self.copyWith(file: value));
  });
}/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MessageLocationCopyWith<$Res>? get location {
    if (_self.location == null) {
    return null;
  }

  return $MessageLocationCopyWith<$Res>(_self.location!, (value) {
    return _then(_self.copyWith(location: value));
  });
}
}


/// Adds pattern-matching-related methods to [Message].
extension MessagePatterns on Message {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Message value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Message() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Message value)  $default,){
final _that = this;
switch (_that) {
case _Message():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Message value)?  $default,){
final _that = this;
switch (_that) {
case _Message() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String conversationId,  Person? sender,  MessageKind kind,  String body,  ChatFile? file,  MessageLocation? location,  String clientId,  DateTime createdAt,  bool deleted,  bool pending,  bool failed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Message() when $default != null:
return $default(_that.id,_that.conversationId,_that.sender,_that.kind,_that.body,_that.file,_that.location,_that.clientId,_that.createdAt,_that.deleted,_that.pending,_that.failed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String conversationId,  Person? sender,  MessageKind kind,  String body,  ChatFile? file,  MessageLocation? location,  String clientId,  DateTime createdAt,  bool deleted,  bool pending,  bool failed)  $default,) {final _that = this;
switch (_that) {
case _Message():
return $default(_that.id,_that.conversationId,_that.sender,_that.kind,_that.body,_that.file,_that.location,_that.clientId,_that.createdAt,_that.deleted,_that.pending,_that.failed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String conversationId,  Person? sender,  MessageKind kind,  String body,  ChatFile? file,  MessageLocation? location,  String clientId,  DateTime createdAt,  bool deleted,  bool pending,  bool failed)?  $default,) {final _that = this;
switch (_that) {
case _Message() when $default != null:
return $default(_that.id,_that.conversationId,_that.sender,_that.kind,_that.body,_that.file,_that.location,_that.clientId,_that.createdAt,_that.deleted,_that.pending,_that.failed);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Message extends Message {
  const _Message({required this.id, required this.conversationId, this.sender, required this.kind, this.body = '', this.file, this.location, required this.clientId, required this.createdAt, this.deleted = false, this.pending = false, this.failed = false}): super._();
  factory _Message.fromJson(Map<String, dynamic> json) => _$MessageFromJson(json);

@override final  int id;
@override final  String conversationId;
@override final  Person? sender;
@override final  MessageKind kind;
@override@JsonKey() final  String body;
@override final  ChatFile? file;
@override final  MessageLocation? location;
@override final  String clientId;
@override final  DateTime createdAt;
@override@JsonKey() final  bool deleted;
/// Client-only: message is still being sent.
@override@JsonKey() final  bool pending;
/// Client-only: sending failed.
@override@JsonKey() final  bool failed;

/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MessageCopyWith<_Message> get copyWith => __$MessageCopyWithImpl<_Message>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MessageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Message&&(identical(other.id, id) || other.id == id)&&(identical(other.conversationId, conversationId) || other.conversationId == conversationId)&&(identical(other.sender, sender) || other.sender == sender)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.body, body) || other.body == body)&&(identical(other.file, file) || other.file == file)&&(identical(other.location, location) || other.location == location)&&(identical(other.clientId, clientId) || other.clientId == clientId)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.deleted, deleted) || other.deleted == deleted)&&(identical(other.pending, pending) || other.pending == pending)&&(identical(other.failed, failed) || other.failed == failed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,conversationId,sender,kind,body,file,location,clientId,createdAt,deleted,pending,failed);

@override
String toString() {
  return 'Message(id: $id, conversationId: $conversationId, sender: $sender, kind: $kind, body: $body, file: $file, location: $location, clientId: $clientId, createdAt: $createdAt, deleted: $deleted, pending: $pending, failed: $failed)';
}


}

/// @nodoc
abstract mixin class _$MessageCopyWith<$Res> implements $MessageCopyWith<$Res> {
  factory _$MessageCopyWith(_Message value, $Res Function(_Message) _then) = __$MessageCopyWithImpl;
@override @useResult
$Res call({
 int id, String conversationId, Person? sender, MessageKind kind, String body, ChatFile? file, MessageLocation? location, String clientId, DateTime createdAt, bool deleted, bool pending, bool failed
});


@override $PersonCopyWith<$Res>? get sender;@override $ChatFileCopyWith<$Res>? get file;@override $MessageLocationCopyWith<$Res>? get location;

}
/// @nodoc
class __$MessageCopyWithImpl<$Res>
    implements _$MessageCopyWith<$Res> {
  __$MessageCopyWithImpl(this._self, this._then);

  final _Message _self;
  final $Res Function(_Message) _then;

/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? conversationId = null,Object? sender = freezed,Object? kind = null,Object? body = null,Object? file = freezed,Object? location = freezed,Object? clientId = null,Object? createdAt = null,Object? deleted = null,Object? pending = null,Object? failed = null,}) {
  return _then(_Message(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,conversationId: null == conversationId ? _self.conversationId : conversationId // ignore: cast_nullable_to_non_nullable
as String,sender: freezed == sender ? _self.sender : sender // ignore: cast_nullable_to_non_nullable
as Person?,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as MessageKind,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,file: freezed == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as ChatFile?,location: freezed == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as MessageLocation?,clientId: null == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,deleted: null == deleted ? _self.deleted : deleted // ignore: cast_nullable_to_non_nullable
as bool,pending: null == pending ? _self.pending : pending // ignore: cast_nullable_to_non_nullable
as bool,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonCopyWith<$Res>? get sender {
    if (_self.sender == null) {
    return null;
  }

  return $PersonCopyWith<$Res>(_self.sender!, (value) {
    return _then(_self.copyWith(sender: value));
  });
}/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ChatFileCopyWith<$Res>? get file {
    if (_self.file == null) {
    return null;
  }

  return $ChatFileCopyWith<$Res>(_self.file!, (value) {
    return _then(_self.copyWith(file: value));
  });
}/// Create a copy of Message
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MessageLocationCopyWith<$Res>? get location {
    if (_self.location == null) {
    return null;
  }

  return $MessageLocationCopyWith<$Res>(_self.location!, (value) {
    return _then(_self.copyWith(location: value));
  });
}
}

// dart format on
