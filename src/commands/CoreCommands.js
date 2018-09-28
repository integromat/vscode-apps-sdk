const vscode = require('vscode')

const Core = require('../Core')

const RpcProvider = require('../providers/RpcProvider')
const ImlProvider = require('../providers/ImlProvider')

const path = require('path')
const fs = require('fs')
const rp = require('request-promise')
const mkdirp = require('mkdirp')
const request = require('request')

class CoreCommands {
    constructor(appsProvider, _authorization, _environment, rpcProvider, imlProvider) {
        this.appsProvider = appsProvider
        this._authorization = _authorization
        this._environment = _environment
        this.currentRpcProvider = rpcProvider
        this.currentImlProvider = imlProvider
    }

    /**
     * Source Uploader
     */
    async sourceUpload(editor) {

        // It it's not an APPS SDK file, don't do anything
        if (!editor.fileName.includes('apps-sdk')) { return }

        // Load the content of the file that has just been saved
        let file = fs.readFileSync(editor.fileName, "utf8");

        // Get the URN path of files URI (the right path)
        let right = editor.fileName.split("apps-sdk")[1]

        // If on DOS-base, replace backslashes with forward slashes (on Unix-base it's done already)
        right = right.replace(/\\/g, "/")

        // If it's an open-source app, don't try to save anything
        if (right.startsWith("/opensource/")) {
            vscode.window.showWarningMessage("Opensource Apps can not be modified.")
            return
        }

        // Build the URL
        let url = (path.join(path.dirname(right), path.basename(right, path.extname(right)))).replace(/\\/g, "/")

        // And compose the URI
        let uri = this._environment + url

        // Prepare request options
        var options = {
            uri: uri,
            method: 'POST',
            body: file,
            headers: {
                "Content-Type": "application/jsonc",
                "Authorization": this._authorization
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
        try {
            // Get the response from server
            let response = JSON.parse(await rp(options))

            // If there's no change to be displayed, end
            if (!response.change) { return }

            // Else refresh the tree, because there's a new change to be displayed
            this.appsProvider.refresh()
        }
        catch (err) {
            let e = JSON.parse(err.error)
            vscode.window.showErrorMessage(`${e.name}: ${e.message}`)
        }
    }

    /**
     * Provider Keeper
     */
    async keepProviders(editor) {
        {

            //If undefined, don't do anything
            if (!editor) { return }

            // Get the URN path of files URI (the right path)
            let right = editor.document.fileName.split("apps-sdk")[1]

            // No right, no apps-sdk, don't do anything
            if (!right) { return }

            // If on DOS-base, replace backslashes with forward slashes (on Unix-base it's done already)
            right = right.replace(/\\/g, "/")

            // Prepare data for loaders
            let crumbs = right.split("/")

            // If versionable, stash the version
            let version
            if (!isNaN(crumbs[3])) {
                version = crumbs[3]
                crumbs.splice(3, 1)
            }

            // If no version, set 1
            version = version === undefined ? 1 : version;

            // If not enough crumbs (=> base/docs) -> remove existing providers and exit.
            if (crumbs.length < 5) {

                // Remove existing RpcProvider
                if (this.currentRpcProvider !== null && this.currentRpcProvider !== undefined) {
                    this.currentRpcProvider.dispose()
                }

                // Remove existing ImlProvider
                if (this.currentImlProvider !== null && this.currentImlProvider !== undefined) {
                    this.currentImlProvider.dispose()
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
            ) {
                // Remove existing RpcProvider
                if (this.currentRpcProvider !== null && this.currentRpcProvider !== undefined) {
                    this.currentRpcProvider.dispose()
                }

                // RPC list url
                let url = `${this._environment}/app/${app}/${version}/rpc`

                // Get list of RPCs
                let response = await Core.rpGet(url, this._authorization)
                let rpcs = response.map(rpc => {
                    return `rpc://${rpc.name}`
                })

                // Register a new RpcProvider
                this.currentRpcProvider = vscode.languages.registerCompletionItemProvider({
                    scheme: 'file',
                    language: 'imljson'
                }, new RpcProvider(rpcs))
            }
            else {

                // If out of scope, remove existing RpcProvider
                if (this.currentRpcProvider !== null && this.currentRpcProvider !== undefined) {
                    this.currentRpcProvider.dispose()
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
                if (this.currentImlProvider !== null && this.currentImlProvider !== undefined) {
                    this.currentImlProvider.dispose()
                }

                // IML functions list url
                let url = `${this._environment}/app/${app}/${version}/function`

                // Get list of IML functions
                let response = await Core.rpGet(url, this._authorization)
                let imls = response.map(iml => {
                    return `${iml.name}()`
                })

                // Register a new ImlProvider
                this.currentImlProvider = vscode.languages.registerCompletionItemProvider({
                    scheme: 'file',
                    language: 'imljson'
                }, new ImlProvider(imls))
            }
            else {

                // If out of scope, remove existing ImlProvider
                if (this.currentImlProvider !== null && this.currentImlProvider !== undefined) {
                    this.currentImlProvider.dispose()
                }
            }
        }
    }

    static async register(_DIR, _authorization, _environment) {

        /**
         * OpenSource Loader
         */
        vscode.commands.registerCommand('apps-sdk.load-open-source', async function (item) {

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
                    switch (item.name) {
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
                    let write = (item.language === "js" || item.language === "md") ? body : Core.formatJsonc(body)

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
         * Source Loader
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
                    urn += `/${item.apiPath}/${item.parent.name}/${item.name}`
                    break
                case "rpc":
                case "module":
                case "connection":
                case "webhook":
                    urn += `/${item.apiPath}/${item.parent.name}/${item.name}`
                    break
                case "app":
                    // Prepared for more app-level codes
                    switch (item.name) {
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
                    let write = (item.language === "js" || item.language === "md") ? body : Core.formatJsonc(body)

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
    }
}

module.exports = CoreCommands