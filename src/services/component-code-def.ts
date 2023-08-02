import { AppComponentType } from "../types/app-component-type.types";

const imljsonc = {
	fileext: 'imljson',
	mimetype: 'application/jsonc',
};
const json = {
	fileext: 'json',
	mimetype: 'application/json',
};

const componentsDefinition: Record<AppComponentType, Record<string, any>> = {
	connection: {
		api: imljsonc,
		parameters: imljsonc,
	},
	webhook: {
		api: imljsonc,
		parameters: imljsonc,
		attach: imljsonc,
		detach: imljsonc,
		update: imljsonc,
	},
	module: {
		api: imljsonc,
		parameters: imljsonc,
		expect: imljsonc,
		interface: imljsonc,
		samples: imljsonc,
		scope: imljsonc,
	},
	rpc: {
		api: imljsonc,
		parameters: imljsonc,
	},
	function: {
		code: { fileext: 'js', mimetype: 'application/javascript' },
	}
};

// Not used yet
const appBaseDefinition = {
	app: {
		content: {
			filename: 'readme',
			fileext: 'md',
			mimetype: 'text/markdown',
		},
	// 	common: {
	// 		fileext: 'imljson',
	// 		mimetype: 'application/json',
	// 	},
	},
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
