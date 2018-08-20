const vscode = require('vscode')

const path = require('path')
const fs = require('fs')
const rp = require('request-promise')

class CoreCommands{
    constructor(appsProvider, _authorization, _environment){
        this.appsProvider = appsProvider
        this._authorization = _authorization
        this._environment = _environment
    }
    async sourceUpload(editor){

        // It it's not an APPS SDK file, don't do anything
        if(!editor.fileName.includes('apps-sdk')){ return }

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
        let uri = this._environment + url

        // Prepare request options
        var options = {
            uri: uri,
            method: 'POST',
            body: file,
            headers: {
                "Content-Type": "application/json",
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
        try{
            // Get the response from server
            let response = JSON.parse(await rp(options))

            // If there's no change to be displayed, end
            if(!response.change){ return }

            // Else refresh the tree, because there's a new change to be displayed
            this.appsProvider.refresh()
        }
        catch(err){
            let e = JSON.parse(err.error)
            vscode.window.showErrorMessage(`${e.name}: ${e.message}`)                
        }
    }
}

module.exports = CoreCommands