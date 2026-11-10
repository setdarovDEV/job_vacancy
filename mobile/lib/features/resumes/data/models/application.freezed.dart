// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'application.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ApplicationEvent {

 ApplicationStatus? get from; ApplicationStatus get to; String? get note; DateTime get at;
/// Create a copy of ApplicationEvent
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ApplicationEventCopyWith<ApplicationEvent> get copyWith => _$ApplicationEventCopyWithImpl<ApplicationEvent>(this as ApplicationEvent, _$identity);

  /// Serializes this ApplicationEvent to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ApplicationEvent&&(identical(other.from, from) || other.from == from)&&(identical(other.to, to) || other.to == to)&&(identical(other.note, note) || other.note == note)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,from,to,note,at);

@override
String toString() {
  return 'ApplicationEvent(from: $from, to: $to, note: $note, at: $at)';
}


}

/// @nodoc
abstract mixin class $ApplicationEventCopyWith<$Res>  {
  factory $ApplicationEventCopyWith(ApplicationEvent value, $Res Function(ApplicationEvent) _then) = _$ApplicationEventCopyWithImpl;
@useResult
$Res call({
 ApplicationStatus? from, ApplicationStatus to, String? note, DateTime at
});




}
/// @nodoc
class _$ApplicationEventCopyWithImpl<$Res>
    implements $ApplicationEventCopyWith<$Res> {
  _$ApplicationEventCopyWithImpl(this._self, this._then);

  final ApplicationEvent _self;
  final $Res Function(ApplicationEvent) _then;

/// Create a copy of ApplicationEvent
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? from = freezed,Object? to = null,Object? note = freezed,Object? at = null,}) {
  return _then(_self.copyWith(
from: freezed == from ? _self.from : from // ignore: cast_nullable_to_non_nullable
as ApplicationStatus?,to: null == to ? _self.to : to // ignore: cast_nullable_to_non_nullable
as ApplicationStatus,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,at: null == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [ApplicationEvent].
extension ApplicationEventPatterns on ApplicationEvent {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ApplicationEvent value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ApplicationEvent() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ApplicationEvent value)  $default,){
final _that = this;
switch (_that) {
case _ApplicationEvent():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ApplicationEvent value)?  $default,){
final _that = this;
switch (_that) {
case _ApplicationEvent() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ApplicationStatus? from,  ApplicationStatus to,  String? note,  DateTime at)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ApplicationEvent() when $default != null:
return $default(_that.from,_that.to,_that.note,_that.at);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ApplicationStatus? from,  ApplicationStatus to,  String? note,  DateTime at)  $default,) {final _that = this;
switch (_that) {
case _ApplicationEvent():
return $default(_that.from,_that.to,_that.note,_that.at);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ApplicationStatus? from,  ApplicationStatus to,  String? note,  DateTime at)?  $default,) {final _that = this;
switch (_that) {
case _ApplicationEvent() when $default != null:
return $default(_that.from,_that.to,_that.note,_that.at);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ApplicationEvent extends ApplicationEvent {
  const _ApplicationEvent({this.from, required this.to, this.note, required this.at}): super._();
  factory _ApplicationEvent.fromJson(Map<String, dynamic> json) => _$ApplicationEventFromJson(json);

@override final  ApplicationStatus? from;
@override final  ApplicationStatus to;
@override final  String? note;
@override final  DateTime at;

/// Create a copy of ApplicationEvent
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ApplicationEventCopyWith<_ApplicationEvent> get copyWith => __$ApplicationEventCopyWithImpl<_ApplicationEvent>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ApplicationEventToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ApplicationEvent&&(identical(other.from, from) || other.from == from)&&(identical(other.to, to) || other.to == to)&&(identical(other.note, note) || other.note == note)&&(identical(other.at, at) || other.at == at));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,from,to,note,at);

@override
String toString() {
  return 'ApplicationEvent(from: $from, to: $to, note: $note, at: $at)';
}


}

/// @nodoc
abstract mixin class _$ApplicationEventCopyWith<$Res> implements $ApplicationEventCopyWith<$Res> {
  factory _$ApplicationEventCopyWith(_ApplicationEvent value, $Res Function(_ApplicationEvent) _then) = __$ApplicationEventCopyWithImpl;
@override @useResult
$Res call({
 ApplicationStatus? from, ApplicationStatus to, String? note, DateTime at
});




}
/// @nodoc
class __$ApplicationEventCopyWithImpl<$Res>
    implements _$ApplicationEventCopyWith<$Res> {
  __$ApplicationEventCopyWithImpl(this._self, this._then);

  final _ApplicationEvent _self;
  final $Res Function(_ApplicationEvent) _then;

/// Create a copy of ApplicationEvent
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? from = freezed,Object? to = null,Object? note = freezed,Object? at = null,}) {
  return _then(_ApplicationEvent(
from: freezed == from ? _self.from : from // ignore: cast_nullable_to_non_nullable
as ApplicationStatus?,to: null == to ? _self.to : to // ignore: cast_nullable_to_non_nullable
as ApplicationStatus,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,at: null == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}


/// @nodoc
mixin _$Application {

 String get id; String get vacancyId; String get resumeId; ApplicationStatus get status; ApplicationSource get source; String? get coverLetter; DateTime? get viewedAt; DateTime get statusChangedAt; DateTime get createdAt; VacancyCard get vacancy; List<ApplicationEvent> get events;
/// Create a copy of Application
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ApplicationCopyWith<Application> get copyWith => _$ApplicationCopyWithImpl<Application>(this as Application, _$identity);

  /// Serializes this Application to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Application&&(identical(other.id, id) || other.id == id)&&(identical(other.vacancyId, vacancyId) || other.vacancyId == vacancyId)&&(identical(other.resumeId, resumeId) || other.resumeId == resumeId)&&(identical(other.status, status) || other.status == status)&&(identical(other.source, source) || other.source == source)&&(identical(other.coverLetter, coverLetter) || other.coverLetter == coverLetter)&&(identical(other.viewedAt, viewedAt) || other.viewedAt == viewedAt)&&(identical(other.statusChangedAt, statusChangedAt) || other.statusChangedAt == statusChangedAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.vacancy, vacancy) || other.vacancy == vacancy)&&const DeepCollectionEquality().equals(other.events, events));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,vacancyId,resumeId,status,source,coverLetter,viewedAt,statusChangedAt,createdAt,vacancy,const DeepCollectionEquality().hash(events));

@override
String toString() {
  return 'Application(id: $id, vacancyId: $vacancyId, resumeId: $resumeId, status: $status, source: $source, coverLetter: $coverLetter, viewedAt: $viewedAt, statusChangedAt: $statusChangedAt, createdAt: $createdAt, vacancy: $vacancy, events: $events)';
}


}

/// @nodoc
abstract mixin class $ApplicationCopyWith<$Res>  {
  factory $ApplicationCopyWith(Application value, $Res Function(Application) _then) = _$ApplicationCopyWithImpl;
@useResult
$Res call({
 String id, String vacancyId, String resumeId, ApplicationStatus status, ApplicationSource source, String? coverLetter, DateTime? viewedAt, DateTime statusChangedAt, DateTime createdAt, VacancyCard vacancy, List<ApplicationEvent> events
});


$VacancyCardCopyWith<$Res> get vacancy;

}
/// @nodoc
class _$ApplicationCopyWithImpl<$Res>
    implements $ApplicationCopyWith<$Res> {
  _$ApplicationCopyWithImpl(this._self, this._then);

  final Application _self;
  final $Res Function(Application) _then;

/// Create a copy of Application
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? vacancyId = null,Object? resumeId = null,Object? status = null,Object? source = null,Object? coverLetter = freezed,Object? viewedAt = freezed,Object? statusChangedAt = null,Object? createdAt = null,Object? vacancy = null,Object? events = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,vacancyId: null == vacancyId ? _self.vacancyId : vacancyId // ignore: cast_nullable_to_non_nullable
as String,resumeId: null == resumeId ? _self.resumeId : resumeId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ApplicationStatus,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as ApplicationSource,coverLetter: freezed == coverLetter ? _self.coverLetter : coverLetter // ignore: cast_nullable_to_non_nullable
as String?,viewedAt: freezed == viewedAt ? _self.viewedAt : viewedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,statusChangedAt: null == statusChangedAt ? _self.statusChangedAt : statusChangedAt // ignore: cast_nullable_to_non_nullable
as DateTime,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,vacancy: null == vacancy ? _self.vacancy : vacancy // ignore: cast_nullable_to_non_nullable
as VacancyCard,events: null == events ? _self.events : events // ignore: cast_nullable_to_non_nullable
as List<ApplicationEvent>,
  ));
}
/// Create a copy of Application
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$VacancyCardCopyWith<$Res> get vacancy {
  
  return $VacancyCardCopyWith<$Res>(_self.vacancy, (value) {
    return _then(_self.copyWith(vacancy: value));
  });
}
}


/// Adds pattern-matching-related methods to [Application].
extension ApplicationPatterns on Application {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Application value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Application() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Application value)  $default,){
final _that = this;
switch (_that) {
case _Application():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Application value)?  $default,){
final _that = this;
switch (_that) {
case _Application() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String vacancyId,  String resumeId,  ApplicationStatus status,  ApplicationSource source,  String? coverLetter,  DateTime? viewedAt,  DateTime statusChangedAt,  DateTime createdAt,  VacancyCard vacancy,  List<ApplicationEvent> events)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Application() when $default != null:
return $default(_that.id,_that.vacancyId,_that.resumeId,_that.status,_that.source,_that.coverLetter,_that.viewedAt,_that.statusChangedAt,_that.createdAt,_that.vacancy,_that.events);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String vacancyId,  String resumeId,  ApplicationStatus status,  ApplicationSource source,  String? coverLetter,  DateTime? viewedAt,  DateTime statusChangedAt,  DateTime createdAt,  VacancyCard vacancy,  List<ApplicationEvent> events)  $default,) {final _that = this;
switch (_that) {
case _Application():
return $default(_that.id,_that.vacancyId,_that.resumeId,_that.status,_that.source,_that.coverLetter,_that.viewedAt,_that.statusChangedAt,_that.createdAt,_that.vacancy,_that.events);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String vacancyId,  String resumeId,  ApplicationStatus status,  ApplicationSource source,  String? coverLetter,  DateTime? viewedAt,  DateTime statusChangedAt,  DateTime createdAt,  VacancyCard vacancy,  List<ApplicationEvent> events)?  $default,) {final _that = this;
switch (_that) {
case _Application() when $default != null:
return $default(_that.id,_that.vacancyId,_that.resumeId,_that.status,_that.source,_that.coverLetter,_that.viewedAt,_that.statusChangedAt,_that.createdAt,_that.vacancy,_that.events);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Application extends Application {
  const _Application({required this.id, required this.vacancyId, required this.resumeId, required this.status, required this.source, this.coverLetter, this.viewedAt, required this.statusChangedAt, required this.createdAt, required this.vacancy, final  List<ApplicationEvent> events = const []}): _events = events,super._();
  factory _Application.fromJson(Map<String, dynamic> json) => _$ApplicationFromJson(json);

@override final  String id;
@override final  String vacancyId;
@override final  String resumeId;
@override final  ApplicationStatus status;
@override final  ApplicationSource source;
@override final  String? coverLetter;
@override final  DateTime? viewedAt;
@override final  DateTime statusChangedAt;
@override final  DateTime createdAt;
@override final  VacancyCard vacancy;
 final  List<ApplicationEvent> _events;
@override@JsonKey() List<ApplicationEvent> get events {
  if (_events is EqualUnmodifiableListView) return _events;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_events);
}


/// Create a copy of Application
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ApplicationCopyWith<_Application> get copyWith => __$ApplicationCopyWithImpl<_Application>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ApplicationToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Application&&(identical(other.id, id) || other.id == id)&&(identical(other.vacancyId, vacancyId) || other.vacancyId == vacancyId)&&(identical(other.resumeId, resumeId) || other.resumeId == resumeId)&&(identical(other.status, status) || other.status == status)&&(identical(other.source, source) || other.source == source)&&(identical(other.coverLetter, coverLetter) || other.coverLetter == coverLetter)&&(identical(other.viewedAt, viewedAt) || other.viewedAt == viewedAt)&&(identical(other.statusChangedAt, statusChangedAt) || other.statusChangedAt == statusChangedAt)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.vacancy, vacancy) || other.vacancy == vacancy)&&const DeepCollectionEquality().equals(other._events, _events));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,vacancyId,resumeId,status,source,coverLetter,viewedAt,statusChangedAt,createdAt,vacancy,const DeepCollectionEquality().hash(_events));

@override
String toString() {
  return 'Application(id: $id, vacancyId: $vacancyId, resumeId: $resumeId, status: $status, source: $source, coverLetter: $coverLetter, viewedAt: $viewedAt, statusChangedAt: $statusChangedAt, createdAt: $createdAt, vacancy: $vacancy, events: $events)';
}


}

/// @nodoc
abstract mixin class _$ApplicationCopyWith<$Res> implements $ApplicationCopyWith<$Res> {
  factory _$ApplicationCopyWith(_Application value, $Res Function(_Application) _then) = __$ApplicationCopyWithImpl;
@override @useResult
$Res call({
 String id, String vacancyId, String resumeId, ApplicationStatus status, ApplicationSource source, String? coverLetter, DateTime? viewedAt, DateTime statusChangedAt, DateTime createdAt, VacancyCard vacancy, List<ApplicationEvent> events
});


@override $VacancyCardCopyWith<$Res> get vacancy;

}
/// @nodoc
class __$ApplicationCopyWithImpl<$Res>
    implements _$ApplicationCopyWith<$Res> {
  __$ApplicationCopyWithImpl(this._self, this._then);

  final _Application _self;
  final $Res Function(_Application) _then;

/// Create a copy of Application
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? vacancyId = null,Object? resumeId = null,Object? status = null,Object? source = null,Object? coverLetter = freezed,Object? viewedAt = freezed,Object? statusChangedAt = null,Object? createdAt = null,Object? vacancy = null,Object? events = null,}) {
  return _then(_Application(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,vacancyId: null == vacancyId ? _self.vacancyId : vacancyId // ignore: cast_nullable_to_non_nullable
as String,resumeId: null == resumeId ? _self.resumeId : resumeId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ApplicationStatus,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as ApplicationSource,coverLetter: freezed == coverLetter ? _self.coverLetter : coverLetter // ignore: cast_nullable_to_non_nullable
as String?,viewedAt: freezed == viewedAt ? _self.viewedAt : viewedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,statusChangedAt: null == statusChangedAt ? _self.statusChangedAt : statusChangedAt // ignore: cast_nullable_to_non_nullable
as DateTime,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,vacancy: null == vacancy ? _self.vacancy : vacancy // ignore: cast_nullable_to_non_nullable
as VacancyCard,events: null == events ? _self._events : events // ignore: cast_nullable_to_non_nullable
as List<ApplicationEvent>,
  ));
}

/// Create a copy of Application
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$VacancyCardCopyWith<$Res> get vacancy {
  
  return $VacancyCardCopyWith<$Res>(_self.vacancy, (value) {
    return _then(_self.copyWith(vacancy: value));
  });
}
}

// dart format on
