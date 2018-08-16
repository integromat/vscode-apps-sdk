const AppsProvider = require('./src/providers/AppsProvider')
const ImlProvider = require('./src/providers/ImlProvider')
const RpcProvider = require('./src/providers/RpcProvider')
const KeywordProvider = require('./src/providers/KeywordProvider')
const OpensourceProvider = require('./src/providers/OpensourceProvider')
const ImljsonHoverProvider = require('./src/providers/ImljsonHoverProvider')

const Core = require('./src/Core')
const QuickPick = require('./src/QuickPick')
const Validator = require('./src/Validator')
const Enum = require('./src/Enum')
const { trackEvent } = require('./src/Tracker')

const request = require('request');
const tempy = require('tempy');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const camelCase = require('lodash.camelcase');
const rp = require('request-promise');
const asyncfile = require('async-file')

const vscode = require('vscode');

var _configuration
var _authorization
var _environment
var _DIR
var currentRpcProvider
var currentImlProvider

async function activate() {
    _DIR = path.join(tempy.directory(), "apps-sdk")
    _configuration = vscode.workspace.getConfiguration('apps-sdk')
    //trackEvent()
    console.log('Apps SDK active.');

    //#region ENV COMMANDS AND HANDLING
    /**
     * Add new environment
     */
    vscode.commands.registerCommand('apps-sdk.env.add', async () => {

        // Prompt for URL
        let url = await vscode.window.showInputBox({
            prompt: "Enter new environment URL (without https:// and API version)",
            value: "api.integromat.com",
            validateInput: Validator.urlFormat
        })

        // Check if filled and unique
        if(!Core.isFilled("url", "environment", url, "An")){ return }
        if(_configuration.environments[url]){
            vscode.window.showErrorMessage("This environment URL has been configured already.")
            return
        }

        // Prompt for environment name
        let name = await vscode.window.showInputBox({
            prompt: "Enter new environment name",
            value: url === "api.integromat.com" ? "Integromat: Production" : ""
        })

        // Check if filled
        if (!Core.isFilled("name", "environment", name)) { return }

        // Prompt for API key
        let apikey = await vscode.window.showInputBox({ prompt: "Enter your Integromat API key" })

        // Check if filled
        if (!Core.isFilled("API key", "your account", apikey, "An", false)) { return }

        // Ping who-am-I endpoint
        let uri = `https://${url}/v1/whoami`
        let response = await Core.rpGet(uri, `Token ${apikey}`)
        if(response === undefined){ return }

        // RAW copy of environments, because _configuration is read only
        let envs = JSON.parse(JSON.stringify(_configuration.environments))

        // Add new env to environments object
        envs[url] = {
            name: name,
            apikey: apikey
        }

        // Save all and reload the window
        Promise.all([
            _configuration.update('login', true, 1),
            _configuration.update('environments', envs, 1),
            _configuration.update('environment', url, 1)
        ]).then(() => {
            //trackEvent()
            vscode.commands.executeCommand("workbench.action.reloadWindow")
        })
    })

    /**
     * Change environment
     */
    vscode.commands.registerCommand('apps-sdk.env.change', async () => {

        // Prompt for environment (show quickpick of existing)
        let environment = await vscode.window.showQuickPick(QuickPick.environments(_configuration), {
            placeHolder: "Choose an environment to use"
        })

        // Check if filled 
        if(!environment){ return }

        // Update active environment in _configuration
        await _configuration.update('environment', environment.description, 1)

        // If new env doesn't contain API key -> set login falsey
        if(_configuration.environments[environment.description].apikey === ""){
            await _configuration.update('login', false, 1)
        }

        // Update envChanger in statusbar and reload the window
        envChanger.text = `$(server) ${environment.label}`
        //trackEvent()
        vscode.commands.executeCommand("workbench.action.reloadWindow")
    })

    /**
     * Status bar ENV CHANGER configuration
     */
    const envChanger = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10)
    envChanger.tooltip = "Click to change your working environment"
    if(_configuration.environment){
        envChanger.text = `$(server) ${_configuration.environments[_configuration.environment].name}`
    }
    else{
        envChanger.text = `$(server) ENVIRONMENT NOT SET`
    }
    envChanger.command = "apps-sdk.env.change"
    envChanger.show()

    /**
     * First launch -> there are no environments
     */
    if(Object.keys(_configuration.environments).length === 0){
        let input = await vscode.window.showWarningMessage("You have no environments set up yet. If you want to start using Apps SDK, you have to add a new one.", "Add environment")
        if(input === "Add environment"){
            vscode.commands.executeCommand('apps-sdk.env.add')
        }
    }
    //#endregion

    if(_configuration.environment != ""){
        
        //#region LOGIN - LOGOUT
        /**
         * Login command
         */
        vscode.commands.registerCommand('apps-sdk.login', async () => {

            // Load environment from configuration
            let environment = _configuration.environments[_configuration.environment]

            // Prompt for API key
            let apikey = await vscode.window.showInputBox({ prompt: `Enter your API key for environment ${environment.name}.`})

            // Check if filled
            if(!Core.isFilled("apikey", "your account", apikey, "An", false)){ return }

            // who-am-I endpoint test
            let uri = `https://${_configuration.environment}/v1/whoami`
            let response = await Core.rpGet(uri, `Token ${apikey}`)
            if(response === undefined){ return }

            // Update environments, save everything and reload the window
            let environments = JSON.parse(JSON.stringify(_configuration.environments))
            environments[_configuration.environment].apikey = apikey
            Promise.all([
                _configuration.update('login', true, 1),
                _configuration.update('environments', environments, 1),
            ]).then(() => {
                //trackEvent()
                vscode.commands.executeCommand("workbench.action.reloadWindow")
            })
        })
    
        /**
         * Logout command
         */
        vscode.commands.registerCommand('apps-sdk.logout', async () => {

            // Confirmation prompt
            let answer = await vscode.window.showQuickPick(Enum.logout, {
                placeHolder: "Do you really want to log out?"
            })

            // Check if filled
            if(!Core.isFilled("answer", "logout", answer, "An", false)) { return }

            // If answer is yes -> update environments, login to falsey, save and reload
            if(answer.label === "Yes"){
                let environments = JSON.parse(JSON.stringify(_configuration.environments))
                environments[_configuration.environment].apikey = ""
                Promise.all([
                    _configuration.update('login', false, 1),
                    _configuration.update('environments', environments, 1)
                ]).then(() => {
                    //trackEvent()
                    vscode.commands.executeCommand("workbench.action.reloadWindow")
                })
            }
        })

        // If environment is set, but there's no API key in the configuration
        if (_configuration.environments[_configuration.environment].apikey === "") {
            let input = await vscode.window.showWarningMessage("Your API key for this environment is not set. Please login first.", "Login")
            if(input === "Login"){
                vscode.commands.executeCommand("apps-sdk.login")
            }
        }

        // Else -> the environment is set and it contains API key -> set (pseudo)global variables and continue
        else{
            _authorization = "Token " + _configuration.environments[_configuration.environment].apikey
            _environment = `https://${_configuration.environment}/v1`
        }
        //#endregion
    }

    /**
     * AUTHORIZED
     * Following stuff is done only when environment and API key are set correctly (_authorization variable was set -> it isn't undefined)
     */
    if (_authorization) {

        /**
         * Register keyword provider for all imljson files
         */
        vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'imljson' }, new KeywordProvider())

        //#region CORE COMMANDS
        /**
         * SOURCE-LOADER
         * This block is responsible for loading source codes from Integromat
         */
        vscode.commands.registerCommand('apps-sdk.load-source', async function (item) {            

            // Compose directory structure
            let urn = `/app/${Core.getApp(item).name}`

            // Add version to URN for versionable items
            if (Core.isVersionable(item.apiPath)) {
                urn += `/${Core.getApp(item).version}`
            }

            // Complete the URN by the type of item
            switch (item.apiPath) {
                case "function":
                    urn += `/${item.apiPath}/${item.parent.name}/code`
                    break
                case "rpc":
                case "module":
                case "connection":
                case "webhook":
                    urn += `/${item.apiPath}/${item.parent.name}/${item.name}`
                    break
                case "app":
                    // Prepared for more app-level codes
                    switch(item.name){
                        case "content":
                            urn += `/docs`
                            break
                        default:
                            urn += `/${item.name}`
                            break;
                    }
                    break
            }

            // Prepare filepath and dirname for the code
            let filepath = `${urn}.${item.language}`
            let dirname = path.dirname(filepath)

            /**
             * RPC-LOADER
             * RpcLoader loads all RPCs available within the app
             * Following condition specifies where are RPCs allowed
             */
            if (
                (item.apiPath === "connection" && item.name === "parameters") ||
                (item.apiPath === "webhook" && item.name === "parameters") ||
                (item.apiPath === "module" && (item.name === "parameters" || item.name === "expect" || item.name === "interface" || item.name === "samples")) ||
                (item.apiPath === "rpc" && item.name === "api")
            ){
                // Remove existing RpcProvider
                if (currentRpcProvider !== null && currentRpcProvider !== undefined) {
                    currentRpcProvider.dispose()
                }

                // RPC list url
                let url = `${_environment}/app/${Core.getApp(item).name}/${Core.getApp(item).version}/rpc`

                // Get list of RPCs
                let response = await Core.rpGet(url, _authorization)
                let rpcs = response.map(rpc => {
                    return `rpc://${rpc.name}`
                })

                // Register a new RpcProvider
                currentRpcProvider = vscode.languages.registerCompletionItemProvider({
                    scheme: 'file',
                    language: 'imljson'
                }, new RpcProvider(rpcs))
            }
            else {

                // If out of scope, remove existing RpcProvider
                if (currentRpcProvider !== null && currentRpcProvider !== undefined) {
                    currentRpcProvider.dispose()
                }
            }

            /**
             * IML-LOADER
             * ImlLoader loads all IML functions available within the app
             * Following condition specifies where are IML functions allowed
             */
            if (
                (item.name === "api" || item.name === "epoch" || item.name === "attach" || item.name === "detach")
            ) {
                // Remove existing ImlProvider
                if (currentImlProvider !== null && currentImlProvider !== undefined) {
                    currentImlProvider.dispose()
                }

                // IML functions list url
                let url = `${_environment}/app/${Core.getApp(item).name}/${Core.getApp(item).version}/function`

                // Get list of IML functions
                let response = await Core.rpGet(url, _authorization)
                let imls = response.map(iml => {
                    return `${iml.name}()`
                })

                // Register a new ImlProvider
                currentImlProvider = vscode.languages.registerCompletionItemProvider({
                    scheme: 'file',
                    language: 'imljson'
                }, new ImlProvider(imls))
            }
            else {

                // If out of scope, remove existing ImlProvider
                if (currentImlProvider !== null && currentImlProvider !== undefined) {
                    currentImlProvider.dispose()
                }
            }

            /**
             * CODE-LOADER
             * Code loader loads the requested code
             */

            // Prepare the directory for the code 
            mkdirp(path.join(_DIR, dirname), function (err) {

                // If something went wrong, throw an error and return
                if (err) {
                    vscode.window.showErrorMessage(err.message)
                    return
                }
                
                // Compose a download URL
                let url = _environment + urn

                /**
                 * GET THE SOURCE CODE
                 * Those lines are responsible straight for the download of code
                 */
                request({
                    url: url,
                    headers: {
                        'Authorization': _authorization
                    }
                }, function (error, response, body) {

                    // Prepare a stream to be saved
                    let write = (item.language === "js" || item.language === "md") ? body : JSON.stringify(JSON.parse(body), null, 4)

                    // Save the received code to the temp directory
                    fs.writeFile(path.join(_DIR, filepath), write, function (err) {

                        // If there was an error, display it and return
                        if (err) {
                            return vscode.window.showErrorMessage(err.message);
                        }

                        //trackEvent()
                        // Open the downloaded code in the editor
                        vscode.window.showTextDocument(vscode.workspace.openTextDocument(path.join(_DIR, filepath)), {
                            preview: false
                        })
                    });
                });
                
            })
        })

        /**
         * OPEN-SOURCE-LOADER
         * This block is responsible for loading open source codes from Integromat
         */
        vscode.commands.registerCommand('apps-sdk.load-open-source', async function (item) {

            // Get rid of all active providers - no need for them in read-only app
            if (currentRpcProvider !== null && currentRpcProvider !== undefined) {
                currentRpcProvider.dispose()
            }
            if (currentImlProvider !== null && currentImlProvider !== undefined) {
                currentImlProvider.dispose()
            }

            // Compose directory structure
            let urn = `/app/${Core.getApp(item).name}`

            // Add version to URN for versionable items
            if (Core.isVersionable(item.apiPath)) {
                urn += `/${Core.getApp(item).version}`
            }

            // Complete the URN by the type of item
            switch (item.apiPath) {
                case "function":
                    urn += `/${item.apiPath}/${item.parent.name}/code`
                    break
                case "rpc":
                case "module":
                case "connection":
                case "webhook":
                    urn += `/${item.apiPath}/${item.parent.name}/${item.name}`
                    break
                case "app":
                    // Prepared for more app-level codes
                    switch(item.name){
                        case "content":
                            urn += `/docs`
                            break
                        default:
                            urn += `/${item.name}`
                            break;
                    }
                    break
            }

            // Prepare filepath and dirname for the code
            let filepath = `${urn}.${item.language}`
            let dirname = path.dirname(filepath)

            /**
             * CODE-LOADER
             * Code loader loads the requested code
             */

            // Prepare the directory for the code 
            mkdirp(path.join(_DIR, "opensource", dirname), function (err) {

                // If something went wrong, throw an error and return
                if (err) {
                    vscode.window.showErrorMessage(err.message)
                    return
                }
                
                // Compose a download URL
                let url = _environment + urn

                /**
                 * GET THE SOURCE CODE
                 * Those lines are responsible straight for the download of code
                 */
                request({
                    url: url,
                    headers: {
                        'Authorization': _authorization
                    }
                }, function (error, response, body) {

                    // Prepare a stream to be saved
                    let write = (item.language === "js" || item.language === "md") ? body : JSON.stringify(JSON.parse(body), null, 4)

                    // Save the received code to the temp directory
                    fs.writeFile(path.join(_DIR, "opensource", filepath), write, { mode: 440 }, function (err) {

                        // If there was an error, display it and return
                        if (err) {
                            return vscode.window.showErrorMessage(err.message);
                        }

                        //trackEvent()
                        // Open the downloaded code in the editor
                        vscode.window.showTextDocument(vscode.workspace.openTextDocument(path.join(_DIR, "opensource", filepath)), {
                            preview: false
                        })
                    });
                });
                
            })
        })

        /**
         * SOURCE-UPLOADER
         * This block is responsible for uploading the sources to the Integromat
         */
        vscode.workspace.onDidSaveTextDocument(async (editor) => {

            // Load the content of the file that has just been saved
            let file = fs.readFileSync(editor.fileName, "utf8");

            // Get the URN path of files URI (the right path)
            let right = editor.fileName.split("apps-sdk")[1]

            // If on DOS-base, replace backslashes with forward slashes (on Unix-base it's done already)
            right = right.replace(/\\/g, "/")

            // If it's an open-source app, don't try to save anything
            if(right.startsWith("/opensource/")){
                vscode.window.showWarningMessage("Opensource Apps can not be modified.")
            }

            // Build the URL
            let url = (path.join(path.dirname(right), path.basename(right, path.extname(right)))).replace(/\\/g, "/")
            
            // And compose the URI
            let uri = _environment + url

            // Prepare request options
            var options = {
                uri: uri,
                method: 'POST',
                body: file,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": _authorization
                }
            };

            // Change the Content-Type header if needed
            if (path.extname(right) === ".js") {
                options.headers["Content-Type"] = "application/javascript"
            }
            if (path.extname(right) === ".md") {
                options.headers["Content-Type"] = "text/markdown"
            }

            /**
             * CODE-UPLOADER
             * Those lines are directly responsible for the code being uploaded
             */
            try{
                // Get the response from server
                let response = JSON.parse(await rp(options))

                //trackEvent()
                // If there's no change to be displayed, end
                if(!response.change){ return }

                // Else refresh the tree, because there's a new change to be displayed
                appsProvider.refresh()
            }
            catch(err){
                let e = JSON.parse(err.error)
                vscode.window.showErrorMessage(`${e.name}: ${e.message}`)                
            }
        });

        /**
         * RPC-IML PROVIDER KEEPER
         * Keeps providers up to date
         */
        vscode.window.onDidChangeActiveTextEditor(async(editor) => {

            //If undefined, don't do anything
            if(!editor){ return }

            // Get the URN path of files URI (the right path)
            let right = editor.document.fileName.split("apps-sdk")[1]

            // No right, no apps-sdk, don't do anything
            if(!right){ return }

            // If on DOS-base, replace backslashes with forward slashes (on Unix-base it's done already)
            right = right.replace(/\\/g, "/")

            // Prepare data for loaders
            let crumbs = right.split("/")

            // If versionable, stash the version
            let version
            if(!isNaN(crumbs[3])){
                version = crumbs[3]
                crumbs.splice(3,1)
            }

            // If no version, set 1
            version = version === undefined ? 1 : version;

            // If not enough crumbs (=> base/docs) -> remove existing providers and exit.
            if(crumbs.length < 5){ 

                // Remove existing RpcProvider
                if (currentRpcProvider !== null && currentRpcProvider !== undefined) {
                    currentRpcProvider.dispose()
                }

                // Remove existing ImlProvider
                if (currentImlProvider !== null && currentImlProvider !== undefined) {
                    currentImlProvider.dispose()
                }
                
                return
            }

            let apiPath = crumbs[3]
            let name = crumbs[5].split(".")[0]
            let app = crumbs[2]
            

            /**
             * RPC-LOADER
             * RpcLoader loads all RPCs available within the app
             * Following condition specifies where are RPCs allowed
             */
            if (
                (apiPath === "connection" && name === "parameters") ||
                (apiPath === "webhook" && name === "parameters") ||
                (apiPath === "module" && (name === "parameters" || name === "expect" || name === "interface" || name === "samples")) ||
                (apiPath === "rpc" && name === "api")
            ){
                // Remove existing RpcProvider
                if (currentRpcProvider !== null && currentRpcProvider !== undefined) {
                    currentRpcProvider.dispose()
                }

                // RPC list url
                let url = `${_environment}/app/${app}/${version}/rpc`

                // Get list of RPCs
                let response = await Core.rpGet(url, _authorization)
                let rpcs = response.map(rpc => {
                    return `rpc://${rpc.name}`
                })

                // Register a new RpcProvider
                currentRpcProvider = vscode.languages.registerCompletionItemProvider({
                    scheme: 'file',
                    language: 'imljson'
                }, new RpcProvider(rpcs))
            }
            else {

                // If out of scope, remove existing RpcProvider
                if (currentRpcProvider !== null && currentRpcProvider !== undefined) {
                    currentRpcProvider.dispose()
                }
            }

            /**
             * IML-LOADER
             * ImlLoader loads all IML functions available within the app
             * Following condition specifies where are IML functions allowed
             */
            if (
                (name === "api" || name === "epoch" || name === "attach" || name === "detach")
            ) {
                // Remove existing ImlProvider
                if (currentImlProvider !== null && currentImlProvider !== undefined) {
                    currentImlProvider.dispose()
                }

                // IML functions list url
                let url = `${_environment}/app/${app}/${version}/function`

                // Get list of IML functions
                let response = await Core.rpGet(url, _authorization)
                let imls = response.map(iml => {
                    return `${iml.name}()`
                })

                // Register a new ImlProvider
                currentImlProvider = vscode.languages.registerCompletionItemProvider({
                    scheme: 'file',
                    language: 'imljson'
                }, new ImlProvider(imls))
            }
            else {

                // If out of scope, remove existing ImlProvider
                if (currentImlProvider !== null && currentImlProvider !== undefined) {
                    currentImlProvider.dispose()
                }
            }
        })

        /**
         * SHOW CHANGES
         * Shows changes
         */
        vscode.commands.registerCommand('apps-sdk.changes.show', async function (code) {

            // Get the diff
            let url = `${_environment}/app/${Core.getApp(code).name}/${Core.getApp(code).version}/change/${code.change}`
            let diffdata = await Core.rpGet(url, _authorization)

            // Prepare paths for files
            let old = tempy.file({name: `old.${code.language}`})
            let cur = tempy.file({name: `cur.${code.language}`})

            // Get the data to write
            let old_data = (code.language === "js" || code.language === "md") ? diffdata.old_value : JSON.stringify(diffdata.old_value, null, 4)
            let cur_data = (code.language === "js" || code.language === "md") ? diffdata.new_value : JSON.stringify(diffdata.new_value, null, 4)

            // Save the files
            Promise.all([
                await asyncfile.writeFile(old, old_data),
                await asyncfile.writeFile(cur, cur_data)
            ]).then(() => {

                //trackEvent()
                // Display diff between the files
                vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(old), vscode.Uri.file(cur), `Changes of ${code.name} in ${code.parent.name}`).catch(err => {
                    vscode.window.showErrorMessage(err)
                })
            })
        })
        /**
         * ICON-EDITOR
         * This block is responsible for the "edit icon" stuff
         */
        vscode.commands.registerCommand('apps-sdk.app.get-icon', function (app) {

            // If called directly (by using a command pallete) -> die
            if (!Core.contextGuard(app)) { return }

            // Create a new WebviewPanel object
            const panel = vscode.window.createWebviewPanel(
                `${app.name}_icon`,
                `${app.label} icon`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            )
            
            // Prepare variable for storing the base64
            let buff

            // If the icon exists on the disc -> get its BASE64
            if (fs.existsSync(app.iconPath.dark)) {
                buff = new Buffer(fs.readFileSync(app.iconPath.dark)).toString('base64')
            }

            // If not, use the BASE64 of blank 512*512 png square
            else {
                buff = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQMAAADOtka5AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADZJREFUeJztwQEBAAAAgiD/r25IQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfBuCAAAB0niJ8AAAAABJRU5ErkJggg=="
            }

            //trackEvent()
            // Inject the theme color and the icon to the generated HTML
            panel.webview.html = Core.getIconHtml(buff, app.theme, __dirname)

            /**
             * Change handler
             */
            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === "change-icon") {

                    // Show open file dialog and wait for a new file URI
                    let uri = await vscode.window.showOpenDialog({
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'Images': ['png']
                        },
                        openLabel: "Upload"
                    })

                    // If no URI supplied -> die
                    if (uri === undefined) {
                        return
                    }

                    // Prepare request options
                    let options = {
                        url: `${_environment}/app/${app.name}/icon`,
                        headers: {
                            'Authorization': _authorization
                        }
                    }

                    // Read the new file and fire the request
                    fs.createReadStream(uri[0].fsPath).pipe(request.post(options, function (err, response, body) {

                        // Parse the response
                        response = JSON.parse(response.body)

                        // If there was an error, show the message
                        if (response.name === "Error") {
                            vscode.window.showErrorMessage(response.message)
                        }

                        // If everything has gone well, close the webview panel and refresh the tree (the new icon will be loaded)
                        else {
                            //trackEvent()
                            vscode.commands.executeCommand('apps-sdk.refresh')
                            panel.dispose()
                        }
                    }))
                }
            }, undefined)
        })
        //#endregion

        /**
         * CREATION COMMANDS
         * Commands for adding new entities
         */
        //#region

        /**
         * New function
         */
        vscode.commands.registerCommand('apps-sdk.function.new', async function (context) {

            // If called out of context -> die
            if(!Core.contextGuard(context)){ return }

            // Get the source app
            let app = context.parent

            // Prompt for the function name
            let name = await vscode.window.showInputBox({
                prompt: "Enter function name",
                ignoreFocusOut: false,
                validateInput: Validator.functionName
            })

            // If not filled -> die
            if(!Core.isFilled("name", "function", name)){ return }

            // Add the new entity. Refresh the tree or show the error
            try{
                await Core.addEntity(_authorization, { "name": name }, `${_environment}/app/${app.name}/${app.version}/function`)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * New RPC
         */
        vscode.commands.registerCommand('apps-sdk.rpc.new', async function (context) {

            // Context workaround
            if(!Core.contextGuard(context)){ return }
            let app = context.parent

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter RPC label" })
            if(!Core.isFilled("label", "RPC", label)){ return }

            // Id (name) prompt
            let id = await vscode.window.showInputBox({
                prompt: "Enter RPC Id",
                value: camelCase(label),
                validateInput: Validator.rpcName
            })
            if(!Core.isFilled("id", "RPC", id, "An")){ return }

            // Connection prompt
            let connection = await vscode.window.showQuickPick(QuickPick.connections(_environment, _authorization, app, true))
            if (!Core.isFilled("connection", "RPC", connection)){ return }

            // Connection and URI compose
            connection = connection.label === "--- Without connection ---" ? undefined : connection.description
            let uri = `${_environment}/app/${app.name}/${app.version}/rpc`

            // Request
            try{
                await Core.addEntity(_authorization, {
                    "name": id,
                    "label": label,
                    "connection": connection
                }, uri)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * New module
         */
        vscode.commands.registerCommand('apps-sdk.module.new', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context.parent

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter module label" })
            if(!Core.isFilled("label", "module", label)){ return }

            // Id prompt
            let id = await vscode.window.showInputBox({
                prompt: "Enter module Id",
                value: camelCase(label),
                validateInput: Validator.moduleName
            })
            if(!Core.isFilled("id", "module", id, "An")){ return }

            // Description prompt
            let description = await vscode.window.showInputBox({ prompt: "Enter module description" })
            if(!Core.isFilled("description", "module", description)){ return }

            // Type prompt
            let type = await vscode.window.showQuickPick(Enum.moduleTypes)
            if(!Core.isFilled("type", "module", type)){ return }

            // Prepare URI and request body
            let uri = `${_environment}/app/${app.name}/${app.version}/module`
            let body = {
                "name": id,
                "label": label,
                "description": description,
                "type_id": type.description
            }

            // Connection / Webhook / No prompt
            switch(type.description){
                case "1":
                case "4":
                case "9":
                    let connection = await vscode.window.showQuickPick(QuickPick.connections(_environment, _authorization, app, true))
                    if(!Core.isFilled("connection", "module", connection)){ return }
                    body.connection = connection.label === "--- Without connection ---" ? "" : connection.description
                    break
                case "10":
                    let webhook = await vscode.window.showQuickPick(QuickPick.webhooks(_environment, _authorization, app, false))
                    if(!Core.isFilled("webhook", "module", webhook)){ return }
                    body.webhook = webhook.label === "--- Without webhook ---" ? "" : webhook.description
                    break
            }

            // Send the request
            try{
                await Core.addEntity(_authorization, body, uri)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * New webhook
         */
        vscode.commands.registerCommand('apps-sdk.webhook.new', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context.parent

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter webhook label" })
            if(!Core.isFilled("label", "webhook", label)){ return }

            // Type prompt
            let type = await vscode.window.showQuickPick(Enum.webhookTypes)
            if(!Core.isFilled("type", "webhook", type)){ return }

            // Connections prompt (decide if compulsory or not)
            let connections
            switch (type.description) {
                case "web":
                    connections = QuickPick.connections(_environment, _authorization, app, true)
                    break
                case "web-shared":
                    connections = QuickPick.connections(_environment, _authorization, app, false)
                    break
            }
            let connection = await vscode.window.showQuickPick(connections)
            if(!Core.isFilled("connection", "webhook", connection)){ return }

            // Build URI and prepare connection value
            let uri = `${_environment}/app/${app.name}/webhook`
            connection = connection.label === "--- Without connection ---" ? "" : connection.description

            // Send the request
            try{
                await Core.addEntity(_authorization, {
                    "label": label,
                    "type": type.description,
                    "connection": connection
                }, uri)
                appsProvider.refresh()
                //trackEvent()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * New connection
         */
        vscode.commands.registerCommand('apps-sdk.connection.new', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context.parent

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter connection label" })
            if(!Core.isFilled("label", "connection", label)){ return }

            // Type prompt
            let type = await vscode.window.showQuickPick(Enum.connectionTypes)
            if(!Core.isFilled("type", "connection", type)){ return }

            // Prepare URI
            let uri = `${_environment}/app/${app.name}/connection`

            // Send the request
            try{
                await Core.addEntity(_authorization, {
                    "label": label,
                    "type": type.description
                }, uri)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * New APP
         */
        vscode.commands.registerCommand('apps-sdk.app.new', async function () {

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter app label" })
            if(!Core.isFilled("label", "app", label)){ return }

            // Id prompt
            let id = await vscode.window.showInputBox({
                prompt: "Enter app Id",
                value: camelCase(label),
                validateInput: Validator.appName
            })
            if(!Core.isFilled("id", "app", id, "An")){ return }

            // Color theme prompt and check
            let theme = await vscode.window.showInputBox({
                prompt: "Pick a color theme",
                value: "#000000"
            })
            if(!Core.isFilled("theme", "app", theme)){ return }
            if(!(/^#[0-9A-F]{6}$/i.test(theme))){ 
                vscode.window.showErrorMessage("Entered color was invalid.")
                return
            }

            // Language prompt
            let language = await vscode.window.showQuickPick(QuickPick.languages(_environment, _authorization), { placeHolder: "Choose app language." })
            if(!Core.isFilled("language", "app", language)){ return }

            // Countries prompt
            let countries = await vscode.window.showQuickPick(QuickPick.countries(_environment, _authorization), {
                canPickMany: true,
                placeHolder: "Choose app countries. If left blank, app will be considered as global."
            })
            if (!Core.isFilled("country", "app", countries)){ return }

            // Build URI and prepare countries list
            let uri = `${_environment}/app`
            countries = countries.map(item => { return item.description })

            // Send the request
            try{
                await Core.addEntity(_authorization, {
                    "name": id,
                    "label": label,
                    "theme": theme,
                    "language": language.description,
                    "private": true,
                    "countries": countries
                }, uri)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })
        //#endregion

        /**
         * DELETION COMMANDS
         * Commands for deleting entities
         */
        //#region
        /**
         * Delete entity
         */
        vscode.commands.registerCommand('apps-sdk.delete', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context.parent.parent

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.delete, { placeHolder: `Do you really want to delete this ${context.apiPath} ?` })
            if(answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If confirmed or not
            switch(answer.label){
                case "No":
                    vscode.window.showInformationMessage(`Stopped. No ${context.apiPath || context.supertype}s were deleted.`)
                    break

                case "Yes": 
                    // Set URI and send the request
                    context.apiPath = context.apiPath === undefined ? context.supertype : context.apiPath
                    let uri = Core.isVersionable(context.apiPath) ? `${_environment}/app/${app.name}/${app.version}/${context.apiPath}/${context.name}` : `${_environment}/app/${app.name}/${context.apiPath}/${context.name}`
                    try{
                        await rp({
                            method: 'DELETE',
                            uri: uri,
                            headers: {
                                Authorization: _authorization
                            },
                            json: true
                        })
                        //trackEvent()
                        appsProvider.refresh()
                    }
                    catch(err){
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })

        /**
         * Delete app
         */
        vscode.commands.registerCommand('apps-sdk.app.delete', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.delete, { placeHolder: `Do you really want to delete this app?` })
            if(answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If was confirmed or not
            switch(answer.label){
                case "No":
                    vscode.window.showInformationMessage(`Stopped. No apps were deleted.`)
                    break
                case "Yes":
                    // Set URI and send the request
                    context.apiPath = context.apiPath === undefined ? context.supertype : context.apiPath
                    let uri = `${_environment}/app/${app.name}/${app.version}`
                    try{
                        await rp({
                            method: 'DELETE',
                            uri: uri,
                            headers: {
                                Authorization: _authorization
                            },
                            json: true
                        })
                        //trackEvent()
                        appsProvider.refresh()
                    }
                    catch(err){
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })
        //#endregion

        /**
         * EDITATION COMMANDS
         * Commands for editing entity metadata and other properties
         */
        //#region

        /**
         * Edit app
         */
        vscode.commands.registerCommand('apps-sdk.app.edit-metadata', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }

            // Get the app from the API (will be used in future)
            let app = await Core.getAppObject(_environment, _authorization, context)

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize app label",
                value: context.bareLabel
            })
            if(!Core.isFilled("label", "app", label)){ return }

            // Theme prompt with prefilled value
            let theme = await vscode.window.showInputBox({
                prompt: "Customize app theme",
                value: context.theme,
                validateInput: Validator.appTheme
            })
            if(!Core.isFilled("theme", "app", theme)){ return }

            // Prepare languages -> place current language to the top, then prompt
            let languages = await QuickPick.languages(_environment, _authorization)
            languages.unshift({label: "Keep current", description: app.language})
            let language = await vscode.window.showQuickPick(languages, { placeHolder: "Choose app language" })
            if(!Core.isFilled("language", "app", language)){ return }

            // Prepare countries -> get current coutries and precheck them, sort by check and alphabet, then prompt
            let countries = await QuickPick.countries(_environment, _authorization)
            if(app.countries !== null){
                countries = countries.map(country => {
                    if(app.countries.includes(country.description)){
                        country.picked = true
                    }
                    return country
                })
                countries.sort(Core.compareCountries)
            }
            countries = await vscode.window.showQuickPick(countries, {
                canPickMany: true,
                placeHolder: "Choose app countries. If left blank, app will be considered as global."
            })
            if (!Core.isFilled("country", "app", countries)) { return }

            // Build URI and prepare countries list
            let uri = `${_environment}/app/${context.name}/${context.version}`
            countries = countries.map(country => { return country.description })
            countries = countries.length > 0 ? countries : undefined

            // Send the request
            try{
                await Core.editEntity(_authorization,{
                    label: label,
                    theme: theme,
                    language: language.description,
                    countries: countries
                }, uri)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }          
        })

        /**
         * Edit connection
         */
        vscode.commands.registerCommand('apps-sdk.connection.edit-metadata', async function (context) {

            // Context check
            if (!Core.contextGuard(context)) { return }

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize connection label",
                value: context.label
            })
            if(!Core.isFilled("label", "connection", label)){ return }

            // Build URI
            let uri = `${_environment}/app/${context.parent.parent.name}/connection/${context.name}/label`

            // Send the request
            try{
                await Core.editEntityPlain(_authorization, label, uri)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Edit webhook
         */
        vscode.commands.registerCommand('apps-sdk.webhook.edit-metadata', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize webhook label",
                value: context.label
            })
            if(!Core.isFilled("label", "webhook", label)){ return }

            // Send the request
            try{
                await Core.editEntityPlain(_authorization, label, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/label`)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Change webhook connection
         */
        vscode.commands.registerCommand('apps-sdk.webhook.change-connection', async function (context){

            //Context check
            if(!Core.contextGuard(context)){ return }

            // Prepare connections -> determine if required or not
            let connections
            switch (context.type) {
                case "web":
                    connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true)
                    break
                case "web-shared":
                    connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, false)
                    break
            }
            connections = [{ label: "Don't change", description: "keep" }].concat(connections)

            // Prompt for connection
            let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
            if(!Core.isFilled("connection", "webhook", connection)){ return }

            // Send the request
            try{
                if (connection.description !== "keep") {
                    connection = connection.label === "--- Without connection ---" ? "" : connection.description
                    await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/connection`)
                    //trackEvent()
                    appsProvider.refresh()
                }
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })
         
        /**
         * Edit module
         */
        vscode.commands.registerCommand('apps-sdk.module.edit-metadata', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize module label",
                value: context.bareLabel
            })
            if(!Core.isFilled("label", "module", label)){ return }

            // Send the request
            try{
                await Core.editEntityPlain(_authorization, label, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/label`)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })
        
        /**
         * Change module connection or webhook
         */
        vscode.commands.registerCommand('apps-sdk.module.change-connection-or-webhook', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }

            // Prompt for connection / webhook / nothing -> based on module type and change it
            switch(context.type){
                case 1:
                case 4:
                case 9:
                    let connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true)
                    connections = [{ label: "Don't change", description: "keep" }].concat(connections)
                    let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
                    if(!Core.isFilled("connection", "module", connection)){ return }
                    if (connection.description !== "keep") {
                        connection = connection.label === "--- Without connection ---" ? "" : connection.description
                        try{
                            await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/connection`)
                            //trackEvent()
                            appsProvider.refresh()
                        }
                        catch(err){
                            vscode.window.showErrorMessage(err.error.message || err)
                        }
                    }
                    break
                case 10:
                    let webhooks = await QuickPick.webhooks(_environment, _authorization, context.parent.parent, false)
                    webhooks = [{ label: "Don't change", description: "keep" }].concat(webhooks)
                    let webhook = await vscode.window.showQuickPick(webhooks, { placeHolder: "Change webhook or keep existing." })
                    if(!Core.isFilled("webhook", "module", webhook)){ return }
                    if (webhook.description !== "keep") {
                        try{
                            await Core.editEntityPlain(_authorization, webhook.description, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/webhook`)
                            appsProvider.refresh()
                        }
                        catch(err){
                            vscode.window.showErrorMessage(err.error.message || err)
                        }
                    }
                    break
            }
        })

        /**
         * Edit RPC
         */
        vscode.commands.registerCommand('apps-sdk.rpc.edit-metadata', async function (context) {

            // Context check
            if (!Core.contextGuard(context)){ return }

            // Prompt for label with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize RPC label",
                value: context.label
            })
            if (!Core.isFilled("label", "RPC", label)){ return }
            
            // Send the request
            try{
                await Core.editEntityPlain(_authorization, label, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/rpc/${context.name}/label`)
                //trackEvent()
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Change RPC connection
         */
        vscode.commands.registerCommand('apps-sdk.rpc.change-connection', async function (context) {

            // Context check
            if (!Core.contextGuard(context)){ return }

            // Prompt for connection
            let connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true)
            connections = [{ label: "Don't change", description: "keep" }].concat(connections)
            let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
            if (!Core.isFilled("connection", "RPC", connection)){ return }

            // Send the request
            try{
                if (connection.description !== "keep") {
                    connection = connection.label === "--- Without connection ---" ? "" : connection.description
                    await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/rpc/${context.name}/connection`)
                    //trackEvent()
                    appsProvider.refresh()
                }
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })
        //#endregion


        /**
         * CHANGES CONTROL COMMANDS
         * Commands for commiting and rolling back changes
         */
        //#region

        /**
         * COMMIT ALL CHANGES
         * Commits all changes made in the application
         */
        vscode.commands.registerCommand('apps-sdk.changes.commit', async function(context){

            // Context check
            if(!Core.contextGuard(context)){ return }

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.commit, {placeHolder: "Do you really want to commit all changes in the app?"})
            if(answer === undefined || answer === null){
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If confirmed or not
            switch(answer.label){
                case "No":
                    vscode.window.showInformationMessage("No changes were commited.")
                    break
                case "Yes":
                    // Compose URI
                    let uri = `${_environment}/app/${context.name}/${context.version}/commit`
                    try{
                        await rp({
                            method: 'POST',
                            uri: uri,
                            headers: {
                                Authorization: _authorization
                            },
                            json: true
                        })
                        //trackEvent()
                        appsProvider.refresh()
                    }
                    catch(err){
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })

        /**
         * ROLLBACK ALL CHANGES
         * Rolls back all changes
         */
        vscode.commands.registerCommand('apps-sdk.changes.rollback', async function(context){

            // Context check
            if(!Core.contextGuard(context)){ return }

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.rollback, {placeHolder: "Do you really want to rollback all changes in the app?"})
            if(answer === undefined || answer === null){
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If confirmed or not
            switch(answer.label){
                case "No":
                    vscode.window.showInformationMessage("No changes were rolled back.")
                    break
                case "Yes":
                    // Compose URI
                    let uri = `${_environment}/app/${context.name}/${context.version}/rollback`
                    try{
                        await rp({
                            method: 'POST',
                            uri: uri,
                            headers: {
                                Authorization: _authorization
                            },
                            json: true
                        })
                        //trackEvent()
                        appsProvider.refresh()
                    }
                    catch(err){
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })
        //#endregion

        /**
         * VIEW REGISTRATION
         * This section registers a view providers (left-menu)
         */

        /**
         * APPS PROVIDER
         * Create a new AppsProvider
         * And register the TreeDataProvider to VSCode
         */
        let appsProvider = new AppsProvider(_authorization, _environment);
        vscode.window.registerTreeDataProvider('apps', appsProvider);

        /**
         * OPENSOURCE PROVIDER
         * Provides only opensource apps (read only)
         */
        let opensourceProvider = new OpensourceProvider(_authorization, _environment)
        vscode.window.registerTreeDataProvider('opensource', opensourceProvider)
        
        /**
         * Language hover provider for IMLJSON
         */
        let imljsonHoverProvider = new ImljsonHoverProvider()
        vscode.languages.registerHoverProvider({language: 'imljson', scheme: 'file'}, imljsonHoverProvider)

        /**
         * Refresh command
         * This command refreshes the left menu tree
         */
        vscode.commands.registerCommand('apps-sdk.refresh', function () {
            //trackEvent()
            appsProvider.refresh();
        })
    }

}
exports.activate = activate;

function deactivate() { }
exports.deactivate = deactivate;