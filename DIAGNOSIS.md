# Original script diagnosis and replacement

Examined the pasted **Magic Userscript+ : Show Site All UserJS 8.1.0** and made read-only requests on 2026-10-11. Line references below refer to the original pasted file, before any edits.

## Confirmed problem: the catalog endpoint returns false empty results

The original Greasy Fork query at line 2395 is:

```text
https://api.greasyfork.org/scripts/by-site/{host}.json?language=all
```

Its Sleazy Fork query at line 2403 uses the same path on `api.sleazyfork.org`.

A live request to the YouTube by-site JSON endpoint returned HTTP 200 with `[]`, while the [Greasy Fork HTML catalog for youtube.com](https://greasyfork.org/en/scripts/by-site/youtube.com?filter_locale=0) showed many scripts. Localized and nonlocalized versions of the JSON path behaved the same way. The original treats an empty array as no scripts at lines 5539–5549. This independently explains missing catalog results; there is no evidence that Firefox Nightly caused that endpoint behavior.

The replacement uses the catalog index API directly:

```text
https://api.greasyfork.org/en/scripts.json?site=youtube.com&filter_locale=0&page=1
```

This returned 100 scripts, and page 2 returned different records. The response's filter identified the YouTube catalog site. A Reddit request identified a different catalog site; an unknown test domain returned `[]`. Sleazy Fork returned 39 records for `reddit.com` and 51 for `xvideos.com` during verification.

These are service catalog matches, not guarantees of exact URL-path applicability. The [Greasy Fork controller source](https://github.com/greasyfork-org/greasyfork/blob/main/app/controllers/concerns/script_listings.rb) confirms the site-domain filter, pagination, language behavior, and blocked-domain response.

## Other behavior in the original

| Original evidence | User-visible effect |
| --- | --- |
| `autofetch: false`, line 2376 | The default configuration does not fetch results automatically. Saved settings can override this. |
| Sleazy Fork, OpenUserJS, and GitHub `enabled: false`, lines 2400, 2408, 2414 | Only Greasy Fork is initially active. |
| GitHub topic-only query, line 2418 | Finds repositories tagged with both expected topics; many relevant repositories have no such tags. |
| GitHub token requirement, lines 5716–5719 | GitHub is skipped without a configured token even though public repository search supports anonymous requests. |
| OpenUserJS HTML selectors, lines 5596–5617 | Depends on the site's current HTML structure. It is more fragile than a supported JSON interface. |
| Only `@match https://*/*`, line 57 | Does not run on ordinary HTTP pages. |
| Built-in finance/social blacklist, lines 2362–2385 | Some pages are deliberately suppressed by the original configuration. |

The original already accepts both a plain result array and `data.query` at lines 5539–5543. A missing wrapper parser was **not** the confirmed fault in the pasted version.

## Service quirks the replacement handles

Current populated Greasy/Sleazy Fork responses can wrap records in `.query`; empty results remain arrays. Script Finder accepts both and displays unknown response formats as errors.

A request to the main Sleazy Fork domain's JSON URL redirected to the API domain while dropping its site parameter during verification. That produced an unfiltered listing. Script Finder calls the API subdomains directly and preserves its query parameters.

The API's `meta=1` response reported a current-page count of 100 for a site with more pages. Script Finder displays loaded counts and **Load more** instead of claiming a complete total. `filter_locale=0` enables all-language results.

Some upstream catalog domains are restricted. For example, the Sleazy Fork Pornhub site query returned 404; the controller source explicitly returns 404 for blocked site entries. Script Finder reports unavailable/restricted results instead of silently treating such responses as no scripts.

[Greasy Fork documents its read-only JSON interface](https://greasyfork.org/en/help/api). Its live behavior and response representation can change; the external search links remain available when a provider fails.

GitHub repository candidates use anonymous public repository search. Its code-search API returned 401 without authentication during verification. GitHub also imposes search limits and a general anonymous API limit. Script Finder caches responses and displays failures; it does not promise every file or repository. [GitHub search API documentation](https://docs.github.com/en/rest/search/search), [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Why a new package

Script Finder is a focused replacement with an independently named Violentmonkey script and Firefox extension. It does not overwrite the original's namespace or point updates at the upstream Magic Userscript+ listing. Disable the old script before installing one variant.

The userscript uses Violentmonkey's content injection context, keeping its interface independent of page-global JavaScript. The extension uses Firefox's extension sidebar and toolbar. The extension's unsigned status affects installation: Nightly supports the documented signing preference override, while a temporary developer installation lasts until restart. [Violentmonkey metadata and injection contexts](https://violentmonkey.github.io/api/metadata-block/), [Mozilla signing instructions](https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox), [Mozilla temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

The investigation establishes these code and endpoint failures. It does not reproduce every interaction of the original in the user's installed Firefox profile, identify a specific Nightly regression, or establish mobile compatibility.
