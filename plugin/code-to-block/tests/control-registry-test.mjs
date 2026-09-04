import assert from 'node:assert/strict';

import { STYLE_CONTROLS, validateCatalog } from '../src/controls/catalog.mjs';
import { composeStyleControlGroups } from '../src/controls/composer.mjs';
import { CAPABILITY_DEFINITIONS } from '../src/elements/capabilities.mjs';
import {
	ELEMENT_DEFINITIONS,
	FIRST_CLASS_ELEMENT_COUNT,
	createElementBlock,
	getAllElements,
	getElement,
	getElementDefinition,
	getElementTargets,
	getManifest,
	hasCapability,
	inferElementDefinition,
	paletteGroups,
	registryManifest,
	validateElement,
	validateElementRegistry,
} from '../src/elements/registry.mjs';
import { panelSearch, resolveInspector } from '../src/elements/resolver.mjs';

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

assert.deepEqual( validateCatalog(), [] );
assertions += 1;
assert.deepEqual( validateElementRegistry(), [] );
assertions += 1;
check(
	FIRST_CLASS_ELEMENT_COUNT === 58,
	'registry must include all 58 first-class elements'
);
check(
	ELEMENT_DEFINITIONS.length === 59,
	'registry must include the limited legacy fallback'
);
check(
	paletteGroups().flatMap( ( group ) => group.items ).length === 58,
	'all first-class elements are discoverable in the palette'
);
check(
	Object.keys( registryManifest().elements ).length === 59,
	'manifest includes every definition'
);
check(
	getAllElements() === ELEMENT_DEFINITIONS,
	'getAllElements returns the canonical immutable registry'
);
check(
	getElement( 'button' )?.id === 'core/button' &&
		getManifest( 'core/button' )?.key === 'button',
	'registry queries accept stable IDs and palette keys'
);
check(
	validateElement( 'core/button' ).length === 0 &&
		validateElement( 'missing/element' ).length === 1,
	'single-element validation fails loudly for unknown definitions'
);
check(
	ELEMENT_DEFINITIONS.every(
		( definition ) =>
			definition.capabilities.length > 0 &&
			definition.capabilities.every(
				( capability ) => CAPABILITY_DEFINITIONS[ capability ]
			)
	),
	'every manifest declares only registered capabilities'
);

const button = createElementBlock( 'button', 'fixture' );
check(
	button.element === 'core/button',
	'button factory stores stable element identity'
);
check(
	button.definition_version === 1,
	'button factory stores independent definition version'
);
check(
	button.type === 'button' && button.tag === 'a',
	'button preserves renderer family and semantics'
);
const buttonPanel = resolveInspector( button );
assert.deepEqual(
	buttonPanel.tabs.style.targets.map( ( target ) => target.id ),
	[ 'root', 'label', 'icon', 'spinner' ],
	'Button exposes only renderer-backed style targets'
);
assertions += 1;
const buttonContentIds = buttonPanel.tabs.content.groups.flatMap( ( group ) =>
	group.controls.map( ( control ) => control.id )
);
check(
	buttonContentIds.includes( 'href' ),
	'Button shows its URL control when the default mode is link'
);
check(
	buttonPanel.tabs.content.groups[ 0 ].controls.some(
		( control ) => control.id === 'mode'
	),
	'button content includes mode'
);
check(
	buttonPanel.tabs.style.groups.some(
		( group ) => group.id === 'typography'
	),
	'button grants typography'
);
check(
	buttonPanel.tabs.style.states.includes( 'loading' ),
	'button grants loading state'
);
check(
	hasCapability( 'core/button', 'buttonAction' ) &&
		hasCapability( 'button', 'typography' ) &&
		! hasCapability( 'core/button', 'image' ),
	'capability queries describe actual button behavior and shared packs'
);
const buttonTargets = getElementTargets( 'core/button' );
const buttonLabelTarget = buttonTargets.find( ( item ) => item.id === 'label' );
const buttonIconTarget = buttonTargets.find( ( item ) => item.id === 'icon' );
check(
	buttonLabelTarget.styleGroups.includes( 'typography' ) &&
		! buttonLabelTarget.styleGroups.includes( 'icon' ) &&
		buttonIconTarget.styleGroups.includes( 'icon' ) &&
		! buttonIconTarget.styleGroups.includes( 'typography' ),
	'logical targets grant only their relevant shared style packs'
);
const buttonIconPanel = resolveInspector( button, { targetId: 'icon' } );
check(
	buttonIconPanel.tabs.style.activeTarget === 'icon' &&
		buttonIconPanel.tabs.style.groups.some(
			( group ) => group.id === 'icon'
		) &&
		! buttonIconPanel.tabs.style.groups.some(
			( group ) => group.id === 'typography'
		),
	'panel resolution composes groups from the active logical target'
);
check(
	resolveInspector( button, { targetId: 'media' } ).tabs.style
		.activeTarget === 'root',
	'unimplemented target requests fall back to the rendered root'
);
check(
	resolveInspector( button, {
		contextKey: 'bp:tablet|state:hover',
	} ).tabs.style.activeContext === 'bp:tablet|state:hover' &&
		resolveInspector( button, { contextKey: 'state:visited' } ).tabs.style
			.activeContext === 'base',
	'inspector contexts are canonical and limited to granted states'
);
const composedButtonGroups = composeStyleControlGroups(
	buttonPanel.tabs.style.groups,
	Object.values( STYLE_CONTROLS ),
	buttonPanel.tabs.style.properties
);
const composedButtonProperties = composedButtonGroups.flatMap( ( group ) =>
	group.fieldObjs.map( ( field ) => field.property )
);
check(
	new Set( composedButtonProperties ).size ===
		composedButtonProperties.length,
	'shared control packs compose without duplicate property controls'
);
check(
	panelSearch( buttonPanel.tabs.content, 'button' ).groups[ 0 ].controls
		.length === buttonPanel.tabs.content.groups[ 0 ].controls.length,
	'matching a group label keeps all controls in that group'
);
check(
	panelSearch( buttonPanel.tabs.advanced, 'animation' ).groups.some(
		( group ) => group.id === 'motion'
	),
	'advanced search resolves registered group fields'
);
check(
	! buttonPanel.tabs.advanced.groups.some(
		( group ) => group.id === 'typography'
	),
	'advanced never contains style groups'
);
check(
	[
		'videoSource',
		'formRecipient',
		'objectFit',
		'gridTemplateColumns',
	].every( ( controlId ) => ! buttonContentIds.includes( controlId ) ) &&
		! buttonPanel.tabs.style.properties.includes( 'object-fit' ) &&
		! buttonPanel.tabs.style.properties.includes( 'grid-template-columns' ),
	'Button excludes media, form, and structural-only controls'
);

const link = createElementBlock( 'link', 'fixture' );
const linkPanel = resolveInspector( link );
const linkContentIds = linkPanel.tabs.content.groups.flatMap( ( group ) =>
	group.controls.map( ( control ) => control.id )
);
check(
	linkContentIds.includes( 'icon' ) &&
		linkContentIds.includes( 'iconPosition' ) &&
		linkPanel.tabs.style.targets.some( ( target ) => target.id === 'icon' ),
	'Standalone Link reuses Button-family optional icon controls and target'
);

for ( const key of [ 'heading', 'text' ] ) {
	const textPanel = resolveInspector( createElementBlock( key, 'fixture' ) );
	assert.deepEqual(
		textPanel.tabs.style.targets.map( ( target ) => target.id ),
		[ 'root', 'text' ],
		`${ key } exposes its renderer-backed text target`
	);
	assertions += 1;
}

const formField = createElementBlock( 'form-field', 'target-fixture' );
formField.props.required = true;
const formFieldPanel = resolveInspector( formField );
const formFieldTargets = getElementTargets( 'forms/field-group' );
assert.deepEqual(
	formFieldPanel.tabs.style.targets.map( ( target ) => target.id ),
	[
		'root',
		'row',
		'label',
		'control',
		'placeholder',
		'help',
		'error',
		'requiredMark',
	],
	'Form Field exposes only renderer-backed row and descendant targets'
);
assertions += 1;
check(
	formFieldTargets.find( ( target ) => target.id === 'placeholder' )
		.selector ===
		'[data-ctb-part="row"] [data-ctb-part="control"]::placeholder' &&
		formFieldTargets
			.find( ( target ) => target.id === 'requiredMark' )
			.selector.endsWith( '[data-ctb-part="requiredMark"]' ),
	'Form Field selectors address the real control pseudo-element and required marker'
);
check(
	resolveInspector(
		createElementBlock( 'form-field', 'optional-field' )
	).tabs.style.targets.every( ( target ) => target.id !== 'requiredMark' ),
	'optional Form Fields hide the conditionally absent required mark target'
);

const headingPanel = resolveInspector(
	createElementBlock( 'heading', 'negative-fixture' )
);
const headingContentIds = headingPanel.tabs.content.groups.flatMap( ( group ) =>
	group.controls.map( ( control ) => control.id )
);
check(
	[ 'videoSource', 'formRecipient', 'objectFit', 'mode' ].every(
		( controlId ) => ! headingContentIds.includes( controlId )
	) && ! headingPanel.tabs.style.properties.includes( 'object-fit' ),
	'Heading excludes video, form, image-crop, and Button-action controls'
);

const spacer = createElementBlock( 'spacer', 'fixture' );
const spacerPanel = resolveInspector( spacer );
check(
	spacerPanel.tabs.style.groups.length === 1 &&
		spacerPanel.tabs.style.groups[ 0 ].id === 'sizing',
	'spacer exposes sizing only'
);
check(
	! spacerPanel.tabs.style.properties.includes( 'font-size' ),
	'spacer excludes typography'
);

const image = createElementBlock( 'image', 'fixture' );
const imagePanel = resolveInspector( image );
assert.deepEqual(
	imagePanel.tabs.style.targets.map( ( target ) => target.id ),
	[ 'root', 'media' ],
	'image exposes its always-rendered root and media targets'
);
assertions += 1;
check(
	imagePanel.tabs.content.groups[ 0 ].controls.some(
		( control ) => control.id === 'alt'
	),
	'image includes alt text'
);
check(
	! imagePanel.tabs.style.properties.includes( 'font-family' ),
	'image excludes root typography'
);
check(
	imagePanel.tabs.style.properties.includes( 'object-fit' ),
	'image media controls include the shared object-fit property'
);
const captionedImage = createElementBlock( 'image', 'caption-fixture' );
captionedImage.props.caption = 'Visible caption';
const imageCaptionPanel = resolveInspector( captionedImage, {
	targetId: 'caption',
} );
check(
	imageCaptionPanel.tabs.style.targets.some(
		( target ) => target.id === 'caption'
	) &&
		imageCaptionPanel.tabs.style.activeTarget === 'caption' &&
		imageCaptionPanel.tabs.style.properties.includes( 'font-family' ) &&
		! imageCaptionPanel.tabs.style.properties.includes( 'object-fit' ),
	'image caption condition composes shared typography without media-only controls'
);
check(
	imagePanel.tabs.advanced.groups.some(
		( group ) => group.id === 'performance'
	),
	'image includes performance'
);

check(
	inferElementDefinition( { type: 'text', tag: 'h4' } ).definition.id ===
		'core/heading',
	'heading matcher is deterministic'
);
check(
	inferElementDefinition( {
		type: 'form_field',
		tag: 'input',
		attributes: { type: 'checkbox' },
	} ).definition.id === 'forms/checkbox',
	'checkbox matcher is deterministic'
);
check(
	inferElementDefinition( { type: 'container', tag: 'table' } ).definition
		.id === 'legacy/html-node',
	'ambiguous native table uses compatibility fallback'
);
check(
	getElementDefinition( 'missing/definition' ).id === 'legacy/html-node',
	'unknown definition uses safe fallback'
);

// eslint-disable-next-line no-console
console.log( `PASS: ${ assertions } control registry assertions.` );
