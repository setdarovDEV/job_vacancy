// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'vacancy.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Salary {

 int? get min; int? get max; String get currency;
/// Create a copy of Salary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SalaryCopyWith<Salary> get copyWith => _$SalaryCopyWithImpl<Salary>(this as Salary, _$identity);

  /// Serializes this Salary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Salary&&(identical(other.min, min) || other.min == min)&&(identical(other.max, max) || other.max == max)&&(identical(other.currency, currency) || other.currency == currency));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,min,max,currency);

@override
String toString() {
  return 'Salary(min: $min, max: $max, currency: $currency)';
}


}

/// @nodoc
abstract mixin class $SalaryCopyWith<$Res>  {
  factory $SalaryCopyWith(Salary value, $Res Function(Salary) _then) = _$SalaryCopyWithImpl;
@useResult
$Res call({
 int? min, int? max, String currency
});




}
/// @nodoc
class _$SalaryCopyWithImpl<$Res>
    implements $SalaryCopyWith<$Res> {
  _$SalaryCopyWithImpl(this._self, this._then);

  final Salary _self;
  final $Res Function(Salary) _then;

/// Create a copy of Salary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? min = freezed,Object? max = freezed,Object? currency = null,}) {
  return _then(_self.copyWith(
min: freezed == min ? _self.min : min // ignore: cast_nullable_to_non_nullable
as int?,max: freezed == max ? _self.max : max // ignore: cast_nullable_to_non_nullable
as int?,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [Salary].
extension SalaryPatterns on Salary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Salary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Salary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Salary value)  $default,){
final _that = this;
switch (_that) {
case _Salary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Salary value)?  $default,){
final _that = this;
switch (_that) {
case _Salary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int? min,  int? max,  String currency)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Salary() when $default != null:
return $default(_that.min,_that.max,_that.currency);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int? min,  int? max,  String currency)  $default,) {final _that = this;
switch (_that) {
case _Salary():
return $default(_that.min,_that.max,_that.currency);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int? min,  int? max,  String currency)?  $default,) {final _that = this;
switch (_that) {
case _Salary() when $default != null:
return $default(_that.min,_that.max,_that.currency);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Salary extends Salary {
  const _Salary({this.min, this.max, this.currency = 'UZS'}): super._();
  factory _Salary.fromJson(Map<String, dynamic> json) => _$SalaryFromJson(json);

@override final  int? min;
@override final  int? max;
@override@JsonKey() final  String currency;

/// Create a copy of Salary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SalaryCopyWith<_Salary> get copyWith => __$SalaryCopyWithImpl<_Salary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SalaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Salary&&(identical(other.min, min) || other.min == min)&&(identical(other.max, max) || other.max == max)&&(identical(other.currency, currency) || other.currency == currency));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,min,max,currency);

@override
String toString() {
  return 'Salary(min: $min, max: $max, currency: $currency)';
}


}

/// @nodoc
abstract mixin class _$SalaryCopyWith<$Res> implements $SalaryCopyWith<$Res> {
  factory _$SalaryCopyWith(_Salary value, $Res Function(_Salary) _then) = __$SalaryCopyWithImpl;
@override @useResult
$Res call({
 int? min, int? max, String currency
});




}
/// @nodoc
class __$SalaryCopyWithImpl<$Res>
    implements _$SalaryCopyWith<$Res> {
  __$SalaryCopyWithImpl(this._self, this._then);

  final _Salary _self;
  final $Res Function(_Salary) _then;

/// Create a copy of Salary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? min = freezed,Object? max = freezed,Object? currency = null,}) {
  return _then(_Salary(
min: freezed == min ? _self.min : min // ignore: cast_nullable_to_non_nullable
as int?,max: freezed == max ? _self.max : max // ignore: cast_nullable_to_non_nullable
as int?,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$VacancyCard {

 String get id; String get slug; String get title; CompanySummary get company; int get categoryId; int get regionId; int? get districtId; Salary? get salary; EmploymentType get employmentType; WorkFormat get workFormat; Experience get experience; Schedule get schedule; List<Skill> get skills; bool get isFeatured; VacancyStatus get status; int get viewsCount; int get applicationsCount; DateTime? get publishedAt; DateTime? get expiresAt; DateTime get createdAt;
/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$VacancyCardCopyWith<VacancyCard> get copyWith => _$VacancyCardCopyWithImpl<VacancyCard>(this as VacancyCard, _$identity);

  /// Serializes this VacancyCard to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is VacancyCard&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.title, title) || other.title == title)&&(identical(other.company, company) || other.company == company)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.districtId, districtId) || other.districtId == districtId)&&(identical(other.salary, salary) || other.salary == salary)&&(identical(other.employmentType, employmentType) || other.employmentType == employmentType)&&(identical(other.workFormat, workFormat) || other.workFormat == workFormat)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.schedule, schedule) || other.schedule == schedule)&&const DeepCollectionEquality().equals(other.skills, skills)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured)&&(identical(other.status, status) || other.status == status)&&(identical(other.viewsCount, viewsCount) || other.viewsCount == viewsCount)&&(identical(other.applicationsCount, applicationsCount) || other.applicationsCount == applicationsCount)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,slug,title,company,categoryId,regionId,districtId,salary,employmentType,workFormat,experience,schedule,const DeepCollectionEquality().hash(skills),isFeatured,status,viewsCount,applicationsCount,publishedAt,expiresAt,createdAt]);

@override
String toString() {
  return 'VacancyCard(id: $id, slug: $slug, title: $title, company: $company, categoryId: $categoryId, regionId: $regionId, districtId: $districtId, salary: $salary, employmentType: $employmentType, workFormat: $workFormat, experience: $experience, schedule: $schedule, skills: $skills, isFeatured: $isFeatured, status: $status, viewsCount: $viewsCount, applicationsCount: $applicationsCount, publishedAt: $publishedAt, expiresAt: $expiresAt, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $VacancyCardCopyWith<$Res>  {
  factory $VacancyCardCopyWith(VacancyCard value, $Res Function(VacancyCard) _then) = _$VacancyCardCopyWithImpl;
@useResult
$Res call({
 String id, String slug, String title, CompanySummary company, int categoryId, int regionId, int? districtId, Salary? salary, EmploymentType employmentType, WorkFormat workFormat, Experience experience, Schedule schedule, List<Skill> skills, bool isFeatured, VacancyStatus status, int viewsCount, int applicationsCount, DateTime? publishedAt, DateTime? expiresAt, DateTime createdAt
});


$CompanySummaryCopyWith<$Res> get company;$SalaryCopyWith<$Res>? get salary;

}
/// @nodoc
class _$VacancyCardCopyWithImpl<$Res>
    implements $VacancyCardCopyWith<$Res> {
  _$VacancyCardCopyWithImpl(this._self, this._then);

  final VacancyCard _self;
  final $Res Function(VacancyCard) _then;

/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? slug = null,Object? title = null,Object? company = null,Object? categoryId = null,Object? regionId = null,Object? districtId = freezed,Object? salary = freezed,Object? employmentType = null,Object? workFormat = null,Object? experience = null,Object? schedule = null,Object? skills = null,Object? isFeatured = null,Object? status = null,Object? viewsCount = null,Object? applicationsCount = null,Object? publishedAt = freezed,Object? expiresAt = freezed,Object? createdAt = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as CompanySummary,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,regionId: null == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as int?,salary: freezed == salary ? _self.salary : salary // ignore: cast_nullable_to_non_nullable
as Salary?,employmentType: null == employmentType ? _self.employmentType : employmentType // ignore: cast_nullable_to_non_nullable
as EmploymentType,workFormat: null == workFormat ? _self.workFormat : workFormat // ignore: cast_nullable_to_non_nullable
as WorkFormat,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as Experience,schedule: null == schedule ? _self.schedule : schedule // ignore: cast_nullable_to_non_nullable
as Schedule,skills: null == skills ? _self.skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as VacancyStatus,viewsCount: null == viewsCount ? _self.viewsCount : viewsCount // ignore: cast_nullable_to_non_nullable
as int,applicationsCount: null == applicationsCount ? _self.applicationsCount : applicationsCount // ignore: cast_nullable_to_non_nullable
as int,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,expiresAt: freezed == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}
/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CompanySummaryCopyWith<$Res> get company {
  
  return $CompanySummaryCopyWith<$Res>(_self.company, (value) {
    return _then(_self.copyWith(company: value));
  });
}/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SalaryCopyWith<$Res>? get salary {
    if (_self.salary == null) {
    return null;
  }

  return $SalaryCopyWith<$Res>(_self.salary!, (value) {
    return _then(_self.copyWith(salary: value));
  });
}
}


/// Adds pattern-matching-related methods to [VacancyCard].
extension VacancyCardPatterns on VacancyCard {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _VacancyCard value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _VacancyCard() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _VacancyCard value)  $default,){
final _that = this;
switch (_that) {
case _VacancyCard():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _VacancyCard value)?  $default,){
final _that = this;
switch (_that) {
case _VacancyCard() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String slug,  String title,  CompanySummary company,  int categoryId,  int regionId,  int? districtId,  Salary? salary,  EmploymentType employmentType,  WorkFormat workFormat,  Experience experience,  Schedule schedule,  List<Skill> skills,  bool isFeatured,  VacancyStatus status,  int viewsCount,  int applicationsCount,  DateTime? publishedAt,  DateTime? expiresAt,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _VacancyCard() when $default != null:
return $default(_that.id,_that.slug,_that.title,_that.company,_that.categoryId,_that.regionId,_that.districtId,_that.salary,_that.employmentType,_that.workFormat,_that.experience,_that.schedule,_that.skills,_that.isFeatured,_that.status,_that.viewsCount,_that.applicationsCount,_that.publishedAt,_that.expiresAt,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String slug,  String title,  CompanySummary company,  int categoryId,  int regionId,  int? districtId,  Salary? salary,  EmploymentType employmentType,  WorkFormat workFormat,  Experience experience,  Schedule schedule,  List<Skill> skills,  bool isFeatured,  VacancyStatus status,  int viewsCount,  int applicationsCount,  DateTime? publishedAt,  DateTime? expiresAt,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _VacancyCard():
return $default(_that.id,_that.slug,_that.title,_that.company,_that.categoryId,_that.regionId,_that.districtId,_that.salary,_that.employmentType,_that.workFormat,_that.experience,_that.schedule,_that.skills,_that.isFeatured,_that.status,_that.viewsCount,_that.applicationsCount,_that.publishedAt,_that.expiresAt,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String slug,  String title,  CompanySummary company,  int categoryId,  int regionId,  int? districtId,  Salary? salary,  EmploymentType employmentType,  WorkFormat workFormat,  Experience experience,  Schedule schedule,  List<Skill> skills,  bool isFeatured,  VacancyStatus status,  int viewsCount,  int applicationsCount,  DateTime? publishedAt,  DateTime? expiresAt,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _VacancyCard() when $default != null:
return $default(_that.id,_that.slug,_that.title,_that.company,_that.categoryId,_that.regionId,_that.districtId,_that.salary,_that.employmentType,_that.workFormat,_that.experience,_that.schedule,_that.skills,_that.isFeatured,_that.status,_that.viewsCount,_that.applicationsCount,_that.publishedAt,_that.expiresAt,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _VacancyCard extends VacancyCard {
  const _VacancyCard({required this.id, required this.slug, required this.title, required this.company, required this.categoryId, required this.regionId, this.districtId, this.salary, required this.employmentType, required this.workFormat, required this.experience, required this.schedule, final  List<Skill> skills = const [], this.isFeatured = false, required this.status, this.viewsCount = 0, this.applicationsCount = 0, this.publishedAt, this.expiresAt, required this.createdAt}): _skills = skills,super._();
  factory _VacancyCard.fromJson(Map<String, dynamic> json) => _$VacancyCardFromJson(json);

@override final  String id;
@override final  String slug;
@override final  String title;
@override final  CompanySummary company;
@override final  int categoryId;
@override final  int regionId;
@override final  int? districtId;
@override final  Salary? salary;
@override final  EmploymentType employmentType;
@override final  WorkFormat workFormat;
@override final  Experience experience;
@override final  Schedule schedule;
 final  List<Skill> _skills;
@override@JsonKey() List<Skill> get skills {
  if (_skills is EqualUnmodifiableListView) return _skills;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_skills);
}

@override@JsonKey() final  bool isFeatured;
@override final  VacancyStatus status;
@override@JsonKey() final  int viewsCount;
@override@JsonKey() final  int applicationsCount;
@override final  DateTime? publishedAt;
@override final  DateTime? expiresAt;
@override final  DateTime createdAt;

/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$VacancyCardCopyWith<_VacancyCard> get copyWith => __$VacancyCardCopyWithImpl<_VacancyCard>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$VacancyCardToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _VacancyCard&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.title, title) || other.title == title)&&(identical(other.company, company) || other.company == company)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.districtId, districtId) || other.districtId == districtId)&&(identical(other.salary, salary) || other.salary == salary)&&(identical(other.employmentType, employmentType) || other.employmentType == employmentType)&&(identical(other.workFormat, workFormat) || other.workFormat == workFormat)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.schedule, schedule) || other.schedule == schedule)&&const DeepCollectionEquality().equals(other._skills, _skills)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured)&&(identical(other.status, status) || other.status == status)&&(identical(other.viewsCount, viewsCount) || other.viewsCount == viewsCount)&&(identical(other.applicationsCount, applicationsCount) || other.applicationsCount == applicationsCount)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,slug,title,company,categoryId,regionId,districtId,salary,employmentType,workFormat,experience,schedule,const DeepCollectionEquality().hash(_skills),isFeatured,status,viewsCount,applicationsCount,publishedAt,expiresAt,createdAt]);

@override
String toString() {
  return 'VacancyCard(id: $id, slug: $slug, title: $title, company: $company, categoryId: $categoryId, regionId: $regionId, districtId: $districtId, salary: $salary, employmentType: $employmentType, workFormat: $workFormat, experience: $experience, schedule: $schedule, skills: $skills, isFeatured: $isFeatured, status: $status, viewsCount: $viewsCount, applicationsCount: $applicationsCount, publishedAt: $publishedAt, expiresAt: $expiresAt, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$VacancyCardCopyWith<$Res> implements $VacancyCardCopyWith<$Res> {
  factory _$VacancyCardCopyWith(_VacancyCard value, $Res Function(_VacancyCard) _then) = __$VacancyCardCopyWithImpl;
@override @useResult
$Res call({
 String id, String slug, String title, CompanySummary company, int categoryId, int regionId, int? districtId, Salary? salary, EmploymentType employmentType, WorkFormat workFormat, Experience experience, Schedule schedule, List<Skill> skills, bool isFeatured, VacancyStatus status, int viewsCount, int applicationsCount, DateTime? publishedAt, DateTime? expiresAt, DateTime createdAt
});


@override $CompanySummaryCopyWith<$Res> get company;@override $SalaryCopyWith<$Res>? get salary;

}
/// @nodoc
class __$VacancyCardCopyWithImpl<$Res>
    implements _$VacancyCardCopyWith<$Res> {
  __$VacancyCardCopyWithImpl(this._self, this._then);

  final _VacancyCard _self;
  final $Res Function(_VacancyCard) _then;

/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? slug = null,Object? title = null,Object? company = null,Object? categoryId = null,Object? regionId = null,Object? districtId = freezed,Object? salary = freezed,Object? employmentType = null,Object? workFormat = null,Object? experience = null,Object? schedule = null,Object? skills = null,Object? isFeatured = null,Object? status = null,Object? viewsCount = null,Object? applicationsCount = null,Object? publishedAt = freezed,Object? expiresAt = freezed,Object? createdAt = null,}) {
  return _then(_VacancyCard(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as CompanySummary,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,regionId: null == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as int?,salary: freezed == salary ? _self.salary : salary // ignore: cast_nullable_to_non_nullable
as Salary?,employmentType: null == employmentType ? _self.employmentType : employmentType // ignore: cast_nullable_to_non_nullable
as EmploymentType,workFormat: null == workFormat ? _self.workFormat : workFormat // ignore: cast_nullable_to_non_nullable
as WorkFormat,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as Experience,schedule: null == schedule ? _self.schedule : schedule // ignore: cast_nullable_to_non_nullable
as Schedule,skills: null == skills ? _self._skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as VacancyStatus,viewsCount: null == viewsCount ? _self.viewsCount : viewsCount // ignore: cast_nullable_to_non_nullable
as int,applicationsCount: null == applicationsCount ? _self.applicationsCount : applicationsCount // ignore: cast_nullable_to_non_nullable
as int,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,expiresAt: freezed == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CompanySummaryCopyWith<$Res> get company {
  
  return $CompanySummaryCopyWith<$Res>(_self.company, (value) {
    return _then(_self.copyWith(company: value));
  });
}/// Create a copy of VacancyCard
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SalaryCopyWith<$Res>? get salary {
    if (_self.salary == null) {
    return null;
  }

  return $SalaryCopyWith<$Res>(_self.salary!, (value) {
    return _then(_self.copyWith(salary: value));
  });
}
}


/// @nodoc
mixin _$VacancyDetail {

 String get id; String get slug; String get title; CompanySummary get company; int get categoryId; int get regionId; int? get districtId; Salary? get salary; EmploymentType get employmentType; WorkFormat get workFormat; Experience get experience; Schedule get schedule; List<Skill> get skills; bool get isFeatured; VacancyStatus get status; int get viewsCount; int get applicationsCount; DateTime? get publishedAt; DateTime? get expiresAt; DateTime get createdAt; String get description; String? get address; DateTime get updatedAt; bool get canEdit; String? get rejectReason; DateTime? get submittedAt;
/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$VacancyDetailCopyWith<VacancyDetail> get copyWith => _$VacancyDetailCopyWithImpl<VacancyDetail>(this as VacancyDetail, _$identity);

  /// Serializes this VacancyDetail to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is VacancyDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.title, title) || other.title == title)&&(identical(other.company, company) || other.company == company)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.districtId, districtId) || other.districtId == districtId)&&(identical(other.salary, salary) || other.salary == salary)&&(identical(other.employmentType, employmentType) || other.employmentType == employmentType)&&(identical(other.workFormat, workFormat) || other.workFormat == workFormat)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.schedule, schedule) || other.schedule == schedule)&&const DeepCollectionEquality().equals(other.skills, skills)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured)&&(identical(other.status, status) || other.status == status)&&(identical(other.viewsCount, viewsCount) || other.viewsCount == viewsCount)&&(identical(other.applicationsCount, applicationsCount) || other.applicationsCount == applicationsCount)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.description, description) || other.description == description)&&(identical(other.address, address) || other.address == address)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.canEdit, canEdit) || other.canEdit == canEdit)&&(identical(other.rejectReason, rejectReason) || other.rejectReason == rejectReason)&&(identical(other.submittedAt, submittedAt) || other.submittedAt == submittedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,slug,title,company,categoryId,regionId,districtId,salary,employmentType,workFormat,experience,schedule,const DeepCollectionEquality().hash(skills),isFeatured,status,viewsCount,applicationsCount,publishedAt,expiresAt,createdAt,description,address,updatedAt,canEdit,rejectReason,submittedAt]);

@override
String toString() {
  return 'VacancyDetail(id: $id, slug: $slug, title: $title, company: $company, categoryId: $categoryId, regionId: $regionId, districtId: $districtId, salary: $salary, employmentType: $employmentType, workFormat: $workFormat, experience: $experience, schedule: $schedule, skills: $skills, isFeatured: $isFeatured, status: $status, viewsCount: $viewsCount, applicationsCount: $applicationsCount, publishedAt: $publishedAt, expiresAt: $expiresAt, createdAt: $createdAt, description: $description, address: $address, updatedAt: $updatedAt, canEdit: $canEdit, rejectReason: $rejectReason, submittedAt: $submittedAt)';
}


}

/// @nodoc
abstract mixin class $VacancyDetailCopyWith<$Res>  {
  factory $VacancyDetailCopyWith(VacancyDetail value, $Res Function(VacancyDetail) _then) = _$VacancyDetailCopyWithImpl;
@useResult
$Res call({
 String id, String slug, String title, CompanySummary company, int categoryId, int regionId, int? districtId, Salary? salary, EmploymentType employmentType, WorkFormat workFormat, Experience experience, Schedule schedule, List<Skill> skills, bool isFeatured, VacancyStatus status, int viewsCount, int applicationsCount, DateTime? publishedAt, DateTime? expiresAt, DateTime createdAt, String description, String? address, DateTime updatedAt, bool canEdit, String? rejectReason, DateTime? submittedAt
});


$CompanySummaryCopyWith<$Res> get company;$SalaryCopyWith<$Res>? get salary;

}
/// @nodoc
class _$VacancyDetailCopyWithImpl<$Res>
    implements $VacancyDetailCopyWith<$Res> {
  _$VacancyDetailCopyWithImpl(this._self, this._then);

  final VacancyDetail _self;
  final $Res Function(VacancyDetail) _then;

/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? slug = null,Object? title = null,Object? company = null,Object? categoryId = null,Object? regionId = null,Object? districtId = freezed,Object? salary = freezed,Object? employmentType = null,Object? workFormat = null,Object? experience = null,Object? schedule = null,Object? skills = null,Object? isFeatured = null,Object? status = null,Object? viewsCount = null,Object? applicationsCount = null,Object? publishedAt = freezed,Object? expiresAt = freezed,Object? createdAt = null,Object? description = null,Object? address = freezed,Object? updatedAt = null,Object? canEdit = null,Object? rejectReason = freezed,Object? submittedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as CompanySummary,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,regionId: null == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as int?,salary: freezed == salary ? _self.salary : salary // ignore: cast_nullable_to_non_nullable
as Salary?,employmentType: null == employmentType ? _self.employmentType : employmentType // ignore: cast_nullable_to_non_nullable
as EmploymentType,workFormat: null == workFormat ? _self.workFormat : workFormat // ignore: cast_nullable_to_non_nullable
as WorkFormat,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as Experience,schedule: null == schedule ? _self.schedule : schedule // ignore: cast_nullable_to_non_nullable
as Schedule,skills: null == skills ? _self.skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as VacancyStatus,viewsCount: null == viewsCount ? _self.viewsCount : viewsCount // ignore: cast_nullable_to_non_nullable
as int,applicationsCount: null == applicationsCount ? _self.applicationsCount : applicationsCount // ignore: cast_nullable_to_non_nullable
as int,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,expiresAt: freezed == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,address: freezed == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,canEdit: null == canEdit ? _self.canEdit : canEdit // ignore: cast_nullable_to_non_nullable
as bool,rejectReason: freezed == rejectReason ? _self.rejectReason : rejectReason // ignore: cast_nullable_to_non_nullable
as String?,submittedAt: freezed == submittedAt ? _self.submittedAt : submittedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}
/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CompanySummaryCopyWith<$Res> get company {
  
  return $CompanySummaryCopyWith<$Res>(_self.company, (value) {
    return _then(_self.copyWith(company: value));
  });
}/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SalaryCopyWith<$Res>? get salary {
    if (_self.salary == null) {
    return null;
  }

  return $SalaryCopyWith<$Res>(_self.salary!, (value) {
    return _then(_self.copyWith(salary: value));
  });
}
}


/// Adds pattern-matching-related methods to [VacancyDetail].
extension VacancyDetailPatterns on VacancyDetail {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _VacancyDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _VacancyDetail() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _VacancyDetail value)  $default,){
final _that = this;
switch (_that) {
case _VacancyDetail():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _VacancyDetail value)?  $default,){
final _that = this;
switch (_that) {
case _VacancyDetail() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String slug,  String title,  CompanySummary company,  int categoryId,  int regionId,  int? districtId,  Salary? salary,  EmploymentType employmentType,  WorkFormat workFormat,  Experience experience,  Schedule schedule,  List<Skill> skills,  bool isFeatured,  VacancyStatus status,  int viewsCount,  int applicationsCount,  DateTime? publishedAt,  DateTime? expiresAt,  DateTime createdAt,  String description,  String? address,  DateTime updatedAt,  bool canEdit,  String? rejectReason,  DateTime? submittedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _VacancyDetail() when $default != null:
return $default(_that.id,_that.slug,_that.title,_that.company,_that.categoryId,_that.regionId,_that.districtId,_that.salary,_that.employmentType,_that.workFormat,_that.experience,_that.schedule,_that.skills,_that.isFeatured,_that.status,_that.viewsCount,_that.applicationsCount,_that.publishedAt,_that.expiresAt,_that.createdAt,_that.description,_that.address,_that.updatedAt,_that.canEdit,_that.rejectReason,_that.submittedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String slug,  String title,  CompanySummary company,  int categoryId,  int regionId,  int? districtId,  Salary? salary,  EmploymentType employmentType,  WorkFormat workFormat,  Experience experience,  Schedule schedule,  List<Skill> skills,  bool isFeatured,  VacancyStatus status,  int viewsCount,  int applicationsCount,  DateTime? publishedAt,  DateTime? expiresAt,  DateTime createdAt,  String description,  String? address,  DateTime updatedAt,  bool canEdit,  String? rejectReason,  DateTime? submittedAt)  $default,) {final _that = this;
switch (_that) {
case _VacancyDetail():
return $default(_that.id,_that.slug,_that.title,_that.company,_that.categoryId,_that.regionId,_that.districtId,_that.salary,_that.employmentType,_that.workFormat,_that.experience,_that.schedule,_that.skills,_that.isFeatured,_that.status,_that.viewsCount,_that.applicationsCount,_that.publishedAt,_that.expiresAt,_that.createdAt,_that.description,_that.address,_that.updatedAt,_that.canEdit,_that.rejectReason,_that.submittedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String slug,  String title,  CompanySummary company,  int categoryId,  int regionId,  int? districtId,  Salary? salary,  EmploymentType employmentType,  WorkFormat workFormat,  Experience experience,  Schedule schedule,  List<Skill> skills,  bool isFeatured,  VacancyStatus status,  int viewsCount,  int applicationsCount,  DateTime? publishedAt,  DateTime? expiresAt,  DateTime createdAt,  String description,  String? address,  DateTime updatedAt,  bool canEdit,  String? rejectReason,  DateTime? submittedAt)?  $default,) {final _that = this;
switch (_that) {
case _VacancyDetail() when $default != null:
return $default(_that.id,_that.slug,_that.title,_that.company,_that.categoryId,_that.regionId,_that.districtId,_that.salary,_that.employmentType,_that.workFormat,_that.experience,_that.schedule,_that.skills,_that.isFeatured,_that.status,_that.viewsCount,_that.applicationsCount,_that.publishedAt,_that.expiresAt,_that.createdAt,_that.description,_that.address,_that.updatedAt,_that.canEdit,_that.rejectReason,_that.submittedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _VacancyDetail extends VacancyDetail {
  const _VacancyDetail({required this.id, required this.slug, required this.title, required this.company, required this.categoryId, required this.regionId, this.districtId, this.salary, required this.employmentType, required this.workFormat, required this.experience, required this.schedule, final  List<Skill> skills = const [], this.isFeatured = false, required this.status, this.viewsCount = 0, this.applicationsCount = 0, this.publishedAt, this.expiresAt, required this.createdAt, required this.description, this.address, required this.updatedAt, this.canEdit = false, this.rejectReason, this.submittedAt}): _skills = skills,super._();
  factory _VacancyDetail.fromJson(Map<String, dynamic> json) => _$VacancyDetailFromJson(json);

@override final  String id;
@override final  String slug;
@override final  String title;
@override final  CompanySummary company;
@override final  int categoryId;
@override final  int regionId;
@override final  int? districtId;
@override final  Salary? salary;
@override final  EmploymentType employmentType;
@override final  WorkFormat workFormat;
@override final  Experience experience;
@override final  Schedule schedule;
 final  List<Skill> _skills;
@override@JsonKey() List<Skill> get skills {
  if (_skills is EqualUnmodifiableListView) return _skills;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_skills);
}

@override@JsonKey() final  bool isFeatured;
@override final  VacancyStatus status;
@override@JsonKey() final  int viewsCount;
@override@JsonKey() final  int applicationsCount;
@override final  DateTime? publishedAt;
@override final  DateTime? expiresAt;
@override final  DateTime createdAt;
@override final  String description;
@override final  String? address;
@override final  DateTime updatedAt;
@override@JsonKey() final  bool canEdit;
@override final  String? rejectReason;
@override final  DateTime? submittedAt;

/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$VacancyDetailCopyWith<_VacancyDetail> get copyWith => __$VacancyDetailCopyWithImpl<_VacancyDetail>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$VacancyDetailToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _VacancyDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.title, title) || other.title == title)&&(identical(other.company, company) || other.company == company)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.districtId, districtId) || other.districtId == districtId)&&(identical(other.salary, salary) || other.salary == salary)&&(identical(other.employmentType, employmentType) || other.employmentType == employmentType)&&(identical(other.workFormat, workFormat) || other.workFormat == workFormat)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.schedule, schedule) || other.schedule == schedule)&&const DeepCollectionEquality().equals(other._skills, _skills)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured)&&(identical(other.status, status) || other.status == status)&&(identical(other.viewsCount, viewsCount) || other.viewsCount == viewsCount)&&(identical(other.applicationsCount, applicationsCount) || other.applicationsCount == applicationsCount)&&(identical(other.publishedAt, publishedAt) || other.publishedAt == publishedAt)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.description, description) || other.description == description)&&(identical(other.address, address) || other.address == address)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.canEdit, canEdit) || other.canEdit == canEdit)&&(identical(other.rejectReason, rejectReason) || other.rejectReason == rejectReason)&&(identical(other.submittedAt, submittedAt) || other.submittedAt == submittedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,slug,title,company,categoryId,regionId,districtId,salary,employmentType,workFormat,experience,schedule,const DeepCollectionEquality().hash(_skills),isFeatured,status,viewsCount,applicationsCount,publishedAt,expiresAt,createdAt,description,address,updatedAt,canEdit,rejectReason,submittedAt]);

@override
String toString() {
  return 'VacancyDetail(id: $id, slug: $slug, title: $title, company: $company, categoryId: $categoryId, regionId: $regionId, districtId: $districtId, salary: $salary, employmentType: $employmentType, workFormat: $workFormat, experience: $experience, schedule: $schedule, skills: $skills, isFeatured: $isFeatured, status: $status, viewsCount: $viewsCount, applicationsCount: $applicationsCount, publishedAt: $publishedAt, expiresAt: $expiresAt, createdAt: $createdAt, description: $description, address: $address, updatedAt: $updatedAt, canEdit: $canEdit, rejectReason: $rejectReason, submittedAt: $submittedAt)';
}


}

/// @nodoc
abstract mixin class _$VacancyDetailCopyWith<$Res> implements $VacancyDetailCopyWith<$Res> {
  factory _$VacancyDetailCopyWith(_VacancyDetail value, $Res Function(_VacancyDetail) _then) = __$VacancyDetailCopyWithImpl;
@override @useResult
$Res call({
 String id, String slug, String title, CompanySummary company, int categoryId, int regionId, int? districtId, Salary? salary, EmploymentType employmentType, WorkFormat workFormat, Experience experience, Schedule schedule, List<Skill> skills, bool isFeatured, VacancyStatus status, int viewsCount, int applicationsCount, DateTime? publishedAt, DateTime? expiresAt, DateTime createdAt, String description, String? address, DateTime updatedAt, bool canEdit, String? rejectReason, DateTime? submittedAt
});


@override $CompanySummaryCopyWith<$Res> get company;@override $SalaryCopyWith<$Res>? get salary;

}
/// @nodoc
class __$VacancyDetailCopyWithImpl<$Res>
    implements _$VacancyDetailCopyWith<$Res> {
  __$VacancyDetailCopyWithImpl(this._self, this._then);

  final _VacancyDetail _self;
  final $Res Function(_VacancyDetail) _then;

/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? slug = null,Object? title = null,Object? company = null,Object? categoryId = null,Object? regionId = null,Object? districtId = freezed,Object? salary = freezed,Object? employmentType = null,Object? workFormat = null,Object? experience = null,Object? schedule = null,Object? skills = null,Object? isFeatured = null,Object? status = null,Object? viewsCount = null,Object? applicationsCount = null,Object? publishedAt = freezed,Object? expiresAt = freezed,Object? createdAt = null,Object? description = null,Object? address = freezed,Object? updatedAt = null,Object? canEdit = null,Object? rejectReason = freezed,Object? submittedAt = freezed,}) {
  return _then(_VacancyDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,company: null == company ? _self.company : company // ignore: cast_nullable_to_non_nullable
as CompanySummary,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,regionId: null == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as int?,salary: freezed == salary ? _self.salary : salary // ignore: cast_nullable_to_non_nullable
as Salary?,employmentType: null == employmentType ? _self.employmentType : employmentType // ignore: cast_nullable_to_non_nullable
as EmploymentType,workFormat: null == workFormat ? _self.workFormat : workFormat // ignore: cast_nullable_to_non_nullable
as WorkFormat,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as Experience,schedule: null == schedule ? _self.schedule : schedule // ignore: cast_nullable_to_non_nullable
as Schedule,skills: null == skills ? _self._skills : skills // ignore: cast_nullable_to_non_nullable
as List<Skill>,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as VacancyStatus,viewsCount: null == viewsCount ? _self.viewsCount : viewsCount // ignore: cast_nullable_to_non_nullable
as int,applicationsCount: null == applicationsCount ? _self.applicationsCount : applicationsCount // ignore: cast_nullable_to_non_nullable
as int,publishedAt: freezed == publishedAt ? _self.publishedAt : publishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,expiresAt: freezed == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,address: freezed == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,canEdit: null == canEdit ? _self.canEdit : canEdit // ignore: cast_nullable_to_non_nullable
as bool,rejectReason: freezed == rejectReason ? _self.rejectReason : rejectReason // ignore: cast_nullable_to_non_nullable
as String?,submittedAt: freezed == submittedAt ? _self.submittedAt : submittedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CompanySummaryCopyWith<$Res> get company {
  
  return $CompanySummaryCopyWith<$Res>(_self.company, (value) {
    return _then(_self.copyWith(company: value));
  });
}/// Create a copy of VacancyDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SalaryCopyWith<$Res>? get salary {
    if (_self.salary == null) {
    return null;
  }

  return $SalaryCopyWith<$Res>(_self.salary!, (value) {
    return _then(_self.copyWith(salary: value));
  });
}
}

// dart format on
