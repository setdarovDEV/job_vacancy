import '../../../../core/l10n/l10n.dart';
import '../../data/models/application.dart';
import '../../data/models/resume.dart';

extension ResumeL10n on AppLocalizations {
  String resumeVisibilityText(ResumeVisibility v) => switch (v) {
    ResumeVisibility.public => resumeVisibilityPublic,
    ResumeVisibility.appliedOnly => resumeVisibilityAppliedOnly,
    ResumeVisibility.hidden => resumeVisibilityHidden,
  };

  String resumeVisibilityHintText(ResumeVisibility v) => switch (v) {
    ResumeVisibility.public => resumeVisibilityHintPublic,
    ResumeVisibility.appliedOnly => resumeVisibilityHintAppliedOnly,
    ResumeVisibility.hidden => resumeVisibilityHintHidden,
  };

  String resumeEducationLevelText(ResumeEducationLevel level) => switch (level) {
    ResumeEducationLevel.secondary => resumeEducationLevelSecondary,
    ResumeEducationLevel.vocational => resumeEducationLevelVocational,
    ResumeEducationLevel.incompleteHigher => resumeEducationLevelIncompleteHigher,
    ResumeEducationLevel.bachelor => resumeEducationLevelBachelor,
    ResumeEducationLevel.master => resumeEducationLevelMaster,
    ResumeEducationLevel.phd => resumeEducationLevelPhd,
  };

  String resumeLanguageLevelText(ResumeLanguageLevel level) => switch (level) {
    ResumeLanguageLevel.a1 => resumeLanguageLevelA1,
    ResumeLanguageLevel.a2 => resumeLanguageLevelA2,
    ResumeLanguageLevel.b1 => resumeLanguageLevelB1,
    ResumeLanguageLevel.b2 => resumeLanguageLevelB2,
    ResumeLanguageLevel.c1 => resumeLanguageLevelC1,
    ResumeLanguageLevel.c2 => resumeLanguageLevelC2,
    ResumeLanguageLevel.native => resumeLanguageLevelNative,
  };

  String applicationStatusText(ApplicationStatus s) => switch (s) {
    ApplicationStatus.sent => applicationStatusSent,
    ApplicationStatus.viewed => applicationStatusViewed,
    ApplicationStatus.invited => applicationStatusInvited,
    ApplicationStatus.interview => applicationStatusInterview,
    ApplicationStatus.hired => applicationStatusHired,
    ApplicationStatus.rejected => applicationStatusRejected,
    ApplicationStatus.withdrawn => applicationStatusWithdrawn,
  };
}
