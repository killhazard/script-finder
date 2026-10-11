# Script Finder 1.0.0 verification

Checked on 2026-10-11 using Debian's installed Firefox Nightly **160.0a1**, Mozilla geckodriver **0.37.1**, and official AMO Violentmonkey **2.49.0**. Browser tests used throwaway profiles, separate from the user's existing Firefox profile.

## Automated logic and adapter checks

**29 tests passed** using:

```sh
node --test tests/*.test.cjs
```

Coverage includes current catalog URLs, array/wrapped responses, pagination, malformed/blocked responses, separate provider failures, safe result links, country/private suffix handling, IDNs, caching and expiry, concurrent lookups/settings, cache-clear races, private-cache isolation, GitHub cooldowns, legacy/modern GM APIs, anonymous requests, timeout/abort handling, and exclusion of local/special pages.

## Real Firefox extension

**14 integration checks passed**: temporary unsigned installation; actual extension messaging and command validation; safe text rendering; filtering; keyboard sorting and Enter-to-search; all-site catalogs; pagination; script-only toolbar badge counts; error badges; provider/automatic switches; active-tab changes; and exclusion of local addresses. No Script Finder extension runtime error was captured in these checks.

A live lookup for `youtube.com` returned **100 Greasy Fork scripts**, **37 Sleazy Fork scripts**, and **30 GitHub repository candidates**. All 137 script records had direct `.user.js` links. The result count was a loaded first-page count, with further pages available.

The real Firefox sidebar opened and fitted its contents correctly. The popup document rendered correctly as an extension page. The floating toolbar popup itself could not be confirmed in headless Firefox; this specific UI interaction remains a manual desktop check.

## Real Violentmonkey installation

**8 real-manager checks passed**. The built `.user.js` was installed through Violentmonkey's confirmation UI, then used on a real HTTPS page. Native clicks verified opening/closing the floating panel, manual searching, loading a second result page, disabling automatic lookup, and clearing cache through GM storage APIs.

Automatic searches for `example.com` returned 68 Greasy Fork scripts, 2 Sleazy Fork scripts, and 30 GitHub candidates. A manual YouTube search returned 100 Greasy Fork and 37 Sleazy Fork scripts; **Load more** increased Greasy Fork results to 200. GitHub's short cooldown appeared visibly during the quick change of scope. There was no Script Finder-attributed console exception; unrelated Firefox/Violentmonkey startup warnings were present.

## Limits of this verification

Counts and repository availability can change. Discovered third-party scripts were not installed or executed. Mobile Firefox, every website/CSP combination, persistent installation across Firefox restarts, and the user's existing profile were not tested. The package is unsigned and has not been submitted to Mozilla.
