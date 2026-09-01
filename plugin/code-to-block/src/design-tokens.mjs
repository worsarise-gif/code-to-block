export const TOKEN_CATEGORIES = [
	{ id: 'colors', label: 'Colors' },
	{ id: 'typography', label: 'Typography' },
	{ id: 'spacing', label: 'Spacing' },
];

export const TOKEN_PROPERTIES = {
	colors: [ 'color' ],
	typography: [
		'font-family',
		'font-size',
		'font-weight',
		'line-height',
		'letter-spacing',
	],
	spacing: [
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
		'border-radius',
	],
};

const TOKEN_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
const TOKEN_REFERENCE_PATTERN =
	/^(colors|typography|spacing)\.([a-z][a-z0-9-]{0,39})$/;

export function tokenIdFromLabel( label ) {
	return String( label )
		.trim()
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-+|-+$/g, '' )
		.slice( 0, 40 )
		.replace( /-+$/g, '' );
}

export function tokenIdIsValid( id ) {
	return TOKEN_ID_PATTERN.test( id );
}

export function tokenReference( category, id ) {
	return `${ category }.${ id }`;
}

export function parseTokenReference( reference ) {
	const match = TOKEN_REFERENCE_PATTERN.exec( String( reference ) );
	return match ? { category: match[ 1 ], id: match[ 2 ] } : null;
}

export function tokenCssName( reference ) {
	const parsed = parseTokenReference( reference );
	return parsed ? `--ctb-token-${ parsed.category }-${ parsed.id }` : '';
}

export function tokenCssValue( reference ) {
	const name = tokenCssName( reference );
	return name ? `var(${ name })` : '';
}

export function getDesignToken( designTokens, reference ) {
	const parsed = parseTokenReference( reference );
	return parsed
		? designTokens?.[ parsed.category ]?.[ parsed.id ] || null
		: null;
}

export function tokensForProperty( designTokens, property ) {
	const category = TOKEN_CATEGORIES.find( ( item ) =>
		TOKEN_PROPERTIES[ item.id ].includes( property )
	)?.id;
	if ( ! category ) {
		return [];
	}
	return Object.entries( designTokens?.[ category ] || {} ).map(
		( [ id, token ] ) => ( {
			...token,
			category,
			id,
			reference: tokenReference( category, id ),
		} )
	);
}

export function effectiveTokenBindings( block, breakpoint ) {
	const bindings = { ...( block.styles.token_bindings || {} ) };
	if ( breakpoint === 'tablet' || breakpoint === 'mobile' ) {
		Object.assign(
			bindings,
			block.responsive_overrides?.tablet?.token_bindings || {}
		);
	}
	if ( breakpoint === 'mobile' ) {
		Object.assign(
			bindings,
			block.responsive_overrides?.mobile?.token_bindings || {}
		);
	}
	return bindings;
}

export function styleSetHasTokenOverride( styleSet, property ) {
	const reference = styleSet.token_bindings?.[ property ];
	return Boolean(
		reference &&
			styleSet.mapped?.[ property ] !== tokenCssValue( reference )
	);
}

export function blockHasTokenOverride( block ) {
	const styleSets = [
		block.styles,
		...Object.values( block.responsive_overrides || {} ),
		...Object.values( block.states || {} ),
	];
	return styleSets.some( ( styleSet ) =>
		Object.keys( styleSet.token_bindings || {} ).some( ( property ) =>
			styleSetHasTokenOverride( styleSet, property )
		)
	);
}

export function countTokenConsumers( document, reference ) {
	let count = 0;
	function visit( block ) {
		const styleSets = [
			block.styles,
			...Object.values( block.responsive_overrides || {} ),
			...Object.values( block.states || {} ),
		];
		for ( const styleSet of styleSets ) {
			count += Object.values( styleSet.token_bindings || {} ).filter(
				( binding ) => binding === reference
			).length;
		}
		for ( const child of block.children ) {
			if ( child.kind !== 'text' ) {
				visit( child );
			}
		}
	}
	visit( document.root );
	return count;
}

export function designTokenDeclarations( designTokens ) {
	const declarations = [];
	for ( const category of TOKEN_CATEGORIES ) {
		for ( const [ id, token ] of Object.entries(
			designTokens?.[ category.id ] || {}
		) ) {
			declarations.push(
				`${ tokenCssName( tokenReference( category.id, id ) ) }:${
					token.value
				};`
			);
		}
	}
	return declarations.join( '' );
}
