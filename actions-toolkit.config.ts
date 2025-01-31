/**
 * @type {import('@integromat/actions-toolkit').ConfigSchema}
 */
const config = {
	releasePlease: {
		/*
		 * Change Release Please commits types, which triggers the release PR and which are visible in changelog.
		 * List of all commit types:
		 * https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-conventionalcommits/src/constants.js
		 */
		hiddenChangeTypesInPublicRepo: ['docs', 'style', 'test'],
	},
};

export default config;
