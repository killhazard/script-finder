# Script Finder 1.0.0 privacy notes

Script Finder is a local userscript or Firefox extension. It has no developer-operated server, analytics, telemetry, account system, or API-key feature.

## Requests triggered by browsing

Automatic fetching is enabled initially for Greasy Fork, Sleazy Fork, and GitHub. For an eligible HTTP/HTTPS website, Script Finder sends the selected hostname or registrable site domain as a search parameter to:

- `api.greasyfork.org` for the Greasy Fork catalog.
- `api.sleazyfork.org` for the Sleazy Fork catalog.
- `api.github.com` for repository candidates.

These searches reveal the domain being looked up to each enabled provider. Script Finder excludes the page's path, query string, fragment, username, and password from those search parameters. Its API requests omit credentials. The services receive your IP address and ordinary network headers, and their own policies apply to their processing and logs.

Disable **automatic fetching** to require a manual search, or disable individual providers in settings. Cached results can avoid a fresh network request. A manual refresh or subsequent result page can make another request.

The 13 external search links send the selected domain to the chosen service only when opened. Opening a result or `.user.js` link is a separate user action and follows that website's normal browser behavior; Script Finder's discovery request rules do not control the destination service or another extension.

## Local data

Script Finder stores:

- Four boolean preferences: automatic fetching and the three provider switches.
- Cache keys containing provider, selected host, and result-page number.
- Result metadata, fetch time, expiry time, and provider errors.

Storage is local Firefox extension storage or Violentmonkey script storage, depending on the installed variant. Nothing is synchronized through a Script Finder account. Successful catalog pages expire after 30 minutes; GitHub pages after 1 hour; errors after 1 minute. Persistent storage holds at most 120 cached pages, with expired entries pruned during subsequent writes. Expiry stops reuse; it is not a scheduled secure-erasure process.

Use **Clear cached results** to delete Script Finder's cached host lookups and results. Settings remain. Cache removal does not erase provider-side logs or affect scripts managed by Violentmonkey. Userscript and extension installations have separate storage.

## Private browsing and excluded pages

The dedicated extension does not run in private browsing. When the userscript manager identifies a private window, Script Finder suppresses automatic searches and keeps manually requested result caching in memory, without writing those results to persistent cache storage. Existing preferences may still be read. Private-mode detection depends on the userscript manager reporting that state correctly.

Automatic discovery excludes non-web URLs, IP addresses, single-label hosts, and common local/reserved names such as localhost and `.local`. No detector can recognize every private organization domain. Use automatic/provider settings to control lookups for domains whose names you consider sensitive.

## Code and permissions

The extension observes tab URLs to identify the website and show matching results. The userscript runs on eligible top-level web pages to display its control. Both variants contain their interface and discovery code locally and use a bundled Public Suffix List. No remote JavaScript library is downloaded at runtime.

Script Finder reads repository metadata; it does not execute, automatically install, or modify the scripts it discovers. Clicking an installation link hands the decision to Firefox and the installed userscript manager. Permissions and behavior of an installed third-party script must be assessed separately.
