import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { isComponentLocalIdValid } from './validate-id';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { entries } from '../../utils/typed-object';

suite('isComponentLocalIdValid()', () => {
	const testingSet: Record<AppComponentType | AppGeneralType, Record<'valid' | 'invalid', string[]>> = {
		app: {
			valid: ['myapp123', 'my-app-123'],
			invalid: ['ap', '0myapp', 'myApp', 'myapp-', '-app'],
		},
		rpc: {
			valid: ['mycomponent123', 'myComponent', 'MyComponent'],
			invalid: ['my', '0mycomponent', 'mycomponent-', '-component', 'my-component-123'],
		},
		module: {
			valid: ['mycomponent123', 'myComponent', 'MyComponent'],
			invalid: ['my', '0mycomponent', 'mycomponent-', '-component', 'my-component-123'],
		},
		function: {
			valid: ['mycomponent123', 'myComponent', 'MyComponent'],
			invalid: ['my', '0mycomponent', 'mycomponent-', '-component', 'my-component-123'],
		},
		webhook: {
			valid: ['mycomponent123', 'myComponent', 'MyComponent', 'my-component-123'],
			invalid: ['my', '0mycomponent', 'mycomponent-', '-component'],
		},
		connection: {
			valid: ['mycomponent123', 'myComponent', 'MyComponent', 'my-component-123'],
			invalid: ['my', '0mycomponent', 'mycomponent-', '-component'],
		},
	};

	for (const [componentType, testingValues] of entries(testingSet)) {
		test(`Should consider an valid ${componentType} IDs as valid`, async () => {
			testingValues.valid.forEach((invalidComponentId) => {
				const isValid = isComponentLocalIdValid(componentType, invalidComponentId);
				assert.strictEqual(
					isValid,
					true,
					`Valid ${componentType} ID "${invalidComponentId}" should be considered valid`,
				);
			});
		});

		test(`Should consider an invalid ${componentType} IDs as invalid`, async () => {
			testingValues.invalid.forEach((invalidComponentId) => {
				const isValid = isComponentLocalIdValid(componentType, invalidComponentId);
				assert.strictEqual(
					isValid,
					false,
					`Invalid ${componentType} ID "${invalidComponentId}" should be considered invalid`,
				);
			});
		});
	}
});
