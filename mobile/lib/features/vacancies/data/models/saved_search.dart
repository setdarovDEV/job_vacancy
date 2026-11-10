import 'package:freezed_annotation/freezed_annotation.dart';

part 'saved_search.freezed.dart';
part 'saved_search.g.dart';

@freezed
abstract class SavedSearch with _$SavedSearch {
  const factory SavedSearch({
    required String id,
    required String name,
    required String params,
    @Default(false) bool notify,
    required DateTime createdAt,
  }) = _SavedSearch;

  const SavedSearch._();

  factory SavedSearch.fromJson(Map<String, Object?> json) => _$SavedSearchFromJson(json);
}
