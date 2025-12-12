#!/bin/sh

echo "This script will make changes to package.json and node_modules. They will not be commited. You are expected to revert them after publish."
read -p "You must bump your version before publish. Have you done so? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
	[[ "$0" = "$BASH_SOURCE" ]] && exit 1 || return 1
fi


echo "==== Removing private packages ===="

npm uninstall @integromat/iml @integromat/udt

npm install

echo "==== Publishing to npmjs.org ===="

npm publish --access=restricted

