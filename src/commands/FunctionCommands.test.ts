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

	describe('Simple unit tests', () => {
		const sumFuncName = 'sum';
		const sumFuncCode = `function ${sumFuncName}(a, b) { return a + b; }`;
		const succesfulSumTestCode = `it('simulatedTestSuccess', () => {
				assert.equal(${sumFuncName}(1,2), 3);
			});`;
		const failingSumTestCode = `it('simulatedTestFailing', () => {
				assert.equal(${sumFuncName}(1,2), 0);
			});`;

		test('Passing unit test', async () => {
			await executeCustomFunctionTest(
				sumFuncName,
				sumFuncCode,
				succesfulSumTestCode,
				[],
				outputChannel,
				'Europe/Prague',
			);
			assertTestSummary(outputChannel, 1, 0);
			assert.equal(
				outputChannel._findLine('- simulatedTestSuccess'),
				'- simulatedTestSuccess ... ✔',
				'Test report',
			);
		});

		test('Failing unit test', async () => {
			await executeCustomFunctionTest(
				sumFuncName,
				sumFuncCode,
				failingSumTestCode,
				[],
				outputChannel,
				'Europe/Prague',
			);
			assertTestSummary(outputChannel, 0, 1);
			assert.equal(
				outputChannel._findLine('- simulatedTestFailing'),
				'- simulatedTestFailing ... ✘ => AssertionError [ERR_ASSERTION]: 3 == 0',
				'AssertionError report',
			);
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

	describe('Another custom functions are available', () => {
		const anotherCustomFunctions = [
			{ name: 'getFive', code: 'function getFive() { return 5; }' },
			{
				name: 'getSix',
				code: 'function getSix() { return 6; }',
			},
		];
		const fakeFunc3Code = 'function fakeFunc3() { return getFive() + getSix(); }';

		test('Sucessful unit test', async () => {
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

			assertTestSummary(outputChannel, 1, 0);
			assert.equal(
				outputChannel._findLine('- simulatedTestAccessAnotherCustomFunc'),
				'- simulatedTestAccessAnotherCustomFunc ... ✔',
				'Test report',
			);
		});

		test('Failing unit test', async () => {
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
			assertTestSummary(outputChannel, 0, 1);

			assert.equal(
				outputChannel._findLine('- simulatedFailingTestAccessAnotherCustomFunc'),
				'- simulatedFailingTestAccessAnotherCustomFunc ... ✘ => AssertionError [ERR_ASSERTION]: 11 == 0',
				'Test report',
			);
		});
	});

	// test('Build-in functions are available', async () => {});
	// TODO !!!

	test('Timeout in case of infinite loop', async () => {
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
});

/**
 * Helper, which asserts the the final test summary text.
 */
function assertTestSummary(outputChannel: OutputChannelMock, sucessfulTestCount: number, failingTestCount: number) {
	// console.log(JSON.stringify(outputChannel._lines, null, 2));
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
