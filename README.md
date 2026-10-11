# Script Finder 1.0.0

Private source repository for personal use. The ready-to-install Violentmonkey file is [`script-finder.user.js`](script-finder.user.js). Source code, tests, and both build targets are included.

## Install from this private repository

Sign in to GitHub, open `script-finder.user.js`, and download or copy the complete file. In Violentmonkey, choose **New script**, replace the editor contents, and save. Disable the original Magic Userscript+ first.

Updates are manual for this private repository: download or copy the new version and replace the installed script when you choose to update. Private GitHub downloads require authentication; do not put a GitHub token or temporary signed URL in userscript metadata. No automatic update credentials are embedded.

Find userscripts for the website you are visiting in Firefox on Debian. This package includes a Violentmonkey userscript and a dedicated Firefox extension. Both automatically load Greasy Fork and Sleazy Fork site catalogs and GitHub repository candidates, with direct searches across more services.

Script Finder finds installable `.user.js` enhancements. It does not list the ordinary JavaScript resources a website loads. Use Firefox Developer Tools → Network → JS for those resources.

## Choose one installation

Disable **Magic Userscript+ : Show Site All UserJS** first. Script Finder is a new replacement, versioned independently of the original 8.1.0. Install either the userscript or extension to avoid duplicate lookups and controls. The extension still needs Violentmonkey, or another userscript manager, to install and run the scripts you discover.

### Violentmonkey — simplest setup

1. Keep Violentmonkey installed and enabled in Firefox.
2. Open `script-finder.user.js` with Violentmonkey and approve its installation.
3. If opening a local file does not show an installation screen, open the Violentmonkey dashboard, choose **New script**, replace the editor contents with the entire `.user.js` file, and save.
4. Reload a normal website. The floating **JS** button opens Script Finder.

No Firefox signing preference change is needed for this version. The script uses Violentmonkey's content injection context and has no remote JavaScript dependencies.

### Dedicated extension — Firefox Nightly

The supplied `script-finder-firefox.xpi` is **unsigned**, so Firefox Nightly is relevant to installation.

For installation that survives browser restarts:

1. In Nightly, open `about:config`.
2. Find `xpinstall.signatures.required` and set it to `false`.
3. Open `about:addons`, choose the gear menu → **Install Add-on From File…**, and select `script-finder-firefox.xpi`.
4. Confirm Firefox's installation prompt. Pin Script Finder in the toolbar if needed, then open an ordinary website. Click its toolbar button to open the popup. To keep results visible while browsing, select **Script Finder** in Firefox's sidebar selector or **View → Sidebar** menu.

The signing preference applies to the browser profile, not just Script Finder. No browser setting is changed automatically. Mozilla documents this option for Nightly and Developer Edition; standard release Firefox requires a signed package. [Mozilla's signing instructions](https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox).

For a temporary test without changing the signing preference, open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**, then select `manifest.json` in the supplied `script-finder-firefox` folder. If you only downloaded the XPI, extract it as a ZIP archive and select its `manifest.json`. Use the packaged files so all bundled dependencies are present. A temporary installation is removed when Firefox restarts. [Mozilla's temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

## Daily use

- Open a website: enabled automatic providers fetch its first result page. The userscript provides a floating **JS** button; the extension provides a toolbar badge and sidebar.
- Review a result's source, author, description, and date. Open the script page or `.user.js` link, then let Violentmonkey handle installation.
- Use **Load more** for additional result pages. Counts describe loaded results, not the total number of scripts on the internet.
- The initial search uses the registrable site domain. Enter an exact subdomain in **Search site** when it has a separate catalog. Use **All-site scripts** for the separate catalog group of broadly applicable scripts. The bundled Public Suffix List recognizes domains such as `example.co.uk` and independently hosted sites.
- Turn off automatic fetching or individual providers in settings; manual searches remain available. Use **Clear cached results** to remove cached host lookups and results.

Greasy Fork and Sleazy Fork results include all languages. Their site catalogs identify possible matches for a host; the userscript manager checks each installed script's precise `@match`, `@include`, and exclusion rules. GitHub results are **repository candidates**, so inspect their `.user.js` files before installing anything. [Violentmonkey's matching documentation](https://violentmonkey.github.io/api/matching/).

The panel includes 13 external search links: Greasy Fork, Sleazy Fork, OpenUserJS, Userscript.Zone, ScriptCat, GitHub code, GitHub repositories, GitHub Gists, GitLab, Codeberg, Gitee, SourceHut, and web search. These links open the services' own searches; they are distinct from the three automatic result providers. GitHub code search may require sign-in. No API key is required or supported by this release.

No tool can enumerate every repository or script. Private, unindexed, removed, blocked, and self-hosted scripts may be absent. Catalog membership also does not establish whether a script still works.

## Privacy and caching

Automatic discovery sends the selected hostname or site domain to the enabled providers. It omits the current page's path, query string, fragment, and login information. Providers still see your IP address and normal network request headers. Disable automatic fetching or a provider if you do not want those lookups.

Results and settings stay in local extension or Violentmonkey storage. Successful Greasy Fork/Sleazy Fork pages are cached for 30 minutes, GitHub pages for 1 hour, and errors for 1 minute; persistent cache storage is limited to 120 result pages. Script Finder has no telemetry, remote code dependencies, automatic script installation, or execution of discovered code. See `PRIVACY.md` in the source archive for details.

The extension is disabled in private browsing. When Violentmonkey reports a private window, the userscript disables automatic lookups; a manual search uses an in-memory result cache. Desktop Firefox on Debian is the target. Mobile Firefox has lower priority and has not been verified.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Original panel still appears | Disable the original Magic Userscript+ script and reload. |
| No floating JS button | Confirm the new script and Violentmonkey are enabled; reload an ordinary HTTP/HTTPS HTML page. Firefox internal pages, add-on pages, local addresses, and some protected pages do not permit or qualify for discovery. |
| Extension cannot be installed | Confirm this is Firefox Nightly and the unsigned installation steps above were followed, or use the Violentmonkey version. |
| Extension disappears after restart | It was loaded temporarily through `about:debugging`; use the persistent Nightly installation above. |
| No automatic results | Check automatic/provider settings. Private browsing suppresses automatic lookups. An empty catalog can be valid; try a broader site scope or an external search. |
| HTTP 403/429 or GitHub cooldown | The provider blocked or rate-limited the request. Wait, disable that provider temporarily, or use its search link. Anonymous GitHub search has strict limits. |
| HTTP 404 | The repository may restrict that host or the endpoint may be unavailable. The error is displayed separately from an empty result list. |
| Non-JSON response | The service may have returned an anti-bot challenge. Open its search link in Firefox. |
| Results seem stale | Refresh the lookup or clear the cache. This does not update or remove other installed userscripts. |
| Listed script will not run | Inspect its own metadata and instructions. Script Finder discovers candidates; Violentmonkey controls their execution. |

The included `DIAGNOSIS.md` explains the original script's observed failure and limits of the repair. Neither variant has an upstream automatic update URL; replace it manually when a newer Script Finder package is supplied.

## Build and check the source

Clone this repository or use GitHub’s **Code → Download ZIP**, open a terminal in the source directory, and run:

```sh
python3 build.py
```

Building uses Python 3's standard library; Node.js is not needed to generate the userscript and unsigned XPI. The build command reports the generated file locations under `dist/`. Generated XPI/ZIP packages are not checked into this repository. When changing source code, rebuild and copy `dist/script-finder.user.js` to the repository-root `script-finder.user.js` before committing, so the ready-to-install file stays current.

To run the shared core tests, with Node.js installed:

```sh
node --test tests/*.test.cjs
```

These tests cover shared discovery logic and the Violentmonkey API adapter. See `TEST-RESULTS.md` for the real Firefox Nightly checks performed for this package. No package has been submitted to Mozilla for signing.

The new application code is MIT licensed. Bundled Public Suffix List data is MPL 2.0; see `LICENSE` and `THIRD-PARTY-NOTICES.md`.
