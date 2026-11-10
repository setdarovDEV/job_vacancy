import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../data/models/names.dart';
import '../../data/models/report.dart';
import '../../data/models/vacancy.dart';

extension VacancyL10n on AppLocalizations {
  String employmentType(EmploymentType t) => switch (t) {
    EmploymentType.fullTime => vacancyFullTime,
    EmploymentType.partTime => vacancyPartTime,
    EmploymentType.project => vacancyProject,
    EmploymentType.internship => vacancyInternship,
    EmploymentType.volunteer => vacancyVolunteer,
  };

  String workFormat(WorkFormat f) => switch (f) {
    WorkFormat.office => vacancyOffice,
    WorkFormat.remote => vacancyRemote,
    WorkFormat.hybrid => vacancyHybrid,
  };

  String experience(Experience e) => switch (e) {
    Experience.none => vacancyExpNone,
    Experience.oneToThree => vacancyExp1_3,
    Experience.threeToSix => vacancyExp3_6,
    Experience.sixPlus => vacancyExp6Plus,
  };

  String schedule(Schedule s) => switch (s) {
    Schedule.fullDay => vacancyScheduleFullDay,
    Schedule.shift => vacancyScheduleShift,
    Schedule.flexible => vacancyScheduleFlexible,
    Schedule.rotation => vacancyScheduleRotation,
  };

  String reportReason(ReportReason r) => switch (r) {
    ReportReason.fraud => reportReasonFraud,
    ReportReason.misleading => reportReasonMisleading,
    ReportReason.offensive => reportReasonOffensive,
    ReportReason.spam => reportReasonSpam,
    ReportReason.other => reportReasonOther,
  };
}

String localizedName(BuildContext context, Names names) =>
    names.forLanguage(context.languageTag);

String salaryText(BuildContext context, Salary? salary) {
  if (salary == null || salary.isNegotiable) return context.l10n.vacancyNegotiable;
  return salary.formatted();
}
