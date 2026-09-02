import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
	applyImportedPageRoot,
	CANVAS_BRIDGE_MESSAGE_TYPES,
	createEditorCanvasDocument,
	EDITOR_CANVAS_BASE_CSS,
	EDITOR_CANVAS_CSP,
	EDITOR_CANVAS_SANDBOX,
	isCanvasBridgeMessage,
} from '../src/canvas-isolation.mjs';

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

const documentSource = createEditorCanvasDocument();
const canvasComponentSource = readFileSync(
	new URL( '../src/components/CenterCanvas.js', import.meta.url ),
	'utf8'
);
check(
	/^<!doctype html>/i.test( documentSource ),
	'The canvas must be a complete document.'
);
check(
	documentSource.includes( 'id="ctb-canvas-root"' ),
	'The frame must expose one controlled mount point.'
);
check(
	documentSource.includes( 'class="ctb-canvas-stage"' ),
	'Generated preview selectors need the canvas-stage scope.'
);
check(
	EDITOR_CANVAS_SANDBOX.includes( 'allow-same-origin' ),
	'The parent needs same-origin DOM access for the React portal.'
);
check(
	! EDITOR_CANVAS_SANDBOX.includes( 'allow-scripts' ),
	'Editor mode must never grant script execution.'
);
check(
	/<iframe[\s\S]*sandbox=\{ EDITOR_CANVAS_SANDBOX \}[\s\S]*srcDoc=\{ EDITOR_CANVAS_DOCUMENT \}/.test(
		canvasComponentSource
	),
	'The canvas component must mount imported layout inside the sandboxed document.'
);
check(
	! /attachShadow|ShadowRoot|ShadowWrapper/.test( canvasComponentSource ),
	'Shadow DOM must not replace the iframe because it cannot contain viewport-relative layout.'
);
check(
	EDITOR_CANVAS_CSP.includes( "script-src 'none'" ),
	'The frame CSP must block scripts independently of parsing.'
);
check(
	EDITOR_CANVAS_CSP.includes( "form-action 'none'" ),
	'Imported forms must not submit from editor mode.'
);
check(
	EDITOR_CANVAS_CSP.includes( "connect-src 'none'" ),
	'Editor content must not make script-driven connections.'
);
check(
	! /\.ctb-rendered-block\s*\{[^}]*position\s*:/s.test(
		EDITOR_CANVAS_BASE_CSS
	),
	'Editor chrome must not change imported positioning.'
);
check(
	! /\.ctb-rendered-block\s*\{[^}]*margin\s*:/s.test(
		EDITOR_CANVAS_BASE_CSS
	),
	'Editor chrome must not change imported spacing.'
);
check(
	! /\.ctb-canvas-document\s*>\s*\.ctb-rendered-block\s*\{/s.test(
		EDITOR_CANVAS_BASE_CSS
	),
	'Editor chrome must not override imported root sizing.'
);
for ( const intent of [ 'before', 'inside', 'after', 'invalid' ] ) {
	check(
		EDITOR_CANVAS_BASE_CSS.includes( `.is-drop-${ intent }` ),
		`The isolated canvas must style the ${ intent } drop state.`
	);
}

function fakeElement() {
	const attributes = new Map();
	return {
		attributes,
		getAttribute: ( name ) => attributes.get( name ) || null,
		setAttribute: ( name, value ) => attributes.set( name, value ),
		removeAttribute: ( name ) => attributes.delete( name ),
	};
}
const documentElement = fakeElement();
const body = fakeElement();
applyImportedPageRoot(
	{ documentElement, body },
	{
		html_attributes: { lang: 'fr', class: 'theme-dark', onclick: 'bad()' },
		body_attributes: { id: 'page', 'data-theme': 'dark' },
	}
);
check(
	documentElement.attributes.get( 'lang' ) === 'fr',
	'html lang is applied'
);
check(
	documentElement.attributes.get( 'class' ) === 'theme-dark',
	'imported html class stays inside the frame'
);
check(
	! documentElement.attributes.has( 'onclick' ),
	'root events are rejected'
);
check( body.attributes.get( 'id' ) === 'page', 'body identity is applied' );
check( body.attributes.get( 'data-theme' ) === 'dark', 'body data is applied' );
check(
	CANVAS_BRIDGE_MESSAGE_TYPES.includes( 'NODE_SELECTED' ),
	'bridge exposes selection messages'
);
check(
	isCanvasBridgeMessage( {
		channel: 'code-to-block-canvas',
		type: 'CANVAS_READY',
		payload: {},
	} ),
	'valid canvas messages pass strict validation'
);
check(
	! isCanvasBridgeMessage( {
		channel: 'attacker',
		type: 'CANVAS_READY',
		payload: {},
	} ),
	'foreign channels are rejected'
);

console.log( `PASS: ${ assertions } isolated canvas assertions.` );
