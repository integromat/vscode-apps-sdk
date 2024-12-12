Change Log
==========

2.2.3 [2024-12-12] (pre-release)
------------------

- Added keyboard shortcut for deployment
- Fixed issue with deleting local components when their name includes a number

2.2.2 [2024-11-28] (pre-release)
------------------

- Added support for the theme property of the banner directive in the App Interface.
- Fixed an issue where deleting components with camelCase names was not functioning correctly.
- Fixed the in-editor validation of `makecomapp.json` file.

Why "pre-release": This build is "Release candidate". If internal tests pass without objection, it will be published. We don't have any other blockers.

2.2.1 [2024-11-05] (pre-release)
------------------

- Fixed broken extension 2.2.0 initialization.

2.2.0 [2024-11-04] (pre-release)
------------------

- Added feature "delete component" into Local Development for Apps.
- Added interface type='banner' into JSON schema.
- Rapidly improved deployment of local app files. Only the changed data are being deployed now.
- Added "Apply for all" into component mapping alignment process.
- Added feature "remember origin and do not ask again".
- Updated URLs to Custom Apps documentation.
- Removed dependency on `static.integromat.com` web.
- Updated list of autocompleted/suggested IML functions.

2.1.0 [2024-10-09]
------------------

- Fixed the IML spead operator`"{{...}}": "{{something}}"` highlighting.
- Improved wizard of new module: Added questions for connection and alternative connection.
- Added the in-editor validation of `makecomapp.json` project file.
- Fixed the issue `"options.maxOutputLength" is out of range` occured during ZIP import.

2.0.0 [2024-07-02]
--------------------

### New feature: Local Development for Apps

The entire Make app can become a folder on your local computer, and you can version it with GIT like any common source code.
Local Development for Apps is a game-changing feature that bridges the gap between your local development environment and apps hosted on Make.
It empowers developers to work efficiently, iterate faster, and have a full control of changes, history and deployment of applications - all without disrupting the live apps running in production.

### Other improvements, changes, fixes

- Added `imt-vsce-local-mode` HTTP header for selected requests.
- Changed header `x-imt-apps-sdk-version` to `imt-apps-sdk-version`.
- Implemented telemetry. Follows official VSC extension guidelines and respects user's VSCode global telemetry preference.
- Updated (iml)json language features to latest version from microsoft/vscode github repo (used json language server 9.0.1)
- Fix: Custom IML function unit testing was not able to test recursive functions
- Enabled document indent autodetection during autoformat (spaces vs. tabs)
- Migrate `vm2` to `node:vm`
- Renamed some context menu item texts
- Library `@integromat/iml` update from v2 to v3
- More user friendly errors in case of invalid code's JSON structure
- Removed redundant extension "activationEvents" from package.json
- Custom function testing fails, when using another custom function (#105)
- Added publication VSCode context flag `isPreReleaseVersion` for being able to build production and pre-release versions from same codebase.

1.3.27 [2023-08-03]
------

### Fixed

- Error during app import (#21)
- Fail to save file kept open during VS Code restart
- Fail to activate the extension for new users with no settings (#87)
- Fail to display opensource app icons in treeview (#82)
- Fail to load apps list if there is single app with multiple versions (#91)

### Changes

- Keep original indent of JSON files. Do not execute the auto format automatically.
- Update dependencies `request-light`, `uuid`, `vscode-json-languageservice`, `vscode-languageclient`, `vscode-languageserver`, `tempy`
- First environment configuration process is more friendly (#87)
- Opensource apps rename to "Examples" (#95)

1.3.22 [2023-07-18]
------

### Fixed

- Module deletion
- Attempts to upload files not belonging to extension
- Error in case of parameters defined as rpc://

### Changes

- Temporary directory is removed on the end of extension lifecycle
- Prevent to remove empty JSON lines by autoformat
- Update `vm2` library to `3.9.19`
- Error handling improvement
- Remove `mkdirp` library - refactorize to build-in function
- Refactorize `request`, `request-promise` library to `axios`
- Update `jsonc-parser` library from `v2` to `v3`
- Update `jimp` library from `0.10.3` to `0.22.8`

### Removed

- Connection template "Digest auth"

## [2.2.0](https://github.com/integromat/vscode-apps-sdk/compare/v2.1.0...2.2.0) (2024-12-12)


### Features

* "remember origin and do not ask again" ([#216](https://github.com/integromat/vscode-apps-sdk/issues/216)) ([81dac95](https://github.com/integromat/vscode-apps-sdk/commit/81dac953510ce326e2edc4aa3813cde4d2578cac))
* add "Apply for all" in component mapping alignment process ([#210](https://github.com/integromat/vscode-apps-sdk/issues/210)) ([03a114f](https://github.com/integromat/vscode-apps-sdk/commit/03a114fbe368bd8bf45559a40d4e5ee5134ce579))
* add action to remove component dependencies on deletion ([#221](https://github.com/integromat/vscode-apps-sdk/issues/221)) ([a113f51](https://github.com/integromat/vscode-apps-sdk/commit/a113f51b41a777104f835fee8fbd601685e864c1))
* add keyboard shortcut for deployment ([#236](https://github.com/integromat/vscode-apps-sdk/issues/236)) ([bcd2344](https://github.com/integromat/vscode-apps-sdk/commit/bcd23441cda332e5f3638ab790f0e836c13c2d3f))
* add support for banner theme into parameters.json ([#232](https://github.com/integromat/vscode-apps-sdk/issues/232)) ([2b1f07c](https://github.com/integromat/vscode-apps-sdk/commit/2b1f07ce17c7be825e0cd7f6a5f941dfb3df4179))
* handle IML function "access denied" errors ([#209](https://github.com/integromat/vscode-apps-sdk/issues/209)) ([c656aa6](https://github.com/integromat/vscode-apps-sdk/commit/c656aa62464059978f96404fafbb04733b79b49c))
* **parameters.json:** extend json schema by type banner ([#218](https://github.com/integromat/vscode-apps-sdk/issues/218)) ([ca315d7](https://github.com/integromat/vscode-apps-sdk/commit/ca315d741190f9c8be4a145b6d160d2b376ec3c3))
* speed up deployment of single files/components ([#206](https://github.com/integromat/vscode-apps-sdk/issues/206)) ([22feca5](https://github.com/integromat/vscode-apps-sdk/commit/22feca55908b88189c16d398aa29cbe429ce5878))


### Bug Fixes

* avoid console error during readDirectory() ([#219](https://github.com/integromat/vscode-apps-sdk/issues/219)) ([29892a8](https://github.com/integromat/vscode-apps-sdk/commit/29892a893640d2f932b2162c39d4f33ebec7ce85))
* **build:** fix build 2.2.0 missing file ([#230](https://github.com/integromat/vscode-apps-sdk/issues/230)) ([eee2fb9](https://github.com/integromat/vscode-apps-sdk/commit/eee2fb9e2b9664f3a43444304b93045f8f966a13))
* fix issue with deleting local components when their name includes a number ([#246](https://github.com/integromat/vscode-apps-sdk/issues/246)) ([f6f81ed](https://github.com/integromat/vscode-apps-sdk/commit/f6f81ed833fe9d073d61e19bff4f779a9009424d))
* fix issue with deleting local components when their name includes a number ([#247](https://github.com/integromat/vscode-apps-sdk/issues/247)) ([5109974](https://github.com/integromat/vscode-apps-sdk/commit/510997446a232711cd2ba11584e2f41f49995d13))
* in-editor `makecomapp.json` validation ([#234](https://github.com/integromat/vscode-apps-sdk/issues/234)) ([bce3e1c](https://github.com/integromat/vscode-apps-sdk/commit/bce3e1caebdd4be8e9aa01aa6e270147f7a34440))
* update URLs to Custom Apps documentation ([#220](https://github.com/integromat/vscode-apps-sdk/issues/220)) ([1286145](https://github.com/integromat/vscode-apps-sdk/commit/1286145ff2b1f8cd171d25c53f57ba2309baf398))


### Miscellaneous Chores

* app version bump to 2.2.3 ([#252](https://github.com/integromat/vscode-apps-sdk/issues/252)) ([6aa2a49](https://github.com/integromat/vscode-apps-sdk/commit/6aa2a4931d646b58575ebb68d8e27ad02916db84))
* changelog for v 2.2.2 ([#240](https://github.com/integromat/vscode-apps-sdk/issues/240)) ([103aa28](https://github.com/integromat/vscode-apps-sdk/commit/103aa2840f85d4d6cc194cd070d3e0d175e75db3))
* gitignore improvement ([#212](https://github.com/integromat/vscode-apps-sdk/issues/212)) ([92f91fd](https://github.com/integromat/vscode-apps-sdk/commit/92f91fdbaec8ee7915e6e6f73bdcbab2bb72c710))
* improve localDeleted description ([#227](https://github.com/integromat/vscode-apps-sdk/issues/227)) ([5abaaa1](https://github.com/integromat/vscode-apps-sdk/commit/5abaaa16e617813b6ddda6bf1adf3797f3eacafc))
* update dependabot branch to master ([823a430](https://github.com/integromat/vscode-apps-sdk/commit/823a4309a781d7a82e4ed07661ff40dccb20e78e))


### Documentation

* add one line comment to tsconfig-&gt;include section ([#231](https://github.com/integromat/vscode-apps-sdk/issues/231)) ([bc5bdca](https://github.com/integromat/vscode-apps-sdk/commit/bc5bdca70a906038893fdda6becb27cba9d11b18))


### Code Refactoring

* import -&gt; import type ([#229](https://github.com/integromat/vscode-apps-sdk/issues/229)) ([40f7517](https://github.com/integromat/vscode-apps-sdk/commit/40f7517692896aad9b5e622da8c025dde1531a53))
* load IML documentation from lib, not via http ([#222](https://github.com/integromat/vscode-apps-sdk/issues/222)) ([648b608](https://github.com/integromat/vscode-apps-sdk/commit/648b60874dc89e460cae0938470caf8995028db2))


### Build System

* app version bump to 2.2.0 ([#228](https://github.com/integromat/vscode-apps-sdk/issues/228)) ([9b86560](https://github.com/integromat/vscode-apps-sdk/commit/9b865603a68ea8fdc083000393428754a605324a))
* bump jimp from 0.22.12 to 1.6.0 ([#204](https://github.com/integromat/vscode-apps-sdk/issues/204)) ([32443a0](https://github.com/integromat/vscode-apps-sdk/commit/32443a0266bc773121a17651200d7f715fcb1f56))
* bump mocha from 10.8.2 to 11.0.1 ([#243](https://github.com/integromat/vscode-apps-sdk/issues/243)) ([6e71382](https://github.com/integromat/vscode-apps-sdk/commit/6e71382908643f7a31f358631368c4fec988503c))
* bump the deps-minor-update group with 3 updates ([#250](https://github.com/integromat/vscode-apps-sdk/issues/250)) ([345589e](https://github.com/integromat/vscode-apps-sdk/commit/345589ec510b79645ba2d763d468108889d9ac61))
* bump the devdeps-minor-update group across 1 directory with 3 updates ([#224](https://github.com/integromat/vscode-apps-sdk/issues/224)) ([8982f56](https://github.com/integromat/vscode-apps-sdk/commit/8982f5669f30f8d253dfdc0627e12f18850548ee))
* bump the eslint group with 3 updates ([#248](https://github.com/integromat/vscode-apps-sdk/issues/248)) ([ddad49e](https://github.com/integromat/vscode-apps-sdk/commit/ddad49ecd22cc390fbf5248eea283c25ca56b5d2))
* **dependabot:** group eslint ([96e7901](https://github.com/integromat/vscode-apps-sdk/commit/96e7901da14efc4f16e87fd98d34afb0175353df))
* **dependabot:** ignore glob 11 ([7920e20](https://github.com/integromat/vscode-apps-sdk/commit/7920e20099f25bcf72e9653a5612780f0ebbb29b))


### Continuous Integration

* update release-please.yml ([235e964](https://github.com/integromat/vscode-apps-sdk/commit/235e96412f8d09cd42ac85d4cc1d638daf0f84fd))

## 1.3.19 [2023-04-18]

### Fixed

- `vm2` library security patch

## 1.3.18 [2023-04-11]

### Fixed

- `vm2` library security patch

## 1.3.17 [2023-04-11]

### Fixed

- `vm2` library security patch

## 1.3.16 [2022-12-08]

### New Features

- Implemented to creating a new universal module

## 1.3.15 [2022-11-28]

### Fixed

- Hot Fix of Make domain URL configuation when adding a new environment "eu1.make.com" => "eu1.make.com/api"

## 1.3.14 [2022-11-22]

### Fixed

- Fixed Show changes feature

## 1.3.13 [2022-10-26]

### Fixed

- Rebranded and removed step for version when cloning/creating an app (only admin can)

## 1.3.12

### Fixed

- removed whitespace on Mata.version whitespace

## 1.3.11

### Fixed

- Fixed to retrieve all apps on Make admin eny by Minsu

## 1.3.10

### Fixed

- Renamed Integromat 2.0 to Make

## 1.3.9

### Fixed

- Bad Packaging

## 1.3.8

### Fixed

- Apps Tree Provider

## 1.3.7

### Updated

- Using Update instead of Publish on Web Hooks
- Fixed Top Level string RPC calls in JSONCs
- Fixed Export Command

## 1.3.6

### Fixed

- API Base URL validation

## 1.3.5

### Fixed

- Another part of App Export

## 1.3.4

### Fixed

- App Export

## 1.3.3

### Fixed

- JSON schema validation improved, minor tweaks in schemas

## 1.3.2

### Added

- Support for V2 admin

## 1.3.1

### Fixed

- Extended length on CA field validation (to 8192)

## 1.3.0

### Added

- Support for multiple versions of Apps
- Cloning Apps
- Cloning Modules

## 1.2.9

### Added

- App Archive corruption detection
- App Import failsave
- App Import Rename Option

### Fixed

- Apps Import/Export Tweaks
- Null value guards

## 1.2.8

### Added

- Early Access Connection for 2.0 API

## 1.2.7

### Fixed

- Import for Apps without an icon

## 1.2.6

### Fixed

- Language Server

## 1.2.5

### Modified

- Minor Tweaks

## 1.2.4

### Modified

- Better Environment Management

## 1.2.3

### Fixed

- Connection Changes

## 1.2.2

### Modified

- Path to WHOAMI call in V2

## 1.2.1

### Modified

- Source Upload error messages improved

## 1.2.0

### Added

- Compatibility with the new API version (not available to use yet, but the support is added)

### Fixed and modified

- Several bugfixes and tweaks

## 1.1.2

### Fixed

- Docs Bug

## 1.1.1

### Added

- Apps Descriptions

## 1.1.0

### Added

- Apps Import

### Modified

- Minor tweaks
- Snippet fixes

## 1.0.18

### Added

- Filter snippet
- Alternative Connection Support
- More IML keywords highlight
- RPCs and Modules count in app detail

### Fixed

- Connection rename bracket
- Body not required with delete method

### Modified

- OAuth validation schema
- Editable -> Mappable

## 1.0.17

### Added

- Metadata and Convert to validation schemas
- labels for nested keys in UDT Generator
- Email snippet
- Grouped options to validation schemas
- Commit message support
- Parameter type "any"
- Multiple versions support
- Favorite apps unique select

### Modified

- UDF generator persistent

## 1.0.16

### Added

- Changes support on Groups
- Data Structure Generator
- App Detail page
- Module Detail page

### Modified

- Better module hover
- Better app hover
- Public/Private indicators changed

## 1.0.15

### Added

- Connection data hints when editing "Communication"
- Module description on hover in tree
- Action CRUD type specification support
- Change module type (action <=> search)
- Module groups support
- Universal module view RUD support

## 1.0.14

### Added

- Integer snippet
- Uinteger snippet
- URL snippet
- Mappable directive for parameters

### Fixed

- Validation schema select mode -> chose mistype fixed
- Trigger validation schema -> order unordered
- Default value doesn't jump to array anymore
- Typos in docs
- Date in trigger specification is required only when the trigger type is date

## 1.0.13

### Added

- Export App
- Temp variables provider
- Webhook custom keys validation (verification, respond)

### Fixed

- Docs links
- Empty language select

## 1.0.12

### Modified

- Updated API
- POST/PUT swap

## 1.0.11

### Added

- log(.sanitize) directive validation
- 'x-imt-apps-sdk-version' header to all requests

## 1.0.10

### Modified

- Minor icon endpoint tweaks

### Fixed

- select.options.value type string as default

## 1.0.9

### Added

- Connection type showing in braces
- Module description editation
- Inbuilt (Static) IML functions provider
- Showing docs abstract when adding an inbuild IML function

### Fixed

- Request-Less Communication allowed in JSON validation

## 1.0.8

### Added

- Parameters map builder
- Parameters provider (providing parameters available in the current context)

### Fixed

- Preview/Open behavior (open permanently not forced anymore)
- Select.Options validation schema fixed

## 1.0.7

### Added

- Complex IMLJSON validation
- IMLJSON language server
- IMLJSON keys IntelliSense

### Fixed

- When saving to the server fails, file is marked as unsaved

### Modified

- Disabled old KeywordProvider as it's now replaced with IMLJSON IntelliSense

## 1.0.6

### Added

- JSONC comments support

## 1.0.5

### Added

- Module connection/webhook picker placeholder

### Fixed

- Undefined keyword

### Modified

- Delete Core method

## 1.0.4

### Added

- it function support in IML tests
- Integromat Help command
- Publish / Hide App or Module
- IML tests with users' functions
- Keybind and command for running IML test

### Fixed

- OpenSource apps icons
- Webhook connection picker placeholder

### Modified

- Test output channel

## 1.0.3

### Added

- Readme
- KebabCase for App ID
- Icons for refresh and add app command
- Better tooltips
- JSONC formatter
- Hover provider for parameter types
- Links from hover provider to new docs

### Fixed

- Source Uploader catches only Apps SDK files
- Check mark symbol displaying correctly on UNIX-based systems
- Annoying icon flickering when the app tree is refreshed

### Modified

- Validator messages contains examples
- Added options, validate, nested and value to key hover provider

### Removed

- Google Analytics tracker

## 1.0.2

### Added

- Added repository URL to package.json
- Prepared Google Analytics tracker
- Hover provider for parameters except options, validate and nested

### Fixed

- Removed trailing comma from select param snippet

### Removed

- Removed invalid env message. No reason for displaying it.

## 1.0.1

### Added

- Extension icon

### Modified

- Extension name

## 1.0.0

Initial release
