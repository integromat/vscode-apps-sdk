Change Log
==========

2.2.5 [2024-12-18]
------------------

- Added keyboard shortcut for deployment.
- Added support for the theme property of the banner directive in the App Interface.
- Fixed the in-editor validation of `makecomapp.json` file.
- Added feature "delete component" into Local Development for Apps.
- Added interface `type='banner'` into JSON schema.
- Rapidly improved deployment of local app files. Only the changed data are being deployed now.
- Added "Apply for all" into component mapping alignment process.
- Added feature "Remember origin and do not ask again".
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
