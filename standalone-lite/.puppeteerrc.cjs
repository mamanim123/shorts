const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(process.env.USERPROFILE, '.cache', 'puppeteer'),
  defaultBrowser: 'chrome',
};
