import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
	{
		files: ['src/**/*.{js,mjs,cjs,ts}'],
		ignores: ['syntaxes/imljson-language-features/**'],
	},
	eslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			globals: {
				...globals.node,
			}
		},
		plugins: {
			'@stylistic': stylistic,
		},
		rules: {
			"@stylistic/semi": [2, "always"],
			"no-unused-vars": ["error", {  "argsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],  // Add ignoring the `_paramName`
		},
	},
	...tseslint.config({
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		extends: [
			...tseslint.configs.recommended,
			...tseslint.configs.strict,
			...tseslint.configs.stylistic,
		],
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", {  "argsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],  // Add ignoring the `_paramName`
			"@stylistic/max-len": ["warn", 120, { "ignoreStrings": true, "ignoreComments": true, "ignoreTemplateLiterals": true }],  // Line width 80 -> 120
			"no-tabs": "off",  // This project uses tabs instead of spaces as default.
			"quote-props": ["error", "as-needed"],
			// "object-curly-spacing" is not aligned in Google with Typescript default used style
			"object-curly-spacing": ["error", "always", { "objectsInObjects": true }],
			"require-jsdoc": "off",
			"valid-jsdoc":"off",
			"quotes": ["error", "single", { "avoidEscape": true }],  // Allow to used double-quotes if inner string has single-quote.
			"block-spacing": ["error", "always"],  // Rollback from Google style to ESLint default.
			"padded-blocks": "off", // Allow to start and end block ith blank lines.
			"no-multi-spaces": ["error", { "ignoreEOLComments": true }],  // Ignore multiple spaces before comments that occur at the end of lines
			"operator-linebreak": ["error", "after", { "overrides": { "?": "before", ":": "before" } }], // Align with Prettier
			"@typescript-eslint/no-explicit-any": "off",  // Used on many places in vscode extension. :(
			"camelcase": ["error", { "allow": ["^testsOnly_"] }],
		},
	}),
	...tseslint.config({
		files: ['src/**/*.js'],
		languageOptions: {
			globals: {
				...globals.mocha,
			},
		},
		rules: {
			"indent": ["error", "tab", {
				"FunctionDeclaration": { "body": 1, "parameters": 1 },
				"SwitchCase": 1
			}],
		},
	}),
	eslintConfigPrettier,
];
