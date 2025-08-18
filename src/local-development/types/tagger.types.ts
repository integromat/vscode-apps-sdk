interface TagHelper<Tag> {
	/** @ignore - Means: do not render into `makecomapp.schema.json` by `typescript-json-schema` lib. */
	__tag?: Tag;
}

/**
 * Helper for preventing the two same interfaces from being used interchangeably.
 */
export type Tagged<T, Tag> = T & TagHelper<Tag>;
