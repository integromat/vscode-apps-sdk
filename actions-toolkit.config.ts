/**
 * @type {import('@integromat/actions-toolkit').ConfigSchema}
 */
const config = {
	releasePlease: {
		/*
		 * Reset the Release Please to default configuration, to be in alignment with definition in
		 * https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-conventionalcommits/src/constants.js
		 * + except keeping visible `refactor` and `build` for being able tracking these changes for case of issue troubleshooting.
		 */
		hiddenChangeTypesInPublicRepo: ['docs', 'style', 'chore', 'test', 'ci'],
	},
};

export default config;
