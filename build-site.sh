#!/bin/sh
set -e
export VITE_HYDRUI_VERSION=$(cat VERSION)
rm -rf dist && mkdir -p dist
npm run build --workspace web/hydrui-site
npm run build:subdir --workspace web/hydrui-client
cp -R web/hydrui-site/dist .
cp -R web/hydrui-client/dist ./dist/client
echo "/ /en/ 302" > dist/_redirects
