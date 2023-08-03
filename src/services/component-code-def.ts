import { AppComponentType } from "../types/app-component-type.types";

const imljsonc = {
	fileext: 'imljson',
	mimetype: 'application/jsonc',
};
const appBaseDefinition = {
	base: {
		filename: 'base',
		fileext: 'imljson',
		mimetype: 'application/jsonc',
	},
	common: {
		fileext: 'json',
		mimetype: 'application/json',
	},
	content: {
		filename: 'readme',
		fileext: 'md',
		mimetype: 'text/markdown',
	},
};

const componentsDefinition: Record<AppComponentType, Record<string, any>> = {
	app: appBaseDefinition,
	connection: {
		api: { ...imljsonc, filename: 'base' },
		parameters: imljsonc,
	},
	webhook: {
		api: { ...imljsonc, filename: 'base' },
		parameters: imljsonc,
		attach: imljsonc,
		detach: imljsonc,
		update: imljsonc,
	},
	module: {
		api: { ...imljsonc, filename: 'base' },
		// TODO Static vs mappable parameters
		parameters: imljsonc,
		expect: imljsonc,
		interface: imljsonc,
		samples: imljsonc,
		scope: imljsonc,
	},
	rpc: {
		api: { ...imljsonc, filename: 'base' },
		parameters: imljsonc,
	},
	function: {
		code: { fileext: 'js', mimetype: 'application/javascript' },
		test: { fileext: 'js', mimetype: 'application/javascript' },
	}
};



export function getAppComponentDefinition(appComponentType: AppComponentType) {

	if (!componentsDefinition[appComponentType]) {
		throw new Error(`Unsupported component name: ${appComponentType}`);
	}

	return componentsDefinition[appComponentType];
}


export function getAppComponentCodeDefinition(appComponentType: AppComponentType, codeName: string): {
	mimetype: string,
	fileext: string,
	filename?: string,
} {
	const componentDef = getAppComponentDefinition(appComponentType);

	if (!componentDef[codeName]) {
		throw new Error(`Unsupported code name: ${appComponentType}->${codeName}`);
	}

	return componentDef[codeName];
}


export function getAppComponentTypes(): AppComponentType[] {
	return Object.keys(componentsDefinition) as AppComponentType[];
}
