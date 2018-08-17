const vscode = require('vscode');
const ua = require('universal-analytics')

// Create analytics user
const usr = ua('UA-XXXXXXXX-X');

function trackEvent(action, label, value) {

    // Sending only when the telemetry is enabled
    if(vscode.workspace.getConfiguration('apps-sdk').telemetry){
        usr.event({
            ec: 'Apps SDK',
            ea: action,
            el: label,
            ev: value,
        }).send();
    }
}

module.exports = { trackEvent }