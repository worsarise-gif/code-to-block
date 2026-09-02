const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('src/index.js', 'utf8');
const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });

const targetComponents = [
	// Canvas
	'Block', 'BlockContent', 'CanvasDragHandles', 'SkeletonLoader',
	// Panels
	'WooCommercePanel', 'FormsPanel', 'WidgetLibraryPanel', 'SeoPanel', 'AccessibilityPanel',
	'DiagnosticsPanel', 'ParityWarningsPanel', 'ScriptDetections', 'PhpDetection', 'PhpDetections', 'ExplainPanel',
	'DesignTokenPanel', 'DesignTokenRow',
	// Controls
	'BlockVisibilityControl', 'BreakpointSwitcher', 'ResponsiveColorOverride', 'MappedStyleControls', 'RawCssControl',
	'BlockDynamicControl', 'BlockSlotControl', 'BlockAnimationControl', 'BlockActions', 'TokenBindingControl',
	'ScrubbableInput',
	// Editor
	'ContextMenu', 'Editor'
];

const results = {};

traverse(ast, {
	FunctionDeclaration(path) {
		const name = path.node.id?.name;
		if (targetComponents.includes(name)) {
			results[name] = {
				start: path.node.loc.start.line,
				end: path.node.loc.end.line
			};
		}
	}
});

console.log(JSON.stringify(results, null, 2));
