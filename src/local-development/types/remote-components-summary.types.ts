import type { AppComponentMetadata } from './makecomapp.types';
import type { AppComponentType } from '../../types/app-component-type.types';

export type RemoteComponentsSummary = Record<AppComponentType, Record<string, AppComponentMetadata>>;
