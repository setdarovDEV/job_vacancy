// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'names.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Names {

 String get uz;@JsonKey(name: 'uz-Cyrl') String get uzCyrl; String get ru; String get en;
/// Create a copy of Names
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NamesCopyWith<Names> get copyWith => _$NamesCopyWithImpl<Names>(this as Names, _$identity);

  /// Serializes this Names to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Names&&(identical(other.uz, uz) || other.uz == uz)&&(identical(other.uzCyrl, uzCyrl) || other.uzCyrl == uzCyrl)&&(identical(other.ru, ru) || other.ru == ru)&&(identical(other.en, en) || other.en == en));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,uz,uzCyrl,ru,en);

@override
String toString() {
  return 'Names(uz: $uz, uzCyrl: $uzCyrl, ru: $ru, en: $en)';
}


}

/// @nodoc
abstract mixin class $NamesCopyWith<$Res>  {
  factory $NamesCopyWith(Names value, $Res Function(Names) _then) = _$NamesCopyWithImpl;
@useResult
$Res call({
 String uz,@JsonKey(name: 'uz-Cyrl') String uzCyrl, String ru, String en
});




}
/// @nodoc
class _$NamesCopyWithImpl<$Res>
    implements $NamesCopyWith<$Res> {
  _$NamesCopyWithImpl(this._self, this._then);

  final Names _self;
  final $Res Function(Names) _then;

/// Create a copy of Names
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? uz = null,Object? uzCyrl = null,Object? ru = null,Object? en = null,}) {
  return _then(_self.copyWith(
uz: null == uz ? _self.uz : uz // ignore: cast_nullable_to_non_nullable
as String,uzCyrl: null == uzCyrl ? _self.uzCyrl : uzCyrl // ignore: cast_nullable_to_non_nullable
as String,ru: null == ru ? _self.ru : ru // ignore: cast_nullable_to_non_nullable
as String,en: null == en ? _self.en : en // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [Names].
extension NamesPatterns on Names {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Names value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Names() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Names value)  $default,){
final _that = this;
switch (_that) {
case _Names():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Names value)?  $default,){
final _that = this;
switch (_that) {
case _Names() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String uz, @JsonKey(name: 'uz-Cyrl')  String uzCyrl,  String ru,  String en)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Names() when $default != null:
return $default(_that.uz,_that.uzCyrl,_that.ru,_that.en);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String uz, @JsonKey(name: 'uz-Cyrl')  String uzCyrl,  String ru,  String en)  $default,) {final _that = this;
switch (_that) {
case _Names():
return $default(_that.uz,_that.uzCyrl,_that.ru,_that.en);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String uz, @JsonKey(name: 'uz-Cyrl')  String uzCyrl,  String ru,  String en)?  $default,) {final _that = this;
switch (_that) {
case _Names() when $default != null:
return $default(_that.uz,_that.uzCyrl,_that.ru,_that.en);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Names extends Names {
  const _Names({required this.uz, @JsonKey(name: 'uz-Cyrl') required this.uzCyrl, required this.ru, required this.en}): super._();
  factory _Names.fromJson(Map<String, dynamic> json) => _$NamesFromJson(json);

@override final  String uz;
@override@JsonKey(name: 'uz-Cyrl') final  String uzCyrl;
@override final  String ru;
@override final  String en;

/// Create a copy of Names
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NamesCopyWith<_Names> get copyWith => __$NamesCopyWithImpl<_Names>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NamesToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Names&&(identical(other.uz, uz) || other.uz == uz)&&(identical(other.uzCyrl, uzCyrl) || other.uzCyrl == uzCyrl)&&(identical(other.ru, ru) || other.ru == ru)&&(identical(other.en, en) || other.en == en));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,uz,uzCyrl,ru,en);

@override
String toString() {
  return 'Names(uz: $uz, uzCyrl: $uzCyrl, ru: $ru, en: $en)';
}


}

/// @nodoc
abstract mixin class _$NamesCopyWith<$Res> implements $NamesCopyWith<$Res> {
  factory _$NamesCopyWith(_Names value, $Res Function(_Names) _then) = __$NamesCopyWithImpl;
@override @useResult
$Res call({
 String uz,@JsonKey(name: 'uz-Cyrl') String uzCyrl, String ru, String en
});




}
/// @nodoc
class __$NamesCopyWithImpl<$Res>
    implements _$NamesCopyWith<$Res> {
  __$NamesCopyWithImpl(this._self, this._then);

  final _Names _self;
  final $Res Function(_Names) _then;

/// Create a copy of Names
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? uz = null,Object? uzCyrl = null,Object? ru = null,Object? en = null,}) {
  return _then(_Names(
uz: null == uz ? _self.uz : uz // ignore: cast_nullable_to_non_nullable
as String,uzCyrl: null == uzCyrl ? _self.uzCyrl : uzCyrl // ignore: cast_nullable_to_non_nullable
as String,ru: null == ru ? _self.ru : ru // ignore: cast_nullable_to_non_nullable
as String,en: null == en ? _self.en : en // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
