const vscode = require('vscode');
const { IML } = require('@integromat/iml');
const camelCase = require('lodash.camelcase');

// Not a Formula, not a Forman, this is just a Felicia (from latin/italian "felice" = happy)
// It will make you happy as it generates VSCode Forms for you based on Integromat Descriptive Syntax

class ValidationError extends Error {
    constructor(message) {
        super(message);
    }
}

const types = {
    select: async(field, context) => {

        const nestedDictionary = field.options.reduce((dictionary, option) => {
            if (option.nested) {
                dictionary[option.value] = option.nested;
            }
            return dictionary;
        }, {});
        const options = field.options.map(option => {
            return {
                label: option.label,
                description: option.value
            }
        });

        // FIXME: THIS

        const value = await vscode.window.showQuickPick(options, {
            placeHolder: field.label
        });

        if (nestedDictionary[value]) {
            const nested = await module.exports(nestedDictionary[value]);
            Object.entries(nested).forEach(([key, value]) => {
                context[key] = value;
            });
        }
        return value;
    },
    text: async(field, context) => {
        const validate = (spec, value) => {
            if (spec.pattern !== undefined && !(RegExp(spec.pattern).test(value))) {
                return `Value must match following pattern: /${spec.pattern}/.`
            }
            if (spec.min !== undefined && value.length < spec.min) {
                return `Value must be at least ${spec.min} characters long.`
            }
            if (spec.max !== undefined && value.length > spec.max) {
                return `Value must be at most ${spec.max} characters long`
            }
            return undefined;
        }

        const value = await vscode.window.showInputBox({
            prompt: field.label,
            value: IML.execute(IML.parse(field.default), {
                context
            }, {
                functions: {
                    camelCase
                }
            }),
            validateInput: field.validate ? validate.bind(null, field.validate) : undefined
        });

        if (field.required === true && (value === null || value === '')) {
            throw new ValidationError(`Field ${field.name} is required.`);
        }

        return value;
    },
    number: async(field, context) => {
        const validate = (spec, value) => {
            try {
                parseInt(value);
            } catch (err) {
                return err;
            }
            if (spec.min !== undefined && value < spec.min) {
                return `Numeric value must be at least ${spec.min}.`
            }
            if (spec.max !== undefined && value > spec.max) {
                return `Numeric value must be at most ${spec.max}.`
            }
            return undefined;
        }

        const value = await vscode.window.showInputBox({
            prompt: field.label,
            value: IML.execute(IML.parse(field.default), { context }, {
                functions: {
                    camelCase
                }
            }),
            validateInput: validate.bind(null, field.validate || {})
        });

        if (field.required === true && (value === undefined || value === null || value === '')) {
            throw new ValidationError(`Field ${field.name} is required.`);
        }

        return value;
    }
}

module.exports = async(config) => {
    try {
        const data = {};
        for (const field of config) {
            if (types[field.type] !== undefined) {
                data[field.name] = await types[field.type](field, data);
                if (data[field.name] === undefined) {
                    return undefined;
                }
            }
        }
        return data;
    } catch (err) {
        vscode.window.showWarningMessage(err.message);
        return undefined;
    }
}