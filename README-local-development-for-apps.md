Local Development for Apps
=================================

Documentation / Manual
----------------------

### How to use Local Development for Apps

The idea is that a developer can `clone` a whole Custom App from Make to local files. Files are `pulled` to the workspace currently opened in VS Code. From this time all local files are "disconnected" from Make until a developer `deploys` them back to Make. Therefore a developer can work on changes as long as he needs without touching on the Custom App running in Make. When all necessary changes are made locally a developer can `deploy` changes back to Make. The whole Custom App can be `deployed` or any `component` can be deployed anytime separately. There is also a way to `pull` changes made in Make and update the local files in case somebody is touching to Custom App `codes` directly on Make UI or by VS Code Extension online editing.

To be sure, what code is currently in Make, the developer can `Compare with Make` by right-clicking on any local code file. Then the diff window (remote vs. local) will be displayed in VS Code.

### Terms used in Local Development for Apps feature

- `component` - One section of an app. Each component is one of the following types:
                module, connection, RPC, custom function, webhook.
- `code` - Each file (mostly JSON) is named `code` and it is the part `component`
           or it belongs to the app itself directly (like `Base`, `Common` or `README`).
- `clone` - The process, which clones a Custom App from Make into a newly created local directory in your opened workspace.
- `pull` - The process that updates or inserts a local component (or its code) loaded from a remote origin (Make).
- `deploy` - The process, which pushes/uploads a local component or code to remote origin (Make).
- `remote`, `origin`, `Make` - Make.com or similar public cloud Make instance or private Make instance.

### How to clone an app to local files

1. Open the workspace (local directory), where an Custom App should be placed.

   *Note: Monorepo style is supported. It means multiple Custom Apps can be placed in the same workspace.*

2. In VS Code's Activity Bar click on the tab `Make apps` to see all your already existing Custom Apps.

   *Note: Expected the `Make Apps SDK` VS Code extension to be installed and the environment with ApiKey is already configured.*

3. Use the right mouse to click on any Custom App and select the `Clone to local workspace` context menu item.

   ![Clone menu item](https://github.com/integromat/vscode-apps-sdk/blob/development/resources/readme/localdev/clone-to-local.png?raw=true)

4. The process asks you to select a destination directory. The default is the `src`.

   *Note: If you intend to have multiple apps in a single workspace, each app must be cloned into a different subdirectory.*

5. When the `clone` process is finished VS Code switches the view to File Explorer, where newly pulled files are placed and the app `README` file will be opened.

6. GIT code versioning (optional step):

   1. Create a new git repository in vscode app folder by `git init`.
   2. Add all files and make first commit by `git add -a; git commit -m "init"`

   ... Now your app code is versioned! You can use `git` commands as usual.

   *After this step the local development is ready to use! 👍*

   ![Locally clonned app](https://github.com/integromat/vscode-apps-sdk/blob/development/resources/readme/localdev/cloned-locally.png?raw=true)

### Local clone structure

When the Custom App is cloned into local files, it is created into some subdirectory (mostly `src`). In this directory, the most important file is `makecomapp.json` which is the main file of the whole project. There is the list of all components, app metadata and links to all component code files. Anytime a new component is created, it must be defined in this `makecomapp.json` file. When a developer right-clicks to this file, he can perform a couple of additional actions for managing/editing/deploying the project local code.

Many actions can be also executed on a sub-part of the project only. For this case, the right-click can be used on any component's subdirectory or on any component code file.

### Deploy local changes to Make

Custom App (including all changes) can be deployed back to Make (named here as `remote origin`). For this action do a right mouse click over `makecomapp.json` file and select `Deploy to Make`.

The same action `Deploy to Make` can be also performed over any code file, component directory or over any project directory. This evokes the deployment of specified files only (not the whole application).

![Context menu actions](https://github.com/integromat/vscode-apps-sdk/blob/development/resources/readme/localdev/context-menu-actions.png?raw=true)

If some component does not exist in Make of in local files yet, then the developer sees the popup dialog with selection, how to pair it and solve this asymentry.

![Component pairing dialog](https://github.com/integromat/vscode-apps-sdk/blob/development/resources/readme/localdev/component-pairing.png?raw=true)

### Add new components

You can create new app component (module, webhook, etc.) in two ways:

- Create component locally, edit local files and then deploy to Make by:

    1. Right-click over the `makecomapps.json` and select `Create [component-type] Component`.

- __or__ Create component online and then pull to local by:

    1. Create a new app component online (via the online part of VS Code Extension or via "Custom Apps" in the Make web interface).

    2. Right-click over the `makecomapps.json` and click `Pull New Components from Make`.

### Storing ApiKey during local development

In the case of using app local development, the API key is stored in the `[workspaceRoot]/.secrets/apikey` file. When multiple origins or multiple apps are placed in a single workspace there will be multiple files.

Note: Path `.secrets` is automatically added into `.gitignore` to avoid accidentally committing into a GIT repository.

### Multiple remote origins

Each locally developer Custom App is cloned from its remote origin. Origin (Make API URI with the API key) is defined in `makecomapp.json` in the section `origins`. By default, each app has one origin. But this can be extended with an unlimited count of origins by a simple edit of this section `origins`.

From the time you define the second origin (or more), you will be asked by VS Code dialog to choose the origin from the list on each interaction with a remote app in Make (deploy, pull, ...).

![Multiple origins selection dialog](https://github.com/integromat/vscode-apps-sdk/blob/development/resources/readme/localdev/origin-selection.png?raw=true)

The purpose of this feature is to cover the case, where developers have also another Custom App in Make used for the development or testing stage.

#### Adding the second (and further) remote origin

This can be useful if you would like to deploy your application to another place.
Common case is that you have second application in Make, which you are not using it as production application,
but that app is for development and testing purposes only.

You can add the origin, when you select the last option in the origin selection dialog during any `Pull All Components From Make` or `Deploy to Make` action. The wizard will help you to fill all required parameters.

### GIT usage

The local development feature is fully compatible with GIT. Use `git init` at any time in the workspace.

During the app clone to the local workspace, the `.gitignore` file is created automatically with the following files to exclude from GIT:

- `.secret` directory, because contains the private API key(s).
