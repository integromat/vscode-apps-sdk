module.exports = {
    functionName: function(string) {
        return RegExp("(^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)").test(string) ? undefined : "Function name must match the following RegExp: (^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$), for example: myFunction"
    },
    rpcName: function(string) {
        return RegExp("(^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)").test(string) ? undefined : "RPC id must match the following RegExp: (^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$), for example: myRpc"
    },
    moduleName: function(string) {
        return RegExp("(^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)").test(string) ? undefined : "Module id must match the following RegExp: (^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$), for example: myModule"
    },
    appName: function(string) {
        return RegExp("(^[a-z][0-9a-z-]+[0-9a-z]$)").test(string) ? undefined : "App name must match the following RegExp: (^[a-z][0-9a-z-]+[0-9a-z]$), for example: my-new-app"
    },
    appTheme: function(string) {
        return RegExp("^(#[0-9A-Fa-f]{6})$").test(string) ? undefined : "String is not valid color."
    },
    commitMessage: function(string) {
        return (string.length <= 1000 && string.length > 0) ? undefined : "Commit message must have not be empty and must have at most 1000 characters."
    }
}
