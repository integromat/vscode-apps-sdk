import * as assert from 'node:assert';
import { beforeEach, describe, test } from 'mocha';
import * as vscode from 'vscode';
import { executeCustomFunctionTest } from './FunctionCommands';

/** Mock of `vscode.OutputChannel` */
class OutputChannelMock implements vscode.OutputChannel {
	_lines: string[] = [];
	private lineEnded: boolean = true;
	name = 'Mock Channel';
	show() {}
	hide() {}
	replace() {}
	clear() {}
	dispose() {}
	append(value?: string): void {
		const lines = (value ?? '').split(/\r?\n/g);
		if (!this.lineEnded) {
			this._lines[this._lines.length - 1] += lines.shift() || '';
		}
		this._lines.push(...lines);
		this.lineEnded = false;
	}
	appendLine(value?: string): void {
		this.append(value);
		this.lineEnded = true;
	}
	_findLine(includes: string | RegExp): string {
		const foundLines =
			includes instanceof RegExp
				? this._lines.filter((line) => includes.test(line))
				: this._lines.filter((line) => line.includes(includes));
		if (foundLines.length === 0) {
			throw new Error(`Not found expected "${includes} in output"`);
		}
		if (foundLines.length > 1) {
			throw new Error(`Too unspecific "${includes} search in output. Multiple lines found."`);
		}
		return foundLines[0];
	}
}

suite('IML Functions Unit testing feature', () => {
	const outputChannel = new OutputChannelMock();

	beforeEach(() => {
		outputChannel._lines = [];
	});

	describe('Unit tests execution & resolving', () => {
		const sumFuncName = 'sum';
		const sumFuncCode = `function ${sumFuncName}(a, b) { return a + b; }`;
		const succesfulSumTestCode = `it('simulatedTestSuccess', () => {
				assert.equal(${sumFuncName}(1,2), 3);
			});`;
		const failingSumTestCode = `it('simulatedTestFailing', () => {
				assert.equal(${sumFuncName}(1,2), 0);
			});`;

		test('Unit test should report the success when expectation === actual', async () => {
			await executeCustomFunctionTest(
				sumFuncName,
				sumFuncCode,
				succesfulSumTestCode,
				[],
				outputChannel,
				'Europe/Prague',
			);
			assert.equal(
				outputChannel._findLine('- simulatedTestSuccess'),
				'- simulatedTestSuccess ... ✔',
				'Test executed successfully',
			);
			assertTestSummary(outputChannel, 1, 0);
		});

		test('Unit test should report the fail when expectation !== actual', async () => {
			await executeCustomFunctionTest(
				sumFuncName,
				sumFuncCode,
				failingSumTestCode,
				[],
				outputChannel,
				'Europe/Prague',
			);
			assert.equal(
				outputChannel._findLine('- simulatedTestFailing'),
				'- simulatedTestFailing ... ✘ => AssertionError [ERR_ASSERTION]: 3 == 0',
				'AssertionError report',
			);
			assertTestSummary(outputChannel, 0, 1);
		});

		test('Multiple unit tests in one file', async () => {
			await executeCustomFunctionTest(
				sumFuncName,
				sumFuncCode,
				succesfulSumTestCode + failingSumTestCode,
				[],
				outputChannel,
				'Europe/Prague',
			);
			assertTestSummary(outputChannel, 1, 1);
		});
	});

	suite('Other custom functions together with build-in are available', () => {
		const anotherCustomFunctions = [
			{ name: 'getFive', code: 'function getFive() { return 5; }' },
			{ name: 'getSix', code: 'function getSix() { return 6; }' },
		];
		const fakeFunc3Code = `function fakeFunc3() { return typeof iml.ceil === 'function' &&
			typeof iml.omit === 'function' &&
			typeof iml.capitalize === 'function' &&
			typeof iml.addDays === 'function' &&
			(iml.getFive() + iml.getSix());
		}`;

		test('Unit test should report the success when expectation === actual', async () => {
			const fakeFunc3SucessfullTestCode = `it('simulatedTestAccessAnotherCustomFunc', () => {
				assert.equal(fakeFunc3(), 11);
			});`;

			await executeCustomFunctionTest(
				'fakeFunc3',
				fakeFunc3Code,
				fakeFunc3SucessfullTestCode,
				anotherCustomFunctions,
				outputChannel,
				'Europe/Prague',
			);

			assert.equal(
				outputChannel._findLine('- simulatedTestAccessAnotherCustomFunc'),
				'- simulatedTestAccessAnotherCustomFunc ... ✔',
				'Test executed successfully',
			);
			assertTestSummary(outputChannel, 1, 0);
		});

		test('Unit test should report the fail when expectation !== actual', async () => {
			const fakeFunc3FailingTestCode = `it('simulatedFailingTestAccessAnotherCustomFunc', () => {
				assert.equal(fakeFunc3(), 0);
			});`;

			await executeCustomFunctionTest(
				'fakeFunc3',
				fakeFunc3Code,
				fakeFunc3FailingTestCode,
				anotherCustomFunctions,
				outputChannel,
				'Europe/Prague',
			);

			assert.equal(
				outputChannel._findLine('- simulatedFailingTestAccessAnotherCustomFunc'),
				'- simulatedFailingTestAccessAnotherCustomFunc ... ✘ => AssertionError [ERR_ASSERTION]: 11 == 0',
				'Test executed with specific failure',
			);
			assertTestSummary(outputChannel, 0, 1);
		});
	});

	test('Build-in functions are available and callable in custom functions', async () => {
		const callImlCode =
			`function callImlFunction() {
				return typeof iml.ceil === 'function' &&
					typeof iml.pick === 'function' &&
					typeof iml.base64 === 'function' &&
					typeof iml.formatDate === 'function' &&
					iml.formatNumber(iml.floor(iml.average(1,6000)), 2, ",", ".");
			}`;

		const callImlSucessfulTestCode = `it('simulatedTestCallIml', () => {
			assert.equal(callImlFunction(), "3.000,00");
		});`;

		await executeCustomFunctionTest(
			'callImlFunction',
			callImlCode,
			callImlSucessfulTestCode,
			[],
			outputChannel,
			'Europe/Prague',
		);

		assert.equal(
			outputChannel._findLine('- simulatedTestCallIml'),
			'- simulatedTestCallIml ... ✔',
			'Test executed successfully',
		);
		assertTestSummary(outputChannel, 1, 0);
	});

	test('Unit test fail when called unexisting iml function', async () => {
		const callImlCode =
			`function callFailingImlFunction1() {
				return iml.notExistFunction(1, 3, 5);
			}`;

		const callImlSucessfulTestCode = `it('simulatedTestCallWrongIml', () => {
			assert.equal(callFailingImlFunction1(), "3.000,00");
		});`;

		await executeCustomFunctionTest(
			'callImlFunction',
			callImlCode,
			callImlSucessfulTestCode,
			[],
			outputChannel,
			'Europe/Prague',
		);

		assert.equal(
			outputChannel._findLine('- simulatedTestCallWrongIml'),
			'- simulatedTestCallWrongIml ... ✘ => TypeError: iml.notExistFunction is not a function',
			'Test report should be "fail',
		);
		assertTestSummary(outputChannel, 0, 1);
	});


	test('Timeout in case of function infinite loop', async () => {
		const loopFuncCode = 'function loopingFunc(a, b) { while(true) {} }';
		const failingLoopFuncTestCode = `it('loopingFunc should return undefined', () => {
			assert.equal(loopingFunc(), undefined);
		});`;
		await executeCustomFunctionTest(
			'loopingFunc',
			loopFuncCode,
			failingLoopFuncTestCode,
			[],
			outputChannel,
			'Europe/Prague',
		);
		assert.equal(
			outputChannel._findLine('- loopingFunc'),
			'- loopingFunc should return undefined ...  ✘ EXECUTION CRITICAL FAILURE',
			'Critical error report',
		);
		assert.equal(
			outputChannel._findLine('Script execution timed out after'),
			'Error: Script execution timed out after 5000ms',
			'Execution timeout',
		);
	});

	test('Isolation: process should not exists in context', async () => {
		const getProcessCode = 'function getProcess() { return process; }';
		const getProcessTestCode = `it('process should not exists in context', () => {
			assert.throws(getProcess, { name: "ReferenceError", message: "process is not defined"}, '"process" variable should not exist');
		});`;
		await executeCustomFunctionTest(
			'getProcess',
			getProcessCode,
			getProcessTestCode,
			[],
			outputChannel,
			'Europe/Prague',
		);
		assert.equal(
			outputChannel._findLine('- process should not exists in context'),
			'- process should not exists in context ... ✔',
			'Test executed successfully',
		);
		assertTestSummary(outputChannel, 1, 0);
	});

	test('Isolation: global should not exists in context', async () => {
		const getGlobalCode = 'function getGlobal() { return global; }';
		const getGlobalTestCode = `it('global should not exists in context', () => {
			assert.throws(getGlobal, { name: "ReferenceError", message: "global is not defined"}, '"global" variable should not exist');
		});`;
		await executeCustomFunctionTest(
			'getGlobal',
			getGlobalCode,
			getGlobalTestCode,
			[],
			outputChannel,
			'Europe/Prague',
		);
		assert.equal(
			outputChannel._findLine('- global should not exists in context'),
			'- global should not exists in context ... ✔',
			'Test executed successfully',
		);
		assertTestSummary(outputChannel, 1, 0);
	});
});

/**
 * Helper, which asserts the the final test summary text.
 */
function assertTestSummary(outputChannel: OutputChannelMock, sucessfulTestCount: number, failingTestCount: number) {
	assert.equal(
		outputChannel._findLine('Total test blocks: '),
		`Total test blocks: ${sucessfulTestCount + failingTestCount}`,
		'Total test count',
	);
	assert.equal(
		outputChannel._findLine('Passed blocks: '),
		`Passed blocks: ${sucessfulTestCount}`,
		'Passed test count',
	);
	assert.equal(outputChannel._findLine('Failed blocks: '), `Failed blocks: ${failingTestCount}`, 'Failed test count');
	const finalConclussion = outputChannel._findLine(/TEST (PASSED|FAILED) ==========/);
	if (failingTestCount === 0) {
		assert.equal(finalConclussion, '========== ✔ TEST PASSED ==========', 'Final conclusion: success');
	} else {
		assert.equal(finalConclussion, '========== ✘ TEST FAILED ==========', 'Final conclusion: failed');
	}
}
