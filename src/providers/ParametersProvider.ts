import { AxiosResponse } from 'axios';
import * as jsoncParser from 'jsonc-parser';
import * as vscode from 'vscode';
import { Environment } from '../types/environment.types';
import * as Core from '../Core';
import { showAndLogError } from '../error-handling';
import { requestMakeApi } from '../utils/request-api-make';

/**
 * Represents static parameters + mappable parameters.
 * Note: These parameters are defined in SDK app module, for example.
 */
export class ParametersProvider {
	private availableParameters = ['parameters'];

	private parameters: vscode.CompletionItem[] = [];

	constructor(
		/** Authorization header value */
		private _authorization: string,
		private _environment: Environment
	) {
		this.availableParameters = ['parameters'];

	}

	async loadParameters(crumbs: string[], version: string) {

		// Preparing api route
		let urn = `/${Core.pathDeterminer(this._environment.version, '__sdk')}${Core.pathDeterminer(this._environment.version, 'app')}`;
		if (Core.isVersionable(crumbs[3])) {
			urn += `/${crumbs[2]}/${version}`;
		}
		urn += `/${crumbs[3]}/${crumbs[4]}`;

		/*
		 * PARAMETERS
		 */
		if (['connection', 'webhook', 'rpc', 'module', 'connections', 'webhooks', 'rpcs', 'modules'].includes(crumbs[3])) {
			const url = `${this._environment.baseUrl}${urn}/parameters`;
			try {
				const parameters = await requestMakeApi({
					url: url,
					headers: {
						Authorization: this._authorization,
					},
					transformResponse: (res: AxiosResponse) => { return res; },  // Do not parse the response into JSON
				});
				this.availableParameters = this.availableParameters.concat(this.generateParametersMap(jsoncParser.parse(parameters), 'parameters'));
			} catch (err: any) {
				showAndLogError(err, 'loadParameters');
			}

		}

		/*
		 * EXPECT
		 */
		if (crumbs[3] === 'module' || crumbs[3] === 'modules') {
			const url = `${this._environment.baseUrl}${urn}/expect`;
			try {
				const expect = await requestMakeApi({
					url: url,
					headers: {
						Authorization: this._authorization,
					},
					transformResponse: (res: AxiosResponse) => { return res; },  // Do not parse the response into JSON
				});
				this.availableParameters = this.availableParameters.concat(this.generateParametersMap(jsoncParser.parse(expect), 'parameters'));
			} catch (err: any) {
				showAndLogError(err, 'loadParameters');
			}

		}

		this.parameters = this.availableParameters.map(parameter => { return new vscode.CompletionItem(parameter, vscode.CompletionItemKind.Variable); });
	}

	/**
	 * @param {Array|string} parameters
	 *  - Array is used when parameters are defined staticaly.
	 *  - String is used when parameters are loaded dynamicaly via "rpc://...".
	 * @param {string} root
	 * @returns {string[]}
	 */
	generateParametersMap(parameters: ParameterDefinition[]|string, root: string) {
		// If parameters are loaded dynamicaly via rpc://, the extension cannot handle with it.
		if (typeof parameters === 'string') {
			if (!parameters.startsWith('rpc://')) {
				throw new Error(
					'Invalid parameters definition: If parameters is a string, ' +
					`it is expected to start with "rpc://". But got "${parameters}".`
				);
			}
			return [];
		}

		let out: string[] = [];
		parameters.forEach(parameter => {
			if (parameter.name !== undefined) {
				out.push(`${root}.${parameter.name}`);
			}
			if (Array.isArray(parameter.nested)) {
				out = out.concat(this.generateParametersMap(parameter.nested, root));
			}
			if (parameter.type === 'collection' && Array.isArray(parameter.spec)) {
				out = out.concat(this.generateParametersMap(parameter.spec, `${root}.${parameter.name}`));
			}
			else if (parameter.type === 'select' && Array.isArray(parameter.options)) {
				parameter.options.forEach(option => {
					if (Array.isArray(option.nested)) {
						out = out.concat(this.generateParametersMap(option.nested, root));
					}
				});
			}
		});
		return out;
	}

	resolveCompletionItem(item: vscode.CompletionItem) {
		return item;
	}

	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		const needle = document.getText(document.getWordRangeAtPosition(position, /([A-Z0-9.a-z])+/));
		if (needle.indexOf('.') > -1) {
			const candidates = this.parameters.filter(parameter => {
				const match = (parameter.label as string)?.match(`${needle}.[A-Za-z0-9]+`);
				if (match && match[0].length === match.input?.length) {
					return true;
				}
			});
			return candidates.map(parameter => {
				const toInsert = (parameter.label as string).split('.')[(parameter.label as string).split('.').length - 1];
				const toProvide = new vscode.CompletionItem(toInsert, vscode.CompletionItemKind.Property);
				toProvide.insertText = toInsert;
				toProvide.label = toInsert;
				return toProvide;
			});
		}
		else {
			return this.parameters.filter(parameter => {
				if ((parameter.label as string).indexOf('.') === -1 && (parameter.label as string).match(needle) !== null) {
					return true;
				}
			});
		}
	}
}


/**
 * @docs https://docs.integromat.com/apps/app-components/parameters
 */
interface ParameterDefinition {
	name: string;
	type?: string;
	label: string;
	help?: string;
	required?: boolean;
	advanced?: boolean;
	disabled?: boolean;
	rpc?: {
		label: string;
		url: string;
		parameters?: any[];
	}
	nested?: string|ParameterDefinition|ParameterDefinition[];
	/** definition for type === "collection" */
	spec?: ParameterDefinition[];
	/**
	 * definition for type === "select"
	 * If string, it must start with "rpc://".
	 * @docs https://docs.integromat.com/apps/app-components/parameters/select
	 */
	options?: {
		label: string;
		value: any;
		nested?: string|ParameterDefinition[];
	}[]|string;
}
