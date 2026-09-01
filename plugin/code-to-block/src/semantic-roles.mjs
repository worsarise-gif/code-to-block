import { tokenCssValue } from './design-tokens.mjs';

export const GUIDED_ROLES_SCHEMA_VERSION = 2;
export const GUIDED_ROLES_FEATURE_FLAG = 'guided_roles';
export const GUIDED_ROLE_SOURCE_VALUES = [
	'built-in',
	'user',
	'imported',
	'legacy',
];

export const GUIDED_ROLE_EVENTS = new Set( [
	'guided_role_recommendation_shown',
	'guided_role_selected',
	'guided_relative_adjustment_used',
	'guided_advanced_exact_edit_started',
	'guided_global_role_updated',
	'guided_local_override_created',
	'guided_override_rejoined',
	'guided_import_normalized',
] );

export const GUIDED_ROLE_TELEMETRY_KEYS = new Set( [
	'role_id',
	'context_category',
	'breakpoint_category',
	'action_result',
] );

export const TYPOGRAPHY_PROPERTIES = [
	'font-family',
	'font-size',
	'font-weight',
	'line-height',
	'letter-spacing',
];

export const SPACING_PROPERTIES = [
	'padding',
	'padding-top',
	'padding-right',
	'padding-bottom',
	'padding-left',
	'margin',
	'margin-top',
	'margin-right',
	'margin-bottom',
	'margin-left',
	'gap',
	'row-gap',
	'column-gap',
];

export const ROLE_LABELS = {
	'type.page-title': 'Page title',
	'type.section-heading': 'Section heading',
	'type.card-heading': 'Card heading',
	'type.intro': 'Intro text',
	'type.body': 'Body text',
	'type.supporting': 'Supporting text',
	'type.action': 'Button or action text',
	'type.label': 'Label or metadata',
	'space.cluster': 'Same cluster',
	'space.related-group': 'Related items',
	'space.separate-group': 'Separate groups',
	'space.card-compact': 'Compact card',
	'space.card-standard': 'Standard card',
	'space.card-feature': 'Feature card',
	'space.section-standard': 'Standard section',
	'space.section-generous': 'Generous section',
	'space.hero': 'Hero spacing',
};

export const ROLE_DESCRIPTIONS = {
	'type.page-title':
		'The primary page message with the strongest visual emphasis.',
	'type.section-heading':
		'Introduces a major section without competing with the page title.',
	'type.card-heading':
		'Keeps repeated and compact headings clear and consistent.',
	'type.intro': 'A short lead paragraph that supports a nearby heading.',
	'type.body':
		'Comfortable reading text for normal paragraphs and rich content.',
	'type.supporting': 'Secondary copy, captions, helper text, and notes.',
	'type.action': 'Clear, compact text for buttons and interactive actions.',
	'type.label': 'Short labels, metadata, navigation, and form labels.',
	'space.cluster':
		'Keeps an icon and label or other tightly related items together.',
	'space.related-group':
		'Separates items that still belong to one content group.',
	'space.separate-group':
		'Creates a clearer break between distinct content groups.',
	'space.card-compact':
		'Efficient padding for dense controls and compact cards.',
	'space.card-standard':
		'Balanced padding for a normal card or content panel.',
	'space.card-feature':
		'More breathing room for a prominent card or callout.',
	'space.section-standard':
		'Balanced block spacing for a normal page section.',
	'space.section-generous':
		'More open block spacing for an editorial section.',
	'space.hero': 'Responsive spacing for a hero or page-intro container.',
};

export const REASON_TEXT = {
	button_action:
		'Recommended because this text belongs to an interactive action.',
	compact_control_label:
		'Recommended because this is a short label in a compact control.',
	metadata_text:
		'Recommended because this content is short supporting metadata.',
	heading_inside_repeated_card:
		'Recommended because this heading appears inside a repeated card or item.',
	first_heading_in_hero:
		'Recommended because this is the first prominent heading in a page-intro area.',
	section_heading:
		'Recommended because this heading begins a normal content section.',
	short_lead_below_title:
		'Recommended because this is a short lead directly supporting a heading.',
	normal_reading_paragraph:
		'Recommended for comfortable reading at this width.',
	supporting_copy:
		'Recommended because this is secondary or explanatory text.',
	inline_icon_label_gap:
		'Recommended because these items form one compact cluster.',
	related_items_gap:
		'Recommended because these items belong to one related group.',
	separate_content_groups:
		'Recommended because these are distinct content groups.',
	padding_inside_compact_card:
		'Recommended for a compact control or dense card.',
	padding_inside_standard_card:
		'Recommended for balanced padding inside this card.',
	padding_inside_feature_card:
		'Recommended because this is a prominent card or callout.',
	padding_inside_standard_section: 'Recommended for a normal page section.',
	padding_inside_generous_section:
		'Recommended for a spacious editorial section.',
	padding_inside_hero:
		'Recommended because this is a hero or page-intro container.',
	linked_sibling_margin:
		'Recommended for the relationship between these sibling elements.',
};

const token = ( label, value ) => ( { label, value, built_in: true } );

export const BALANCED_DESIGN_TOKENS = {
	typography: {
		'font-heading': token(
			'Heading font',
			"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
		),
		'font-body': token(
			'Body font',
			"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
		),
		'size-page-title-plus': token(
			'Page title larger',
			'clamp(3rem, 2rem + 5vw, 6rem)'
		),
		'size-page-title': token(
			'Page title',
			'clamp(2.5rem, 1.75rem + 3.75vw, 5rem)'
		),
		'size-section-heading': token(
			'Section heading',
			'clamp(2rem, 1.6rem + 2vw, 3.25rem)'
		),
		'size-card-heading': token(
			'Card heading',
			'clamp(1.25rem, 1.15rem + 0.5vw, 1.75rem)'
		),
		'size-intro': token(
			'Intro text',
			'clamp(1.125rem, 1.05rem + 0.375vw, 1.375rem)'
		),
		'size-body': token(
			'Body text',
			'clamp(1rem, 0.96rem + 0.2vw, 1.125rem)'
		),
		'size-supporting': token(
			'Supporting text',
			'clamp(0.875rem, 0.84rem + 0.15vw, 1rem)'
		),
		'size-supporting-minus': token( 'Supporting text smaller', '0.75rem' ),
		'size-action': token( 'Action text', '1rem' ),
		'size-label': token( 'Label text', '0.875rem' ),
		'weight-regular': token( 'Regular weight', '400' ),
		'weight-semibold': token( 'Semibold weight', '600' ),
		'weight-bold': token( 'Bold weight', '700' ),
		'leading-display': token( 'Display line height', '1.05' ),
		'leading-heading': token( 'Heading line height', '1.10' ),
		'leading-compact': token( 'Compact line height', '1.20' ),
		'leading-label': token( 'Label line height', '1.30' ),
		'leading-supporting': token( 'Supporting line height', '1.50' ),
		'leading-intro': token( 'Intro line height', '1.55' ),
		'leading-body': token( 'Body line height', '1.60' ),
		'leading-loose': token( 'Loose line height', '1.75' ),
		'tracking-display': token( 'Display tracking', '-0.03em' ),
		'tracking-heading': token( 'Heading tracking', '-0.02em' ),
		'tracking-card': token( 'Card heading tracking', '-0.01em' ),
		'tracking-normal': token( 'Normal tracking', '0' ),
		'tracking-label': token( 'Label tracking', '0.04em' ),
	},
	spacing: {
		'guided-2xs': token( '2XS spacing', '0.25rem' ),
		'guided-xs': token( 'XS spacing', '0.5rem' ),
		'guided-sm': token( 'Small spacing', '0.75rem' ),
		'guided-md': token( 'Medium spacing', '1rem' ),
		'guided-lg': token( 'Large spacing', '1.5rem' ),
		'guided-xl': token( 'XL spacing', '2rem' ),
		'guided-2xl': token(
			'2XL responsive spacing',
			'clamp(2.5rem, 2rem + 2vw, 4rem)'
		),
		'guided-3xl': token(
			'3XL responsive spacing',
			'clamp(4rem, 3rem + 4vw, 7rem)'
		),
	},
};

const typographyRecipe = ( {
	id,
	size,
	minus,
	plus,
	weight,
	line,
	tighter,
	looser,
	tracking,
	contexts,
} ) => ( {
	id,
	kind: 'typography',
	labelKey: id,
	descriptionKey: id,
	propertyTokenRefs: {
		'font-family':
			id.includes( 'title' ) || id.includes( 'heading' )
				? 'typography.font-heading'
				: 'typography.font-body',
		'font-size': `typography.${ size }`,
		'font-weight': `typography.${ weight }`,
		'line-height': `typography.${ line }`,
		'letter-spacing': `typography.${ tracking }`,
	},
	variants: {
		minus: { 'font-size': `typography.${ minus }` },
		default: { 'font-size': `typography.${ size }` },
		plus: { 'font-size': `typography.${ plus }` },
	},
	densityVariants: {
		minus: { 'line-height': `typography.${ tighter }` },
		default: { 'line-height': `typography.${ line }` },
		plus: { 'line-height': `typography.${ looser }` },
	},
	supportedContexts: contexts,
	builtIn: true,
	version: 1,
} );

const spacingRecipe = ( id, minus, normal, plus, contexts ) => ( {
	id,
	kind: 'spacing',
	labelKey: id,
	descriptionKey: id,
	propertyTokenRefs: { value: `spacing.${ normal }` },
	variants: {
		minus: minus ? { value: `spacing.${ minus }` } : undefined,
		default: { value: `spacing.${ normal }` },
		plus: plus ? { value: `spacing.${ plus }` } : undefined,
	},
	supportedContexts: contexts,
	builtIn: true,
	version: 1,
} );

export const BALANCED_STYLE_ROLES = Object.fromEntries(
	[
		typographyRecipe( {
			id: 'type.page-title',
			size: 'size-page-title',
			minus: 'size-section-heading',
			plus: 'size-page-title-plus',
			weight: 'weight-bold',
			line: 'leading-display',
			tighter: 'leading-display',
			looser: 'leading-heading',
			tracking: 'tracking-display',
			contexts: [ 'hero', 'page-intro', 'first-heading' ],
		} ),
		typographyRecipe( {
			id: 'type.section-heading',
			size: 'size-section-heading',
			minus: 'size-card-heading',
			plus: 'size-page-title',
			weight: 'weight-bold',
			line: 'leading-heading',
			tighter: 'leading-display',
			looser: 'leading-compact',
			tracking: 'tracking-heading',
			contexts: [ 'section', 'heading' ],
		} ),
		typographyRecipe( {
			id: 'type.card-heading',
			size: 'size-card-heading',
			minus: 'size-intro',
			plus: 'size-section-heading',
			weight: 'weight-semibold',
			line: 'leading-compact',
			tighter: 'leading-heading',
			looser: 'leading-label',
			tracking: 'tracking-card',
			contexts: [ 'card', 'repeated-item', 'tile' ],
		} ),
		typographyRecipe( {
			id: 'type.intro',
			size: 'size-intro',
			minus: 'size-body',
			plus: 'size-card-heading',
			weight: 'weight-regular',
			line: 'leading-intro',
			tighter: 'leading-supporting',
			looser: 'leading-body',
			tracking: 'tracking-normal',
			contexts: [ 'lead', 'intro' ],
		} ),
		typographyRecipe( {
			id: 'type.body',
			size: 'size-body',
			minus: 'size-supporting',
			plus: 'size-intro',
			weight: 'weight-regular',
			line: 'leading-body',
			tighter: 'leading-intro',
			looser: 'leading-loose',
			tracking: 'tracking-normal',
			contexts: [ 'paragraph', 'rich-text', 'article' ],
		} ),
		typographyRecipe( {
			id: 'type.supporting',
			size: 'size-supporting',
			minus: 'size-supporting-minus',
			plus: 'size-body',
			weight: 'weight-regular',
			line: 'leading-supporting',
			tighter: 'leading-label',
			looser: 'leading-body',
			tracking: 'tracking-normal',
			contexts: [ 'caption', 'helper', 'note', 'secondary' ],
		} ),
		typographyRecipe( {
			id: 'type.action',
			size: 'size-action',
			minus: 'size-label',
			plus: 'size-intro',
			weight: 'weight-semibold',
			line: 'leading-compact',
			tighter: 'leading-display',
			looser: 'leading-label',
			tracking: 'tracking-label',
			contexts: [ 'button', 'action', 'link' ],
		} ),
		typographyRecipe( {
			id: 'type.label',
			size: 'size-label',
			minus: 'size-supporting-minus',
			plus: 'size-action',
			weight: 'weight-semibold',
			line: 'leading-label',
			tighter: 'leading-compact',
			looser: 'leading-supporting',
			tracking: 'tracking-label',
			contexts: [ 'label', 'metadata', 'navigation', 'badge' ],
		} ),
		spacingRecipe(
			'space.cluster',
			'guided-2xs',
			'guided-xs',
			'guided-sm',
			[ 'inline', 'icon-label' ]
		),
		spacingRecipe(
			'space.related-group',
			'guided-sm',
			'guided-md',
			'guided-lg',
			[ 'fields', 'list', 'stack' ]
		),
		spacingRecipe(
			'space.separate-group',
			'guided-md',
			'guided-lg',
			'guided-xl',
			[ 'groups', 'siblings' ]
		),
		spacingRecipe(
			'space.card-compact',
			'guided-sm',
			'guided-md',
			'guided-lg',
			[ 'compact-card', 'control' ]
		),
		spacingRecipe(
			'space.card-standard',
			'guided-md',
			'guided-lg',
			'guided-xl',
			[ 'card', 'panel' ]
		),
		spacingRecipe(
			'space.card-feature',
			'guided-lg',
			'guided-xl',
			'guided-2xl',
			[ 'feature-card', 'callout', 'promotion' ]
		),
		spacingRecipe(
			'space.section-standard',
			'guided-xl',
			'guided-2xl',
			'guided-3xl',
			[ 'section' ]
		),
		spacingRecipe(
			'space.section-generous',
			'guided-2xl',
			'guided-3xl',
			null,
			[ 'editorial-section' ]
		),
		spacingRecipe( 'space.hero', 'guided-2xl', 'guided-3xl', null, [
			'hero',
			'page-intro',
		] ),
	].map( ( recipe ) => [ recipe.id, recipe ] )
);

const clone = ( value ) => JSON.parse( JSON.stringify( value ) );

function visitBlocks( block, visitor, parent = null, ancestors = [] ) {
	visitor( block, parent, ancestors );
	for ( const child of block.children || [] ) {
		if ( child.kind !== 'text' ) {
			visitBlocks( child, visitor, block, [ ...ancestors, block ] );
		}
	}
}

export function roleCatalog( document ) {
	return {
		...BALANCED_STYLE_ROLES,
		...( document?.style_roles || {} ),
	};
}

export function guidedRolesEnabled( document ) {
	return document?.feature_flags?.[ GUIDED_ROLES_FEATURE_FLAG ] !== false;
}

export function ensureGuidedRoleDesignSystem(
	document,
	{ newDocument = false, enable = true } = {}
) {
	const next = clone( document );
	if ( newDocument || Number( next.schema_version || 1 ) >= 2 ) {
		next.schema_version = GUIDED_ROLES_SCHEMA_VERSION;
	}
	next.feature_flags = {
		...( next.feature_flags || {} ),
		[ GUIDED_ROLES_FEATURE_FLAG ]: enable,
	};
	next.design_tokens = { ...( next.design_tokens || {} ) };
	for ( const [ category, tokens ] of Object.entries(
		BALANCED_DESIGN_TOKENS
	) ) {
		next.design_tokens[ category ] = {
			...( next.design_tokens[ category ] || {} ),
		};
		for ( const [ id, definition ] of Object.entries( tokens ) ) {
			if ( ! next.design_tokens[ category ][ id ] ) {
				next.design_tokens[ category ][ id ] = clone( definition );
			}
		}
	}
	next.style_roles = { ...( next.style_roles || {} ) };
	for ( const [ id, recipe ] of Object.entries( BALANCED_STYLE_ROLES ) ) {
		if ( ! next.style_roles[ id ] ) {
			next.style_roles[ id ] = clone( recipe );
		}
	}
	return next;
}

export function migrateGuidedRolesDocument(
	document,
	{ newDocument = false, exactLegacyMapping = false } = {}
) {
	const enable =
		document?.feature_flags?.[ GUIDED_ROLES_FEATURE_FLAG ] !== false;
	const next = ensureGuidedRoleDesignSystem( document, {
		newDocument: true,
		enable,
	} );
	if ( ! enable ) {
		return next;
	}
	if ( ! newDocument && exactLegacyMapping ) {
		visitBlocks( next.root, ( block ) => {
			if ( block.styles?.role_bindings || ! isTextualBlock( block ) ) {
				return;
			}
			const candidates = recommendStyleRoles( next, block.id, {
				property: 'font-size',
			} );
			const recommendation = candidates[ 0 ];
			const recipe = next.style_roles?.[ recommendation?.roleId ];
			if (
				recipe &&
				rawStylesExactlyMatchRole( block.styles, recipe, next )
			) {
				block.styles = applyRoleToStyleSet(
					block.styles,
					recipe.id,
					'typography',
					next.style_roles,
					{ source: 'legacy' }
				);
			}
		} );
	}
	return next;
}

function rawStylesExactlyMatchRole( styleSet, recipe, document ) {
	return Object.entries( recipe.propertyTokenRefs ).every(
		( [ property, reference ] ) => {
			const [ category, id ] = reference.split( '.' );
			return (
				styleSet.mapped?.[ property ] ===
				document.design_tokens?.[ category ]?.[ id ]?.value
			);
		}
	);
}

export function isTextualBlock( block ) {
	return (
		block?.type === 'text' ||
		block?.type === 'button' ||
		[ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'label', 'small' ].includes(
			block?.tag
		)
	);
}

export function blockText( block ) {
	return ( block?.children || [] )
		.filter( ( child ) => child.kind === 'text' )
		.map( ( child ) => child.value )
		.join( '' )
		.trim();
}

export function findBlockWithContext( document, id ) {
	let result = null;
	visitBlocks( document.root, ( block, parent, ancestors ) => {
		if ( block.id === id ) {
			result = { block, parent, ancestors };
		}
	} );
	return result;
}

function classWords( block ) {
	return `${ block?.id || '' } ${ block?.attributes?.class || '' } ${
		block?.meta?.source || ''
	}`.toLowerCase();
}

function isHeading( block ) {
	return /^h[1-6]$/.test( block?.tag || '' );
}

function isCardLike( block ) {
	return /card|tile|product|feature|testimonial|callout|promo/.test(
		classWords( block )
	);
}

function isHeroLike( block ) {
	return /hero|page-intro|masthead/.test( classWords( block ) );
}

function structuralSiblings( parent ) {
	return ( parent?.children || [] ).filter(
		( child ) => child.kind !== 'text'
	);
}

function firstHeadingId( root ) {
	let id = '';
	visitBlocks( root, ( block ) => {
		if ( ! id && isHeading( block ) ) {
			id = block.id;
		}
	} );
	return id;
}

export function deriveRoleContext( document, blockId, property = 'font-size' ) {
	const found = findBlockWithContext( document, blockId );
	if ( ! found ) {
		return null;
	}
	const { block, parent, ancestors } = found;
	// `visitBlocks` includes the direct parent as the final ancestor. The
	// structural peer group for a block inside a repeated card therefore lives
	// one level higher.
	const grandparent = ancestors.at( -2 ) || null;
	const siblings = structuralSiblings( parent );
	const parentSiblings = structuralSiblings( grandparent );
	const repeated =
		siblings.length >= 3 ||
		( isCardLike( parent ) && parentSiblings.length >= 3 ) ||
		( parentSiblings.length >= 3 &&
			parentSiblings.every( ( item ) => item.tag === parent?.tag ) );
	const hero =
		isHeroLike( block ) ||
		isHeroLike( parent ) ||
		ancestors.some( isHeroLike );
	const card = isCardLike( block ) || isCardLike( parent ) || repeated;
	const text = blockText( block );
	const parentIndex = siblings.findIndex( ( item ) => item.id === block.id );
	const previous = parentIndex > 0 ? siblings[ parentIndex - 1 ] : null;
	const insideSection =
		block.tag === 'section' ||
		parent?.tag === 'section' ||
		ancestors.some( ( item ) => item.tag === 'section' );
	return {
		block,
		parent,
		ancestors,
		property,
		text,
		textLength: text.length,
		isHeading: isHeading( block ),
		isFirstHeading: firstHeadingId( document.root ) === block.id,
		isButton:
			block.type === 'button' || [ 'button', 'a' ].includes( block.tag ),
		isMetadata:
			/label|meta|caption|helper|badge|byline|timestamp|disclaimer|note/.test(
				classWords( block )
			) || [ 'label', 'small', 'time' ].includes( block.tag ),
		isRepeated: repeated,
		isCard: card,
		isHero: hero,
		insideSection,
		isIntro:
			block.tag === 'p' &&
			text.length <= 180 &&
			Boolean( previous && isHeading( previous ) ),
		isCompact:
			/compact|dense|toolbar|control/.test( classWords( parent ) ) ||
			text.length <= 24,
		isFeature: /feature|callout|promo/.test(
			classWords( block ) + classWords( parent )
		),
		isEditorial: /editorial|article|story/.test(
			classWords( block ) + classWords( parent )
		),
	};
}

function recommendations( ids, reasonCode ) {
	return ids.slice( 0, 3 ).map( ( roleId, index ) => ( {
		roleId,
		rank: index + 1,
		recommended: index === 0,
		reasonCode,
		reasonTextKey: reasonCode,
		reason: REASON_TEXT[ reasonCode ],
		fitStatus: 'safe',
	} ) );
}

export function recommendStyleRoles( document, blockId, options = {} ) {
	const property = options.property || 'font-size';
	const context = deriveRoleContext( document, blockId, property );
	if ( ! context ) {
		return [];
	}
	if ( TYPOGRAPHY_PROPERTIES.includes( property ) ) {
		if ( context.isButton ) {
			return recommendations(
				context.isCompact
					? [ 'type.action', 'type.label' ]
					: [ 'type.action', 'type.label', 'type.body' ],
				'button_action'
			);
		}
		if ( context.isMetadata ) {
			return recommendations(
				[ 'type.label', 'type.supporting', 'type.action' ],
				'metadata_text'
			);
		}
		if ( context.isHeading && ( context.isRepeated || context.isCard ) ) {
			return recommendations(
				[
					'type.card-heading',
					'type.section-heading',
					'type.supporting',
				],
				'heading_inside_repeated_card'
			);
		}
		if (
			context.isHeading &&
			( context.isHero || context.isFirstHeading )
		) {
			return recommendations(
				[
					'type.page-title',
					'type.section-heading',
					'type.card-heading',
				],
				'first_heading_in_hero'
			);
		}
		if ( context.isHeading ) {
			return recommendations(
				[
					'type.section-heading',
					'type.card-heading',
					'type.page-title',
				],
				'section_heading'
			);
		}
		if ( context.isIntro ) {
			return recommendations(
				[ 'type.intro', 'type.body', 'type.supporting' ],
				'short_lead_below_title'
			);
		}
		if ( context.block.tag === 'p' || context.block.type === 'text' ) {
			return recommendations(
				[ 'type.body', 'type.intro', 'type.supporting' ],
				'normal_reading_paragraph'
			);
		}
		return recommendations(
			[ 'type.supporting', 'type.body', 'type.label' ],
			'supporting_copy'
		);
	}

	if ( [ 'gap', 'row-gap', 'column-gap' ].includes( property ) ) {
		if ( context.isButton || context.isCompact ) {
			return recommendations(
				[
					'space.cluster',
					'space.related-group',
					'space.separate-group',
				],
				'inline_icon_label_gap'
			);
		}
		return recommendations(
			[ 'space.related-group', 'space.cluster', 'space.separate-group' ],
			'related_items_gap'
		);
	}
	if ( property.startsWith( 'padding' ) ) {
		if ( context.isHero ) {
			return recommendations(
				[
					'space.hero',
					'space.section-generous',
					'space.section-standard',
				],
				'padding_inside_hero'
			);
		}
		if (
			context.block.tag === 'section' ||
			( context.insideSection && ! context.isCard )
		) {
			return recommendations(
				context.isEditorial
					? [
							'space.section-generous',
							'space.section-standard',
							'space.hero',
					  ]
					: [
							'space.section-standard',
							'space.section-generous',
							'space.hero',
					  ],
				context.isEditorial
					? 'padding_inside_generous_section'
					: 'padding_inside_standard_section'
			);
		}
		if ( context.isFeature ) {
			return recommendations(
				[
					'space.card-feature',
					'space.card-standard',
					'space.card-compact',
				],
				'padding_inside_feature_card'
			);
		}
		if ( context.isCompact ) {
			return recommendations(
				[
					'space.card-compact',
					'space.card-standard',
					'space.card-feature',
				],
				'padding_inside_compact_card'
			);
		}
		return recommendations(
			[
				'space.card-standard',
				'space.card-compact',
				'space.card-feature',
			],
			'padding_inside_standard_card'
		);
	}
	return recommendations(
		[ 'space.separate-group', 'space.related-group', 'space.cluster' ],
		'linked_sibling_margin'
	);
}

export function roleBindingForProperty( styleSet, property ) {
	for ( const [ scope, binding ] of Object.entries(
		styleSet?.role_bindings || {}
	) ) {
		if (
			binding.kind === 'typography' &&
			TYPOGRAPHY_PROPERTIES.includes( property )
		) {
			return { scope, binding };
		}
		if ( binding.kind === 'spacing' && scope === property ) {
			return { scope, binding };
		}
	}
	return null;
}

function stepKey( step ) {
	if ( step < 0 ) {
		return 'minus';
	}
	if ( step > 0 ) {
		return 'plus';
	}
	return 'default';
}

export function roleTokenReferences( recipe, binding, scope ) {
	if ( ! recipe || ! binding ) {
		return {};
	}
	if ( recipe.kind === 'spacing' ) {
		const variant =
			recipe.variants?.[
				stepKey( binding.spacingAdjustment?.distance || 0 )
			] || recipe.variants?.default;
		return variant?.value ? { [ scope ]: variant.value } : {};
	}
	const refs = { ...( recipe.propertyTokenRefs || {} ) };
	const size =
		recipe.variants?.[
			stepKey( binding.typographyAdjustment?.size || 0 )
		] || recipe.variants?.default;
	const density =
		recipe.densityVariants?.[
			stepKey( binding.typographyAdjustment?.density || 0 )
		] || recipe.densityVariants?.default;
	Object.assign( refs, size || {}, density || {} );
	return refs;
}

export function applyRoleToStyleSet(
	styleSet,
	roleId,
	scope,
	roles = BALANCED_STYLE_ROLES,
	options = {}
) {
	const recipe = roles?.[ roleId ];
	if ( ! recipe ) {
		return clone( styleSet );
	}
	const next = clone( styleSet );
	next.mapped = { ...( next.mapped || {} ) };
	next.token_bindings = { ...( next.token_bindings || {} ) };
	next.role_bindings = { ...( next.role_bindings || {} ) };
	const previous = next.role_bindings[ scope ];
	if ( previous ) {
		const previousRecipe = roles?.[ previous.roleId ];
		for ( const property of Object.keys(
			roleTokenReferences( previousRecipe, previous, scope )
		) ) {
			delete next.token_bindings[ property ];
			delete next.mapped[ property ];
		}
	}
	let source = recipe.builtIn ? 'built-in' : 'user';
	if ( GUIDED_ROLE_SOURCE_VALUES.includes( options.source ) ) {
		source = options.source;
	}
	const binding = {
		roleId,
		kind: recipe.kind,
		...( recipe.kind === 'typography'
			? {
					typographyAdjustment: {
						size: options.size || 0,
						density: options.density || 0,
					},
			  }
			: { spacingAdjustment: { distance: options.distance || 0 } } ),
		overrides: Array.isArray( options.overrides )
			? clone( options.overrides )
			: [],
		source,
	};
	next.role_bindings[ scope ] = binding;
	const references = roleTokenReferences( recipe, binding, scope );
	for ( const [ property, reference ] of Object.entries( references ) ) {
		next.token_bindings[ property ] = reference;
		next.mapped[ property ] = tokenCssValue( reference );
	}
	for ( const override of binding.overrides ) {
		if (
			references[ override.property ] &&
			( ! override.breakpoint ||
				override.breakpoint === options.breakpoint ) &&
			( ! override.state || override.state === options.state )
		) {
			next.mapped[ override.property ] = override.value;
		}
	}
	if ( ! Object.keys( next.token_bindings ).length ) {
		delete next.token_bindings;
	}
	return next;
}

export function adjustRoleInStyleSet(
	styleSet,
	scope,
	adjustment,
	roles = BALANCED_STYLE_ROLES
) {
	const current = styleSet?.role_bindings?.[ scope ];
	if ( ! current ) {
		return clone( styleSet );
	}
	const options = {
		source: current.source,
		overrides: current.overrides,
		size: adjustment.size ?? current.typographyAdjustment?.size ?? 0,
		density:
			adjustment.density ?? current.typographyAdjustment?.density ?? 0,
		distance:
			adjustment.distance ?? current.spacingAdjustment?.distance ?? 0,
		breakpoint: adjustment.breakpoint,
		state: adjustment.state,
	};
	return applyRoleToStyleSet(
		styleSet,
		current.roleId,
		scope,
		roles,
		options
	);
}

export function setRolePropertyOverride(
	styleSet,
	scope,
	property,
	value,
	{ breakpoint, state } = {},
	roles = BALANCED_STYLE_ROLES
) {
	const next = clone( styleSet );
	const binding = next.role_bindings?.[ scope ];
	if ( ! binding ) {
		return next;
	}
	const overrides = ( binding.overrides || [] ).filter(
		( item ) =>
			item.property !== property ||
			item.breakpoint !== breakpoint ||
			item.state !== state
	);
	overrides.push( {
		property,
		value,
		...( breakpoint ? { breakpoint } : {} ),
		...( state ? { state } : {} ),
	} );
	return applyRoleToStyleSet( next, binding.roleId, scope, roles, {
		source: binding.source,
		overrides,
		breakpoint,
		state,
		size: binding.typographyAdjustment?.size || 0,
		density: binding.typographyAdjustment?.density || 0,
		distance: binding.spacingAdjustment?.distance || 0,
	} );
}

export function rejoinRoleProperty(
	styleSet,
	scope,
	property,
	{ breakpoint, state } = {},
	roles = BALANCED_STYLE_ROLES
) {
	const next = clone( styleSet );
	const binding = next.role_bindings?.[ scope ];
	if ( ! binding ) {
		return next;
	}
	const overrides = ( binding.overrides || [] ).filter(
		( item ) =>
			! (
				item.property === property &&
				item.breakpoint === breakpoint &&
				item.state === state
			)
	);
	return applyRoleToStyleSet( next, binding.roleId, scope, roles, {
		source: binding.source,
		overrides,
		breakpoint,
		state,
		size: binding.typographyAdjustment?.size || 0,
		density: binding.typographyAdjustment?.density || 0,
		distance: binding.spacingAdjustment?.distance || 0,
	} );
}

export function resolveImportReviewFlag(
	styleSet,
	flagId,
	{ useRole = false } = {},
	roles = BALANCED_STYLE_ROLES
) {
	let next = clone( styleSet );
	const flag = next.import_review_flags?.find(
		( item ) => item.id === flagId
	);
	if ( ! flag ) {
		return next;
	}
	if ( useRole ) {
		const matchingScope = Object.entries( next.role_bindings || {} ).find(
			( [ , binding ] ) =>
				binding.roleId === flag.roleId &&
				( binding.overrides || [] ).some(
					( override ) => override.property === flag.property
				)
		)?.[ 0 ];
		if ( matchingScope ) {
			next = rejoinRoleProperty(
				next,
				matchingScope,
				flag.property,
				{},
				roles
			);
		}
	}
	next.import_review_flags = ( next.import_review_flags || [] ).filter(
		( item ) => item.id !== flagId
	);
	if ( ! next.import_review_flags.length ) {
		delete next.import_review_flags;
	}
	return next;
}

export function resolveRoleBoundProperty( {
	styleSet,
	property,
	scope,
	roles = BALANCED_STYLE_ROLES,
	designTokens = BALANCED_DESIGN_TOKENS,
	breakpoint,
	state,
} ) {
	const binding = styleSet?.role_bindings?.[ scope ];
	if ( ! binding ) {
		return styleSet?.mapped?.[ property ];
	}
	const override = ( binding.overrides || [] ).find(
		( item ) =>
			item.property === property &&
			( ! item.breakpoint || item.breakpoint === breakpoint ) &&
			( ! item.state || item.state === state )
	);
	if ( override ) {
		return override.value;
	}
	const reference = roleTokenReferences(
		roles?.[ binding.roleId ],
		binding,
		scope
	)[ property ];
	if ( reference ) {
		const [ category, id ] = reference.split( '.' );
		return (
			designTokens?.[ category ]?.[ id ]?.value ||
			tokenCssValue( reference )
		);
	}
	return styleSet?.mapped?.[ property ];
}

export function rolePreviewStyles(
	document,
	roleId,
	scope,
	bindingOptions = {}
) {
	const roles = roleCatalog( document );
	const recipe = roles[ roleId ];
	if ( ! recipe ) {
		return {};
	}
	const binding = {
		roleId,
		kind: recipe.kind,
		typographyAdjustment: {
			size: bindingOptions.size || 0,
			density: bindingOptions.density || 0,
		},
		spacingAdjustment: { distance: bindingOptions.distance || 0 },
		overrides: [],
		source: recipe.builtIn ? 'built-in' : 'user',
	};
	return Object.fromEntries(
		Object.entries( roleTokenReferences( recipe, binding, scope ) ).map(
			( [ property, reference ] ) => [
				property,
				tokenCssValue( reference ),
			]
		)
	);
}

function roleUsageDetails( document, roleId ) {
	let uses = 0;
	let overriddenElements = 0;
	const elements = [];
	visitBlocks( document.root, ( block ) => {
		let blockUses = false;
		let blockOverrides = false;
		const styleSets = [
			{ styleSet: block.styles },
			...Object.entries( block.responsive_overrides || {} ).map(
				( [ breakpoint, styleSet ] ) => ( { styleSet, breakpoint } )
			),
			...Object.entries( block.states || {} ).map(
				( [ state, styleSet ] ) => ( { styleSet, state } )
			),
		];
		for ( const branch of styleSets ) {
			for ( const [ scope, binding ] of Object.entries(
				branch.styleSet?.role_bindings || {}
			) ) {
				if ( binding.roleId === roleId ) {
					blockUses = true;
					blockOverrides ||= Boolean( binding.overrides?.length );
					elements.push( {
						blockId: block.id,
						tag: block.tag,
						roleId,
						scope,
						...( branch.breakpoint
							? { breakpoint: branch.breakpoint }
							: {} ),
						...( branch.state ? { state: branch.state } : {} ),
						overrides: clone( binding.overrides || [] ),
					} );
				}
			}
		}
		uses += blockUses ? 1 : 0;
		overriddenElements += blockOverrides ? 1 : 0;
	} );
	return { uses, overriddenElements, elements };
}

export function countRoleUsage( document, roleId ) {
	const { uses, overriddenElements } = roleUsageDetails( document, roleId );
	return { uses, overriddenElements };
}

function collectRecipeTokenReferences( value, references = new Set() ) {
	if ( Array.isArray( value ) ) {
		value.forEach( ( item ) =>
			collectRecipeTokenReferences( item, references )
		);
	} else if ( value && typeof value === 'object' ) {
		Object.values( value ).forEach( ( item ) =>
			collectRecipeTokenReferences( item, references )
		);
	} else if (
		typeof value === 'string' &&
		/^(typography|spacing)\.[a-z][a-z0-9-]*$/.test( value )
	) {
		references.add( value );
	}
	return references;
}

function replaceReference( value, fromReference, toReference ) {
	if ( Array.isArray( value ) ) {
		return value.map( ( item ) =>
			replaceReference( item, fromReference, toReference )
		);
	}
	if ( value && typeof value === 'object' ) {
		return Object.fromEntries(
			Object.entries( value ).map( ( [ key, item ] ) => [
				key,
				replaceReference( item, fromReference, toReference ),
			] )
		);
	}
	return value === fromReference ? toReference : value;
}

function referenceUsedByOtherRole( roles, roleId, reference ) {
	return Object.entries( roles ).some(
		( [ id, recipe ] ) =>
			id !== roleId &&
			JSON.stringify( recipe ).includes( `"${ reference }"` )
	);
}

function uniqueTokenId( document, category, preferred ) {
	const base =
		preferred
			.toLowerCase()
			.replace( /[^a-z0-9]+/g, '-' )
			.replace( /^-+|-+$/g, '' )
			.slice( 0, 40 ) || 'guided-role-value';
	let id = base;
	let suffix = 2;
	while ( document.design_tokens?.[ category ]?.[ id ] ) {
		const tail = `-${ suffix++ }`;
		id = `${ base.slice( 0, 40 - tail.length ) }${ tail }`;
	}
	return id;
}

function syncRoleBindingsInDocument( document, roleId ) {
	const roles = roleCatalog( document );
	visitBlocks( document.root, ( block ) => {
		const branches = [
			{ styleSet: block.styles },
			...Object.entries( block.responsive_overrides || {} ).map(
				( [ breakpoint, styleSet ] ) => ( { styleSet, breakpoint } )
			),
			...Object.entries( block.states || {} ).map(
				( [ state, styleSet ] ) => ( { styleSet, state } )
			),
		];
		for ( const branch of branches ) {
			const { styleSet } = branch;
			for ( const [ scope, binding ] of Object.entries(
				styleSet?.role_bindings || {}
			) ) {
				if ( binding.roleId !== roleId ) {
					continue;
				}
				const synced = applyRoleToStyleSet(
					styleSet,
					roleId,
					scope,
					roles,
					{
						source: binding.source,
						overrides: binding.overrides,
						size: binding.typographyAdjustment?.size || 0,
						density: binding.typographyAdjustment?.density || 0,
						distance: binding.spacingAdjustment?.distance || 0,
						breakpoint: branch.breakpoint,
						state: branch.state,
					}
				);
				Object.keys( styleSet ).forEach(
					( key ) => delete styleSet[ key ]
				);
				Object.assign( styleSet, synced );
			}
		}
	} );
	return document;
}

export function updateRolePropertyGlobally(
	document,
	roleId,
	property,
	value,
	{ scope = 'typography', binding } = {}
) {
	const next = clone( document );
	const roles = roleCatalog( next );
	const recipe = roles[ roleId ];
	if ( ! recipe || ! String( value || '' ).trim() ) {
		return next;
	}
	const activeBinding = binding || {
		roleId,
		kind: recipe.kind,
		typographyAdjustment: { size: 0, density: 0 },
		spacingAdjustment: { distance: 0 },
		overrides: [],
		source: recipe.builtIn ? 'built-in' : 'user',
	};
	const reference = roleTokenReferences( recipe, activeBinding, scope )[
		property
	];
	if ( ! reference ) {
		return next;
	}
	const [ category, id ] = reference.split( '.' );
	const current = next.design_tokens?.[ category ]?.[ id ];
	if ( ! current ) {
		return next;
	}
	if ( referenceUsedByOtherRole( roles, roleId, reference ) ) {
		const uniqueId = uniqueTokenId(
			next,
			category,
			`${ roleId }-${ property.replace( /[^a-z0-9]+/gi, '-' ) }`
		);
		const uniqueReference = `${ category }.${ uniqueId }`;
		next.design_tokens[ category ][ uniqueId ] = {
			...clone( current ),
			label: `${ roleLabel( roleId ) } ${ property }`,
			value,
			built_in: false,
		};
		next.style_roles[ roleId ] = replaceReference(
			next.style_roles[ roleId ],
			reference,
			uniqueReference
		);
	} else {
		next.design_tokens[ category ][ id ] = { ...current, value };
	}
	return syncRoleBindingsInDocument( next, roleId );
}

export function restoreBalancedRole( document, roleId ) {
	if ( ! BALANCED_STYLE_ROLES[ roleId ] ) {
		return clone( document );
	}
	const next = clone( document );
	next.style_roles = {
		...( next.style_roles || {} ),
		[ roleId ]: clone( BALANCED_STYLE_ROLES[ roleId ] ),
	};
	return syncRoleBindingsInDocument( next, roleId );
}

export function auditGuidedRoles( document ) {
	return Object.values( roleCatalog( document ) ).map( ( recipe ) => ( {
		id: recipe.id,
		label: ROLE_LABELS[ recipe.id ] || recipe.id,
		description: ROLE_DESCRIPTIONS[ recipe.id ] || '',
		kind: recipe.kind,
		builtIn: Boolean( recipe.builtIn ),
		tokenReferences: [ ...collectRecipeTokenReferences( recipe ) ],
		userModified:
			JSON.stringify( recipe ) !==
			JSON.stringify( BALANCED_STYLE_ROLES[ recipe.id ] ),
		...roleUsageDetails( document, recipe.id ),
	} ) );
}

function parseCssPx( value, referenceWidth = 1280 ) {
	const string = String( value || '' ).trim();
	if ( /^-?\d*\.?\d+px$/i.test( string ) ) {
		return Number.parseFloat( string );
	}
	if ( /^-?\d*\.?\d+rem$/i.test( string ) ) {
		return Number.parseFloat( string ) * 16;
	}
	if ( /^-?\d*\.?\d+em$/i.test( string ) ) {
		return Number.parseFloat( string ) * 16;
	}
	const clamp = /^clamp\(([^,]+),([^,]+),([^,]+)\)$/i.exec( string );
	if ( clamp ) {
		const min = parseCssPx( clamp[ 1 ], referenceWidth );
		const max = parseCssPx( clamp[ 3 ], referenceWidth );
		const preferred = clamp[ 2 ].match(
			/(-?\d*\.?\d+)rem\s*\+\s*(-?\d*\.?\d+)vw/i
		);
		const preferredPx = preferred
			? Number( preferred[ 1 ] ) * 16 +
			  ( Number( preferred[ 2 ] ) * referenceWidth ) / 100
			: max;
		return Math.max( min, Math.min( max, preferredPx ) );
	}
	return Number.NaN;
}

function tokenValue( document, reference ) {
	const [ category, id ] = String( reference || '' ).split( '.' );
	return document.design_tokens?.[ category ]?.[ id ]?.value;
}

function roleSizePx( document, roleId, referenceWidth ) {
	const reference =
		roleCatalog( document )?.[ roleId ]?.propertyTokenRefs?.[ 'font-size' ];
	return parseCssPx( tokenValue( document, reference ), referenceWidth );
}

function spacingRolePx( document, roleId, referenceWidth ) {
	const reference =
		roleCatalog( document )?.[ roleId ]?.variants?.default?.value;
	return parseCssPx( tokenValue( document, reference ), referenceWidth );
}

function setImportedOverride( styleSet, scope, property, value, reviewId ) {
	const binding = styleSet.role_bindings?.[ scope ];
	if ( ! binding ) {
		return;
	}
	binding.overrides = [
		...( binding.overrides || [] ).filter(
			( item ) => item.property !== property
		),
		{ property, value },
	];
	styleSet.mapped[ property ] = value;
	styleSet.import_review_flags = [
		...( styleSet.import_review_flags || [] ),
		{
			id: reviewId,
			property,
			roleId: binding.roleId,
			message: 'Deliberate imported difference kept as a local override.',
		},
	];
}

export function normalizeImportedStyles(
	importedDocument,
	targetDesignSystem,
	options = {}
) {
	const referenceWidth = options.referenceWidth || 1280;
	const mergedDesignTokens = clone( targetDesignSystem?.design_tokens || {} );
	for ( const [ category, tokens ] of Object.entries(
		importedDocument.design_tokens || {}
	) ) {
		mergedDesignTokens[ category ] = {
			...( mergedDesignTokens[ category ] || {} ),
			...clone( tokens ),
		};
	}
	const document = ensureGuidedRoleDesignSystem(
		{
			...clone( importedDocument ),
			...( Object.keys( mergedDesignTokens ).length
				? { design_tokens: mergedDesignTokens }
				: {} ),
			...( targetDesignSystem?.style_roles
				? { style_roles: clone( targetDesignSystem.style_roles ) }
				: {} ),
		},
		{ newDocument: true }
	);
	const summary = {
		mappedElements: 0,
		normalizedGroups: [],
		retainedOverrides: 0,
		flags: [],
	};
	const roles = roleCatalog( document );
	const repeatedCardHeadings = [];
	const repeatedCardContainers = [];

	visitBlocks( document.root, ( block, parent ) => {
		const context = deriveRoleContext( document, block.id, 'font-size' );
		if ( context?.isHeading && context.isRepeated ) {
			repeatedCardHeadings.push( block );
		}
		if (
			parent &&
			structuralSiblings( parent ).length >= 3 &&
			isCardLike( block )
		) {
			repeatedCardContainers.push( block );
		}
	} );

	for ( const block of repeatedCardHeadings ) {
		const value = parseCssPx(
			block.styles?.mapped?.[ 'font-size' ],
			referenceWidth
		);
		const target = roleSizePx(
			document,
			'type.card-heading',
			referenceWidth
		);
		if (
			Number.isFinite( value ) &&
			Math.abs( value - target ) / target <= 0.2
		) {
			block.styles = applyRoleToStyleSet(
				block.styles,
				'type.card-heading',
				'typography',
				roles,
				{ source: 'imported' }
			);
			summary.mappedElements += 1;
		}
	}
	if ( repeatedCardHeadings.length >= 3 ) {
		summary.normalizedGroups.push( {
			count: repeatedCardHeadings.length,
			roleId: 'type.card-heading',
			label: 'repeated card headings',
		} );
	}

	for ( const block of repeatedCardContainers ) {
		const value = parseCssPx(
			block.styles?.mapped?.padding,
			referenceWidth
		);
		const target = spacingRolePx(
			document,
			'space.card-standard',
			referenceWidth
		);
		if (
			Number.isFinite( value ) &&
			Math.abs( value - target ) / target <= 0.2
		) {
			block.styles = applyRoleToStyleSet(
				block.styles,
				'space.card-standard',
				'padding',
				roles,
				{ source: 'imported' }
			);
			summary.mappedElements += 1;
		}
	}
	if ( repeatedCardContainers.length >= 3 ) {
		summary.normalizedGroups.push( {
			count: repeatedCardContainers.length,
			roleId: 'space.card-standard',
			label: 'repeated card paddings',
		} );
	}

	visitBlocks( document.root, ( block ) => {
		if (
			! isTextualBlock( block ) ||
			block.styles?.role_bindings?.typography
		) {
			return;
		}
		const raw = block.styles?.mapped?.[ 'font-size' ];
		const importedPx = parseCssPx( raw, referenceWidth );
		if ( ! Number.isFinite( importedPx ) ) {
			return;
		}
		const candidates = recommendStyleRoles( document, block.id, {
			property: 'font-size',
		} );
		let best = null;
		for ( const candidate of candidates ) {
			const targetPx = roleSizePx(
				document,
				candidate.roleId,
				referenceWidth
			);
			if ( ! Number.isFinite( targetPx ) ) {
				continue;
			}
			const sizeDistance = Math.abs( importedPx - targetPx ) / targetPx;
			const structuralPenalty =
				candidate.rank === 1 ? 0 : 0.3 * ( candidate.rank - 1 );
			const score = sizeDistance * 0.7 + structuralPenalty;
			if ( ! best || score < best.score ) {
				best = { ...candidate, score, sizeDistance };
			}
		}
		const selected = best || candidates[ 0 ];
		if ( ! selected ) {
			return;
		}
		block.styles = applyRoleToStyleSet(
			block.styles,
			selected.roleId,
			'typography',
			roles,
			{ source: 'imported' }
		);
		if ( selected.score <= ( options.typographyThreshold || 0.24 ) ) {
			summary.mappedElements += 1;
			return;
		}
		const flagId = `import-${ block.id }-font-size`;
		setImportedOverride(
			block.styles,
			'typography',
			'font-size',
			raw,
			flagId
		);
		summary.retainedOverrides += 1;
		summary.flags.push( {
			id: flagId,
			blockId: block.id,
			property: 'font-size',
			roleId: selected.roleId,
			actions: [ 'use_site_role', 'keep_imported_difference' ],
		} );
	} );

	return { document, summary };
}

export function evaluateRoleFit( {
	roleId,
	text = '',
	containerWidth = 720,
	breakpoint = 'desktop',
	fontSizePx = 16,
	lineHeight = 1.2,
	fixedHeight,
	scrollWidth,
} ) {
	const averageGlyphWidth = fontSizePx * 0.54;
	const estimatedWidth = Math.max(
		averageGlyphWidth,
		text.length * averageGlyphWidth
	);
	const lineCount = Math.max(
		1,
		Math.ceil( estimatedWidth / Math.max( 1, containerWidth ) )
	);
	let threshold = Number.POSITIVE_INFINITY;
	if ( roleId === 'type.page-title' ) {
		threshold = breakpoint === 'mobile' ? 3 : 2;
	} else if (
		roleId === 'type.section-heading' ||
		roleId === 'type.card-heading'
	) {
		threshold = 3;
	}
	const horizontalOverflow = Number.isFinite( scrollWidth )
		? scrollWidth > containerWidth + 1
		: false;
	const clipping = Number.isFinite( fixedHeight )
		? lineCount * fontSizePx * lineHeight > fixedHeight + 1
		: false;
	const severeWordOverflow = String( text )
		.split( /\s+/ )
		.some( ( word ) => word.length * averageGlyphWidth > containerWidth );
	let status = 'safe';
	if ( horizontalOverflow || clipping || severeWordOverflow ) {
		status = 'unsafe';
	} else if ( lineCount > threshold ) {
		status = 'warning';
	}
	return {
		status,
		lineCount,
		horizontalOverflow,
		clipping,
		severeWordOverflow,
		threshold,
	};
}

export function diagnoseGuidedStyles( document, blockId, options = {} ) {
	const found = findBlockWithContext( document, blockId );
	if ( ! found ) {
		return [];
	}
	const issues = [];
	for ( const [ scope, binding ] of Object.entries(
		found.block.styles?.role_bindings || {}
	) ) {
		if ( ! roleCatalog( document )[ binding.roleId ] ) {
			issues.push( {
				id: 'missing-role',
				severity: 'warning',
				scope,
				message:
					'This element references a role that is not available in the site.',
				action: 'Keep the current appearance or choose a site role.',
			} );
			continue;
		}
		if ( binding.overrides?.length ) {
			issues.push( {
				id: 'detached-styling',
				severity: 'info',
				scope,
				roleId: binding.roleId,
				property: binding.overrides[ 0 ].property,
				message: `${ binding.overrides.length } local override${
					binding.overrides.length === 1 ? '' : 's'
				} differ from ${
					ROLE_LABELS[ binding.roleId ] || binding.roleId
				}.`,
				action: `Rejoin ${
					ROLE_LABELS[ binding.roleId ] || binding.roleId
				}`,
				fix: 'rejoin',
			} );
		}
		const property = binding.kind === 'typography' ? 'font-size' : scope;
		const recommended = recommendStyleRoles( document, blockId, {
			property,
		} )[ 0 ];
		if ( recommended && recommended.roleId !== binding.roleId ) {
			issues.push( {
				id: 'role-mismatch',
				severity: 'info',
				scope,
				roleId: binding.roleId,
				message: `${
					ROLE_LABELS[ binding.roleId ] || binding.roleId
				} is unusual in this context.`,
				action: `Review ${
					ROLE_LABELS[ recommended.roleId ] || recommended.roleId
				}`,
			} );
		}
	}
	if ( options.fit?.status && options.fit.status !== 'safe' ) {
		issues.push( {
			id:
				options.fit.status === 'unsafe'
					? 'overflow-or-clipping'
					: 'heading-wrap',
			severity: options.fit.status,
			breakpoint: options.breakpoint || 'desktop',
			message:
				options.fit.status === 'unsafe'
					? 'Text clips or overflows at this breakpoint.'
					: `This heading wraps to ${ options.fit.lineCount } lines.`,
			action: 'Use the next smaller approved variant.',
			fix: 'smaller',
		} );
	}
	return issues;
}

export function sanitizeGuidedRoleTelemetry( eventName, payload = {} ) {
	if ( ! GUIDED_ROLE_EVENTS.has( eventName ) ) {
		return null;
	}
	return {
		event: eventName,
		payload: Object.fromEntries(
			Object.entries( payload )
				.filter(
					( [ key, value ] ) =>
						GUIDED_ROLE_TELEMETRY_KEYS.has( key ) &&
						[ 'string', 'number', 'boolean' ].includes(
							typeof value
						)
				)
				.map( ( [ key, value ] ) => [ key, value ] )
		),
	};
}

export function semanticDetentFromPointerDelta( delta, threshold = 12 ) {
	if ( delta <= -threshold ) {
		return -1;
	}
	if ( delta >= threshold ) {
		return 1;
	}
	return 0;
}

export function roleLabel( roleId ) {
	return ROLE_LABELS[ roleId ] || roleId;
}

export function roleDescription( roleId ) {
	return ROLE_DESCRIPTIONS[ roleId ] || '';
}
