/* eslint @typescript-eslint/no-unused-vars: "warn" */ // TODO remove this line after full implementation
import type * as IVscode from 'vscode';
import debugFactory from 'debug';
import * as fs from 'fs/promises';
import type { Stats } from 'fs';
import * as path from 'path';
import { FileType } from '../vscode-file-type.enum';

const debug = debugFactory('app:vscode-cli-override');

export const vsCodeLibWrapperFsImplementationForCLI = {
	readFile: (async (uri: IVscode.Uri): Promise<Uint8Array> => {
		debug(`Reading file from path: ${uri.fsPath}`);
		return fs.readFile(uri.fsPath);
	}) as typeof IVscode.workspace.fs.readFile,
	writeFile: (async (uri: IVscode.Uri, content: Uint8Array) => {
		debug(`Writing file to path: ${uri.fsPath}`);

		const dir = path.dirname(uri.fsPath);

		// Ensure the directory exists (recursive = true)
		await fs.mkdir(dir, { recursive: true });

		// Now write the file
		return fs.writeFile(uri.fsPath, content);
	}) as typeof IVscode.workspace.fs.writeFile,
	stat: (async (uri: IVscode.Uri) => {
		const isDirectory = false;
		try {
			debug(`Stat for path: ${uri.fsPath}`);
			const lstat = await fs.lstat(uri.fsPath);
			let type: number = FileType.Unknown;
			let size = lstat.size;
			let ctime = lstat.birthtimeMs;
			let mtime = lstat.mtimeMs;

			const isSymlink = lstat.isSymbolicLink();
			let targetIsDir = lstat.isDirectory();
			let targetIsFile = lstat.isFile();
			if (isSymlink) {
				try {
					const stat = await fs.stat(uri.fsPath);
					targetIsDir = stat.isDirectory();
					targetIsFile = stat.isFile();
					// Prefer target timestamps/size when available
					size = stat.size;
					ctime = stat.birthtimeMs;
					mtime = stat.mtimeMs;
				} catch {
					// Broken symlink, keep defaults
				}
			}

			if (targetIsDir) type = FileType.Directory;
			else if (targetIsFile) type = FileType.File;
			else type = FileType.Unknown;
			if (isSymlink) type = type | FileType.SymbolicLink;

			return { type: type as IVscode.FileType, ctime, mtime, size } as IVscode.FileStat;
		} catch (err: unknown) {
			// Narrow `err` to a NodeJS error with a code property
			if (err instanceof Error) {
				const nodeErr = err as NodeJS.ErrnoException;

				if (nodeErr.code === 'ENOENT') {
					nodeErr.name = 'FileNotFound';
					nodeErr.code = 'FileNotFound';
					throw nodeErr;
				}
			}

			throw err; // rethrow unmodified
		}
	}) as typeof IVscode.workspace.fs.stat,
	readDirectory: (async (uri: IVscode.Uri) => {
		debug(`Reading directory: ${uri.fsPath}`);
		const entries: [string, IVscode.FileType][] = [];
		const dirents = await fs.readdir(uri.fsPath, { withFileTypes: true });
		for (const dirent of dirents) {
			const name = dirent.name;
			const fullPath = path.join(uri.fsPath, name);
			let type: number = FileType.Unknown;
			let isSymlink = dirent.isSymbolicLink();
			let isDir = dirent.isDirectory();
			let isFile = dirent.isFile();
			if (!isDir && !isFile) {
				// For special files or when using withFileTypes=false fall back to lstat
				try {
					const lst = await fs.lstat(fullPath);
					isSymlink = lst.isSymbolicLink();
					isDir = lst.isDirectory();
					isFile = lst.isFile();
				} catch {
					// ignore; keep Unknown
				}
			}
			if (isSymlink) {
				// Try to identify target type
				try {
					const st = await fs.stat(fullPath);
					isDir = st.isDirectory();
					isFile = st.isFile();
				} catch {
					// broken link, keep unknown with symlink flag
				}
			}
			if (isDir) type = FileType.Directory;
			else if (isFile) type = FileType.File;
			else type = FileType.Unknown;
			if (isSymlink) type = type | FileType.SymbolicLink;
			entries.push([name, type as IVscode.FileType]);
		}
		return entries;
	}) as typeof IVscode.workspace.fs.readDirectory,
	createDirectory: (async (uri: IVscode.Uri) => {
		debug(`Creating directory (recursive): ${uri.fsPath}`);
		await fs.mkdir(uri.fsPath, { recursive: true });
	}) as typeof IVscode.workspace.fs.createDirectory,
	delete: (async (
		uri: IVscode.Uri,
		options?: { recursive: boolean; useTrash?: boolean | undefined },
	) => {
		debug(
			`Deleting path: ${uri.fsPath} (recursive=${options?.recursive ?? false}, useTrash=${options?.useTrash ?? false})`,
		);
		// useTrash is not supported in CLI implementation; delete permanently
		let stat: Stats | undefined;
		stat = await fs.lstat(uri.fsPath);
		if (stat.isDirectory() && !stat.isSymbolicLink()) {
			if (options?.recursive) {
				// rm with recursive for Node >=14.14
				await fs.rm(uri.fsPath, { recursive: true, force: false });
			} else {
				await fs.rmdir(uri.fsPath);
			}
		} else {
			await fs.unlink(uri.fsPath);
		}
	}) as typeof IVscode.workspace.fs.delete,
};
