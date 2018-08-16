module.exports = {
    functionName: function (string) {
        return RegExp("(^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)").test(string) ? undefined : "Function name must match the following RegExp: (^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)"
    },
    rpcName: function (string) {
        return RegExp("(^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)").test(string) ? undefined : "RPC id must match the following RegExp: (^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)"
    },
    moduleName: function(string) {
        return RegExp("(^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)").test(string) ? undefined : "Module id must match the following RegExp: (^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$)"
    },
    appName: function(string) {
        return RegExp("(^[a-z][0-9a-z-]+[0-9a-z]$)").test(string) ? undefined : "App name must match the following RegExp: (^[a-z][0-9a-z-]+[0-9a-z]$)"
    },
    appTheme: function(string) {
        return RegExp("^(#[0-9A-Fa-f]{6})$").test(string) ? undefined : "String is not valid color."
    },
    urlFormat: function(string){
        return RegExp("(integromat)(.)((com|cloud))").test(string) ? undefined : "URL is not valid Integromat API URL."
    }
}