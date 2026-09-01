import assert from 'node:assert/strict';

import {
	adjustRoleInStyleSet,
	applyRoleToStyleSet,
	auditGuidedRoles,
	BALANCED_STYLE_ROLES,
	countRoleUsage,
	diagnoseGuidedStyles,
	ensureGuidedRoleDesignSystem,
	evaluateRoleFit,
	migrateGuidedRolesDocument,
	normalizeImportedStyles,
	recommendStyleRoles,
	rejoinRoleProperty,
	resolveImportReviewFlag,
	resolveRoleBoundProperty,
	roleCatalog,
	sanitizeGuidedRoleTelemetry,
	semanticDetentFromPointerDelta,
	setRolePropertyOverride,
	updateRolePropertyGlobally,
} from '../src/semantic-roles.mjs';

let assertions = 0;
function equal( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

function ok( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

const textNode = ( value ) => ( { kind: 'text', value } );
const styleSet = ( mapped = {} ) => ( { mapped, custom_css_fallback: '' } );
const block = ( id, tag, mapped = {}, children = [], extra = {} ) => ( {
	id,
	type: /^h|^p$|^small$|^label$/.test( tag ) ? 'text' : 'container',
	tag,
	attributes: {},
	children,
	styles: styleSet( mapped ),
	meta: { source: 'guided-test' },
	...extra,
} );

const baseDocument = {
	schema_version: 1,
	name: 'Guided role fixture',
	root: block( 'root', 'main', {}, [
		block(
			'hero',
			'section',
			{ padding: '72px' },
			[
				block( 'hero-title', 'h1', { 'font-size': '64px' }, [
					textNode( 'Build with clearer visual decisions' ),
				] ),
				block( 'hero-intro', 'p', {}, [
					textNode( 'A short paragraph below the page title.' ),
				] ),
			],
			{ attributes: { class: 'hero' } }
		),
		block(
			'section',
			'section',
			{ padding: '48px' },
			[
				block( 'section-title', 'h2', { 'font-size': '48px' }, [
					textNode( 'A normal section heading' ),
				] ),
				block(
					'cards',
					'div',
					{ display: 'grid', gap: '16px' },
					[ 1, 2, 3, 4 ].map( ( item ) =>
						block(
							`card-${ item }`,
							'article',
							{ padding: '24px' },
							[
								block(
									`card-title-${ item }`,
									'h3',
									{ 'font-size': '24px' },
									[ textNode( `Card heading ${ item }` ) ]
								),
							],
							{ attributes: { class: 'feature-card' } }
						)
					),
					{ attributes: { class: 'card-grid' } }
				),
			],
			{ attributes: { class: 'content-section' } }
		),
		block( 'article-copy', 'p', {}, [
			textNode( 'Long-form article body copy.' ),
		] ),
	] ),
};

const guided = ensureGuidedRoleDesignSystem( baseDocument, {
	newDocument: true,
} );
const guidedAgain = ensureGuidedRoleDesignSystem( guided, {
	newDocument: true,
} );
equal(
	Object.keys( guided.style_roles ).length,
	Object.keys( guidedAgain.style_roles ).length,
	'Role seeding must be idempotent.'
);
equal(
	Object.keys( guided.design_tokens.typography ).length,
	Object.keys( guidedAgain.design_tokens.typography ).length,
	'Token seeding must be idempotent.'
);
equal( guided.schema_version, 2, 'New documents must use schema version 2.' );

const gatedDocument = structuredClone( baseDocument );
gatedDocument.feature_flags = { guided_roles: false };
const gatedMigration = migrateGuidedRolesDocument( gatedDocument );
equal(
	gatedMigration.feature_flags.guided_roles,
	false,
	'An explicitly disabled document must remain behind the release gate.'
);
equal(
	JSON.stringify( gatedMigration.root ),
	JSON.stringify( gatedDocument.root ),
	'Disabling guided roles must preserve existing block styling.'
);

equal(
	recommendStyleRoles( guided, 'hero-title', { property: 'font-size' } )[ 0 ]
		.roleId,
	'type.page-title',
	'The first heading in a hero must recommend Page title.'
);
equal(
	recommendStyleRoles( guided, 'section-title', {
		property: 'font-size',
	} )[ 0 ].roleId,
	'type.section-heading',
	'A normal section heading must recommend Section heading.'
);
equal(
	recommendStyleRoles( guided, 'card-title-1', {
		property: 'font-size',
	} )[ 0 ].roleId,
	'type.card-heading',
	'A repeated card heading must recommend Card heading.'
);
equal(
	recommendStyleRoles( guided, 'hero-intro', { property: 'font-size' } )[ 0 ]
		.roleId,
	'type.intro',
	'A short lead below a title must recommend Intro text.'
);
equal(
	recommendStyleRoles( guided, 'article-copy', {
		property: 'font-size',
	} )[ 0 ].roleId,
	'type.body',
	'A normal paragraph must recommend Body text.'
);
equal(
	recommendStyleRoles( guided, 'cards', { property: 'gap' } ).length,
	3,
	'Recommendations must never exceed three choices.'
);
equal(
	recommendStyleRoles( guided, 'card-1', { property: 'padding' } )[ 0 ]
		.roleId,
	'space.card-feature',
	'A feature card must receive contextual padding choices.'
);

let bound = applyRoleToStyleSet(
	styleSet(),
	'type.body',
	'typography',
	roleCatalog( guided )
);
equal(
	Object.keys( bound.role_bindings ),
	[ 'typography' ],
	'Role selection must serialize one semantic binding.'
);
ok(
	Object.values( bound.mapped ).every( ( value ) =>
		value.startsWith( 'var(' )
	),
	'Role selection must keep mapped values token-backed.'
);
bound = adjustRoleInStyleSet(
	bound,
	'typography',
	{ size: 1, density: -1 },
	roleCatalog( guided )
);
equal(
	bound.role_bindings.typography.typographyAdjustment,
	{ size: 1, density: -1 },
	'Typography adjustments must use bounded semantic detents.'
);
bound = setRolePropertyOverride(
	bound,
	'typography',
	'line-height',
	'1.42',
	{ breakpoint: 'mobile' },
	roleCatalog( guided )
);
equal(
	resolveRoleBoundProperty( {
		styleSet: bound,
		property: 'line-height',
		scope: 'typography',
		roles: roleCatalog( guided ),
		designTokens: guided.design_tokens,
		breakpoint: 'mobile',
	} ),
	'1.42',
	'A mobile property override must win over the role recipe.'
);
equal(
	resolveRoleBoundProperty( {
		styleSet: bound,
		property: 'font-size',
		scope: 'typography',
		roles: roleCatalog( guided ),
		designTokens: guided.design_tokens,
		breakpoint: 'desktop',
	} ),
	guided.design_tokens.typography[ 'size-intro' ].value,
	'An adjusted body role must resolve through its approved larger token.'
);
bound = rejoinRoleProperty(
	bound,
	'typography',
	'line-height',
	{ breakpoint: 'mobile' },
	roleCatalog( guided )
);
equal(
	bound.role_bindings.typography.overrides.length,
	0,
	'Rejoin must remove only the selected role override.'
);

equal(
	semanticDetentFromPointerDelta( 17 ),
	1,
	'A positive drag must snap to Farther.'
);
equal(
	semanticDetentFromPointerDelta( -17 ),
	-1,
	'A negative drag must snap to Closer.'
);
equal(
	semanticDetentFromPointerDelta( 4 ),
	0,
	'A small drag must remain at Default.'
);

const fit = evaluateRoleFit( {
	roleId: 'type.page-title',
	text: 'This is an intentionally long heading that cannot fit in a narrow card',
	containerWidth: 210,
	breakpoint: 'mobile',
	fontSizePx: 40,
} );
ok( fit.status !== 'safe', 'Long text must produce a breakpoint fit warning.' );

const localDocument = structuredClone( guided );
localDocument.root.children[ 1 ].children[ 1 ].children[ 0 ].styles =
	setRolePropertyOverride(
		applyRoleToStyleSet(
			localDocument.root.children[ 1 ].children[ 1 ].children[ 0 ].styles,
			'space.card-standard',
			'padding',
			roleCatalog( localDocument )
		),
		'padding',
		'padding',
		'25px',
		{},
		roleCatalog( localDocument )
	);
const issues = diagnoseGuidedStyles( localDocument, 'card-1' );
ok(
	issues.some(
		( issue ) => issue.id === 'detached-styling' && issue.fix === 'rejoin'
	),
	'Diagnostics must offer Rejoin for a detached local override.'
);

const sharedDocument = structuredClone( guided );
for ( const id of [ 'hero-intro', 'article-copy', 'card-title-1' ] ) {
	const stack = [ sharedDocument.root ];
	while ( stack.length ) {
		const current = stack.pop();
		if ( current.id === id ) {
			current.styles = applyRoleToStyleSet(
				current.styles,
				'type.body',
				'typography',
				roleCatalog( sharedDocument )
			);
			break;
		}
		stack.push(
			...( current.children || [] ).filter(
				( child ) => child.kind !== 'text'
			)
		);
	}
}
equal(
	countRoleUsage( sharedDocument, 'type.body' ),
	{ uses: 3, overriddenElements: 0 },
	'Role usage auditing must count bound elements exactly.'
);
const globallyUpdated = updateRolePropertyGlobally(
	sharedDocument,
	'type.body',
	'font-size',
	'19px',
	{
		scope: 'typography',
		binding:
			sharedDocument.root.children[ 0 ].children[ 1 ].styles.role_bindings
				.typography,
	}
);
ok(
	Object.values( globallyUpdated.design_tokens.typography ).some(
		( item ) => item.value === '19px'
	),
	'A global role edit must update or create one backing token.'
);
equal(
	auditGuidedRoles( globallyUpdated ).find(
		( item ) => item.id === 'type.body'
	).uses,
	3,
	'Global edits must retain every role binding.'
);
const bodyAudit = auditGuidedRoles( globallyUpdated ).find(
	( item ) => item.id === 'type.body'
);
equal(
	bodyAudit.elements.length,
	3,
	'The role manager audit must list every linked element.'
);
ok(
	bodyAudit.tokenReferences.includes( 'typography.font-body' ),
	'The role manager audit must expose backing token references.'
);

const imported = ensureGuidedRoleDesignSystem(
	{
		schema_version: 2,
		name: 'Import fixture',
		root: block( 'import-root', 'main', {}, [
			block(
				'import-hero',
				'section',
				{},
				[
					block( 'import-hero-title', 'h1', { 'font-size': '63px' }, [
						textNode( 'Imported hero' ),
					] ),
				],
				{ attributes: { class: 'hero' } }
			),
			block(
				'import-cards',
				'div',
				{},
				[ 23, 24, 25, 24 ].map( ( size, index ) =>
					block(
						`import-card-${ index }`,
						'article',
						{ padding: `${ 23 + index }px` },
						[
							block(
								`import-card-title-${ index }`,
								'h3',
								{ 'font-size': `${ size }px` },
								[ textNode( `Imported card ${ index + 1 }` ) ]
							),
						],
						{ attributes: { class: 'feature-card' } }
					)
				),
				{ attributes: { class: 'card-grid' } }
			),
			block(
				'import-promo',
				'section',
				{},
				[
					block(
						'import-promo-title',
						'h2',
						{ 'font-size': '112px' },
						[ textNode( 'Oversized promotion' ) ]
					),
				],
				{ attributes: { class: 'promotion' } }
			),
		] ),
	},
	{ newDocument: true }
);
const normalized = normalizeImportedStyles( imported );
equal(
	normalized.summary.retainedOverrides,
	1,
	'Import normalization must retain only the deliberate promotional difference.'
);
equal(
	normalized.summary.normalizedGroups.map( ( item ) => item.roleId ).sort(),
	[ 'space.card-standard', 'type.card-heading' ],
	'Repeated card headings and paddings must normalize to shared roles.'
);
equal(
	normalized.summary.flags[ 0 ].blockId,
	'import-promo-title',
	'The promotional heading must be the only flagged override.'
);
const promoStyleSet =
	normalized.document.root.children[ 2 ].children[ 0 ].styles;
const reviewFlagId = promoStyleSet.import_review_flags[ 0 ].id;
const keptImport = resolveImportReviewFlag(
	promoStyleSet,
	reviewFlagId,
	{ useRole: false },
	roleCatalog( normalized.document )
);
equal(
	keptImport.import_review_flags,
	undefined,
	'Keeping an imported difference must resolve its review flag.'
);
equal(
	keptImport.role_bindings.typography.overrides.length,
	1,
	'Keeping an imported difference must retain its local override.'
);
const adoptedImport = resolveImportReviewFlag(
	promoStyleSet,
	reviewFlagId,
	{ useRole: true },
	roleCatalog( normalized.document )
);
equal(
	adoptedImport.role_bindings.typography.overrides.length,
	0,
	'Using the site role must remove the imported local override.'
);

const legacy = structuredClone( baseDocument );
const legacyStyles = JSON.stringify( legacy.root );
const migrated = migrateGuidedRolesDocument( legacy );
equal(
	JSON.stringify( migrated.root ),
	legacyStyles,
	'Conservative migration must not rewrite existing legacy blocks.'
);
equal(
	migrated.schema_version,
	2,
	'Migration must increment the document schema version.'
);

const telemetry = sanitizeGuidedRoleTelemetry( 'guided_role_selected', {
	role_id: 'type.body',
	context_category: 'paragraph',
	breakpoint_category: 'mobile',
	action_result: 'committed',
	text: 'private content',
	font_name: 'Private Font',
	value: '19px',
} );
equal(
	Object.keys( telemetry.payload ).sort(),
	[ 'action_result', 'breakpoint_category', 'context_category', 'role_id' ],
	'Telemetry must exclude content, font names, and raw values.'
);
equal(
	sanitizeGuidedRoleTelemetry( 'unknown_event', {} ),
	null,
	'Unknown telemetry events must fail closed.'
);

ok(
	Object.keys( BALANCED_STYLE_ROLES ).length === 17,
	'The Balanced library must contain all eight typography and nine spacing roles.'
);

console.log( `PASS: ${ assertions } guided-role assertions.` );
