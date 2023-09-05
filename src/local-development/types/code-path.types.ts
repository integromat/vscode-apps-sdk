import * as vscode from 'vscode';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { CodeFriendlyType } from './code-friendly-type.types';

export interface CodePath {
	componentType: AppComponentType | AppGeneralType;
	componentName: string;
	codeName: CodeFriendlyType;
	localFile: vscode.Uri;
}
