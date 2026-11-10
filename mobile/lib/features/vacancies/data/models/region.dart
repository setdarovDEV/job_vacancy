import 'package:freezed_annotation/freezed_annotation.dart';

import 'names.dart';

part 'region.freezed.dart';
part 'region.g.dart';

enum RegionKind { region, city, district }

/// Region node: regions contain cities/districts.
@freezed
abstract class Region with _$Region {
  const factory Region({
    required int id,
    required String slug,
    required RegionKind kind,
    required Names name,
    @Default([]) List<Region> children,
  }) = _Region;

  const Region._();

  factory Region.fromJson(Map<String, Object?> json) => _$RegionFromJson(json);
}
