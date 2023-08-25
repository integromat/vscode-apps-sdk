# Make Apps SDK plugin for Visual Studio Code

## Features

- Source code editor with syntax highlighter and hints
- Icon editor
- Version control
- Apps control (CRUD modules, RPCs, connections, ...)
- Documentation editor
- Faster and more comfortable than the web interface
- Everything in one place
- ... and much more

**Read more in [our documentation](https://docs.integromat.com/apps/apps-sdk).**

---

## Upcomming feature: Local development (pre-alpha)

### Features status

**For testing purposes only!**

- Clone SDK app to local workspace
- Deploy any code file up to Make (+bulk deploy)
- Rewrite the local file by the never version from Make (download)
- Compare local code file with Make
- Ability to have multiple origins of single local app to beeing able to use for staging
- ApiKey store as local file(s)
- Pull new components from Make
- Compatibile with GIT versioning

#### Not implemented yet in local development:

- "Deploy all" by click to `makecomapp.json`.
- Handle of multiple apiKey files in same workspace.
- Smart code highlight and JSON validation.
- Handle with HTTP 428 api rate limit reach.
- Local create webhooks, modules, RPCs, functions.
- Pull all changes from Make
- IMLJSON suggestions (e.g. `parameters`, `connection` object properties)
- Icon file

#### Fixed/resolved

- Cloning issue of components with same ID (but different character case only)
  - For example: two modules: `myModule`, `mymodule`
  - File extension `.imljson` change to `.iml.json`.

**IMPORTANT NOTE: Local file structure and all these features for local development
                are under development and don't have to be stable yet.**

### Terms used in local development feature

- `component` - One section of app. Each component is one of following type:
                `module`, `connection`, `rpc`, `custom function`, `webhook`.
- `code` - Each one file (mostly JSON) is named `code` and it is the part `component`
           or it belongs to the app itself directly (like `Base`, `Common` or `Readme`).
- `clone` - The process, which clones a SDK app from Make into a newly created local directory in your opened workspace.
- `pull` - The process, which updates or inserts a local component content loaded from a remote origin (Make).
- `download` - The process, which updates the local code (part of the component) loaded from a remote origin (Make).
               `Download` is a part of `pull` process.
- `deploy` - The process, which pushes/uploads a local component or code to remote origin (Make).
- `remote`, `origin` - Make.com or similar public cloud Make instance or private Make instance.
