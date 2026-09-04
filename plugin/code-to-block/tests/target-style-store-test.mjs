import assert from 'node:assert/strict';

import { createElementBlock } from '../src/elements/registry.mjs';
import { redoDocument, undoDocument } from '../src/history.mjs';
import {
	updateBlockStyleSet,
	updateBlockTargetStyleSet,
} from '../src/store/block-commands.mjs';
import {
	contextKeyForBreakpoint,
	effectiveTargetMappedStyles,
	effectiveTargetTokenBindings,
	inheritedTargetMappedStyles,
	readTargetStyleSet,
	targetContextIsAllowed,
} from '../src/styles/editor-bridge.mjs';
import {
	compileBlockStyles,
	compileDocumentStyles,
	stableElementClass,
} from '../src/styles/compiler.mjs';
import { useEditorStore } from '../src/store/editor-store.mjs';

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

const button = createElementBlock( 'button', 'target-store' );
button.styles.mapped.color = '#111111';
button.styles.import_review_flags = {
	color: { reason: 'Imported declaration' },
};
button.style = {
	targets: {
		root: {
			contexts: {
				base: { declarations: { color: '#111111' } },
			},
		},
	},
};
const document = {
	schema_version: 3,
	registry_version: 1,
	name: 'Target style commands',
	root: button,
};
const state = {
	document,
	past: [],
	future: [ { stale: true } ],
	selectedBlockId: button.id,
};

check(
	contextKeyForBreakpoint( 'tablet' ) === 'bp:tablet',
	'breakpoint contexts use schema-v3 keys'
);
check(
	targetContextIsAllowed( button, 'label', 'bp:tablet|state:hover' ),
	'registered Button target and state are writable'
);
check(
	! targetContextIsAllowed( button, 'media', 'base' ),
	'unregistered targets are rejected'
);
check(
	! targetContextIsAllowed( button, 'label', 'state:visited' ),
	'states outside the element manifest are rejected'
);

const labelResult = updateBlockTargetStyleSet(
	state,
	button.id,
	'label',
	'bp:tablet|state:hover',
	( styleSet ) => ( {
		...styleSet,
		mapped: { ...styleSet.mapped, color: '#224466' },
		custom_css_fallback: 'letter-spacing: .1em;',
	} )
);
const labelBlock = labelResult.document.root;
check( labelResult !== state, 'a target style edit commits a new state' );
check( labelResult.past[ 0 ] === document, 'target edits enter undo history' );
assert.deepEqual( labelResult.future, [] );
assertions += 1;
check(
	labelBlock.style.targets.label.contexts[ 'bp:tablet|state:hover' ]
		.declarations.color === '#224466',
	'target declarations persist at the exact v3 path'
);
check(
	labelBlock.style.targets.label.contexts[ 'bp:tablet|state:hover' ]
		.custom_declarations === 'letter-spacing: .1em;',
	'target custom declarations persist at the exact v3 path'
);
check(
	labelBlock.styles.mapped.color === '#111111',
	'non-root target edits never leak into legacy root styles'
);
check(
	! state.document.root.style.targets.label,
	'target commands do not mutate the source document'
);
check(
	labelResult.document.history.at( -1 ).action === 'Style updated',
	'target edits are classified as style history'
);

const compiled = compileDocumentStyles( labelResult.document, 41 );
const labelDebug = compiled.debug.find(
	( entry ) =>
		entry.blockId === button.id &&
		entry.targetId === 'label' &&
		entry.contextKey === 'bp:tablet|state:hover'
);
check( Boolean( labelDebug ), 'compiler reports the target/context rule' );
check(
	labelDebug.selector.includes( '[data-ctb-part="label"]:hover' ),
	'compiler addresses the Button label marker'
);
check(
	compiled.css.includes( '@media(max-width:768px)' ) &&
		compiled.css.includes( 'color:#224466;' ) &&
		compiled.css.includes( 'letter-spacing: .1em;' ),
	'compiler emits target breakpoint, mapped, and custom declarations'
);

const serialized = JSON.parse( JSON.stringify( labelResult.document ) );
assert.deepEqual(
	serialized.root.style.targets.label,
	labelBlock.style.targets.label,
	'target contexts survive JSON serialization'
);
assertions += 1;

const undone = { ...labelResult, ...undoDocument( labelResult ) };
check(
	! undone.document.root.style.targets.label,
	'undo restores the document before the target edit'
);
const redone = { ...undone, ...redoDocument( undone ) };
check(
	redone.document.root.style.targets.label.contexts[ 'bp:tablet|state:hover' ]
		.declarations.color === '#224466',
	'redo restores the exact target context'
);

const rootResult = updateBlockStyleSet(
	state,
	button.id,
	'desktop',
	( styleSet ) => ( {
		...styleSet,
		mapped: { ...styleSet.mapped, color: '#336699' },
	} )
);
check(
	rootResult.document.root.style.targets.root.contexts.base.declarations
		.color === '#336699',
	'existing root edits now write schema-v3 base declarations'
);
check(
	rootResult.document.root.styles.mapped.color === '#336699',
	'root/base edits retain legacy styles.mapped compatibility'
);
assert.deepEqual(
	rootResult.document.root.styles.import_review_flags,
	button.styles.import_review_flags,
	'root/base edits preserve legacy import review metadata'
);
assertions += 1;

const legacyFallbackBlock = JSON.parse( JSON.stringify( button ) );
delete legacyFallbackBlock.style.targets.root;
legacyFallbackBlock.styles.mapped.color = '#778899';
check(
	readTargetStyleSet( legacyFallbackBlock, 'root', 'base' ).mapped.color ===
		'#778899',
	'missing root contexts read from the legacy compatibility path'
);
legacyFallbackBlock.style.targets.root = {
	contexts: { base: { declarations: { color: '#112233' } } },
};
check(
	readTargetStyleSet( legacyFallbackBlock, 'root', 'base' ).mapped.color ===
		'#112233',
	'v3 root contexts remain authoritative over stale legacy values'
);

const tabletResult = updateBlockStyleSet(
	rootResult,
	button.id,
	'tablet',
	( styleSet ) => ( {
		...styleSet,
		mapped: { ...styleSet.mapped, padding: '12px' },
	} )
);
check(
	tabletResult.document.root.style.targets.root.contexts[ 'bp:tablet' ]
		.declarations.padding === '12px',
	'existing responsive edits write schema-v3 breakpoint contexts'
);
check(
	tabletResult.document.root.responsive_overrides.tablet.mapped.padding ===
		'12px',
	'root breakpoint edits retain legacy responsive compatibility'
);

const clearedRoot = updateBlockTargetStyleSet(
	rootResult,
	button.id,
	'root',
	'base',
	( styleSet ) => ( {
		...styleSet,
		mapped: {},
		custom_css_fallback: '',
	} )
);
check(
	! clearedRoot.document.root.style.targets.root &&
		Object.keys( clearedRoot.document.root.styles.mapped ).length === 0,
	'clearing root/base prunes v3 declarations and keeps valid legacy styles'
);
assert.deepEqual(
	clearedRoot.document.root.styles.import_review_flags,
	button.styles.import_review_flags,
	'clearing root/base preserves legacy import review metadata'
);
assertions += 1;

const hoverResult = updateBlockTargetStyleSet(
	rootResult,
	button.id,
	'root',
	'state:hover',
	( styleSet ) => ( { ...styleSet, mapped: { opacity: '0.8' } } )
);
check(
	hoverResult.document.root.states.hover.mapped.opacity === '0.8',
	'root state edits retain legacy state compatibility'
);

const canonicalResult = updateBlockTargetStyleSet(
	state,
	button.id,
	'label',
	'state:hover|bp:tablet',
	( styleSet ) => ( { ...styleSet, mapped: { color: '#445566' } } )
);
check(
	canonicalResult.document.root.style.targets.label.contexts[
		'bp:tablet|state:hover'
	].declarations.color === '#445566' &&
		! canonicalResult.document.root.style.targets.label.contexts[
			'state:hover|bp:tablet'
		],
	'parseable context aliases are persisted under the canonical key'
);

const metadataState = JSON.parse( JSON.stringify( state ) );
metadataState.document.root.style.targets.label = {
	contexts: {
		base: {
			declarations: { color: '#111111' },
			origin_notes: { source: 'import', declarations: [ 'color' ] },
		},
	},
};
const metadataResult = updateBlockTargetStyleSet(
	metadataState,
	button.id,
	'label',
	'base',
	( styleSet ) => ( {
		...styleSet,
		mapped: { ...styleSet.mapped, color: '#abcdef' },
	} )
);
assert.deepEqual(
	metadataResult.document.root.style.targets.label.contexts.base.origin_notes,
	metadataState.document.root.style.targets.label.contexts.base.origin_notes,
	'editing declarations preserves supported context origin metadata'
);
assertions += 1;

const cleared = updateBlockTargetStyleSet(
	labelResult,
	button.id,
	'label',
	'bp:tablet|state:hover',
	( styleSet ) => ( {
		...styleSet,
		mapped: {},
		custom_css_fallback: '',
	} )
);
check(
	! cleared.document.root.style.targets.label,
	'empty target contexts and target branches are pruned'
);
assert.deepEqual(
	readTargetStyleSet( labelBlock, 'label', 'bp:tablet|state:hover' ),
	{
		mapped: { color: '#224466' },
		custom_css_fallback: 'letter-spacing: .1em;',
	}
);
assertions += 1;

for ( const invalid of [
	[ 'media', 'base' ],
	[ 'label', 'bp:watch' ],
	[ 'label', 'state:visited' ],
] ) {
	check(
		updateBlockTargetStyleSet(
			state,
			button.id,
			invalid[ 0 ],
			invalid[ 1 ],
			( styleSet ) => styleSet
		) === state,
		'invalid target/context writes are no-ops'
	);
}
const lockedState = {
	...state,
	document: {
		...document,
		root: { ...button, permissions: { locked: true } },
	},
};
check(
	updateBlockTargetStyleSet(
		lockedState,
		button.id,
		'label',
		'base',
		( styleSet ) => ( { ...styleSet, mapped: { color: 'red' } } )
	) === lockedState,
	'locked blocks reject target edits'
);
const legacyState = {
	...state,
	document: { ...document, schema_version: 2 },
};
check(
	updateBlockTargetStyleSet(
		legacyState,
		button.id,
		'label',
		'base',
		( styleSet ) => styleSet
	) === legacyState,
	'non-v3 documents do not receive target branches'
);
check(
	compiled.css.includes( '.' + stableElementClass( button.id ) ),
	'target CSS retains stable element identity'
);

const cascadeBlock = JSON.parse( JSON.stringify( labelBlock ) );
cascadeBlock.style.targets.label.contexts.base = {
	declarations: { 'font-size': '16px' },
	token_bindings: { 'font-size': 'typography.body' },
};
cascadeBlock.style.targets.label.contexts[ 'bp:tablet' ] = {
	declarations: { 'font-weight': '600' },
};
assert.deepEqual(
	inheritedTargetMappedStyles(
		cascadeBlock,
		'label',
		'bp:tablet|state:hover'
	),
	{ 'font-size': '16px', 'font-weight': '600' },
	'target inheritance includes prior breakpoint layers but not the owned context'
);
assertions += 1;
assert.deepEqual(
	effectiveTargetMappedStyles(
		cascadeBlock,
		'label',
		'bp:tablet|state:hover'
	),
	{
		'font-size': '16px',
		'font-weight': '600',
		color: '#224466',
	},
	'target effective values merge the full breakpoint/state cascade'
);
assertions += 1;
assert.deepEqual(
	effectiveTargetTokenBindings(
		cascadeBlock,
		'label',
		'bp:tablet|state:hover'
	),
	{ 'font-size': 'typography.body' },
	'target token bindings inherit through the same context cascade'
);
assertions += 1;

const previewCompiled = compileBlockStyles( labelBlock, 0, {
	rootSelector: '.ctb-canvas-stage',
} );
check(
	previewCompiled.css.includes(
		`.ctb-canvas-stage .${ stableElementClass(
			button.id
		) } > [data-ctb-part="label"]:hover`
	),
	'canvas compilation scopes target selectors to the isolated editor stage'
);

const fieldBlock = createElementBlock( 'form-field', 'placeholder-state' );
fieldBlock.props = {
	fieldType: 'email',
	label: 'Email',
	name: 'email',
	placeholder: 'you@example.com',
};
fieldBlock.style = {
	targets: {
		placeholder: {
			contexts: {
				'state:focusVisible': {
					declarations: { color: '#445566' },
				},
			},
		},
	},
};
const fieldCss = compileBlockStyles( fieldBlock, 41 ).css;
check(
	fieldCss.includes(
		'[data-ctb-part="control"]:focus-visible::placeholder{color:#445566;}'
	),
	'placeholder state selectors are inserted before the pseudo-element'
);
check(
	! fieldCss.includes( '::placeholder:focus-visible' ),
	'compiler never appends a state after a placeholder pseudo-element'
);

const loadingBlock = JSON.parse( JSON.stringify( button ) );
loadingBlock.style.targets.spinner = {
	contexts: {
		'state:loading': { declarations: { opacity: '0.8' } },
	},
};
const loadingCss = compileBlockStyles( loadingBlock, 41 ).css;
const loadingRoot = `:where(#ctb-page-41) .${ stableElementClass(
	button.id
) }`;
check(
	loadingCss.includes(
		`${ loadingRoot }[aria-busy="true"] > [data-ctb-part="spinner"]`
	) &&
		loadingCss.includes(
			`${ loadingRoot }[data-ctb-loading="true"] > [data-ctb-part="spinner"]`
		),
	'child targets respond to loading state carried by the element root'
);

const tokenDocument = JSON.parse( JSON.stringify( document ) );
tokenDocument.design_tokens = {
	colors: { brand: { label: 'Brand', value: '#663399' } },
};
useEditorStore.setState( {
	document: tokenDocument,
	past: [],
	future: [],
	selectedBlockId: button.id,
} );
useEditorStore
	.getState()
	.updateBlockTargetCustomCss(
		button.id,
		'letter-spacing: .05em;',
		'label',
		'base'
	);
check(
	useEditorStore.getState().document.root.style.targets.label.contexts.base
		.custom_declarations === 'letter-spacing: .05em;',
	'target custom CSS uses the same persisted context and history command'
);
useEditorStore
	.getState()
	.setBlockTargetTokenBinding(
		button.id,
		'color',
		'colors.brand',
		'label',
		'base'
	);
let tokenContext =
	useEditorStore.getState().document.root.style.targets.label.contexts.base;
check(
	tokenContext.declarations.color === 'var(--ctb-token-colors-brand)' &&
		tokenContext.token_bindings.color === 'colors.brand',
	'target token linking persists both the CSS reference and binding metadata'
);
useEditorStore
	.getState()
	.removeBlockTargetTokenBinding(
		button.id,
		'color',
		'colors.brand',
		'label',
		'base'
	);
tokenContext =
	useEditorStore.getState().document.root.style.targets.label.contexts.base;
check(
	tokenContext.declarations.color === '#663399' &&
		! tokenContext.token_bindings,
	'target token unlinking preserves the resolved value and removes metadata'
);

const canonicalOnlyBlock = createElementBlock(
	'container',
	'canonical-visibility'
);
delete canonicalOnlyBlock.styles;
canonicalOnlyBlock.style = {
	targets: {
		root: {
			contexts: {
				base: { declarations: { display: 'flex' } },
			},
		},
	},
};
useEditorStore.setState( {
	document: {
		schema_version: 3,
		registry_version: 1,
		name: 'Canonical visibility',
		root: canonicalOnlyBlock,
	},
	past: [],
	future: [],
	selectedBlockId: canonicalOnlyBlock.id,
} );
useEditorStore
	.getState()
	.setBlockHidden( canonicalOnlyBlock.id, 'desktop', true );
let visibilityContext =
	useEditorStore.getState().document.root.style.targets.root.contexts.base;
check(
	visibilityContext.custom_declarations === 'display: none !important;',
	'canonical v3 visibility writes do not require a legacy styles mirror'
);
useEditorStore
	.getState()
	.setBlockHidden( canonicalOnlyBlock.id, 'desktop', false );
visibilityContext =
	useEditorStore.getState().document.root.style.targets.root.contexts.base;
check(
	visibilityContext.custom_declarations === 'display: flex !important;',
	'canonical v3 visibility restores the effective root display value'
);

// eslint-disable-next-line no-console
console.log( 'PASS: ' + assertions + ' target style store assertions.' );
