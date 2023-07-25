import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";
import * as vscode from "vscode";

export async function run(...argv2: any): Promise<void> {
	const mochaOutputFile = process.env.MOCHA_OUTPUT_FILE ? path.join(__dirname, "..", "..", process.env.MOCHA_OUTPUT_FILE) : undefined;

	// Create the mocha test
	const mocha = new Mocha({
		ui: "tdd",
		color: true,
		// Use JSON output if requested by the environment `MOCHA_OUTPUT_FILE=filenam.json`
		reporter: mochaOutputFile ? "json" : "spec",
		reporterOptions: mochaOutputFile ? { output: mochaOutputFile } : undefined,
	});

	const testsRoot = path.resolve(__dirname, "..");

	const files = await glob("**/**.test.js", { cwd: testsRoot });

	// Add files to the test suite
	files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

	await new Promise((c, e) => {
		try {
			// Run the mocha test
			mocha.run((failures) => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c(undefined);
				}
			});
		} catch (err) {
			e(err);
		}
	});

	if (mochaOutputFile) {
		console.log('Test report saved in file:', mochaOutputFile);
	}
}
