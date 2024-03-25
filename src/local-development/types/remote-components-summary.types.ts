import { AppComponentMetadata } from './makecomapp.types';
import { AppComponentType } from '../../types/app-component-type.types';

export type RemoteComponentsSummary = Record<AppComponentType, Record<string, AppComponentMetadata>>;
