# Third-party notices

## Public Suffix List

Script Finder bundles the Public Suffix List in `shared/public_suffix_list.dat` and a generated representation in `shared/suffix-rules.js`. This identifies registrable domains, including public suffixes such as `co.uk` and private hosting suffixes. It is packaged locally and is not fetched during browsing.

- Source: https://publicsuffix.org/list/public_suffix_list.dat
- Project and instructions: https://publicsuffix.org/list/
- Retrieved: 2026-10-11
- List version: `2026-10-07_07-28-19_UTC`
- Source commit: `3929462652695bad04f0a27afb600974014a3c8b`
- License: [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/)

The original list retains its source notices. The JavaScript representation extracts the list's rules for bundled use. Those data and their generated representation remain subject to MPL 2.0; the new application code is MIT licensed. The corresponding list source is included in the source archive.

Original notice:

```text
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
```

## Original script reference

The user supplied **Magic Userscript+ : Show Site All UserJS**, version 8.1.0, by Magic, as the diagnostic reference. Its metadata declares MIT licensing and points to [magicoflolis/Userscript-Plus](https://github.com/magicoflolis/Userscript-Plus). Script Finder is a new implementation for this request and is not an official release or update of that project. The original script's remote update addresses are not used.

## Repository services

Greasy Fork, Sleazy Fork, GitHub, OpenUserJS, Userscript.Zone, ScriptCat, GitLab, Codeberg, Gitee, and SourceHut are external services. Script Finder queries their public interfaces or opens their search pages; inclusion does not imply endorsement or affiliation. Discovered scripts and repository contents retain their own licenses. No discovered code is bundled with or executed by Script Finder.
