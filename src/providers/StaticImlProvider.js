const vscode = require('vscode')

const Core = require('../Core');
const { IML } = require('@integromat/iml')

class StaticImlProvider {
    constructor() {
        this.availableFunctions = []
    }

    async initialize() {
        let dictionary = JSON.parse((await Core.rpGet("https://static.integromat.com/lang/imt.iml.en.js ")).match(/({.+})/gm));
        let availableFunctions = Object.keys(IML.FUNCTIONS).map(name => {
            let f = IML.FUNCTIONS[name];
            let item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function)
            item.documentation = this.getDescription(name)
            item.detail = `${f.value.toString().replace(/{(.|\n)+}/gm, '{ ... }')}: ${f.type}`
            return item
        }).filter(fun => {
            return fun.label !== "" ? true : false
        })
        console.log(availableFunctions);
    }

    resolveCompletionItem(item) {
        return item
    }

    provideCompletionItems() {

    }

    getDescription(name) {
        switch (name) {
            case "get":
                return "Returns the value path of an object or array. To access nested objects, use dot notation. First item in an array is index 1."
            case "average":
                return "Returns the average value of the numeric values in a specific array, or the average value of numerical values entered individually."
            case "ceil":
                return "Returns the smallest integer greater than or equal to a specified number."
            case "floor":
                return "Returns the largest integer less than or equal to a specified number."
            case "if":
                return "Returns value 1 if the expression is evaluated to true, otherwise it returns value 2."
            case "ifempty":
                return "Returns value 1 if this value is not empty, otherwise it returns value 2."
            case "switch":
                return "Evaluates one value (called the expression) against a list of values, and returns the result corresponding to the first matching value."
            case "join":
                return "Concatenates all the items of an array into a string, using the specified separator between each item."
            case "length":
                return "Return the length of a text string (number of characters) or binary buffer (buffer size in bytes)."
            case "lower":
                return "Converts all alphabetical characters in a text string to lowercase."
            case "capitalize":
                return "Converts first character in a text string to uppercase."
            case "startcase":
                return "Capitalizes the first letter of every word and lower cases all other letters."
            case "ascii":
                return "Removes all non-ascii characters from a text string."
            case "max":
                return "Returns the largest number in a specified array, or the largest number among numbers entered individually."
            case "min":
                return "Returns the smallest number in a specified array, or the smallest number among numbers entered individually."
            case "replace":
                return "Replaces the search string with the new string."
            case "round":
                return "Rounds a numeric value to the nearest integer."
            case "trim":
                return "Removes space characters at the start or end of the text."
            case "upper":
                return "Converts all alphabetical characters in a text string to uppercase."
            case "substring":
                return "Returns a portion of a text string between the \"start\" position and \"the end\" position."
            case "indexOf":
                return "Returns the position of the first occurrence of a specified value in a string. This method returns '-1' if the value searched for never occurs."
            case "sum":
                return "Returns the sum of the values in a specified array, or the sum of numbers entered individually."
            case "toBinary":
                return "Converts any value to binary data. You can also specify encoding as a second argument to apply binary conversions from hex or base64 to binary data."
            case "toString":
                return "Converts any value to a string."
            case "encodeURL":
                return "Encodes special characters in a text to a valid URL address."
            case "decodeURL":
                return "Decodes special characters in URL to text."
            case "escapeHTML":
                return "Escapes all HTML tags in text."
            case "stripHTML":
                return "Removes all HTML tags from text."
            case "addSeconds":
                return "Returns a new date as a result of adding a given number of seconds to a date. To subtract seconds, enter a negative number."
            case "addMinutes":
                return "Returns a new date as a result of adding a given number of minutes to a date. To subtract minutes, enter a negative number."
            case "addHours":
                return "Returns a new date as a result of adding a given number of hours to a date. To subtract hours, enter a negative number."
            case "addDays":
                return "Returns a new date as a result of adding a given number of days to a date. To subtract days, enter a negative number."
            case "addMonths":
                return "Returns a new date as a result of adding a given number of months to a date. To subtract months, enter a negative number."
            case "addYears":
                return "Returns a new date as a result of adding a given number of years to a date. To subtract years, enter a negative number."
            case "setSecond":
                return "Returns a new date with the seconds specified in parameters. Accepts numbers from 0 to 59. If a number is given outside of this range, it will return the date with the seconds from the previous or subsequent minute(s), accordingly."
            case "setMinute":
                return "Returns a new date with the minutes specified in parameters. Accepts numbers from 0 to 59. If a number is given outside of the range, it will return the date with the minutes from the previous or subsequent hour(s), accordingly."
            case "setHour":
                return "Returns a new date with the hour specified in parameters. Accepts numbers from 0 to 23. If a number is given outside of the range, it will return the date with the hour from the previous or subsequent day(s), accordingly."
            case "setDay":
                return "Returns a new date with the day specified in parameters. It can be used to set the day of the week, with Sunday as 1 and Saturday as 7. If the given value is from 1 to 7, the resulting date will be within the current (Sunday-to-Saturday) week. If a number is given outside of the range, it will return the day from the previous or subsequent week(s), accordingly."
            case "setDate":
                return "Returns a new date with the day of the month specified in parameters. Accepts numbers from 1 to 31. If a number is given outside of the range, it will return the day from the previous or subsequent month(s), accordingly."
            case "setMonth":
                return "Returns a new date with the month specified in parameters. Accepts numbers from 1 to 12. If a number is given outside of this range, it will return the month in the previous or subsequent year(s), accordingly."
            case "setYear":
                return "Returns a new date with the year specified in parameters."
            case "formatDate":
                return "Returns a date in the requested format and optionally, in a specified timezone. For example, format DD.MM.YYYY HH:mm. See the list of supported timezones."
            case "parseDate":
                return "Parses a string with a date and returns the date."
            case "parseNumber":
                return "Parses a string with a number and returns the number. Example: parseNumber(1 756,456;,)"
            case "formatNumber":
                return "Returns a number in the requested format. Decimal point is `,` by default, Thousands separator is `.` by default."
            case "keys":
                return "Returns an array of a given object's or array's properties."
            case "slice":
                return "Returns a new array containing only selected items."
            case "merge":
                return "Merges one or more arrays into one array."
            case "contains":
                return "Verifies if text or array contains the search string."
            case "split":
                return "Splits a string into an array of strings by separating the string into substrings."
            case "remove":
                return "Removes values specified in the parameters of an array. Effective only on primitive arrays of text or numbers."
            case "add":
                return "Adds values specified in parameters to an array and returns that array."
            case "map":
                return "Returns a primitive array containing values of a complex array. Allows filtering values. Use raw variable names for keys."
            case "sort":
                return "Sorts values of an array. The order is either `asc` or `desc`. Use `key` argument to access properties inside complex objects. Use raw variable names for keys. To access nested properties, use dot notation. The first item in an array is index 1."
            case "reverse":
                return "Returns an array in reversed order."
            case "distinct":
                return "Removes duplicates inside an array. Use `key` argument to access properties inside complex objects. To access nested properties, use dot notation. The first item in an array is index 1."
            case "md5":
                return "Calculates the md5 hash of a string."
            case "sha1":
                return "Calculates the sha1 hash of a string. If the key argument is specified, sha1 HMAC hash is returned instead. Supported encodings: `hex` (default), `base64` or `latin1`."
            case "sha256":
                return "Calculates the sha256 hash of a string. If the key argument is specified, sha256 HMAC hash is returned instead. Supported encodings: `hex` (default), `base64` or `latin1`."
            case "sha512":
                return "Calculates the sha512 hash of a string. If the key argument is specified, sha512 HMAC hash is returned instead. Supported encodings: `hex` (default), `base64` or `latin1`. Supported key encodings: `text` (default), `hex`, `base64` or `binary`. When using `binary` key encoding, a key must be a buffer, not a string."
            case "base64":
                return "Transforms text to base64."
            default:
                return ""
        }
    }
}

module.exports = StaticImlProvider