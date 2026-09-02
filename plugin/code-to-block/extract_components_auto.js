const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const groups = {
	'canvas/CanvasComponents.js': ['SkeletonLoader', 'Block', 'CanvasDragHandles', 'BlockContent'],
	'panels/DiagnosticsPanels.js': ['AccessibilityPanel', 'DiagnosticsPanel', 'ParityWarningsPanel'],
	'panels/CodeDetectionsPanel.js': ['ScriptDetections', 'PhpDetection', 'PhpDetections'],
	'panels/ExplainPanel.js': ['ExplainPanel'],
	'panels/WooCommercePanel.js': ['WooCommercePanel'],
	'panels/FormsPanel.js': ['FormsPanel'],
	'panels/WidgetLibraryPanel.js': ['WidgetLibraryPanel'],
	'panels/SeoPanel.js': ['SeoPanel'],
	'panels/DesignTokenPanel.js': ['DesignTokenRow', 'DesignTokenPanel'],
	'controls/StyleControls.js': ['BlockVisibilityControl', 'BreakpointSwitcher', 'ResponsiveColorOverride', 'MappedStyleControls', 'RawCssControl'],
	'controls/BlockControls.js': ['BlockDynamicControl', 'BlockSlotControl', 'BlockAnimationControl', 'BlockActions'],
	'controls/TokenControls.js': ['TokenBindingControl'],
	'controls/ScrubbableInput.js': ['ScrubbableInput'],
	'ContextMenu.js': ['ContextMenu'],
	'Editor.js': ['Editor'],
	'../utils/editor-utils.js': [
		'resolveDocumentDropIntent', 'dragEventPoint', 'toReactStyles', 'normalizeResourceUrl', 'normalizeCssUrls',
		'previewDeclarations', 'buildPreviewStyles', 'buildEditorStyleSnapshot', 'collisionStrategy',
		'cursorOffsetModifier', 'colorPickerValue', 'breakpointStyleSummary', 'tokenValueIsValid',
		'loadEditorGsap', 'documentHasGsapAnimation', 'defaultGsapAction'
	]
};

const code = fs.readFileSync('src/index.js', 'utf8');
const lines = code.split('\n');
const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });

const compRanges = {};
traverse(ast, {
	FunctionDeclaration(path) {
		const name = path.node.id?.name;
		if (name) compRanges[name] = { start: path.node.loc.start.line, end: path.node.loc.end.line };
	}
});

const importNodes = ast.program.body.filter(node => node.type === 'ImportDeclaration');
const endOfImports = importNodes[importNodes.length - 1].loc.end.line;
const originalImportsCode = lines.slice(0, endOfImports).join('\n');

for (const [filename, components] of Object.entries(groups)) {
	let compCode = '';
	for (const comp of components) {
		const range = compRanges[comp];
		if (!range) continue;
		const compLines = lines.slice(range.start - 1, range.end);
		compLines[0] = compLines[0].replace('function ' + comp, 'export function ' + comp);
		compCode += compLines.join('\n') + '\n\n';
	}

	let localImportsCode = originalImportsCode;
	let depth = filename.includes('/') && !filename.startsWith('../') ? 2 : 1;
	
	if (filename === '../utils/editor-utils.js') {
		localImportsCode = originalImportsCode.split("'./").join("'../");
	} else if (depth === 1) {
		localImportsCode = originalImportsCode.split("'./").join("'../");
	} else {
		localImportsCode = originalImportsCode.split("'./").join("'../../");
	}

	// Generate cross-imports block
	let crossImportsCode = '';
	for (const [otherFile, otherComps] of Object.entries(groups)) {
		if (otherFile === filename) continue;
		
		let relativePath = '';
		if (filename === '../utils/editor-utils.js') {
			if (otherFile.startsWith('../')) relativePath = './' + otherFile.substring(3);
			else relativePath = '../components/' + otherFile;
		} else if (depth === 1) {
			if (otherFile.startsWith('../')) relativePath = '.' + otherFile;
			else relativePath = './' + otherFile;
		} else {
			if (otherFile.startsWith('../')) relativePath = '../.' + otherFile;
			else relativePath = '../' + otherFile;
		}
		
		crossImportsCode += "import { " + otherComps.join(', ') + " } from '" + relativePath + "';\n";
	}

	const tempCode = localImportsCode + '\n' + crossImportsCode + '\n' + compCode;
	const tempAst = parser.parse(tempCode, { sourceType: 'module', plugins: ['jsx'] });

	const usedIdentifiers = new Set();
	traverse(tempAst, {
		Identifier(path) { if (path.isReferencedIdentifier()) usedIdentifiers.add(path.node.name); },
		JSXIdentifier(path) { usedIdentifiers.add(path.node.name); }
	});

	const filteredImportsAst = { type: 'Program', body: [], directives: [] };
	for (const node of tempAst.program.body) {
		if (node.type === 'ImportDeclaration') {
			node.specifiers = node.specifiers.filter(spec => usedIdentifiers.has(spec.local.name));
			if (node.specifiers.length > 0 || node.source.value.endsWith('.css')) {
				filteredImportsAst.body.push(node);
			}
		}
	}

	const finalImports = generate(filteredImportsAst).code;
	
	const fullPath = "src/components/" + filename;
	if (filename.startsWith('../')) {
		fs.mkdirSync('src/utils', { recursive: true });
		fs.writeFileSync('src/utils/' + filename.substring(9), finalImports + '\n\n' + compCode);
	} else {
		const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(fullPath, finalImports + '\n\n' + compCode);
	}
	console.log("Created " + filename);
}
