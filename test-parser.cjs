const fs = require('fs');
const { JSDOM } = require('./plugin/code-to-block/node_modules/jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.window.CSSStyleDeclaration.prototype[Symbol.iterator] = function* () {
  for (let index = 0; index < this.length; index++) {
    yield this.item(index);
  }
};

const { parseBlockDocument } = require('./plugin/code-to-block/src/parser.js');
const { buildPreviewStyles } = require('./plugin/code-to-block/src/utils/editor-utils.js');
const { normalizeImportedStyles } = require('./plugin/code-to-block/src/semantic-roles.mjs');

const html = fs.readFileSync('./test-input.html', 'utf8');
try {
  const result = parseBlockDocument(html, '');
  const normalized = normalizeImportedStyles(result.document, {});
  console.log('Normalized imported_assets.stylesheets count:', normalized.document.imported_assets?.stylesheets?.length);
  const preview = buildPreviewStyles(normalized.document, 'desktop');
  console.log('Normalized previewStyles length:', preview.css.length);
  console.log('Indexes mapped count:', Object.keys(preview.indexes).length);
} catch (err) {
  console.error('Error during import:', err.message, err.stack);
}
