#/bin/sh
set -e
cat header prefix.server.js peacock.core.js > peacock.server.js
cat header prefix.browser.js peacock.core.js > peacock.browser.js
