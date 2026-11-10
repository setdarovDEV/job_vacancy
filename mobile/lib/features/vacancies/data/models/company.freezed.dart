// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'company.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CompanySummary {

 String get id; String get name; String get slug; String? get logoUrl; bool get verified;
/// Create a copy of CompanySummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CompanySummaryCopyWith<CompanySummary> get copyWith => _$CompanySummaryCopyWithImpl<CompanySummary>(this as CompanySummary, _$identity);

  /// Serializes this CompanySummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CompanySummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.verified, verified) || other.verified == verified));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,logoUrl,verified);

@override
String toString() {
  return 'CompanySummary(id: $id, name: $name, slug: $slug, logoUrl: $logoUrl, verified: $verified)';
}


}

/// @nodoc
abstract mixin class $CompanySummaryCopyWith<$Res>  {
  factory $CompanySummaryCopyWith(CompanySummary value, $Res Function(CompanySummary) _then) = _$CompanySummaryCopyWithImpl;
@useResult
$Res call({
 String id, String name, String slug, String? logoUrl, bool verified
});




}
/// @nodoc
class _$CompanySummaryCopyWithImpl<$Res>
    implements $CompanySummaryCopyWith<$Res> {
  _$CompanySummaryCopyWithImpl(this._self, this._then);

  final CompanySummary _self;
  final $Res Function(CompanySummary) _then;

/// Create a copy of CompanySummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? logoUrl = freezed,Object? verified = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,verified: null == verified ? _self.verified : verified // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [CompanySummary].
extension CompanySummaryPatterns on CompanySummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CompanySummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CompanySummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CompanySummary value)  $default,){
final _that = this;
switch (_that) {
case _CompanySummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CompanySummary value)?  $default,){
final _that = this;
switch (_that) {
case _CompanySummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? logoUrl,  bool verified)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CompanySummary() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.logoUrl,_that.verified);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String slug,  String? logoUrl,  bool verified)  $default,) {final _that = this;
switch (_that) {
case _CompanySummary():
return $default(_that.id,_that.name,_that.slug,_that.logoUrl,_that.verified);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String slug,  String? logoUrl,  bool verified)?  $default,) {final _that = this;
switch (_that) {
case _CompanySummary() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.logoUrl,_that.verified);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CompanySummary extends CompanySummary {
  const _CompanySummary({required this.id, required this.name, required this.slug, this.logoUrl, this.verified = false}): super._();
  factory _CompanySummary.fromJson(Map<String, dynamic> json) => _$CompanySummaryFromJson(json);

@override final  String id;
@override final  String name;
@override final  String slug;
@override final  String? logoUrl;
@override@JsonKey() final  bool verified;

/// Create a copy of CompanySummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CompanySummaryCopyWith<_CompanySummary> get copyWith => __$CompanySummaryCopyWithImpl<_CompanySummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CompanySummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CompanySummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.verified, verified) || other.verified == verified));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,logoUrl,verified);

@override
String toString() {
  return 'CompanySummary(id: $id, name: $name, slug: $slug, logoUrl: $logoUrl, verified: $verified)';
}


}

/// @nodoc
abstract mixin class _$CompanySummaryCopyWith<$Res> implements $CompanySummaryCopyWith<$Res> {
  factory _$CompanySummaryCopyWith(_CompanySummary value, $Res Function(_CompanySummary) _then) = __$CompanySummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String slug, String? logoUrl, bool verified
});




}
/// @nodoc
class __$CompanySummaryCopyWithImpl<$Res>
    implements _$CompanySummaryCopyWith<$Res> {
  __$CompanySummaryCopyWithImpl(this._self, this._then);

  final _CompanySummary _self;
  final $Res Function(_CompanySummary) _then;

/// Create a copy of CompanySummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? logoUrl = freezed,Object? verified = null,}) {
  return _then(_CompanySummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,verified: null == verified ? _self.verified : verified // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$Company {

 String get id; String get slug; String get name; String? get logoUrl; String? get coverUrl; bool get verified; DateTime get createdAt; String? get about; int? get industryId;@JsonKey(unknownEnumValue: CompanySize.one10) CompanySize? get size; String? get website; String? get email; String? get phone; int? get regionId; String? get address; int? get foundedYear; int? get openVacancies;
/// Create a copy of Company
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CompanyCopyWith<Company> get copyWith => _$CompanyCopyWithImpl<Company>(this as Company, _$identity);

  /// Serializes this Company to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Company&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.coverUrl, coverUrl) || other.coverUrl == coverUrl)&&(identical(other.verified, verified) || other.verified == verified)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.about, about) || other.about == about)&&(identical(other.industryId, industryId) || other.industryId == industryId)&&(identical(other.size, size) || other.size == size)&&(identical(other.website, website) || other.website == website)&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.address, address) || other.address == address)&&(identical(other.foundedYear, foundedYear) || other.foundedYear == foundedYear)&&(identical(other.openVacancies, openVacancies) || other.openVacancies == openVacancies));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,slug,name,logoUrl,coverUrl,verified,createdAt,about,industryId,size,website,email,phone,regionId,address,foundedYear,openVacancies);

@override
String toString() {
  return 'Company(id: $id, slug: $slug, name: $name, logoUrl: $logoUrl, coverUrl: $coverUrl, verified: $verified, createdAt: $createdAt, about: $about, industryId: $industryId, size: $size, website: $website, email: $email, phone: $phone, regionId: $regionId, address: $address, foundedYear: $foundedYear, openVacancies: $openVacancies)';
}


}

/// @nodoc
abstract mixin class $CompanyCopyWith<$Res>  {
  factory $CompanyCopyWith(Company value, $Res Function(Company) _then) = _$CompanyCopyWithImpl;
@useResult
$Res call({
 String id, String slug, String name, String? logoUrl, String? coverUrl, bool verified, DateTime createdAt, String? about, int? industryId,@JsonKey(unknownEnumValue: CompanySize.one10) CompanySize? size, String? website, String? email, String? phone, int? regionId, String? address, int? foundedYear, int? openVacancies
});




}
/// @nodoc
class _$CompanyCopyWithImpl<$Res>
    implements $CompanyCopyWith<$Res> {
  _$CompanyCopyWithImpl(this._self, this._then);

  final Company _self;
  final $Res Function(Company) _then;

/// Create a copy of Company
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? slug = null,Object? name = null,Object? logoUrl = freezed,Object? coverUrl = freezed,Object? verified = null,Object? createdAt = null,Object? about = freezed,Object? industryId = freezed,Object? size = freezed,Object? website = freezed,Object? email = freezed,Object? phone = freezed,Object? regionId = freezed,Object? address = freezed,Object? foundedYear = freezed,Object? openVacancies = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,coverUrl: freezed == coverUrl ? _self.coverUrl : coverUrl // ignore: cast_nullable_to_non_nullable
as String?,verified: null == verified ? _self.verified : verified // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,industryId: freezed == industryId ? _self.industryId : industryId // ignore: cast_nullable_to_non_nullable
as int?,size: freezed == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as CompanySize?,website: freezed == website ? _self.website : website // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,address: freezed == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String?,foundedYear: freezed == foundedYear ? _self.foundedYear : foundedYear // ignore: cast_nullable_to_non_nullable
as int?,openVacancies: freezed == openVacancies ? _self.openVacancies : openVacancies // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [Company].
extension CompanyPatterns on Company {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Company value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Company() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Company value)  $default,){
final _that = this;
switch (_that) {
case _Company():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Company value)?  $default,){
final _that = this;
switch (_that) {
case _Company() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String slug,  String name,  String? logoUrl,  String? coverUrl,  bool verified,  DateTime createdAt,  String? about,  int? industryId, @JsonKey(unknownEnumValue: CompanySize.one10)  CompanySize? size,  String? website,  String? email,  String? phone,  int? regionId,  String? address,  int? foundedYear,  int? openVacancies)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Company() when $default != null:
return $default(_that.id,_that.slug,_that.name,_that.logoUrl,_that.coverUrl,_that.verified,_that.createdAt,_that.about,_that.industryId,_that.size,_that.website,_that.email,_that.phone,_that.regionId,_that.address,_that.foundedYear,_that.openVacancies);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String slug,  String name,  String? logoUrl,  String? coverUrl,  bool verified,  DateTime createdAt,  String? about,  int? industryId, @JsonKey(unknownEnumValue: CompanySize.one10)  CompanySize? size,  String? website,  String? email,  String? phone,  int? regionId,  String? address,  int? foundedYear,  int? openVacancies)  $default,) {final _that = this;
switch (_that) {
case _Company():
return $default(_that.id,_that.slug,_that.name,_that.logoUrl,_that.coverUrl,_that.verified,_that.createdAt,_that.about,_that.industryId,_that.size,_that.website,_that.email,_that.phone,_that.regionId,_that.address,_that.foundedYear,_that.openVacancies);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String slug,  String name,  String? logoUrl,  String? coverUrl,  bool verified,  DateTime createdAt,  String? about,  int? industryId, @JsonKey(unknownEnumValue: CompanySize.one10)  CompanySize? size,  String? website,  String? email,  String? phone,  int? regionId,  String? address,  int? foundedYear,  int? openVacancies)?  $default,) {final _that = this;
switch (_that) {
case _Company() when $default != null:
return $default(_that.id,_that.slug,_that.name,_that.logoUrl,_that.coverUrl,_that.verified,_that.createdAt,_that.about,_that.industryId,_that.size,_that.website,_that.email,_that.phone,_that.regionId,_that.address,_that.foundedYear,_that.openVacancies);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Company extends Company {
  const _Company({required this.id, required this.slug, required this.name, this.logoUrl, this.coverUrl, this.verified = false, required this.createdAt, this.about, this.industryId, @JsonKey(unknownEnumValue: CompanySize.one10) this.size, this.website, this.email, this.phone, this.regionId, this.address, this.foundedYear, this.openVacancies}): super._();
  factory _Company.fromJson(Map<String, dynamic> json) => _$CompanyFromJson(json);

@override final  String id;
@override final  String slug;
@override final  String name;
@override final  String? logoUrl;
@override final  String? coverUrl;
@override@JsonKey() final  bool verified;
@override final  DateTime createdAt;
@override final  String? about;
@override final  int? industryId;
@override@JsonKey(unknownEnumValue: CompanySize.one10) final  CompanySize? size;
@override final  String? website;
@override final  String? email;
@override final  String? phone;
@override final  int? regionId;
@override final  String? address;
@override final  int? foundedYear;
@override final  int? openVacancies;

/// Create a copy of Company
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CompanyCopyWith<_Company> get copyWith => __$CompanyCopyWithImpl<_Company>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CompanyToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Company&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.coverUrl, coverUrl) || other.coverUrl == coverUrl)&&(identical(other.verified, verified) || other.verified == verified)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.about, about) || other.about == about)&&(identical(other.industryId, industryId) || other.industryId == industryId)&&(identical(other.size, size) || other.size == size)&&(identical(other.website, website) || other.website == website)&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.address, address) || other.address == address)&&(identical(other.foundedYear, foundedYear) || other.foundedYear == foundedYear)&&(identical(other.openVacancies, openVacancies) || other.openVacancies == openVacancies));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,slug,name,logoUrl,coverUrl,verified,createdAt,about,industryId,size,website,email,phone,regionId,address,foundedYear,openVacancies);

@override
String toString() {
  return 'Company(id: $id, slug: $slug, name: $name, logoUrl: $logoUrl, coverUrl: $coverUrl, verified: $verified, createdAt: $createdAt, about: $about, industryId: $industryId, size: $size, website: $website, email: $email, phone: $phone, regionId: $regionId, address: $address, foundedYear: $foundedYear, openVacancies: $openVacancies)';
}


}

/// @nodoc
abstract mixin class _$CompanyCopyWith<$Res> implements $CompanyCopyWith<$Res> {
  factory _$CompanyCopyWith(_Company value, $Res Function(_Company) _then) = __$CompanyCopyWithImpl;
@override @useResult
$Res call({
 String id, String slug, String name, String? logoUrl, String? coverUrl, bool verified, DateTime createdAt, String? about, int? industryId,@JsonKey(unknownEnumValue: CompanySize.one10) CompanySize? size, String? website, String? email, String? phone, int? regionId, String? address, int? foundedYear, int? openVacancies
});




}
/// @nodoc
class __$CompanyCopyWithImpl<$Res>
    implements _$CompanyCopyWith<$Res> {
  __$CompanyCopyWithImpl(this._self, this._then);

  final _Company _self;
  final $Res Function(_Company) _then;

/// Create a copy of Company
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? slug = null,Object? name = null,Object? logoUrl = freezed,Object? coverUrl = freezed,Object? verified = null,Object? createdAt = null,Object? about = freezed,Object? industryId = freezed,Object? size = freezed,Object? website = freezed,Object? email = freezed,Object? phone = freezed,Object? regionId = freezed,Object? address = freezed,Object? foundedYear = freezed,Object? openVacancies = freezed,}) {
  return _then(_Company(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,coverUrl: freezed == coverUrl ? _self.coverUrl : coverUrl // ignore: cast_nullable_to_non_nullable
as String?,verified: null == verified ? _self.verified : verified // ignore: cast_nullable_to_non_nullable
as bool,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,industryId: freezed == industryId ? _self.industryId : industryId // ignore: cast_nullable_to_non_nullable
as int?,size: freezed == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as CompanySize?,website: freezed == website ? _self.website : website // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as int?,address: freezed == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String?,foundedYear: freezed == foundedYear ? _self.foundedYear : foundedYear // ignore: cast_nullable_to_non_nullable
as int?,openVacancies: freezed == openVacancies ? _self.openVacancies : openVacancies // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
