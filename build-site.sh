#!/bin/sh
set -e
rm -rf dist && mkdir -p dist
npm run build --workspaces
cp -R web/hydrui-client/dist .
mkdir -p dist/client
mv dist/index.html dist/client
cp -R web/hydrui-site/dist .
echo "/ /en/ 302" > dist/_redirects
