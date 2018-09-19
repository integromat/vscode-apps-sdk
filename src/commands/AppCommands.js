const vscode = require('vscode')

const Core = require('../Core')
const Validator = require('../Validator')
const QuickPick = require('../QuickPick')
const Enum = require('../Enum')

const kebabCase = require('lodash.kebabcase')
const fs = require('fs')
const request = require('request')
const path = require('path')
const rp = require('request-promise')
const asyncfile = require('async-file')

class AppCommands {
    static async register(appsProvider, _authorization, _environment) {

        /**
         * New APP
         */
        vscode.commands.registerCommand('apps-sdk.app.new', async function () {

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter app label" })
            if (!Core.isFilled("label", "app", label)) { return }

            // Id prompt
            let id = await vscode.window.showInputBox({
                prompt: "Enter app Id",
                value: kebabCase(label),
                validateInput: Validator.appName
            })
            if (!Core.isFilled("id", "app", id, "An")) { return }

            // Color theme prompt and check
            let theme = await vscode.window.showInputBox({
                prompt: "Pick a color theme",
                value: "#000000"
            })
            if (!Core.isFilled("theme", "app", theme)) { return }
            if (!(/^#[0-9A-F]{6}$/i.test(theme))) {
                vscode.window.showErrorMessage("Entered color was invalid.")
                return
            }

            // Language prompt
            let language = await vscode.window.showQuickPick(QuickPick.languages(_environment, _authorization), { placeHolder: "Choose app language." })
            if (!Core.isFilled("language", "app", language)) { return }

            // Countries prompt
            let countries = await vscode.window.showQuickPick(QuickPick.countries(_environment, _authorization), {
                canPickMany: true,
                placeHolder: "Choose app countries. If left blank, app will be considered as global."
            })
            if (!Core.isFilled("country", "app", countries)) { return }

            // Build URI and prepare countries list
            let uri = `${_environment}/app`
            countries = countries.map(item => { return item.description })

            // Send the request
            try {
                await Core.addEntity(_authorization, {
                    "name": id,
                    "label": label,
                    "theme": theme,
                    "language": language.description,
                    "private": true,
                    "countries": countries
                }, uri)
                appsProvider.refresh()
            }
            catch (err) {
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Edit app
         */
        vscode.commands.registerCommand('apps-sdk.app.edit-metadata', async function (context) {

            // Context check
            if (!Core.contextGuard(context)) { return }

            // Get the app from the API (will be used in future)
            let app = await Core.getAppObject(_environment, _authorization, context)

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize app label",
                value: context.bareLabel
            })
            if (!Core.isFilled("label", "app", label)) { return }

            // Theme prompt with prefilled value
            let theme = await vscode.window.showInputBox({
                prompt: "Customize app theme",
                value: context.theme,
                validateInput: Validator.appTheme
            })
            if (!Core.isFilled("theme", "app", theme)) { return }

            // Prepare languages -> place current language to the top, then prompt
            let languages = await QuickPick.languages(_environment, _authorization)
            languages.unshift({ label: "Keep current", description: app.language })
            let language = await vscode.window.showQuickPick(languages, { placeHolder: "Choose app language" })
            if (!Core.isFilled("language", "app", language)) { return }

            // Prepare countries -> get current coutries and precheck them, sort by check and alphabet, then prompt
            let countries = await QuickPick.countries(_environment, _authorization)
            if (app.countries !== null) {
                countries = countries.map(country => {
                    if (app.countries.includes(country.description)) {
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
            try {
                await Core.editEntity(_authorization, {
                    label: label,
                    theme: theme,
                    language: language.description,
                    countries: countries
                }, uri)
                appsProvider.refresh()
            }
            catch (err) {
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Delete app
         */
        vscode.commands.registerCommand('apps-sdk.app.delete', async function (context) {

            // Context check
            if (!Core.contextGuard(context)) { return }
            let app = context

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.delete, { placeHolder: `Do you really want to delete this app?` })
            if (answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If was confirmed or not
            switch (answer.label) {
                case "No":
                    vscode.window.showInformationMessage(`Stopped. No apps were deleted.`)
                    break
                case "Yes":
                    // Set URI and send the request
                    let uri = `${_environment}/app/${app.name}/${app.version}`
                    try {
                        await rp({
                            method: 'DELETE',
                            uri: uri,
                            headers: {
                                Authorization: _authorization
                            },
                            json: true
                        })
                        appsProvider.refresh()
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })

        /**
         * Edit app icon
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

            // Inject the theme color and the icon to the generated HTML
            panel.webview.html = Core.getIconHtml(buff, app.theme, path.join(__dirname, '..', '..'))

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
                    fs.createReadStream(uri[0].fsPath).pipe(request.post(options, async function (err, response) {

                        // Parse the response
                        response = JSON.parse(response.body)

                        // If there was an error, show the message
                        if (response.name === "Error") {
                            vscode.window.showErrorMessage(response.message)
                        }

                        // If everything has gone well, close the webview panel and refresh the tree (the new icon will be loaded)
                        else {

                            if (await asyncfile.exists(app.iconPath.dark)) {
                                await asyncfile.rename(app.iconPath.dark, `${app.iconPath.dark}.old`)
                            }
                            if (await asyncfile.exists(app.iconPath.light)) {
                                await asyncfile.rename(app.iconPath.light, `${app.iconPath.light}.old`)
                            }

                            vscode.commands.executeCommand('apps-sdk.refresh')
                            panel.dispose()
                        }
                    }))
                }
            }, undefined)
        })

        vscode.commands.registerCommand('apps-sdk.app.visibility.private', async function (context) {

            // Context check
            if (!Core.contextGuard(context)) { return }
            let app = context

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.hide, { placeHolder: `Do you really want to mark this app as private?` })
            if (answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If was confirmed or not
            switch (answer.label) {
                case "No":
                    vscode.window.showInformationMessage(`The app has been kept as public.`)
                    break
                case "Yes":
                    // Set URI and send the request
                    let uri = `${_environment}/app/${app.name}/${app.version}/private`
                    try {
                        await Core.editEntityPlain(_authorization, "", uri)
                        appsProvider.refresh()
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }

        })

        vscode.commands.registerCommand('apps-sdk.app.visibility.public', async function (context) {

            // Context check
            if (!Core.contextGuard(context)) { return }
            let app = context

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.publish, { placeHolder: `Do you really want to mark this app as public?` })
            if (answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If was confirmed or not
            switch (answer.label) {
                case "No":
                    vscode.window.showInformationMessage(`The app has been kept as private.`)
                    break
                case "Yes":
                    // Set URI and send the request
                    let uri = `${_environment}/app/${app.name}/${app.version}/public`
                    try {
                        await Core.editEntityPlain(_authorization, "", uri)
                        appsProvider.refresh()
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })
    }
}

module.exports = AppCommands