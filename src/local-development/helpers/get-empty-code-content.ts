import type { CodeType } from '../types/code-type.types';

/**
 * Retuns the default empty content for each code type.
 *
 * Note: This function is here only temporary, until full templates are implemented instead.
 */
export function getEmptyCodeContent(codeType: CodeType, componentLocalId: string): string {
	switch (codeType) {
		case 'base':
		case 'communication':
		case 'common':
		case 'scopeList':
		case 'samples':
		case 'attach':
		case 'detach':
		case 'update':
		case 'epoch':
		case 'installDirectives':
			return '{ }\n';
		case 'params':
		case 'mappableParams':
		case 'staticParams':
		case 'defaultScope':
		case 'scope':
		case 'interface':
		case 'groups':
		case 'requiredScope':
		case 'installSpec':
			return '[]\n';
		case 'readme':
			return 'README\n======\n';
		case 'code':
			return `function ${componentLocalId}() {\n` + '    // Write the JavaScript code here...\n' + '}';
		case 'test':
			return '// Write the JavaScript code here...\n';
		default:
			throw new Error(`Cannot create empty code, because code type "${codeType}" is unknown..`);
	}
}
