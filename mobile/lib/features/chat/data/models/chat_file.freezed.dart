// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'chat_file.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ChatFile {

 String get id; String get contentType; int get size; String get name; String? get url; Map<String, Object?>? get meta;
/// Create a copy of ChatFile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ChatFileCopyWith<ChatFile> get copyWith => _$ChatFileCopyWithImpl<ChatFile>(this as ChatFile, _$identity);

  /// Serializes this ChatFile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ChatFile&&(identical(other.id, id) || other.id == id)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.size, size) || other.size == size)&&(identical(other.name, name) || other.name == name)&&(identical(other.url, url) || other.url == url)&&const DeepCollectionEquality().equals(other.meta, meta));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,contentType,size,name,url,const DeepCollectionEquality().hash(meta));

@override
String toString() {
  return 'ChatFile(id: $id, contentType: $contentType, size: $size, name: $name, url: $url, meta: $meta)';
}


}

/// @nodoc
abstract mixin class $ChatFileCopyWith<$Res>  {
  factory $ChatFileCopyWith(ChatFile value, $Res Function(ChatFile) _then) = _$ChatFileCopyWithImpl;
@useResult
$Res call({
 String id, String contentType, int size, String name, String? url, Map<String, Object?>? meta
});




}
/// @nodoc
class _$ChatFileCopyWithImpl<$Res>
    implements $ChatFileCopyWith<$Res> {
  _$ChatFileCopyWithImpl(this._self, this._then);

  final ChatFile _self;
  final $Res Function(ChatFile) _then;

/// Create a copy of ChatFile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? contentType = null,Object? size = null,Object? name = null,Object? url = freezed,Object? meta = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,url: freezed == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String?,meta: freezed == meta ? _self.meta : meta // ignore: cast_nullable_to_non_nullable
as Map<String, Object?>?,
  ));
}

}


/// Adds pattern-matching-related methods to [ChatFile].
extension ChatFilePatterns on ChatFile {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ChatFile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ChatFile() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ChatFile value)  $default,){
final _that = this;
switch (_that) {
case _ChatFile():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ChatFile value)?  $default,){
final _that = this;
switch (_that) {
case _ChatFile() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String contentType,  int size,  String name,  String? url,  Map<String, Object?>? meta)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ChatFile() when $default != null:
return $default(_that.id,_that.contentType,_that.size,_that.name,_that.url,_that.meta);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String contentType,  int size,  String name,  String? url,  Map<String, Object?>? meta)  $default,) {final _that = this;
switch (_that) {
case _ChatFile():
return $default(_that.id,_that.contentType,_that.size,_that.name,_that.url,_that.meta);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String contentType,  int size,  String name,  String? url,  Map<String, Object?>? meta)?  $default,) {final _that = this;
switch (_that) {
case _ChatFile() when $default != null:
return $default(_that.id,_that.contentType,_that.size,_that.name,_that.url,_that.meta);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ChatFile extends ChatFile {
  const _ChatFile({required this.id, required this.contentType, required this.size, required this.name, this.url, final  Map<String, Object?>? meta}): _meta = meta,super._();
  factory _ChatFile.fromJson(Map<String, dynamic> json) => _$ChatFileFromJson(json);

@override final  String id;
@override final  String contentType;
@override final  int size;
@override final  String name;
@override final  String? url;
 final  Map<String, Object?>? _meta;
@override Map<String, Object?>? get meta {
  final value = _meta;
  if (value == null) return null;
  if (_meta is EqualUnmodifiableMapView) return _meta;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}


/// Create a copy of ChatFile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ChatFileCopyWith<_ChatFile> get copyWith => __$ChatFileCopyWithImpl<_ChatFile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ChatFileToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ChatFile&&(identical(other.id, id) || other.id == id)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.size, size) || other.size == size)&&(identical(other.name, name) || other.name == name)&&(identical(other.url, url) || other.url == url)&&const DeepCollectionEquality().equals(other._meta, _meta));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,contentType,size,name,url,const DeepCollectionEquality().hash(_meta));

@override
String toString() {
  return 'ChatFile(id: $id, contentType: $contentType, size: $size, name: $name, url: $url, meta: $meta)';
}


}

/// @nodoc
abstract mixin class _$ChatFileCopyWith<$Res> implements $ChatFileCopyWith<$Res> {
  factory _$ChatFileCopyWith(_ChatFile value, $Res Function(_ChatFile) _then) = __$ChatFileCopyWithImpl;
@override @useResult
$Res call({
 String id, String contentType, int size, String name, String? url, Map<String, Object?>? meta
});




}
/// @nodoc
class __$ChatFileCopyWithImpl<$Res>
    implements _$ChatFileCopyWith<$Res> {
  __$ChatFileCopyWithImpl(this._self, this._then);

  final _ChatFile _self;
  final $Res Function(_ChatFile) _then;

/// Create a copy of ChatFile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? contentType = null,Object? size = null,Object? name = null,Object? url = freezed,Object? meta = freezed,}) {
  return _then(_ChatFile(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,url: freezed == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String?,meta: freezed == meta ? _self._meta : meta // ignore: cast_nullable_to_non_nullable
as Map<String, Object?>?,
  ));
}


}

// dart format on
