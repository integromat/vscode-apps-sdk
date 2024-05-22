import * as vscode from 'vscode';
import { MakecomappJsonFile } from './makecomapp-json-file-class';

/**
 * Class based logic around Local App Development.
 *
 * TODO: The idea is to refactor some node modules from stand-alone non-class functions into class based structure.
 */
export class CustomAppLocalProject {
	constructor(private readonly anyProjectPath: vscode.Uri) {}

	async isCommonDataIncluded(): Promise<boolean> {
		return (await this.getFreshMakecomappJson()).isCommonDataIncluded;
	}

	async getFreshMakecomappJson() {
		return await MakecomappJsonFile.fromLocalProject(this.anyProjectPath);
	}
}
