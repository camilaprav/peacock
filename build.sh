#/bin/sh
set -e
cat prefix.server.js peacock.core.js > peacock.server.js
cat prefix.browser.js peacock.core.js > peacock.browser.js
