#!/usr/bin/env bash

printf '%*s' "${COLUMNS:-$(tput cols)}" '' | tr ' ' -

if ! [ -x "$(command -v node)" ]; then
  printf "Error: node.js is not installed."
  printf "To install Node.js 14.x from the command line."
  printf "curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -"
  printf "sudo apt install nodejs"
  exit 1
fi

if ! [ -x "$(command -v npm)" ]; then
  printf "Error: npm is not installed."
  exit 1
fi

printf "NODE VERSION:  "
node -v
printf "NPM VERSION:  "
npm -v

if [ ! -x "$(command -v semver)" ]
then
  npm i -g semver
fi

min_version="$(node -pe "require('./package.json')['engines'].node")"
node_version=$(node -v)
check_version=$(semver $node_version -r $min_version)
if [ -x $check_version ]
then
  printf "Error: node.js min version $min_version."
  printf "To install Node.js 14.x from the command line."
  printf "curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -"
  printf "sudo apt install nodejs"
  exit 1
fi

if [ ! -d node_modules/ ]
then
  npm install
fi
if [ ! -d dist/ ]
then
  npm run build
fi

printf '%*s' "${COLUMNS:-$(tput cols)}" '' | tr ' ' -

node dist/index.js
