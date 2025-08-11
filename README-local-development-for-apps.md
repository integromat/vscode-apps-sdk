Local Development for Apps
=================================

Documentation / Manual
----------------------

### How to use Local Development for Apps

The idea is that a developer can `clone` a whole Custom App from Make to local files. Files are `pulled` to the workspace currently opened in VS Code. From this point, all local files are "disconnected" from Make until a developer `deploys` them back to Make. Therefore, a developer can work on changes as long as needed without affecting the Custom App running in Make. When all necessary changes are made locally, a developer can `deploy` changes back to Make. There is also a way to `pull` changes made in Make and update the local files in case somebody modifies the Custom App `codes` directly on the Make UI or by using the VS Code Extension online editing.

To ensure what code is currently in Make, the developer can `Compare with Make` by right-clicking on any local code file. Then the diff window (remote vs. local) will be displayed in VS Code.

### Terms used in Local Development for Apps feature

- `component` - One section of an app. Each component is one of the following types:
                module, connection, RPC, custom function, webhook.
- `code` - Each file (mostly JSON) is named `code` and it is part of a `component`
           or it belongs to the app itself directly (like `Base`, `Common` or `README`).
- `clone` - The process of cloning a Custom App from Make into a newly created local directory in your opened workspace.
- `pull` - The process that updates or inserts a local component (or its code) loaded from a remote origin (Make).
- `deploy` - The process of pushing/uploading a local component or code to a remote origin (Make).
- `remote`, `origin`, `Make` - Make.com or a similar public cloud Make instance or private Make instance.

### How to clone an app to local files

1. Open the workspace (local directory) where a Custom App should be placed.

   *Note: Monorepo style is supported. This means multiple Custom Apps can be placed in the same workspace.*

2. In VS Code's Activity Bar, click on the tab `Make apps` to see all your already existing Custom Apps.

   *Note: The `Make Apps SDK` VS Code extension is expected to be installed and the environment with ApiKey already configured.*

3. Use the right mouse button to click on any Custom App and select the `Clone to local workspace` context menu item.

   ![Clone menu item](https://github.com/integromat/vscode-apps-sdk/blob/master/resources/readme/localdev/clone-to-local.png?raw=true)

4. The process asks you to select a destination directory. The default is the `src`.

   *Note: If you intend to have multiple apps in a single workspace, each app must be cloned into a different subdirectory.*

5. When the `clone` process is finished, VS Code switches the view to File Explorer, where newly pulled files are placed and the app `README` file will be opened.

6. GIT code versioning (optional step):

   1. Create a new git repository in the vscode app folder by running `git init`.
   2. Add all files and make the first commit by running `git add -A; git commit -m "init"`

   ... Now your app code is versioned! You can use `git` commands as usual.

   *After this step, the local development is ready to use! 👍*

   ![Locally cloned app](https://github.com/integromat/vscode-apps-sdk/blob/master/resources/readme/localdev/cloned-locally.png?raw=true)

### Local clone structure

When the Custom App is cloned into local files, it is created in some subdirectory (mostly `src`). In this directory, the most important file is `makecomapp.json`, which is the main file of the whole project. It contains the list of all components, app metadata, and links to all component code files. Anytime a new component is created, it must be defined in this `makecomapp.json` file. When a developer right-clicks on this file, they can perform a couple of additional actions for managing/editing/deploying the project local code.

Many actions can also be executed on a sub-part of the project only. For this case, the right-click can be used on any component's subdirectory or on any component code file.

### Deploy local changes to Make

The Custom App (including all changes) can be deployed back to Make (referred to here as `remote origin`). To do this, right-click on the `makecomapp.json` file and select `Deploy to Make`.

The same action `Deploy to Make` can also be performed on any code file, component directory, or any project directory. This triggers the deployment of specified files only (not the whole application).

![Context menu actions](https://github.com/integromat/vscode-apps-sdk/blob/master/resources/readme/localdev/context-menu-actions.png?raw=true)

If some component does not exist in Make or in local files yet, then the developer sees a popup dialog with a selection on how to pair it and solve this asymmetry.

![Component pairing dialog](https://github.com/integromat/vscode-apps-sdk/blob/master/resources/readme/localdev/component-pairing.png?raw=true)

### Add new components

You can create a new app component (module, webhook, etc.) in two ways:

- Create the component locally, edit local files, and then deploy to Make by:

    1. Right-click on the `makecomapps.json` and select `Create [component-type] Component`.

- __or__ Create the component online and then pull it to local by:

    1. Create a new app component online (via the online part of the VS Code Extension or via "Custom Apps" in the Make web interface).

    2. Right-click on the `makecomapps.json` and click `Pull New Components from Make`.

### Storing ApiKey during local development

When using app local development, the API key is stored in the `[workspaceRoot]/.secrets/apikey` file. When multiple origins or multiple apps are placed in a single workspace, there will be multiple files.

Note: The `.secrets` directory is automatically added to `.gitignore` to avoid accidentally committing it into a GIT repository.

### Multiple remote origins

Each locally developed Custom App is cloned from its remote origin. The origin (Make API URI with the API key) is defined in `makecomapp.json` in the section `origins`. By default, each app has one origin. But this can be extended with an unlimited count.

You will be asked by a VS Code dialog to choose the origin from the list on each interaction with a remote app in Make (deploy, pull, ...).

![Multiple origins selection dialog](https://github.com/integromat/vscode-apps-sdk/blob/master/resources/readme/localdev/origin-selection.png?raw=true)

The purpose of this feature is to cover the case where developers have also another Custom App(s) in Make used for development or testing stages.

#### Adding the second (and further) remote origin

This can be useful if you would like to deploy your application to another place.
A common case is that you have a second application in Make, which you are not using as a production application,
but that app is for development and testing purposes only.

You can add the origin by selecting the last option in the origin selection dialog during any `Deploy to Make` action. The wizard will prefill the new origin in the `makecomapp.json` file in the section `origins`, then you will finalize adding the origin by editing these prefilled template values.

![Multiple origins selection dialog](https://github.com/integromat/vscode-apps-sdk/blob/master/resources/readme/localdev/origin-selection.png?raw=true)

![Added origin: template code](https://github.com/integromat/vscode-apps-sdk/blob/master/resources/readme/localdev/new-origin-template.png?raw=true)

#### Mapping subcomponents in different application versions

In certain cases, managing multiple versions of the same application is required, which is feasible, but one must consider that some subcomponents may be owned by a different application version. In such cases, component content can only be modified from the home/owning application version.

### Git usage

The local development feature is fully compatible with Git. Use `git init` at any time in the workspace and manage your Git repository as usual.

During the app clone to the local workspace, the `.gitignore` file is created automatically with the following files to exclude from Git:

- `.secret` directory, because it contains the private API key(s).

Consider excluding `common.json` if it contains any secrets or sensitive data in your app.
