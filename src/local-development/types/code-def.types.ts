import { AppComponentMetadata } from './makecomapp.types';

export interface CodeDef {
	mimetype: string;
	fileext: string;
	filename?: string;
	onlyFor?: (componentMetadata: AppComponentMetadata) => boolean;
}
