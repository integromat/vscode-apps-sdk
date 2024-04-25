Change Log
==========

1.3.53 (pre-release) [unreleased]
--------------------

- Fixed: References `connection`, `altConnection`, `webhook` are correctly deployed to Make
  during remote component creation and during "Deploy to Make".
- Fixed: New Remote Instant Trigger Module creation works correctly now.
- Improved the local Instant Trigger Module creation wizard.
- Fixed: Action module CRUD is optional value now.
- Improved: Module type and CRUD are updated by "Deploy to Make".

1.3.52 (pre-release) [2024-04-15]
--------------------

- Fixed `Compare with Make` action missing on some file types.
- Apps local development: Fixed the remote components creation.
- The extension is more compatible. Min compatible version downgraded to VS Code 1.82 - August 2023.

### Known bugs

- PRC's references `connection`, `altConnetion` are ignored during "Deploy to Make".
- Modules's references `connection`, `altConnetion` and `webhook` are ignored during "Deploy to Make".
  - Consequences: Cannot create Instant Trigger Module because `webhook` reference is mandatory during module creation.

1.3.51 (pre-release) [2024-04-11]
--------------------

### Changes

- Apps local development: Implemented the cloning/edit/deployment of module's `scope`.
- Apps local development: Project now stores also linked webhooks in Instant triggers.
- Apps local development: Implemented command "pull all components from Make".
- Apps local development: Implemented ability to have multiple app origins, then deploy the code to multiple apps (test, staging, production, etc).
- Apps local development: Implemented the new local components creation.
- Apps local development feature is beta (previously it was alpha version only).
- Removed ability to create connection to legacy Integromat.

1.3.50 (pre-release) [2024-01-04]
--------------------

### Changes

- Updated (iml)json language server to 9.0.1 (+ merged to development)
- Published VSCode context flag `isPreReleaseVersion`.

1.3.35 (pre-release) [2023-10-11]
--------------------

### Fixed

- JSON schemas was not applied for IMLJSON for the case `fileMatch` with multiple items.
- Custom IML function unit testing was not able to test recursive functions

1.3.34 (pre-release) [2023-10-04]
--------------------

### Changes

- Updated (iml)json language features to latest version from microsoft/vscode github repo

### Fixed

- Custom IML function was not correctly available under the namespace `iml.` in another function's body
- JSON syntax error highlighting of IMLJSON was broken in editor

1.3.33 (pre-release) [2023-09-27]
--------------------

### Changes

- Document indent autodetection during autoformat (spaces vs. tabs)

### Fixed

- Error dialog should be displayed in case of error

1.3.32 (pre-release) [2023-09-26]
--------------------

### New features

- New local module -> automatic append to `groups.json`
- Warning dialog when try to clone app into not empty directory

### Fixed

- "Clone to local" menu item misses on published apps
- Ability to clone app into project root

### Changes

- Migrate `vm2` to `node:vm`
- "makecomapp.json not found" error message improvement
- "Workspace" word change to "Folder"

1.3.31 (pre-release) [2023-09-19]
--------------------

### Changes

- Error messages improvements
- Bulk deployment continues to work even after the error occurred. Shows the error report on the end.

1.3.30 (pre-release) [2023-09-12]
--------------------

### New features

- Ability to create local module
- Ability to create remote module in Make
- Local connection creation wizard
- Ability to create all types of connections (Basic, OAuth)
- `makecomapp.json` structure automatic migration/upgrade
- Validate components IDs in `makecomapp.json`
- Directory/files names sanitization for case of unexpected/unsupported symbols in component IDs

### Changes

- `makecomapp.json` module property `moduleSubtype` rename to `moduleType`
- Context menu item texts rename
- Library `@integromat/iml` update from v2 to v3

### Fixed

- More user friendly errors in case of invalid code's JSON structure

1.3.29 (pre-release) [2023-09-06]
--------------------

### New features

- SDK Apps Local Development

### Changes

- Removed redundant extension "activationEvents" from package.json

1.3.28 (pre-release) [2023-08-21]
--------------------

### Fixed

- Custom function testing fails, when using another custom function (#105)

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
