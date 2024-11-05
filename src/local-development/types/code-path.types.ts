import * as vscode from 'vscode';
import type { CodeType } from './code-type.types';
import type { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';

export interface CodePath {
	componentType: AppComponentType | AppGeneralType;
	componentLocalId: string;
	codeType: CodeType;
	localFile: vscode.Uri;
}
