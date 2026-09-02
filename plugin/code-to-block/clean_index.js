const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('src/index.js', 'utf8');
const lines = code.split('\n');

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

const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
const rangesToRemove = [];

traverse(ast, {
	FunctionDeclaration(path) {
		const name = path.node.id?.name;
		for (const [file, comps] of Object.entries(groups)) {
			if (comps.includes(name)) {
				rangesToRemove.push({ start: path.node.loc.start.line, end: path.node.loc.end.line });
			}
		}
	},
	VariableDeclaration(path) {
		const name = path.node.declarations[0].id.name;
		if (name === 'importCodeService') {
			rangesToRemove.push({ start: path.node.loc.start.line, end: path.node.loc.end.line });
		}
	}
});

rangesToRemove.sort((a, b) => b.start - a.start);

let newLines = [...lines];
for (const range of rangesToRemove) {
	newLines.splice(range.start - 1, range.end - range.start + 1);
}

let newImports = '';
for (const [file, comps] of Object.entries(groups)) {
    if (file === '../utils/editor-utils.js') continue;
	newImports += "import { " + comps.join(', ') + " } from './components/" + file + "';\n";
}

const lastImportIdx = newLines.findLastIndex(line => line.startsWith('import '));
newLines.splice(lastImportIdx + 1, 0, '\n' + newImports);

fs.writeFileSync('src/index.js', newLines.join('\n'));
console.log('Cleaned index.js');
