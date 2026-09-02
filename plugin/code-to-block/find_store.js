const fs = require('fs');

const code = fs.readFileSync('src/index.js', 'utf8');

const exampleDocStart = code.indexOf('const EXAMPLE_DOCUMENT =');
const useEditorStoreStart = code.indexOf('const useEditorStore = create( ( set ) => ( {');

if (exampleDocStart === -1 || useEditorStoreStart === -1) {
    console.error("Could not find start signatures.");
    process.exit(1);
}

// Find line number of exampleDocStart
const startLine = code.substring(0, exampleDocStart).split('\n').length;

// Track braces from the start of the object inside useEditorStore
const objectStart = code.indexOf('{', useEditorStoreStart);
let braceCount = 0;
let endIndex = -1;

for (let i = objectStart; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    else if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            let nextSemi = code.indexOf(';', i);
            endIndex = nextSemi + 1;
            break;
        }
    }
}

const endLine = code.substring(0, endIndex).split('\n').length;
console.log(`${startLine},${endLine}`);
