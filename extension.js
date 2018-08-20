const vscode = require('vscode')

const AppsProvider = require('./src/providers/AppsProvider')
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

const tempy = require('tempy')
const path = require('path')

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

        /**
         * Registering commands
         */
        let coreCommands = new CoreCommands(appsProvider, _authorization, _environment, currentRpcProvider, currentImlProvider)
        await CoreCommands.register(_DIR, _authorization, _environment)
        await AppCommands.register(appsProvider, _authorization, _environment)
        await ConnectionCommands.register(appsProvider, _authorization, _environment)
        await WebhookCommands.register(appsProvider, _authorization, _environment)
        await ModuleCommands.register(appsProvider, _authorization, _environment)
        await RpcCommands.register(appsProvider, _authorization, _environment)
        await FunctionCommands.register(appsProvider, _authorization, _environment)
        await CommonCommands.register(appsProvider, _authorization, _environment)
        await ChangesCommands.register(appsProvider, _authorization, _environment)

        /**
         * Registering events
         */
        vscode.workspace.onDidSaveTextDocument(editor => coreCommands.sourceUpload(editor))
        vscode.window.onDidChangeActiveTextEditor(editor => coreCommands.keepProviders(editor))
    }

}
exports.activate = activate;

function deactivate() { }
exports.deactivate = deactivate;