import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/company.dart';
import '../models/skill.dart';

class SearchSuggestions {
  SearchSuggestions({required this.titles, required this.companies, required this.skills});

  final List<TitleSuggestion> titles;
  final List<CompanySummary> companies;
  final List<Skill> skills;
}

class TitleSuggestion {
  TitleSuggestion({required this.title, required this.vacancies});

  final String title;
  final int vacancies;
}

abstract interface class SearchApi {
  Future<SearchSuggestions> suggest(String q);
  Future<List<String>> popular();
}

class HttpSearchApi implements SearchApi {
  HttpSearchApi(this._api);
  final ApiClient _api;

  static final _company = decodeObject(CompanySummary.fromJson);
  static final _skill = decodeObject(Skill.fromJson);

  @override
  Future<SearchSuggestions> suggest(String q) => _api.get(
    '/search/suggest',
    query: {'q': q},
    decode: (data) {
      final body = data as Map<String, Object?>;
      return SearchSuggestions(
        titles:
            (body['titles'] as List<Object?>?)
                ?.map((e) {
                  final m = e as Map<String, Object?>;
                  return TitleSuggestion(title: m['title'] as String, vacancies: (m['vacancies'] as num).toInt());
                })
                .toList() ??
            [],
        companies:
            (body['companies'] as List<Object?>?)
                ?.map((e) => _company(e as Map<String, Object?>))
                .toList() ??
            [],
        skills:
            (body['skills'] as List<Object?>?)
                ?.map((e) => _skill(e as Map<String, Object?>))
                .toList() ??
            [],
      );
    },
  );

  @override
  Future<List<String>> popular() => _api.get(
    '/search/popular',
    decode: (data) => (data as List<Object?>).map((e) => e as String).toList(),
  );
}

final searchApiProvider = Provider<SearchApi>((ref) => HttpSearchApi(ref.watch(apiClientProvider)));
