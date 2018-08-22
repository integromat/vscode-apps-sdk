const vscode = require('vscode')

const AppsProvider = require('./src/providers/AppsProvider')
const KeywordProvider = require('./src/providers/KeywordProvider')
const OpensourceProvider = require('./src/providers/OpensourceProvider')
const ImljsonHoverProvider = require('./src/providers/ImljsonHoverProvider')

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
const EnvironmentCommands = require('./src/commands/EnvironmentCommands')

const tempy = require('tempy')
const path = require('path')
const jsoncParser = require('jsonc-parser')

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

    // Environment commands and envChanger
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

    await EnvironmentCommands.register(envChanger, _configuration)

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


        /**
         * Registering JSONC formatter
         */
        vscode.languages.registerDocumentFormattingEditProvider({language:'imljson', scheme:'file'}, {
            provideDocumentFormattingEdits(document) {
                let text = document.getText()
                let edits = jsoncParser.format(text, undefined, {insertSpaces: 4})
                return edits.map(edit => {
                    let start = document.positionAt(edit.offset)
                    let end = document.positionAt(edit.offset + edit.length)
                    return vscode.TextEdit.replace(new vscode.Range(start, end), edit.content)
                })
            }
        });
    }

}
exports.activate = activate;

function deactivate() { }
exports.deactivate = deactivate;