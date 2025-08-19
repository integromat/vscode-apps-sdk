#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$SCRIPT_DIR/index.ts" ] && [ ! -f "$SCRIPT_DIR/index.js" ]; then
	echo "Error: Neither expected index.ts nor index.js found in $SCRIPT_DIR"
	exit 1
fi

if [ ! -f "$SCRIPT_DIR/index.js" ]; then
	# Build TS to JS and run
	cd "$SCRIPT_DIR"
	pushd ..
	npm run compile
	popd

	node "$SCRIPT_DIR/../out/cli/index.js" "$@"
else
	# Already builded in JS. Run.
	node "$SCRIPT_DIR/index.js" "$@"
fi

