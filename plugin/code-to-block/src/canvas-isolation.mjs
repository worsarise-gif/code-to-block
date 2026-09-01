export const EDITOR_CANVAS_SANDBOX = 'allow-same-origin';

export const EDITOR_CANVAS_CSP = [
	"default-src 'none'",
	"script-src 'none'",
	"connect-src 'none'",
	"object-src 'none'",
	"base-uri 'none'",
	"form-action 'none'",
	"img-src 'self' data: blob: http: https:",
	"media-src 'self' data: blob: http: https:",
	"font-src 'self' data: http: https:",
	"style-src 'unsafe-inline' http: https:",
	'frame-src http: https:',
].join( '; ' );

export const EDITOR_CANVAS_BASE_CSS = `
:root {
	color-scheme: light;
	background: #fff;
}
html,
body {
	box-sizing: border-box;
	margin: 0;
	min-height: 100%;
	width: 100%;
}
body {
	background: #fff;
	overflow: auto;
}
#ctb-canvas-root,
.ctb-canvas-document {
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	min-width: 0;
	width: 100%;
}
#ctb-canvas-root {
	isolation: isolate;
}
.ctb-rendered-block {
	box-sizing: border-box;
}
.ctb-rendered-block.is-draggable {
	cursor: grab;
}
.ctb-rendered-block.is-draggable:active {
	cursor: grabbing;
}
.ctb-rendered-block:hover {
	outline: 1px dashed rgba(79, 70, 229, 0.45);
	outline-offset: -1px;
}
.ctb-rendered-block.is-selected {
	outline: 2px solid #4f46e5;
	outline-offset: -2px;
}
.ctb-rendered-block.is-dragging {
	opacity: 0.32;
}
.ctb-rendered-block.is-drop-target {
	box-shadow: inset 0 0 0 3px #4f46e5;
}
.ctb-rendered-block.is-drop-before {
	box-shadow: inset 0 4px 0 #4f46e5;
}
.ctb-rendered-block.is-drop-inside {
	box-shadow: inset 0 0 0 4px #4f46e5;
}
.ctb-rendered-block.is-drop-after {
	box-shadow: inset 0 -4px 0 #4f46e5;
}
.ctb-rendered-block.is-drop-invalid {
	box-shadow: inset 0 0 0 4px #dc2626;
	cursor: not-allowed;
}
.ctb-canvas-drag-handle {
	appearance: none;
	background: transparent;
	border: 0;
	margin: 0;
	padding: 0;
}
.ctb-canvas-drag-handle:focus-visible {
	outline: 2px solid #4f46e5;
	outline-offset: 1px;
}
`;

function escapeStyleText( value ) {
	return String( value ).replace( /<\/style/gi, '<\\/style' );
}

/**
 * Creates the inert document used by the editable canvas. Imported JavaScript
 * is never inserted into this document, and the sandbox omits allow-scripts.
 */
export function createEditorCanvasDocument() {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta http-equiv="Content-Security-Policy" content="${ EDITOR_CANVAS_CSP }">
	<title>Builder canvas</title>
	<style>${ escapeStyleText( EDITOR_CANVAS_BASE_CSS ) }</style>
</head>
<body>
	<div id="ctb-canvas-root" class="ctb-canvas-stage"></div>
</body>
</html>`;
}
