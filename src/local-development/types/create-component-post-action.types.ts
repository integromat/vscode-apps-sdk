export interface CreateAppComponentPostAction {
	/** Describes that the connection ID must be changed in all references (in makecomapp.json) */
	renameConnection?: {
		oldId: string,
		newId: string,
	}
}
