const vscode = require('vscode')

const AppsProvider = require('./src/providers/AppsProvider')
const ImlProvider = require('./src/providers/ImlProvider')
const RpcProvider = require('./src/providers/RpcProvider')
const KeywordProvider = require('./src/providers/KeywordProvider')
const OpensourceProvider = require('./src/providers/OpensourceProvider')
const ImljsonHoverProvider = require('./src/providers/ImljsonHoverProvider')

const Core = require('./src/Core')
const QuickPick = require('./src/QuickPick')
const Validator = require('./src/Validator')

const RpcCommands = require('./src/commands/RpcCommands')
const FunctionCommands = require('./src/commands/FunctionCommands')
const ModuleCommands = require('./src/commands/ModuleCommands')
const WebhookCommands = require('./src/commands/WebhookCommands')
const ConnectionCommands = require('./src/commands/ConnectionCommands')
const AppCommands = require('./src/commands/AppCommands')
const CommonCommands = require('./src/commands/CommonCommands')
const ChangesCommands = require('./src/commands/ChangesCommands')
const AccountCommands = require('./src/commands/AccountCommands')
const CoreCommands = require('./src/commands/CoreCommands')

const request = require('request')
const tempy = require('tempy')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const rp = require('request-promise')

var _configuration
var _authorization
var _environment
var _DIR
var currentRpcProvider
var currentImlProvider

async function activate() {
    _DIR = path.join(tempy.directory(), "apps-sdk")
    _configuration = vscode.workspace.getConfiguration('apps-sdk')
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
        
        await AccountCommands.register(_configuration)

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
    }

    /**
     * AUTHORIZED
     * Following stuff is done only when environment and API key are set correctly (_authorization variable was set -> it isn't undefined)
     */
    if (_authorization) {

        /**
         * Registering providers
         */
        vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'imljson' }, new KeywordProvider())
        vscode.languages.registerHoverProvider({language: 'imljson', scheme: 'file'}, new ImljsonHoverProvider())
        vscode.window.registerTreeDataProvider('opensource', new OpensourceProvider(_authorization, _environment))

        let appsProvider = new AppsProvider(_authorization, _environment);
        vscode.window.registerTreeDataProvider('apps', appsProvider);

        let coreCommands = new CoreCommands(appsProvider, _authorization, _environment)

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

                        // Open the downloaded code in the editor
                        vscode.window.showTextDocument(vscode.workspace.openTextDocument(path.join(_DIR, "opensource", filepath)), {
                            preview: false
                        })
                    });
                });
                
            })
        })

        /**
         * Source Uploader
         */
        vscode.workspace.onDidSaveTextDocument(editor => coreCommands.sourceUpload(editor))

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
        //#endregion

        await AppCommands.register(appsProvider, _authorization, _environment)
        await ConnectionCommands.register(appsProvider, _authorization, _environment)
        await WebhookCommands.register(appsProvider, _authorization, _environment)
        await ModuleCommands.register(appsProvider, _authorization, _environment)
        await RpcCommands.register(appsProvider, _authorization, _environment)
        await FunctionCommands.register(appsProvider, _authorization, _environment)
        await CommonCommands.register(appsProvider, _authorization, _environment)
        await ChangesCommands.register(appsProvider, _authorization, _environment)

    }

}
exports.activate = activate;

function deactivate() { }
exports.deactivate = deactivate;