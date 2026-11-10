import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/vacancy.dart';

/// Query parameters for the public vacancy search endpoint.
class VacancySearchParams {
  const VacancySearchParams({
    this.q,
    this.sort,
    this.categoryId,
    this.regionId,
    this.districtId,
    this.companyId,
    this.employmentType,
    this.workFormat,
    this.experience,
    this.schedule,
    this.salaryFrom,
    this.currency,
    this.withSalary,
  });

  final String? q;
  final String? sort;
  final int? categoryId;
  final int? regionId;
  final int? districtId;
  final String? companyId;
  final EmploymentType? employmentType;
  final WorkFormat? workFormat;
  final Experience? experience;
  final Schedule? schedule;
  final int? salaryFrom;
  final String? currency;
  final bool? withSalary;

  Map<String, Object?> toQuery() => {
    if (q != null && q!.isNotEmpty) 'q': q,
    if (sort != null && sort!.isNotEmpty) 'sort': sort,
    if (categoryId != null) 'category_id': categoryId,
    if (regionId != null) 'region_id': regionId,
    if (districtId != null) 'district_id': districtId,
    if (companyId != null && companyId!.isNotEmpty) 'company_id': companyId,
    if (employmentType != null) 'employment_type': employmentType!.apiValue,
    if (workFormat != null) 'work_format': workFormat!.apiValue,
    if (experience != null) 'experience': experience!.apiValue,
    if (schedule != null) 'schedule': schedule!.apiValue,
    if (salaryFrom != null) 'salary_from': salaryFrom,
    if (currency != null && currency!.isNotEmpty) 'currency': currency,
    if (withSalary == true) 'with_salary': true,
  };

  VacancySearchParams copyWith({
    String? q,
    String? sort,
    int? categoryId,
    int? regionId,
    int? districtId,
    String? companyId,
    EmploymentType? employmentType,
    WorkFormat? workFormat,
    Experience? experience,
    Schedule? schedule,
    int? salaryFrom,
    String? currency,
    bool? withSalary,
  }) => VacancySearchParams(
    q: q ?? this.q,
    sort: sort ?? this.sort,
    categoryId: categoryId ?? this.categoryId,
    regionId: regionId ?? this.regionId,
    districtId: districtId ?? this.districtId,
    companyId: companyId ?? this.companyId,
    employmentType: employmentType ?? this.employmentType,
    workFormat: workFormat ?? this.workFormat,
    experience: experience ?? this.experience,
    schedule: schedule ?? this.schedule,
    salaryFrom: salaryFrom ?? this.salaryFrom,
    currency: currency ?? this.currency,
    withSalary: withSalary ?? this.withSalary,
  );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VacancySearchParams &&
          q == other.q &&
          sort == other.sort &&
          categoryId == other.categoryId &&
          regionId == other.regionId &&
          districtId == other.districtId &&
          companyId == other.companyId &&
          employmentType == other.employmentType &&
          workFormat == other.workFormat &&
          experience == other.experience &&
          schedule == other.schedule &&
          salaryFrom == other.salaryFrom &&
          currency == other.currency &&
          withSalary == other.withSalary;

  @override
  int get hashCode => Object.hashAll([
    q,
    sort,
    categoryId,
    regionId,
    districtId,
    companyId,
    employmentType,
    workFormat,
    experience,
    schedule,
    salaryFrom,
    currency,
    withSalary,
  ]);

  bool get hasFilter =>
      categoryId != null ||
      regionId != null ||
      districtId != null ||
      employmentType != null ||
      workFormat != null ||
      experience != null ||
      schedule != null ||
      salaryFrom != null ||
      (currency != null && currency != 'UZS') ||
      withSalary == true;
}

abstract interface class VacancyApi {
  Future<Page<VacancyCard>> search(VacancySearchParams params, {String? cursor, int limit = 20});
  Future<VacancyDetail> detail(String slug);
  Future<void> save(String slug);
  Future<void> unsave(String slug);
  Future<Page<VacancyCard>> saved({String? cursor, int limit = 20});
  Future<List<String>> savedIds();
}

class HttpVacancyApi implements VacancyApi {
  HttpVacancyApi(this._api);
  final ApiClient _api;

  static final _card = decodeObject(VacancyCard.fromJson);
  static final _detail = decodeObject(VacancyDetail.fromJson);

  @override
  Future<Page<VacancyCard>> search(VacancySearchParams params, {String? cursor, int limit = 20}) => _api.getPage(
    '/vacancies',
    item: (json) => _card(json),
    query: {...params.toQuery(), if (cursor != null) 'cursor': cursor, 'limit': limit},
  );

  @override
  Future<VacancyDetail> detail(String slug) => _api.get('/vacancies/$slug', decode: _detail);

  @override
  Future<void> save(String slug) => _api.putVoid('/vacancies/$slug/save');

  @override
  Future<void> unsave(String slug) => _api.deleteVoid('/vacancies/$slug/save');

  @override
  Future<Page<VacancyCard>> saved({String? cursor, int limit = 20}) => _api.getPage(
    '/me/saved-vacancies',
    item: (json) => _card(json),
    query: {if (cursor != null) 'cursor': cursor, 'limit': limit},
  );

  @override
  Future<List<String>> savedIds() => _api.get(
    '/me/saved-vacancies/ids',
    decode: (data) => (data as List<Object?>).map((e) => e as String).toList(),
  );
}

final vacancyApiProvider = Provider<VacancyApi>((ref) => HttpVacancyApi(ref.watch(apiClientProvider)));
