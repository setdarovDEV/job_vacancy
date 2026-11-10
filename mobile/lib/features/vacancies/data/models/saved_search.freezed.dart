// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'saved_search.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SavedSearch {

 String get id; String get name; String get params; bool get notify; DateTime get createdAt;
/// Create a copy of SavedSearch
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SavedSearchCopyWith<SavedSearch> get copyWith => _$SavedSearchCopyWithImpl<SavedSearch>(this as SavedSearch, _$identity);

  /// Serializes this SavedSearch to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SavedSearch&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.params, params) || other.params == params)&&(identical(other.notify, notify) || other.notify == notify)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,params,notify,createdAt);

@override
String toString() {
  return 'SavedSearch(id: $id, name: $name, params: $params, notify: $notify, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $SavedSearchCopyWith<$Res>  {
  factory $SavedSearchCopyWith(SavedSearch value, $Res Function(SavedSearch) _then) = _$SavedSearchCopyWithImpl;
@useResult
$Res call({
 String id, String name, String params, bool notify, DateTime createdAt
});




}
/// @nodoc
class _$SavedSearchCopyWithImpl<$Res>
    implements $SavedSearchCopyWith<$Res> {
  _$SavedSearchCopyWithImpl(this._self, this._then);

  final SavedSearch _self;
  final $Res Function(SavedSearch) _then;

/// Create a copy of SavedSearch
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? params = null,Object? notify = null,Object? createdAt = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,params: null == params ? _self.params : params // ignore: cast_nullable_to_non_nullable
as String,notify: null == notify ? _self.notify : notify // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [SavedSearch].
extension SavedSearchPatterns on SavedSearch {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SavedSearch value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SavedSearch() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SavedSearch value)  $default,){
final _that = this;
switch (_that) {
case _SavedSearch():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SavedSearch value)?  $default,){
final _that = this;
switch (_that) {
case _SavedSearch() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String params,  bool notify,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SavedSearch() when $default != null:
return $default(_that.id,_that.name,_that.params,_that.notify,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String params,  bool notify,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _SavedSearch():
return $default(_that.id,_that.name,_that.params,_that.notify,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String params,  bool notify,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _SavedSearch() when $default != null:
return $default(_that.id,_that.name,_that.params,_that.notify,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SavedSearch extends SavedSearch {
  const _SavedSearch({required this.id, required this.name, required this.params, this.notify = false, required this.createdAt}): super._();
  factory _SavedSearch.fromJson(Map<String, dynamic> json) => _$SavedSearchFromJson(json);

@override final  String id;
@override final  String name;
@override final  String params;
@override@JsonKey() final  bool notify;
@override final  DateTime createdAt;

/// Create a copy of SavedSearch
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SavedSearchCopyWith<_SavedSearch> get copyWith => __$SavedSearchCopyWithImpl<_SavedSearch>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SavedSearchToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SavedSearch&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.params, params) || other.params == params)&&(identical(other.notify, notify) || other.notify == notify)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,params,notify,createdAt);

@override
String toString() {
  return 'SavedSearch(id: $id, name: $name, params: $params, notify: $notify, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$SavedSearchCopyWith<$Res> implements $SavedSearchCopyWith<$Res> {
  factory _$SavedSearchCopyWith(_SavedSearch value, $Res Function(_SavedSearch) _then) = __$SavedSearchCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String params, bool notify, DateTime createdAt
});




}
/// @nodoc
class __$SavedSearchCopyWithImpl<$Res>
    implements _$SavedSearchCopyWith<$Res> {
  __$SavedSearchCopyWithImpl(this._self, this._then);

  final _SavedSearch _self;
  final $Res Function(_SavedSearch) _then;

/// Create a copy of SavedSearch
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? params = null,Object? notify = null,Object? createdAt = null,}) {
  return _then(_SavedSearch(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,params: null == params ? _self.params : params // ignore: cast_nullable_to_non_nullable
as String,notify: null == notify ? _self.notify : notify // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}

// dart format on
