#!/usr/bin/env bash

## Get the directory of the script
SCRIPTDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node --require ts-node/register ${SCRIPTDIR}/index.ts
