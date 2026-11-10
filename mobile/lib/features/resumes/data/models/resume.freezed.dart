// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'resume.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ResumePerson {

 String get id; String get fullName; String? get avatarUrl;
/// Create a copy of ResumePerson
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumePersonCopyWith<ResumePerson> get copyWith => _$ResumePersonCopyWithImpl<ResumePerson>(this as ResumePerson, _$identity);

  /// Serializes this ResumePerson to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumePerson&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.avatarUrl, avatarUrl) || other.avatarUrl == avatarUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,avatarUrl);

@override
String toString() {
  return 'ResumePerson(id: $id, fullName: $fullName, avatarUrl: $avatarUrl)';
}


}

/// @nodoc
abstract mixin class $ResumePersonCopyWith<$Res>  {
  factory $ResumePersonCopyWith(ResumePerson value, $Res Function(ResumePerson) _then) = _$ResumePersonCopyWithImpl;
@useResult
$Res call({
 String id, String fullName, String? avatarUrl
});




}
/// @nodoc
class _$ResumePersonCopyWithImpl<$Res>
    implements $ResumePersonCopyWith<$Res> {
  _$ResumePersonCopyWithImpl(this._self, this._then);

  final ResumePerson _self;
  final $Res Function(ResumePerson) _then;

/// Create a copy of ResumePerson
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? fullName = null,Object? avatarUrl = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,avatarUrl: freezed == avatarUrl ? _self.avatarUrl : avatarUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumePerson].
extension ResumePersonPatterns on ResumePerson {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumePerson value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumePerson() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumePerson value)  $default,){
final _that = this;
switch (_that) {
case _ResumePerson():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumePerson value)?  $default,){
final _that = this;
switch (_that) {
case _ResumePerson() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String fullName,  String? avatarUrl)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumePerson() when $default != null:
return $default(_that.id,_that.fullName,_that.avatarUrl);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String fullName,  String? avatarUrl)  $default,) {final _that = this;
switch (_that) {
case _ResumePerson():
return $default(_that.id,_that.fullName,_that.avatarUrl);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String fullName,  String? avatarUrl)?  $default,) {final _that = this;
switch (_that) {
case _ResumePerson() when $default != null:
return $default(_that.id,_that.fullName,_that.avatarUrl);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumePerson extends ResumePerson {
  const _ResumePerson({required this.id, required this.fullName, this.avatarUrl}): super._();
  factory _ResumePerson.fromJson(Map<String, dynamic> json) => _$ResumePersonFromJson(json);

@override final  String id;
@override final  String fullName;
@override final  String? avatarUrl;

/// Create a copy of ResumePerson
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumePersonCopyWith<_ResumePerson> get copyWith => __$ResumePersonCopyWithImpl<_ResumePerson>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumePersonToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumePerson&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.avatarUrl, avatarUrl) || other.avatarUrl == avatarUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,avatarUrl);

@override
String toString() {
  return 'ResumePerson(id: $id, fullName: $fullName, avatarUrl: $avatarUrl)';
}


}

/// @nodoc
abstract mixin class _$ResumePersonCopyWith<$Res> implements $ResumePersonCopyWith<$Res> {
  factory _$ResumePersonCopyWith(_ResumePerson value, $Res Function(_ResumePerson) _then) = __$ResumePersonCopyWithImpl;
@override @useResult
$Res call({
 String id, String fullName, String? avatarUrl
});




}
/// @nodoc
class __$ResumePersonCopyWithImpl<$Res>
    implements _$ResumePersonCopyWith<$Res> {
  __$ResumePersonCopyWithImpl(this._self, this._then);

  final _ResumePerson _self;
  final $Res Function(_ResumePerson) _then;

/// Create a copy of ResumePerson
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? fullName = null,Object? avatarUrl = freezed,}) {
  return _then(_ResumePerson(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,avatarUrl: freezed == avatarUrl ? _self.avatarUrl : avatarUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$ResumeSalary {

 int get amount; String get currency;
/// Create a copy of ResumeSalary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeSalaryCopyWith<ResumeSalary> get copyWith => _$ResumeSalaryCopyWithImpl<ResumeSalary>(this as ResumeSalary, _$identity);

  /// Serializes this ResumeSalary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeSalary&&(identical(other.amount, amount) || other.amount == amount)&&(identical(other.currency, currency) || other.currency == currency));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,amount,currency);

@override
String toString() {
  return 'ResumeSalary(amount: $amount, currency: $currency)';
}


}

/// @nodoc
abstract mixin class $ResumeSalaryCopyWith<$Res>  {
  factory $ResumeSalaryCopyWith(ResumeSalary value, $Res Function(ResumeSalary) _then) = _$ResumeSalaryCopyWithImpl;
@useResult
$Res call({
 int amount, String currency
});




}
/// @nodoc
class _$ResumeSalaryCopyWithImpl<$Res>
    implements $ResumeSalaryCopyWith<$Res> {
  _$ResumeSalaryCopyWithImpl(this._self, this._then);

  final ResumeSalary _self;
  final $Res Function(ResumeSalary) _then;

/// Create a copy of ResumeSalary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? amount = null,Object? currency = null,}) {
  return _then(_self.copyWith(
amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as int,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumeSalary].
extension ResumeSalaryPatterns on ResumeSalary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeSalary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeSalary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeSalary value)  $default,){
final _that = this;
switch (_that) {
case _ResumeSalary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeSalary value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeSalary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int amount,  String currency)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeSalary() when $default != null:
return $default(_that.amount,_that.currency);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int amount,  String currency)  $default,) {final _that = this;
switch (_that) {
case _ResumeSalary():
return $default(_that.amount,_that.currency);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int amount,  String currency)?  $default,) {final _that = this;
switch (_that) {
case _ResumeSalary() when $default != null:
return $default(_that.amount,_that.currency);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeSalary extends ResumeSalary {
  const _ResumeSalary({required this.amount, this.currency = 'UZS'}): super._();
  factory _ResumeSalary.fromJson(Map<String, dynamic> json) => _$ResumeSalaryFromJson(json);

@override final  int amount;
@override@JsonKey() final  String currency;

/// Create a copy of ResumeSalary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeSalaryCopyWith<_ResumeSalary> get copyWith => __$ResumeSalaryCopyWithImpl<_ResumeSalary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeSalaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeSalary&&(identical(other.amount, amount) || other.amount == amount)&&(identical(other.currency, currency) || other.currency == currency));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,amount,currency);

@override
String toString() {
  return 'ResumeSalary(amount: $amount, currency: $currency)';
}


}

/// @nodoc
abstract mixin class _$ResumeSalaryCopyWith<$Res> implements $ResumeSalaryCopyWith<$Res> {
  factory _$ResumeSalaryCopyWith(_ResumeSalary value, $Res Function(_ResumeSalary) _then) = __$ResumeSalaryCopyWithImpl;
@override @useResult
$Res call({
 int amount, String currency
});




}
/// @nodoc
class __$ResumeSalaryCopyWithImpl<$Res>
    implements _$ResumeSalaryCopyWith<$Res> {
  __$ResumeSalaryCopyWithImpl(this._self, this._then);

  final _ResumeSalary _self;
  final $Res Function(_ResumeSalary) _then;

/// Create a copy of ResumeSalary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? amount = null,Object? currency = null,}) {
  return _then(_ResumeSalary(
amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as int,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ResumeLastJob {

 String get position; String get company; bool get current;
/// Create a copy of ResumeLastJob
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeLastJobCopyWith<ResumeLastJob> get copyWith => _$ResumeLastJobCopyWithImpl<ResumeLastJob>(this as ResumeLastJob, _$identity);

  /// Serializes this ResumeLastJob to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeLastJob&&(identical(other.position, position) || other.position == position)&&(identical(other.company, company) || other.company == company)&&(identical(other.current, current) || other.current == current));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,position,company,current);

@override
String toString() {
  return 'ResumeLastJob(position: $position, company: $company, current: $current)';
}


}

/// @nodoc
abstract mixin class $ResumeLastJobCopyWith<$Res>  {
  factory $ResumeLastJobCopyWith(ResumeLastJob value, $Res Function(ResumeLastJob) _then) = _$ResumeLastJobCopyWithImpl;
@useResult
$Res call({
 String position, String company, bool current
});




}
/// @nodoc
class _$ResumeLastJobCopyWithImpl<$Res>
    implements $ResumeLastJobCopyWith<$Res> {
  _$ResumeLastJobCopyWithImpl(this._self, this._then);

  final ResumeLastJob _self;
  final $Res Function(ResumeLastJob) _then;

/// Create a copy of ResumeLastJob
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? position = null,Object? company = null,Object? current = null,}) {
  return _then(_self.copyWith(
position: null == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as String,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as String,current: null == current ? _self.current : current // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumeLastJob].
extension ResumeLastJobPatterns on ResumeLastJob {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeLastJob value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeLastJob() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeLastJob value)  $default,){
final _that = this;
switch (_that) {
case _ResumeLastJob():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeLastJob value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeLastJob() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String position,  String company,  bool current)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeLastJob() when $default != null:
return $default(_that.position,_that.company,_that.current);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String position,  String company,  bool current)  $default,) {final _that = this;
switch (_that) {
case _ResumeLastJob():
return $default(_that.position,_that.company,_that.current);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String position,  String company,  bool current)?  $default,) {final _that = this;
switch (_that) {
case _ResumeLastJob() when $default != null:
return $default(_that.position,_that.company,_that.current);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeLastJob extends ResumeLastJob {
  const _ResumeLastJob({required this.position, required this.company, this.current = false}): super._();
  factory _ResumeLastJob.fromJson(Map<String, dynamic> json) => _$ResumeLastJobFromJson(json);

@override final  String position;
@override final  String company;
@override@JsonKey() final  bool current;

/// Create a copy of ResumeLastJob
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeLastJobCopyWith<_ResumeLastJob> get copyWith => __$ResumeLastJobCopyWithImpl<_ResumeLastJob>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeLastJobToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeLastJob&&(identical(other.position, position) || other.position == position)&&(identical(other.company, company) || other.company == company)&&(identical(other.current, current) || other.current == current));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,position,company,current);

@override
String toString() {
  return 'ResumeLastJob(position: $position, company: $company, current: $current)';
}


}

/// @nodoc
abstract mixin class _$ResumeLastJobCopyWith<$Res> implements $ResumeLastJobCopyWith<$Res> {
  factory _$ResumeLastJobCopyWith(_ResumeLastJob value, $Res Function(_ResumeLastJob) _then) = __$ResumeLastJobCopyWithImpl;
@override @useResult
$Res call({
 String position, String company, bool current
});




}
/// @nodoc
class __$ResumeLastJobCopyWithImpl<$Res>
    implements _$ResumeLastJobCopyWith<$Res> {
  __$ResumeLastJobCopyWithImpl(this._self, this._then);

  final _ResumeLastJob _self;
  final $Res Function(_ResumeLastJob) _then;

/// Create a copy of ResumeLastJob
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? position = null,Object? company = null,Object? current = null,}) {
  return _then(_ResumeLastJob(
position: null == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as String,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as String,current: null == current ? _self.current : current // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$ResumeExperience {

 String get company; String get position; String get start; String? get end; String? get description;
/// Create a copy of ResumeExperience
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeExperienceCopyWith<ResumeExperience> get copyWith => _$ResumeExperienceCopyWithImpl<ResumeExperience>(this as ResumeExperience, _$identity);

  /// Serializes this ResumeExperience to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeExperience&&(identical(other.company, company) || other.company == company)&&(identical(other.position, position) || other.position == position)&&(identical(other.start, start) || other.start == start)&&(identical(other.end, end) || other.end == end)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,company,position,start,end,description);

@override
String toString() {
  return 'ResumeExperience(company: $company, position: $position, start: $start, end: $end, description: $description)';
}


}

/// @nodoc
abstract mixin class $ResumeExperienceCopyWith<$Res>  {
  factory $ResumeExperienceCopyWith(ResumeExperience value, $Res Function(ResumeExperience) _then) = _$ResumeExperienceCopyWithImpl;
@useResult
$Res call({
 String company, String position, String start, String? end, String? description
});




}
/// @nodoc
class _$ResumeExperienceCopyWithImpl<$Res>
    implements $ResumeExperienceCopyWith<$Res> {
  _$ResumeExperienceCopyWithImpl(this._self, this._then);

  final ResumeExperience _self;
  final $Res Function(ResumeExperience) _then;

/// Create a copy of ResumeExperience
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? company = null,Object? position = null,Object? start = null,Object? end = freezed,Object? description = freezed,}) {
  return _then(_self.copyWith(
company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as String,position: null == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as String,start: null == start ? _self.start : start // ignore: cast_nullable_to_non_nullable
as String,end: freezed == end ? _self.end : end // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumeExperience].
extension ResumeExperiencePatterns on ResumeExperience {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeExperience value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeExperience() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeExperience value)  $default,){
final _that = this;
switch (_that) {
case _ResumeExperience():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeExperience value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeExperience() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String company,  String position,  String start,  String? end,  String? description)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeExperience() when $default != null:
return $default(_that.company,_that.position,_that.start,_that.end,_that.description);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String company,  String position,  String start,  String? end,  String? description)  $default,) {final _that = this;
switch (_that) {
case _ResumeExperience():
return $default(_that.company,_that.position,_that.start,_that.end,_that.description);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String company,  String position,  String start,  String? end,  String? description)?  $default,) {final _that = this;
switch (_that) {
case _ResumeExperience() when $default != null:
return $default(_that.company,_that.position,_that.start,_that.end,_that.description);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeExperience extends ResumeExperience {
  const _ResumeExperience({required this.company, required this.position, required this.start, this.end, this.description}): super._();
  factory _ResumeExperience.fromJson(Map<String, dynamic> json) => _$ResumeExperienceFromJson(json);

@override final  String company;
@override final  String position;
@override final  String start;
@override final  String? end;
@override final  String? description;

/// Create a copy of ResumeExperience
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeExperienceCopyWith<_ResumeExperience> get copyWith => __$ResumeExperienceCopyWithImpl<_ResumeExperience>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeExperienceToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeExperience&&(identical(other.company, company) || other.company == company)&&(identical(other.position, position) || other.position == position)&&(identical(other.start, start) || other.start == start)&&(identical(other.end, end) || other.end == end)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,company,position,start,end,description);

@override
String toString() {
  return 'ResumeExperience(company: $company, position: $position, start: $start, end: $end, description: $description)';
}


}

/// @nodoc
abstract mixin class _$ResumeExperienceCopyWith<$Res> implements $ResumeExperienceCopyWith<$Res> {
  factory _$ResumeExperienceCopyWith(_ResumeExperience value, $Res Function(_ResumeExperience) _then) = __$ResumeExperienceCopyWithImpl;
@override @useResult
$Res call({
 String company, String position, String start, String? end, String? description
});




}
/// @nodoc
class __$ResumeExperienceCopyWithImpl<$Res>
    implements _$ResumeExperienceCopyWith<$Res> {
  __$ResumeExperienceCopyWithImpl(this._self, this._then);

  final _ResumeExperience _self;
  final $Res Function(_ResumeExperience) _then;

/// Create a copy of ResumeExperience
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? company = null,Object? position = null,Object? start = null,Object? end = freezed,Object? description = freezed,}) {
  return _then(_ResumeExperience(
company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as String,position: null == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as String,start: null == start ? _self.start : start // ignore: cast_nullable_to_non_nullable
as String,end: freezed == end ? _self.end : end // ignore: cast_nullable_to_non_nullable
as String?,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$ResumeEducation {

 String get institution; ResumeEducationLevel get level; String? get field; int? get startYear; int? get endYear;
/// Create a copy of ResumeEducation
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeEducationCopyWith<ResumeEducation> get copyWith => _$ResumeEducationCopyWithImpl<ResumeEducation>(this as ResumeEducation, _$identity);

  /// Serializes this ResumeEducation to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeEducation&&(identical(other.institution, institution) || other.institution == institution)&&(identical(other.level, level) || other.level == level)&&(identical(other.field, field) || other.field == field)&&(identical(other.startYear, startYear) || other.startYear == startYear)&&(identical(other.endYear, endYear) || other.endYear == endYear));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,institution,level,field,startYear,endYear);

@override
String toString() {
  return 'ResumeEducation(institution: $institution, level: $level, field: $field, startYear: $startYear, endYear: $endYear)';
}


}

/// @nodoc
abstract mixin class $ResumeEducationCopyWith<$Res>  {
  factory $ResumeEducationCopyWith(ResumeEducation value, $Res Function(ResumeEducation) _then) = _$ResumeEducationCopyWithImpl;
@useResult
$Res call({
 String institution, ResumeEducationLevel level, String? field, int? startYear, int? endYear
});




}
/// @nodoc
class _$ResumeEducationCopyWithImpl<$Res>
    implements $ResumeEducationCopyWith<$Res> {
  _$ResumeEducationCopyWithImpl(this._self, this._then);

  final ResumeEducation _self;
  final $Res Function(ResumeEducation) _then;

/// Create a copy of ResumeEducation
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? institution = null,Object? level = null,Object? field = freezed,Object? startYear = freezed,Object? endYear = freezed,}) {
  return _then(_self.copyWith(
institution: null == institution ? _self.institution : institution // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as ResumeEducationLevel,field: freezed == field ? _self.field : field // ignore: cast_nullable_to_non_nullable
as String?,startYear: freezed == startYear ? _self.startYear : startYear // ignore: cast_nullable_to_non_nullable
as int?,endYear: freezed == endYear ? _self.endYear : endYear // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumeEducation].
extension ResumeEducationPatterns on ResumeEducation {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeEducation value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeEducation() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeEducation value)  $default,){
final _that = this;
switch (_that) {
case _ResumeEducation():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeEducation value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeEducation() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String institution,  ResumeEducationLevel level,  String? field,  int? startYear,  int? endYear)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeEducation() when $default != null:
return $default(_that.institution,_that.level,_that.field,_that.startYear,_that.endYear);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String institution,  ResumeEducationLevel level,  String? field,  int? startYear,  int? endYear)  $default,) {final _that = this;
switch (_that) {
case _ResumeEducation():
return $default(_that.institution,_that.level,_that.field,_that.startYear,_that.endYear);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String institution,  ResumeEducationLevel level,  String? field,  int? startYear,  int? endYear)?  $default,) {final _that = this;
switch (_that) {
case _ResumeEducation() when $default != null:
return $default(_that.institution,_that.level,_that.field,_that.startYear,_that.endYear);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeEducation extends ResumeEducation {
  const _ResumeEducation({required this.institution, required this.level, this.field, this.startYear, this.endYear}): super._();
  factory _ResumeEducation.fromJson(Map<String, dynamic> json) => _$ResumeEducationFromJson(json);

@override final  String institution;
@override final  ResumeEducationLevel level;
@override final  String? field;
@override final  int? startYear;
@override final  int? endYear;

/// Create a copy of ResumeEducation
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeEducationCopyWith<_ResumeEducation> get copyWith => __$ResumeEducationCopyWithImpl<_ResumeEducation>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeEducationToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeEducation&&(identical(other.institution, institution) || other.institution == institution)&&(identical(other.level, level) || other.level == level)&&(identical(other.field, field) || other.field == field)&&(identical(other.startYear, startYear) || other.startYear == startYear)&&(identical(other.endYear, endYear) || other.endYear == endYear));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,institution,level,field,startYear,endYear);

@override
String toString() {
  return 'ResumeEducation(institution: $institution, level: $level, field: $field, startYear: $startYear, endYear: $endYear)';
}


}

/// @nodoc
abstract mixin class _$ResumeEducationCopyWith<$Res> implements $ResumeEducationCopyWith<$Res> {
  factory _$ResumeEducationCopyWith(_ResumeEducation value, $Res Function(_ResumeEducation) _then) = __$ResumeEducationCopyWithImpl;
@override @useResult
$Res call({
 String institution, ResumeEducationLevel level, String? field, int? startYear, int? endYear
});




}
/// @nodoc
class __$ResumeEducationCopyWithImpl<$Res>
    implements _$ResumeEducationCopyWith<$Res> {
  __$ResumeEducationCopyWithImpl(this._self, this._then);

  final _ResumeEducation _self;
  final $Res Function(_ResumeEducation) _then;

/// Create a copy of ResumeEducation
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? institution = null,Object? level = null,Object? field = freezed,Object? startYear = freezed,Object? endYear = freezed,}) {
  return _then(_ResumeEducation(
institution: null == institution ? _self.institution : institution // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as ResumeEducationLevel,field: freezed == field ? _self.field : field // ignore: cast_nullable_to_non_nullable
as String?,startYear: freezed == startYear ? _self.startYear : startYear // ignore: cast_nullable_to_non_nullable
as int?,endYear: freezed == endYear ? _self.endYear : endYear // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$ResumeLanguage {

 String get language; ResumeLanguageLevel get level;
/// Create a copy of ResumeLanguage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeLanguageCopyWith<ResumeLanguage> get copyWith => _$ResumeLanguageCopyWithImpl<ResumeLanguage>(this as ResumeLanguage, _$identity);

  /// Serializes this ResumeLanguage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeLanguage&&(identical(other.language, language) || other.language == language)&&(identical(other.level, level) || other.level == level));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,language,level);

@override
String toString() {
  return 'ResumeLanguage(language: $language, level: $level)';
}


}

/// @nodoc
abstract mixin class $ResumeLanguageCopyWith<$Res>  {
  factory $ResumeLanguageCopyWith(ResumeLanguage value, $Res Function(ResumeLanguage) _then) = _$ResumeLanguageCopyWithImpl;
@useResult
$Res call({
 String language, ResumeLanguageLevel level
});




}
/// @nodoc
class _$ResumeLanguageCopyWithImpl<$Res>
    implements $ResumeLanguageCopyWith<$Res> {
  _$ResumeLanguageCopyWithImpl(this._self, this._then);

  final ResumeLanguage _self;
  final $Res Function(ResumeLanguage) _then;

/// Create a copy of ResumeLanguage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? language = null,Object? level = null,}) {
  return _then(_self.copyWith(
language: null == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as ResumeLanguageLevel,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumeLanguage].
extension ResumeLanguagePatterns on ResumeLanguage {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeLanguage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeLanguage() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeLanguage value)  $default,){
final _that = this;
switch (_that) {
case _ResumeLanguage():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeLanguage value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeLanguage() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String language,  ResumeLanguageLevel level)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeLanguage() when $default != null:
return $default(_that.language,_that.level);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String language,  ResumeLanguageLevel level)  $default,) {final _that = this;
switch (_that) {
case _ResumeLanguage():
return $default(_that.language,_that.level);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String language,  ResumeLanguageLevel level)?  $default,) {final _that = this;
switch (_that) {
case _ResumeLanguage() when $default != null:
return $default(_that.language,_that.level);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeLanguage extends ResumeLanguage {
  const _ResumeLanguage({required this.language, required this.level}): super._();
  factory _ResumeLanguage.fromJson(Map<String, dynamic> json) => _$ResumeLanguageFromJson(json);

@override final  String language;
@override final  ResumeLanguageLevel level;

/// Create a copy of ResumeLanguage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeLanguageCopyWith<_ResumeLanguage> get copyWith => __$ResumeLanguageCopyWithImpl<_ResumeLanguage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeLanguageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeLanguage&&(identical(other.language, language) || other.language == language)&&(identical(other.level, level) || other.level == level));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,language,level);

@override
String toString() {
  return 'ResumeLanguage(language: $language, level: $level)';
}


}

/// @nodoc
abstract mixin class _$ResumeLanguageCopyWith<$Res> implements $ResumeLanguageCopyWith<$Res> {
  factory _$ResumeLanguageCopyWith(_ResumeLanguage value, $Res Function(_ResumeLanguage) _then) = __$ResumeLanguageCopyWithImpl;
@override @useResult
$Res call({
 String language, ResumeLanguageLevel level
});




}
/// @nodoc
class __$ResumeLanguageCopyWithImpl<$Res>
    implements _$ResumeLanguageCopyWith<$Res> {
  __$ResumeLanguageCopyWithImpl(this._self, this._then);

  final _ResumeLanguage _self;
  final $Res Function(_ResumeLanguage) _then;

/// Create a copy of ResumeLanguage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? language = null,Object? level = null,}) {
  return _then(_ResumeLanguage(
language: null == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as ResumeLanguageLevel,
  ));
}


}


/// @nodoc
mixin _$ResumeContacts {

 String? get email; String? get phone;
/// Create a copy of ResumeContacts
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeContactsCopyWith<ResumeContacts> get copyWith => _$ResumeContactsCopyWithImpl<ResumeContacts>(this as ResumeContacts, _$identity);

  /// Serializes this ResumeContacts to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeContacts&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,email,phone);

@override
String toString() {
  return 'ResumeContacts(email: $email, phone: $phone)';
}


}

/// @nodoc
abstract mixin class $ResumeContactsCopyWith<$Res>  {
  factory $ResumeContactsCopyWith(ResumeContacts value, $Res Function(ResumeContacts) _then) = _$ResumeContactsCopyWithImpl;
@useResult
$Res call({
 String? email, String? phone
});




}
/// @nodoc
class _$ResumeContactsCopyWithImpl<$Res>
    implements $ResumeContactsCopyWith<$Res> {
  _$ResumeContactsCopyWithImpl(this._self, this._then);

  final ResumeContacts _self;
  final $Res Function(ResumeContacts) _then;

/// Create a copy of ResumeContacts
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? email = freezed,Object? phone = freezed,}) {
  return _then(_self.copyWith(
email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumeContacts].
extension ResumeContactsPatterns on ResumeContacts {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeContacts value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeContacts() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeContacts value)  $default,){
final _that = this;
switch (_that) {
case _ResumeContacts():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeContacts value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeContacts() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? email,  String? phone)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeContacts() when $default != null:
return $default(_that.email,_that.phone);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? email,  String? phone)  $default,) {final _that = this;
switch (_that) {
case _ResumeContacts():
return $default(_that.email,_that.phone);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? email,  String? phone)?  $default,) {final _that = this;
switch (_that) {
case _ResumeContacts() when $default != null:
return $default(_that.email,_that.phone);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeContacts extends ResumeContacts {
  const _ResumeContacts({this.email, this.phone}): super._();
  factory _ResumeContacts.fromJson(Map<String, dynamic> json) => _$ResumeContactsFromJson(json);

@override final  String? email;
@override final  String? phone;

/// Create a copy of ResumeContacts
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeContactsCopyWith<_ResumeContacts> get copyWith => __$ResumeContactsCopyWithImpl<_ResumeContacts>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeContactsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeContacts&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,email,phone);

@override
String toString() {
  return 'ResumeContacts(email: $email, phone: $phone)';
}


}

/// @nodoc
abstract mixin class _$ResumeContactsCopyWith<$Res> implements $ResumeContactsCopyWith<$Res> {
  factory _$ResumeContactsCopyWith(_ResumeContacts value, $Res Function(_ResumeContacts) _then) = __$ResumeContactsCopyWithImpl;
@override @useResult
$Res call({
 String? email, String? phone
});




}
/// @nodoc
class __$ResumeContactsCopyWithImpl<$Res>
    implements _$ResumeContactsCopyWith<$Res> {
  __$ResumeContactsCopyWithImpl(this._self, this._then);

  final _ResumeContacts _self;
  final $Res Function(_ResumeContacts) _then;

/// Create a copy of ResumeContacts
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? email = freezed,Object? phone = freezed,}) {
  return _then(_ResumeContacts(
email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$ResumeCard {

 String get id; String get title; ResumePerson get person; int? get categoryId; int? get regionId; bool get relocate; int get experienceMonths; ResumeSalary? get desiredSalary; ResumeLastJob? get lastJob; List<Skill> get skills; ResumeVisibility get visibility; DateTime get updatedAt;
/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeCardCopyWith<ResumeCard> get copyWith => _$ResumeCardCopyWithImpl<ResumeCard>(this as ResumeCard, _$identity);

  /// Serializes this ResumeCard to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeCard&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.person, person) || other.person == person)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.relocate, relocate) || other.relocate == relocate)&&(identical(other.experienceMonths, experienceMonths) || other.experienceMonths == experienceMonths)&&(identical(other.desiredSalary, desiredSalary) || other.desiredSalary == desiredSalary)&&(identical(other.lastJob, lastJob) || other.lastJob == lastJob)&&const DeepCollectionEquality().equals(other.skills, skills)&&(identical(other.visibility, visibility) || other.visibility == visibility)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,person,categoryId,regionId,relocate,experienceMonths,desiredSalary,lastJob,const DeepCollectionEquality().hash(skills),visibility,updatedAt);

@override
String toString() {
  return 'ResumeCard(id: $id, title: $title, person: $person, categoryId: $categoryId, regionId: $regionId, relocate: $relocate, experienceMonths: $experienceMonths, desiredSalary: $desiredSalary, lastJob: $lastJob, skills: $skills, visibility: $visibility, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $ResumeCardCopyWith<$Res>  {
  factory $ResumeCardCopyWith(ResumeCard value, $Res Function(ResumeCard) _then) = _$ResumeCardCopyWithImpl;
@useResult
$Res call({
 String id, String title, ResumePerson person, int? categoryId, int? regionId, bool relocate, int experienceMonths, ResumeSalary? desiredSalary, ResumeLastJob? lastJob, List<Skill> skills, ResumeVisibility visibility, DateTime updatedAt
});


$ResumePersonCopyWith<$Res> get person;$ResumeSalaryCopyWith<$Res>? get desiredSalary;$ResumeLastJobCopyWith<$Res>? get lastJob;

}
/// @nodoc
class _$ResumeCardCopyWithImpl<$Res>
    implements $ResumeCardCopyWith<$Res> {
  _$ResumeCardCopyWithImpl(this._self, this._then);

  final ResumeCard _self;
  final $Res Function(ResumeCard) _then;

/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? person = null,Object? categoryId = freezed,Object? regionId = freezed,Object? relocate = null,Object? experienceMonths = null,Object? desiredSalary = freezed,Object? lastJob = freezed,Object? skills = null,Object? visibility = null,Object? updatedAt = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,person: null == person ? _self.person : person // ignore: cast_nullable_to_non_nullable
as ResumePerson,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,relocate: null == relocate ? _self.relocate : relocate // ignore: cast_nullable_to_non_nullable
as bool,experienceMonths: null == experienceMonths ? _self.experienceMonths : experienceMonths // ignore: cast_nullable_to_non_nullable
as int,desiredSalary: freezed == desiredSalary ? _self.desiredSalary : desiredSalary // ignore: cast_nullable_to_non_nullable
as ResumeSalary?,lastJob: freezed == lastJob ? _self.lastJob : lastJob // ignore: cast_nullable_to_non_nullable
as ResumeLastJob?,skills: null == skills ? _self.skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,visibility: null == visibility ? _self.visibility : visibility // ignore: cast_nullable_to_non_nullable
as ResumeVisibility,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}
/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumePersonCopyWith<$Res> get person {
  
  return $ResumePersonCopyWith<$Res>(_self.person, (value) {
    return _then(_self.copyWith(person: value));
  });
}/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeSalaryCopyWith<$Res>? get desiredSalary {
    if (_self.desiredSalary == null) {
    return null;
  }

  return $ResumeSalaryCopyWith<$Res>(_self.desiredSalary!, (value) {
    return _then(_self.copyWith(desiredSalary: value));
  });
}/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeLastJobCopyWith<$Res>? get lastJob {
    if (_self.lastJob == null) {
    return null;
  }

  return $ResumeLastJobCopyWith<$Res>(_self.lastJob!, (value) {
    return _then(_self.copyWith(lastJob: value));
  });
}
}


/// Adds pattern-matching-related methods to [ResumeCard].
extension ResumeCardPatterns on ResumeCard {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeCard value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeCard() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeCard value)  $default,){
final _that = this;
switch (_that) {
case _ResumeCard():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeCard value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeCard() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  ResumePerson person,  int? categoryId,  int? regionId,  bool relocate,  int experienceMonths,  ResumeSalary? desiredSalary,  ResumeLastJob? lastJob,  List<Skill> skills,  ResumeVisibility visibility,  DateTime updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeCard() when $default != null:
return $default(_that.id,_that.title,_that.person,_that.categoryId,_that.regionId,_that.relocate,_that.experienceMonths,_that.desiredSalary,_that.lastJob,_that.skills,_that.visibility,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  ResumePerson person,  int? categoryId,  int? regionId,  bool relocate,  int experienceMonths,  ResumeSalary? desiredSalary,  ResumeLastJob? lastJob,  List<Skill> skills,  ResumeVisibility visibility,  DateTime updatedAt)  $default,) {final _that = this;
switch (_that) {
case _ResumeCard():
return $default(_that.id,_that.title,_that.person,_that.categoryId,_that.regionId,_that.relocate,_that.experienceMonths,_that.desiredSalary,_that.lastJob,_that.skills,_that.visibility,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  ResumePerson person,  int? categoryId,  int? regionId,  bool relocate,  int experienceMonths,  ResumeSalary? desiredSalary,  ResumeLastJob? lastJob,  List<Skill> skills,  ResumeVisibility visibility,  DateTime updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _ResumeCard() when $default != null:
return $default(_that.id,_that.title,_that.person,_that.categoryId,_that.regionId,_that.relocate,_that.experienceMonths,_that.desiredSalary,_that.lastJob,_that.skills,_that.visibility,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeCard extends ResumeCard {
  const _ResumeCard({required this.id, required this.title, required this.person, this.categoryId, this.regionId, this.relocate = false, this.experienceMonths = 0, this.desiredSalary, this.lastJob, final  List<Skill> skills = const [], this.visibility = ResumeVisibility.hidden, required this.updatedAt}): _skills = skills,super._();
  factory _ResumeCard.fromJson(Map<String, dynamic> json) => _$ResumeCardFromJson(json);

@override final  String id;
@override final  String title;
@override final  ResumePerson person;
@override final  int? categoryId;
@override final  int? regionId;
@override@JsonKey() final  bool relocate;
@override@JsonKey() final  int experienceMonths;
@override final  ResumeSalary? desiredSalary;
@override final  ResumeLastJob? lastJob;
 final  List<Skill> _skills;
@override@JsonKey() List<Skill> get skills {
  if (_skills is EqualUnmodifiableListView) return _skills;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_skills);
}

@override@JsonKey() final  ResumeVisibility visibility;
@override final  DateTime updatedAt;

/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeCardCopyWith<_ResumeCard> get copyWith => __$ResumeCardCopyWithImpl<_ResumeCard>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeCardToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeCard&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.person, person) || other.person == person)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.relocate, relocate) || other.relocate == relocate)&&(identical(other.experienceMonths, experienceMonths) || other.experienceMonths == experienceMonths)&&(identical(other.desiredSalary, desiredSalary) || other.desiredSalary == desiredSalary)&&(identical(other.lastJob, lastJob) || other.lastJob == lastJob)&&const DeepCollectionEquality().equals(other._skills, _skills)&&(identical(other.visibility, visibility) || other.visibility == visibility)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,person,categoryId,regionId,relocate,experienceMonths,desiredSalary,lastJob,const DeepCollectionEquality().hash(_skills),visibility,updatedAt);

@override
String toString() {
  return 'ResumeCard(id: $id, title: $title, person: $person, categoryId: $categoryId, regionId: $regionId, relocate: $relocate, experienceMonths: $experienceMonths, desiredSalary: $desiredSalary, lastJob: $lastJob, skills: $skills, visibility: $visibility, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$ResumeCardCopyWith<$Res> implements $ResumeCardCopyWith<$Res> {
  factory _$ResumeCardCopyWith(_ResumeCard value, $Res Function(_ResumeCard) _then) = __$ResumeCardCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, ResumePerson person, int? categoryId, int? regionId, bool relocate, int experienceMonths, ResumeSalary? desiredSalary, ResumeLastJob? lastJob, List<Skill> skills, ResumeVisibility visibility, DateTime updatedAt
});


@override $ResumePersonCopyWith<$Res> get person;@override $ResumeSalaryCopyWith<$Res>? get desiredSalary;@override $ResumeLastJobCopyWith<$Res>? get lastJob;

}
/// @nodoc
class __$ResumeCardCopyWithImpl<$Res>
    implements _$ResumeCardCopyWith<$Res> {
  __$ResumeCardCopyWithImpl(this._self, this._then);

  final _ResumeCard _self;
  final $Res Function(_ResumeCard) _then;

/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? person = null,Object? categoryId = freezed,Object? regionId = freezed,Object? relocate = null,Object? experienceMonths = null,Object? desiredSalary = freezed,Object? lastJob = freezed,Object? skills = null,Object? visibility = null,Object? updatedAt = null,}) {
  return _then(_ResumeCard(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,person: null == person ? _self.person : person // ignore: cast_nullable_to_non_nullable
as ResumePerson,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,relocate: null == relocate ? _self.relocate : relocate // ignore: cast_nullable_to_non_nullable
as bool,experienceMonths: null == experienceMonths ? _self.experienceMonths : experienceMonths // ignore: cast_nullable_to_non_nullable
as int,desiredSalary: freezed == desiredSalary ? _self.desiredSalary : desiredSalary // ignore: cast_nullable_to_non_nullable
as ResumeSalary?,lastJob: freezed == lastJob ? _self.lastJob : lastJob // ignore: cast_nullable_to_non_nullable
as ResumeLastJob?,skills: null == skills ? _self._skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,visibility: null == visibility ? _self.visibility : visibility // ignore: cast_nullable_to_non_nullable
as ResumeVisibility,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumePersonCopyWith<$Res> get person {
  
  return $ResumePersonCopyWith<$Res>(_self.person, (value) {
    return _then(_self.copyWith(person: value));
  });
}/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeSalaryCopyWith<$Res>? get desiredSalary {
    if (_self.desiredSalary == null) {
    return null;
  }

  return $ResumeSalaryCopyWith<$Res>(_self.desiredSalary!, (value) {
    return _then(_self.copyWith(desiredSalary: value));
  });
}/// Create a copy of ResumeCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeLastJobCopyWith<$Res>? get lastJob {
    if (_self.lastJob == null) {
    return null;
  }

  return $ResumeLastJobCopyWith<$Res>(_self.lastJob!, (value) {
    return _then(_self.copyWith(lastJob: value));
  });
}
}


/// @nodoc
mixin _$ResumeDetail {

 String get id; String get title; ResumePerson get person; int? get categoryId; int? get regionId; bool get relocate; int get experienceMonths; ResumeSalary? get desiredSalary; ResumeLastJob? get lastJob; List<Skill> get skills; ResumeVisibility get visibility; DateTime get updatedAt; String? get about; List<EmploymentType> get employmentTypes; List<WorkFormat> get workFormats; List<ResumeExperience> get experiences; List<ResumeEducation> get educations; List<ResumeLanguage> get languages; ResumeContacts? get contacts; bool get isOwner;
/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeDetailCopyWith<ResumeDetail> get copyWith => _$ResumeDetailCopyWithImpl<ResumeDetail>(this as ResumeDetail, _$identity);

  /// Serializes this ResumeDetail to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.person, person) || other.person == person)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.relocate, relocate) || other.relocate == relocate)&&(identical(other.experienceMonths, experienceMonths) || other.experienceMonths == experienceMonths)&&(identical(other.desiredSalary, desiredSalary) || other.desiredSalary == desiredSalary)&&(identical(other.lastJob, lastJob) || other.lastJob == lastJob)&&const DeepCollectionEquality().equals(other.skills, skills)&&(identical(other.visibility, visibility) || other.visibility == visibility)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.about, about) || other.about == about)&&const DeepCollectionEquality().equals(other.employmentTypes, employmentTypes)&&const DeepCollectionEquality().equals(other.workFormats, workFormats)&&const DeepCollectionEquality().equals(other.experiences, experiences)&&const DeepCollectionEquality().equals(other.educations, educations)&&const DeepCollectionEquality().equals(other.languages, languages)&&(identical(other.contacts, contacts) || other.contacts == contacts)&&(identical(other.isOwner, isOwner) || other.isOwner == isOwner));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,title,person,categoryId,regionId,relocate,experienceMonths,desiredSalary,lastJob,const DeepCollectionEquality().hash(skills),visibility,updatedAt,about,const DeepCollectionEquality().hash(employmentTypes),const DeepCollectionEquality().hash(workFormats),const DeepCollectionEquality().hash(experiences),const DeepCollectionEquality().hash(educations),const DeepCollectionEquality().hash(languages),contacts,isOwner]);

@override
String toString() {
  return 'ResumeDetail(id: $id, title: $title, person: $person, categoryId: $categoryId, regionId: $regionId, relocate: $relocate, experienceMonths: $experienceMonths, desiredSalary: $desiredSalary, lastJob: $lastJob, skills: $skills, visibility: $visibility, updatedAt: $updatedAt, about: $about, employmentTypes: $employmentTypes, workFormats: $workFormats, experiences: $experiences, educations: $educations, languages: $languages, contacts: $contacts, isOwner: $isOwner)';
}


}

/// @nodoc
abstract mixin class $ResumeDetailCopyWith<$Res>  {
  factory $ResumeDetailCopyWith(ResumeDetail value, $Res Function(ResumeDetail) _then) = _$ResumeDetailCopyWithImpl;
@useResult
$Res call({
 String id, String title, ResumePerson person, int? categoryId, int? regionId, bool relocate, int experienceMonths, ResumeSalary? desiredSalary, ResumeLastJob? lastJob, List<Skill> skills, ResumeVisibility visibility, DateTime updatedAt, String? about, List<EmploymentType> employmentTypes, List<WorkFormat> workFormats, List<ResumeExperience> experiences, List<ResumeEducation> educations, List<ResumeLanguage> languages, ResumeContacts? contacts, bool isOwner
});


$ResumePersonCopyWith<$Res> get person;$ResumeSalaryCopyWith<$Res>? get desiredSalary;$ResumeLastJobCopyWith<$Res>? get lastJob;$ResumeContactsCopyWith<$Res>? get contacts;

}
/// @nodoc
class _$ResumeDetailCopyWithImpl<$Res>
    implements $ResumeDetailCopyWith<$Res> {
  _$ResumeDetailCopyWithImpl(this._self, this._then);

  final ResumeDetail _self;
  final $Res Function(ResumeDetail) _then;

/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? person = null,Object? categoryId = freezed,Object? regionId = freezed,Object? relocate = null,Object? experienceMonths = null,Object? desiredSalary = freezed,Object? lastJob = freezed,Object? skills = null,Object? visibility = null,Object? updatedAt = null,Object? about = freezed,Object? employmentTypes = null,Object? workFormats = null,Object? experiences = null,Object? educations = null,Object? languages = null,Object? contacts = freezed,Object? isOwner = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,person: null == person ? _self.person : person // ignore: cast_nullable_to_non_nullable
as ResumePerson,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,relocate: null == relocate ? _self.relocate : relocate // ignore: cast_nullable_to_non_nullable
as bool,experienceMonths: null == experienceMonths ? _self.experienceMonths : experienceMonths // ignore: cast_nullable_to_non_nullable
as int,desiredSalary: freezed == desiredSalary ? _self.desiredSalary : desiredSalary // ignore: cast_nullable_to_non_nullable
as ResumeSalary?,lastJob: freezed == lastJob ? _self.lastJob : lastJob // ignore: cast_nullable_to_non_nullable
as ResumeLastJob?,skills: null == skills ? _self.skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,visibility: null == visibility ? _self.visibility : visibility // ignore: cast_nullable_to_non_nullable
as ResumeVisibility,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,employmentTypes: null == employmentTypes ? _self.employmentTypes : employmentTypes // ignore: cast_nullable_to_non_nullable
as List<EmploymentType>,workFormats: null == workFormats ? _self.workFormats : workFormats // ignore: cast_nullable_to_non_nullable
as List<WorkFormat>,experiences: null == experiences ? _self.experiences : experiences // ignore: cast_nullable_to_non_nullable
as List<ResumeExperience>,educations: null == educations ? _self.educations : educations // ignore: cast_nullable_to_non_nullable
as List<ResumeEducation>,languages: null == languages ? _self.languages : languages // ignore: cast_nullable_to_non_nullable
as List<ResumeLanguage>,contacts: freezed == contacts ? _self.contacts : contacts // ignore: cast_nullable_to_non_nullable
as ResumeContacts?,isOwner: null == isOwner ? _self.isOwner : isOwner // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}
/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumePersonCopyWith<$Res> get person {
  
  return $ResumePersonCopyWith<$Res>(_self.person, (value) {
    return _then(_self.copyWith(person: value));
  });
}/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeSalaryCopyWith<$Res>? get desiredSalary {
    if (_self.desiredSalary == null) {
    return null;
  }

  return $ResumeSalaryCopyWith<$Res>(_self.desiredSalary!, (value) {
    return _then(_self.copyWith(desiredSalary: value));
  });
}/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeLastJobCopyWith<$Res>? get lastJob {
    if (_self.lastJob == null) {
    return null;
  }

  return $ResumeLastJobCopyWith<$Res>(_self.lastJob!, (value) {
    return _then(_self.copyWith(lastJob: value));
  });
}/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeContactsCopyWith<$Res>? get contacts {
    if (_self.contacts == null) {
    return null;
  }

  return $ResumeContactsCopyWith<$Res>(_self.contacts!, (value) {
    return _then(_self.copyWith(contacts: value));
  });
}
}


/// Adds pattern-matching-related methods to [ResumeDetail].
extension ResumeDetailPatterns on ResumeDetail {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeDetail() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeDetail value)  $default,){
final _that = this;
switch (_that) {
case _ResumeDetail():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeDetail value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeDetail() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  ResumePerson person,  int? categoryId,  int? regionId,  bool relocate,  int experienceMonths,  ResumeSalary? desiredSalary,  ResumeLastJob? lastJob,  List<Skill> skills,  ResumeVisibility visibility,  DateTime updatedAt,  String? about,  List<EmploymentType> employmentTypes,  List<WorkFormat> workFormats,  List<ResumeExperience> experiences,  List<ResumeEducation> educations,  List<ResumeLanguage> languages,  ResumeContacts? contacts,  bool isOwner)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeDetail() when $default != null:
return $default(_that.id,_that.title,_that.person,_that.categoryId,_that.regionId,_that.relocate,_that.experienceMonths,_that.desiredSalary,_that.lastJob,_that.skills,_that.visibility,_that.updatedAt,_that.about,_that.employmentTypes,_that.workFormats,_that.experiences,_that.educations,_that.languages,_that.contacts,_that.isOwner);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  ResumePerson person,  int? categoryId,  int? regionId,  bool relocate,  int experienceMonths,  ResumeSalary? desiredSalary,  ResumeLastJob? lastJob,  List<Skill> skills,  ResumeVisibility visibility,  DateTime updatedAt,  String? about,  List<EmploymentType> employmentTypes,  List<WorkFormat> workFormats,  List<ResumeExperience> experiences,  List<ResumeEducation> educations,  List<ResumeLanguage> languages,  ResumeContacts? contacts,  bool isOwner)  $default,) {final _that = this;
switch (_that) {
case _ResumeDetail():
return $default(_that.id,_that.title,_that.person,_that.categoryId,_that.regionId,_that.relocate,_that.experienceMonths,_that.desiredSalary,_that.lastJob,_that.skills,_that.visibility,_that.updatedAt,_that.about,_that.employmentTypes,_that.workFormats,_that.experiences,_that.educations,_that.languages,_that.contacts,_that.isOwner);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  ResumePerson person,  int? categoryId,  int? regionId,  bool relocate,  int experienceMonths,  ResumeSalary? desiredSalary,  ResumeLastJob? lastJob,  List<Skill> skills,  ResumeVisibility visibility,  DateTime updatedAt,  String? about,  List<EmploymentType> employmentTypes,  List<WorkFormat> workFormats,  List<ResumeExperience> experiences,  List<ResumeEducation> educations,  List<ResumeLanguage> languages,  ResumeContacts? contacts,  bool isOwner)?  $default,) {final _that = this;
switch (_that) {
case _ResumeDetail() when $default != null:
return $default(_that.id,_that.title,_that.person,_that.categoryId,_that.regionId,_that.relocate,_that.experienceMonths,_that.desiredSalary,_that.lastJob,_that.skills,_that.visibility,_that.updatedAt,_that.about,_that.employmentTypes,_that.workFormats,_that.experiences,_that.educations,_that.languages,_that.contacts,_that.isOwner);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeDetail extends ResumeDetail {
  const _ResumeDetail({required this.id, required this.title, required this.person, this.categoryId, this.regionId, this.relocate = false, this.experienceMonths = 0, this.desiredSalary, this.lastJob, final  List<Skill> skills = const [], this.visibility = ResumeVisibility.hidden, required this.updatedAt, this.about, final  List<EmploymentType> employmentTypes = const [], final  List<WorkFormat> workFormats = const [], final  List<ResumeExperience> experiences = const [], final  List<ResumeEducation> educations = const [], final  List<ResumeLanguage> languages = const [], this.contacts, this.isOwner = false}): _skills = skills,_employmentTypes = employmentTypes,_workFormats = workFormats,_experiences = experiences,_educations = educations,_languages = languages,super._();
  factory _ResumeDetail.fromJson(Map<String, dynamic> json) => _$ResumeDetailFromJson(json);

@override final  String id;
@override final  String title;
@override final  ResumePerson person;
@override final  int? categoryId;
@override final  int? regionId;
@override@JsonKey() final  bool relocate;
@override@JsonKey() final  int experienceMonths;
@override final  ResumeSalary? desiredSalary;
@override final  ResumeLastJob? lastJob;
 final  List<Skill> _skills;
@override@JsonKey() List<Skill> get skills {
  if (_skills is EqualUnmodifiableListView) return _skills;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_skills);
}

@override@JsonKey() final  ResumeVisibility visibility;
@override final  DateTime updatedAt;
@override final  String? about;
 final  List<EmploymentType> _employmentTypes;
@override@JsonKey() List<EmploymentType> get employmentTypes {
  if (_employmentTypes is EqualUnmodifiableListView) return _employmentTypes;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_employmentTypes);
}

 final  List<WorkFormat> _workFormats;
@override@JsonKey() List<WorkFormat> get workFormats {
  if (_workFormats is EqualUnmodifiableListView) return _workFormats;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_workFormats);
}

 final  List<ResumeExperience> _experiences;
@override@JsonKey() List<ResumeExperience> get experiences {
  if (_experiences is EqualUnmodifiableListView) return _experiences;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_experiences);
}

 final  List<ResumeEducation> _educations;
@override@JsonKey() List<ResumeEducation> get educations {
  if (_educations is EqualUnmodifiableListView) return _educations;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_educations);
}

 final  List<ResumeLanguage> _languages;
@override@JsonKey() List<ResumeLanguage> get languages {
  if (_languages is EqualUnmodifiableListView) return _languages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_languages);
}

@override final  ResumeContacts? contacts;
@override@JsonKey() final  bool isOwner;

/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeDetailCopyWith<_ResumeDetail> get copyWith => __$ResumeDetailCopyWithImpl<_ResumeDetail>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeDetailToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.person, person) || other.person == person)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.relocate, relocate) || other.relocate == relocate)&&(identical(other.experienceMonths, experienceMonths) || other.experienceMonths == experienceMonths)&&(identical(other.desiredSalary, desiredSalary) || other.desiredSalary == desiredSalary)&&(identical(other.lastJob, lastJob) || other.lastJob == lastJob)&&const DeepCollectionEquality().equals(other._skills, _skills)&&(identical(other.visibility, visibility) || other.visibility == visibility)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.about, about) || other.about == about)&&const DeepCollectionEquality().equals(other._employmentTypes, _employmentTypes)&&const DeepCollectionEquality().equals(other._workFormats, _workFormats)&&const DeepCollectionEquality().equals(other._experiences, _experiences)&&const DeepCollectionEquality().equals(other._educations, _educations)&&const DeepCollectionEquality().equals(other._languages, _languages)&&(identical(other.contacts, contacts) || other.contacts == contacts)&&(identical(other.isOwner, isOwner) || other.isOwner == isOwner));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,title,person,categoryId,regionId,relocate,experienceMonths,desiredSalary,lastJob,const DeepCollectionEquality().hash(_skills),visibility,updatedAt,about,const DeepCollectionEquality().hash(_employmentTypes),const DeepCollectionEquality().hash(_workFormats),const DeepCollectionEquality().hash(_experiences),const DeepCollectionEquality().hash(_educations),const DeepCollectionEquality().hash(_languages),contacts,isOwner]);

@override
String toString() {
  return 'ResumeDetail(id: $id, title: $title, person: $person, categoryId: $categoryId, regionId: $regionId, relocate: $relocate, experienceMonths: $experienceMonths, desiredSalary: $desiredSalary, lastJob: $lastJob, skills: $skills, visibility: $visibility, updatedAt: $updatedAt, about: $about, employmentTypes: $employmentTypes, workFormats: $workFormats, experiences: $experiences, educations: $educations, languages: $languages, contacts: $contacts, isOwner: $isOwner)';
}


}

/// @nodoc
abstract mixin class _$ResumeDetailCopyWith<$Res> implements $ResumeDetailCopyWith<$Res> {
  factory _$ResumeDetailCopyWith(_ResumeDetail value, $Res Function(_ResumeDetail) _then) = __$ResumeDetailCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, ResumePerson person, int? categoryId, int? regionId, bool relocate, int experienceMonths, ResumeSalary? desiredSalary, ResumeLastJob? lastJob, List<Skill> skills, ResumeVisibility visibility, DateTime updatedAt, String? about, List<EmploymentType> employmentTypes, List<WorkFormat> workFormats, List<ResumeExperience> experiences, List<ResumeEducation> educations, List<ResumeLanguage> languages, ResumeContacts? contacts, bool isOwner
});


@override $ResumePersonCopyWith<$Res> get person;@override $ResumeSalaryCopyWith<$Res>? get desiredSalary;@override $ResumeLastJobCopyWith<$Res>? get lastJob;@override $ResumeContactsCopyWith<$Res>? get contacts;

}
/// @nodoc
class __$ResumeDetailCopyWithImpl<$Res>
    implements _$ResumeDetailCopyWith<$Res> {
  __$ResumeDetailCopyWithImpl(this._self, this._then);

  final _ResumeDetail _self;
  final $Res Function(_ResumeDetail) _then;

/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? person = null,Object? categoryId = freezed,Object? regionId = freezed,Object? relocate = null,Object? experienceMonths = null,Object? desiredSalary = freezed,Object? lastJob = freezed,Object? skills = null,Object? visibility = null,Object? updatedAt = null,Object? about = freezed,Object? employmentTypes = null,Object? workFormats = null,Object? experiences = null,Object? educations = null,Object? languages = null,Object? contacts = freezed,Object? isOwner = null,}) {
  return _then(_ResumeDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,person: null == person ? _self.person : person // ignore: cast_nullable_to_non_nullable
as ResumePerson,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,relocate: null == relocate ? _self.relocate : relocate // ignore: cast_nullable_to_non_nullable
as bool,experienceMonths: null == experienceMonths ? _self.experienceMonths : experienceMonths // ignore: cast_nullable_to_non_nullable
as int,desiredSalary: freezed == desiredSalary ? _self.desiredSalary : desiredSalary // ignore: cast_nullable_to_non_nullable
as ResumeSalary?,lastJob: freezed == lastJob ? _self.lastJob : lastJob // ignore: cast_nullable_to_non_nullable
as ResumeLastJob?,skills: null == skills ? _self._skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,visibility: null == visibility ? _self.visibility : visibility // ignore: cast_nullable_to_non_nullable
as ResumeVisibility,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,employmentTypes: null == employmentTypes ? _self._employmentTypes : employmentTypes // ignore: cast_nullable_to_non_nullable
as List<EmploymentType>,workFormats: null == workFormats ? _self._workFormats : workFormats // ignore: cast_nullable_to_non_nullable
as List<WorkFormat>,experiences: null == experiences ? _self._experiences : experiences // ignore: cast_nullable_to_non_nullable
as List<ResumeExperience>,educations: null == educations ? _self._educations : educations // ignore: cast_nullable_to_non_nullable
as List<ResumeEducation>,languages: null == languages ? _self._languages : languages // ignore: cast_nullable_to_non_nullable
as List<ResumeLanguage>,contacts: freezed == contacts ? _self.contacts : contacts // ignore: cast_nullable_to_non_nullable
as ResumeContacts?,isOwner: null == isOwner ? _self.isOwner : isOwner // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumePersonCopyWith<$Res> get person {
  
  return $ResumePersonCopyWith<$Res>(_self.person, (value) {
    return _then(_self.copyWith(person: value));
  });
}/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeSalaryCopyWith<$Res>? get desiredSalary {
    if (_self.desiredSalary == null) {
    return null;
  }

  return $ResumeSalaryCopyWith<$Res>(_self.desiredSalary!, (value) {
    return _then(_self.copyWith(desiredSalary: value));
  });
}/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeLastJobCopyWith<$Res>? get lastJob {
    if (_self.lastJob == null) {
    return null;
  }

  return $ResumeLastJobCopyWith<$Res>(_self.lastJob!, (value) {
    return _then(_self.copyWith(lastJob: value));
  });
}/// Create a copy of ResumeDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ResumeContactsCopyWith<$Res>? get contacts {
    if (_self.contacts == null) {
    return null;
  }

  return $ResumeContactsCopyWith<$Res>(_self.contacts!, (value) {
    return _then(_self.copyWith(contacts: value));
  });
}
}


/// @nodoc
mixin _$ResumeInput {

 String get title; String? get about; int? get categoryId; int? get regionId; bool get relocate; int? get desiredSalary; String get currency; List<EmploymentType> get employmentTypes; List<WorkFormat> get workFormats; ResumeVisibility get visibility; List<ResumeExperience> get experiences; List<ResumeEducation> get educations; List<String> get skills; List<ResumeLanguage> get languages;
/// Create a copy of ResumeInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResumeInputCopyWith<ResumeInput> get copyWith => _$ResumeInputCopyWithImpl<ResumeInput>(this as ResumeInput, _$identity);

  /// Serializes this ResumeInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResumeInput&&(identical(other.title, title) || other.title == title)&&(identical(other.about, about) || other.about == about)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.relocate, relocate) || other.relocate == relocate)&&(identical(other.desiredSalary, desiredSalary) || other.desiredSalary == desiredSalary)&&(identical(other.currency, currency) || other.currency == currency)&&const DeepCollectionEquality().equals(other.employmentTypes, employmentTypes)&&const DeepCollectionEquality().equals(other.workFormats, workFormats)&&(identical(other.visibility, visibility) || other.visibility == visibility)&&const DeepCollectionEquality().equals(other.experiences, experiences)&&const DeepCollectionEquality().equals(other.educations, educations)&&const DeepCollectionEquality().equals(other.skills, skills)&&const DeepCollectionEquality().equals(other.languages, languages));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,title,about,categoryId,regionId,relocate,desiredSalary,currency,const DeepCollectionEquality().hash(employmentTypes),const DeepCollectionEquality().hash(workFormats),visibility,const DeepCollectionEquality().hash(experiences),const DeepCollectionEquality().hash(educations),const DeepCollectionEquality().hash(skills),const DeepCollectionEquality().hash(languages));

@override
String toString() {
  return 'ResumeInput(title: $title, about: $about, categoryId: $categoryId, regionId: $regionId, relocate: $relocate, desiredSalary: $desiredSalary, currency: $currency, employmentTypes: $employmentTypes, workFormats: $workFormats, visibility: $visibility, experiences: $experiences, educations: $educations, skills: $skills, languages: $languages)';
}


}

/// @nodoc
abstract mixin class $ResumeInputCopyWith<$Res>  {
  factory $ResumeInputCopyWith(ResumeInput value, $Res Function(ResumeInput) _then) = _$ResumeInputCopyWithImpl;
@useResult
$Res call({
 String title, String? about, int? categoryId, int? regionId, bool relocate, int? desiredSalary, String currency, List<EmploymentType> employmentTypes, List<WorkFormat> workFormats, ResumeVisibility visibility, List<ResumeExperience> experiences, List<ResumeEducation> educations, List<String> skills, List<ResumeLanguage> languages
});




}
/// @nodoc
class _$ResumeInputCopyWithImpl<$Res>
    implements $ResumeInputCopyWith<$Res> {
  _$ResumeInputCopyWithImpl(this._self, this._then);

  final ResumeInput _self;
  final $Res Function(ResumeInput) _then;

/// Create a copy of ResumeInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? title = null,Object? about = freezed,Object? categoryId = freezed,Object? regionId = freezed,Object? relocate = null,Object? desiredSalary = freezed,Object? currency = null,Object? employmentTypes = null,Object? workFormats = null,Object? visibility = null,Object? experiences = null,Object? educations = null,Object? skills = null,Object? languages = null,}) {
  return _then(_self.copyWith(
title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,relocate: null == relocate ? _self.relocate : relocate // ignore: cast_nullable_to_non_nullable
as bool,desiredSalary: freezed == desiredSalary ? _self.desiredSalary : desiredSalary // ignore: cast_nullable_to_non_nullable
as int?,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,employmentTypes: null == employmentTypes ? _self.employmentTypes : employmentTypes // ignore: cast_nullable_to_non_nullable
as List<EmploymentType>,workFormats: null == workFormats ? _self.workFormats : workFormats // ignore: cast_nullable_to_non_nullable
as List<WorkFormat>,visibility: null == visibility ? _self.visibility : visibility // ignore: cast_nullable_to_non_nullable
as ResumeVisibility,experiences: null == experiences ? _self.experiences : experiences // ignore: cast_nullable_to_non_nullable
as List<ResumeExperience>,educations: null == educations ? _self.educations : educations // ignore: cast_nullable_to_non_nullable
as List<ResumeEducation>,skills: null == skills ? _self.skills : skills // ignore: cast_nullable_to_non_nullable
as List<String>,languages: null == languages ? _self.languages : languages // ignore: cast_nullable_to_non_nullable
as List<ResumeLanguage>,
  ));
}

}


/// Adds pattern-matching-related methods to [ResumeInput].
extension ResumeInputPatterns on ResumeInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResumeInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResumeInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResumeInput value)  $default,){
final _that = this;
switch (_that) {
case _ResumeInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResumeInput value)?  $default,){
final _that = this;
switch (_that) {
case _ResumeInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String title,  String? about,  int? categoryId,  int? regionId,  bool relocate,  int? desiredSalary,  String currency,  List<EmploymentType> employmentTypes,  List<WorkFormat> workFormats,  ResumeVisibility visibility,  List<ResumeExperience> experiences,  List<ResumeEducation> educations,  List<String> skills,  List<ResumeLanguage> languages)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResumeInput() when $default != null:
return $default(_that.title,_that.about,_that.categoryId,_that.regionId,_that.relocate,_that.desiredSalary,_that.currency,_that.employmentTypes,_that.workFormats,_that.visibility,_that.experiences,_that.educations,_that.skills,_that.languages);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String title,  String? about,  int? categoryId,  int? regionId,  bool relocate,  int? desiredSalary,  String currency,  List<EmploymentType> employmentTypes,  List<WorkFormat> workFormats,  ResumeVisibility visibility,  List<ResumeExperience> experiences,  List<ResumeEducation> educations,  List<String> skills,  List<ResumeLanguage> languages)  $default,) {final _that = this;
switch (_that) {
case _ResumeInput():
return $default(_that.title,_that.about,_that.categoryId,_that.regionId,_that.relocate,_that.desiredSalary,_that.currency,_that.employmentTypes,_that.workFormats,_that.visibility,_that.experiences,_that.educations,_that.skills,_that.languages);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String title,  String? about,  int? categoryId,  int? regionId,  bool relocate,  int? desiredSalary,  String currency,  List<EmploymentType> employmentTypes,  List<WorkFormat> workFormats,  ResumeVisibility visibility,  List<ResumeExperience> experiences,  List<ResumeEducation> educations,  List<String> skills,  List<ResumeLanguage> languages)?  $default,) {final _that = this;
switch (_that) {
case _ResumeInput() when $default != null:
return $default(_that.title,_that.about,_that.categoryId,_that.regionId,_that.relocate,_that.desiredSalary,_that.currency,_that.employmentTypes,_that.workFormats,_that.visibility,_that.experiences,_that.educations,_that.skills,_that.languages);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResumeInput extends ResumeInput {
  const _ResumeInput({required this.title, this.about, this.categoryId, this.regionId, this.relocate = false, this.desiredSalary, this.currency = 'UZS', final  List<EmploymentType> employmentTypes = const [], final  List<WorkFormat> workFormats = const [], this.visibility = ResumeVisibility.hidden, final  List<ResumeExperience> experiences = const [], final  List<ResumeEducation> educations = const [], final  List<String> skills = const [], final  List<ResumeLanguage> languages = const []}): _employmentTypes = employmentTypes,_workFormats = workFormats,_experiences = experiences,_educations = educations,_skills = skills,_languages = languages,super._();
  factory _ResumeInput.fromJson(Map<String, dynamic> json) => _$ResumeInputFromJson(json);

@override final  String title;
@override final  String? about;
@override final  int? categoryId;
@override final  int? regionId;
@override@JsonKey() final  bool relocate;
@override final  int? desiredSalary;
@override@JsonKey() final  String currency;
 final  List<EmploymentType> _employmentTypes;
@override@JsonKey() List<EmploymentType> get employmentTypes {
  if (_employmentTypes is EqualUnmodifiableListView) return _employmentTypes;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_employmentTypes);
}

 final  List<WorkFormat> _workFormats;
@override@JsonKey() List<WorkFormat> get workFormats {
  if (_workFormats is EqualUnmodifiableListView) return _workFormats;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_workFormats);
}

@override@JsonKey() final  ResumeVisibility visibility;
 final  List<ResumeExperience> _experiences;
@override@JsonKey() List<ResumeExperience> get experiences {
  if (_experiences is EqualUnmodifiableListView) return _experiences;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_experiences);
}

 final  List<ResumeEducation> _educations;
@override@JsonKey() List<ResumeEducation> get educations {
  if (_educations is EqualUnmodifiableListView) return _educations;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_educations);
}

 final  List<String> _skills;
@override@JsonKey() List<String> get skills {
  if (_skills is EqualUnmodifiableListView) return _skills;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_skills);
}

 final  List<ResumeLanguage> _languages;
@override@JsonKey() List<ResumeLanguage> get languages {
  if (_languages is EqualUnmodifiableListView) return _languages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_languages);
}


/// Create a copy of ResumeInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResumeInputCopyWith<_ResumeInput> get copyWith => __$ResumeInputCopyWithImpl<_ResumeInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResumeInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResumeInput&&(identical(other.title, title) || other.title == title)&&(identical(other.about, about) || other.about == about)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.relocate, relocate) || other.relocate == relocate)&&(identical(other.desiredSalary, desiredSalary) || other.desiredSalary == desiredSalary)&&(identical(other.currency, currency) || other.currency == currency)&&const DeepCollectionEquality().equals(other._employmentTypes, _employmentTypes)&&const DeepCollectionEquality().equals(other._workFormats, _workFormats)&&(identical(other.visibility, visibility) || other.visibility == visibility)&&const DeepCollectionEquality().equals(other._experiences, _experiences)&&const DeepCollectionEquality().equals(other._educations, _educations)&&const DeepCollectionEquality().equals(other._skills, _skills)&&const DeepCollectionEquality().equals(other._languages, _languages));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,title,about,categoryId,regionId,relocate,desiredSalary,currency,const DeepCollectionEquality().hash(_employmentTypes),const DeepCollectionEquality().hash(_workFormats),visibility,const DeepCollectionEquality().hash(_experiences),const DeepCollectionEquality().hash(_educations),const DeepCollectionEquality().hash(_skills),const DeepCollectionEquality().hash(_languages));

@override
String toString() {
  return 'ResumeInput(title: $title, about: $about, categoryId: $categoryId, regionId: $regionId, relocate: $relocate, desiredSalary: $desiredSalary, currency: $currency, employmentTypes: $employmentTypes, workFormats: $workFormats, visibility: $visibility, experiences: $experiences, educations: $educations, skills: $skills, languages: $languages)';
}


}

/// @nodoc
abstract mixin class _$ResumeInputCopyWith<$Res> implements $ResumeInputCopyWith<$Res> {
  factory _$ResumeInputCopyWith(_ResumeInput value, $Res Function(_ResumeInput) _then) = __$ResumeInputCopyWithImpl;
@override @useResult
$Res call({
 String title, String? about, int? categoryId, int? regionId, bool relocate, int? desiredSalary, String currency, List<EmploymentType> employmentTypes, List<WorkFormat> workFormats, ResumeVisibility visibility, List<ResumeExperience> experiences, List<ResumeEducation> educations, List<String> skills, List<ResumeLanguage> languages
});




}
/// @nodoc
class __$ResumeInputCopyWithImpl<$Res>
    implements _$ResumeInputCopyWith<$Res> {
  __$ResumeInputCopyWithImpl(this._self, this._then);

  final _ResumeInput _self;
  final $Res Function(_ResumeInput) _then;

/// Create a copy of ResumeInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? title = null,Object? about = freezed,Object? categoryId = freezed,Object? regionId = freezed,Object? relocate = null,Object? desiredSalary = freezed,Object? currency = null,Object? employmentTypes = null,Object? workFormats = null,Object? visibility = null,Object? experiences = null,Object? educations = null,Object? skills = null,Object? languages = null,}) {
  return _then(_ResumeInput(
title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,categoryId: freezed == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,relocate: null == relocate ? _self.relocate : relocate // ignore: cast_nullable_to_non_nullable
as bool,desiredSalary: freezed == desiredSalary ? _self.desiredSalary : desiredSalary // ignore: cast_nullable_to_non_nullable
as int?,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,employmentTypes: null == employmentTypes ? _self._employmentTypes : employmentTypes // ignore: cast_nullable_to_non_nullable
as List<EmploymentType>,workFormats: null == workFormats ? _self._workFormats : workFormats // ignore: cast_nullable_to_non_nullable
as List<WorkFormat>,visibility: null == visibility ? _self.visibility : visibility // ignore: cast_nullable_to_non_nullable
as ResumeVisibility,experiences: null == experiences ? _self._experiences : experiences // ignore: cast_nullable_to_non_nullable
as List<ResumeExperience>,educations: null == educations ? _self._educations : educations // ignore: cast_nullable_to_non_nullable
as List<ResumeEducation>,skills: null == skills ? _self._skills : skills // ignore: cast_nullable_to_non_nullable
as List<String>,languages: null == languages ? _self._languages : languages // ignore: cast_nullable_to_non_nullable
as List<ResumeLanguage>,
  ));
}


}

// dart format on
