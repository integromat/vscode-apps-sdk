const vscode = require('vscode');

// Not a Formula, not a Forman, this is just a Felicia (from latin/italian "felice" = happy)
// It will make you happy as it generates VSCode Forms for you based on Integromat Descriptive Syntax

class ValidationError extends Error {
	constructor(message) {
		super(message);
	}
}

const types = {
	text: async (field) => {
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
			value: field.default,
			validateInput: field.validate ? validate.bind(null, field.validate) : undefined
		});

		if (field.required === true && (value === null || value === '')) {
			throw new ValidationError(`Field ${field.name} is required.`);
		}

		return value;
	},
	number: async (field) => {
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
			value: field.default,
			validateInput: validate.bind(null, field.validate || {})
		});

		if (field.required === true && (value === undefined || value === null || value === '')) {
			throw new ValidationError(`Field ${field.name} is required.`);
		}

		return value;
	}
}

module.exports = async (config) => {
	try {
		const data = {};
		for (const field of config) {
			if (types[field.type] !== undefined) {
				data[field.name] = await types[field.type](field);
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