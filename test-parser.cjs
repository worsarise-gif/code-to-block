const fs = require('fs');
const { parseBlockDocument } = require('./plugin/code-to-block/src/parser.js');

const html = fs.readFileSync('./test-input.html', 'utf8');
try {
  const result = parseBlockDocument(html, '');
  console.log('Document imported successfully.');
  console.log('Warnings:');
  console.log(JSON.stringify(result.warnings, null, 2));
  console.log('Errors:');
  console.log(JSON.stringify(result.errors || [], null, 2));
} catch (err) {
  console.error('Error during import:', err.message);
}
