const ua = require('universal-analytics')

// Create analytics user
const usr = ua('UA-XXXXXXXX-X');

function trackEvent(category, action, label, value) {
    usr.event({
        ec: category,
        ea: action,
        el: label,
        ev: value,
    }).send();
}

module.exports = { trackEvent }