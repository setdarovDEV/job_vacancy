import 'package:freezed_annotation/freezed_annotation.dart';

import 'names.dart';

part 'category.freezed.dart';
part 'category.g.dart';

/// Category node, possibly with nested children.
@freezed
abstract class Category with _$Category {
  const factory Category({
    required int id,
    required String slug,
    required Names name,
    String? icon,
    @Default([]) List<Category> children,
  }) = _Category;

  const Category._();

  factory Category.fromJson(Map<String, Object?> json) => _$CategoryFromJson(json);
}
