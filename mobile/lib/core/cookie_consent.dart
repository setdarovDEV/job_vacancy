import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'l10n/l10n.dart';
import 'preferences.dart';

/// The user's cookie consent choice in the mobile app.
/// `essential` keeps only required cookies; `all` also enables analytics.
enum CookieConsent { essential, all }

class CookieConsentController extends Notifier<CookieConsent?> {
  static const _key = 'jv.cookie_consent';

  @override
  CookieConsent? build() {
    final raw = ref.read(sharedPreferencesProvider).getString(_key);
    return _parse(raw);
  }

  Future<void> set(CookieConsent consent) async {
    await ref.read(sharedPreferencesProvider).setString(_key, consent.name);
    state = consent;
  }

  static CookieConsent? _parse(String? value) => switch (value) {
    'essential' => CookieConsent.essential,
    'all' => CookieConsent.all,
    _ => null,
  };
}

final cookieConsentProvider = NotifierProvider<CookieConsentController, CookieConsent?>(CookieConsentController.new);

/// A fixed-position banner shown until the user makes a cookie choice.
class CookieConsentBanner extends ConsumerWidget {
  const CookieConsentBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consent = ref.watch(cookieConsentProvider);
    final l = context.l10n;
    if (consent != null) return const SizedBox.shrink();

    return SafeArea(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Container(
          margin: const EdgeInsets.all(12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l.cookieBannerTitle,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Text(l.cookieBannerBody, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => ref.read(cookieConsentProvider.notifier).set(CookieConsent.essential),
                      child: Text(l.cookieBannerEssentialOnly),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => ref.read(cookieConsentProvider.notifier).set(CookieConsent.all),
                      child: Text(l.cookieBannerAcceptAll),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
