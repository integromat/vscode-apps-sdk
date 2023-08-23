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

## Local development (pre-alpha)

**For testing pursposes only!**

- Clone SDK app to local workspace
- Deploy any code file up to Make (+bulk deploy)
- Rewrite the local file by the never version from Make (download)
- Compare local code file with Make
- Ability to have origins of single local app to beeing able to use for staging
- ApiKey store as local file(s)
- Compatibile with GIT versioning

### Not implemented yet in local development:

- Cloning issue of components with same ID (but different character case only)
  - For example: two modules: `myModule`, `mymodule`
- Icon file
- Local create webhooks, modules, RPCs, functions.
- Pull new components from Make
- Pull all changes from Make
- Smart code highlight and JSON validation.
- IMLJSON suggestions (e.g. `parameters`, `connection` object properties)
- File extension `.imljson` should be renamed to `.iml.json`.

**IMPORTANT NOTE: Local file structure and all these features for local development
                are under development and don't have to be stable yet.**

## Read more in [our documentation](https://docs.integromat.com/apps/apps-sdk).

