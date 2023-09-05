import * as vscode from 'vscode';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { CodeType } from './code-type.types';

export interface CodePath {
	componentType: AppComponentType | AppGeneralType;
	componentName: string;
	codeType: CodeType;
	localFile: vscode.Uri;
}
