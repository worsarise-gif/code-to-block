function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function isBlock( value ) {
	return Boolean( value && typeof value === 'object' && ! value.kind );
}

function uniqueId( base, used, maxLength = 500 ) {
	base = base.slice( 0, maxLength );
	let id = base;
	let suffix = 2;
	while ( used.has( id ) ) {
		const tail = `-${ suffix++ }`;
		id = `${ base.slice( 0, maxLength - tail.length ) }${ tail }`;
	}
	used.add( id );
	return id;
}

function collectUsedIds( block, blockIds, domIds ) {
	blockIds.add( block.id );
	if ( typeof block.attributes?.id === 'string' ) {
		domIds.add( block.attributes.id );
	}
	for ( const child of block.children || [] ) {
		if ( isBlock( child ) ) {
			collectUsedIds( child, blockIds, domIds );
		}
	}
}

function mapCloneIds(
	block,
	prefix,
	idMap,
	domIdMap,
	counters,
	usedBlockIds,
	usedDomIds
) {
	const oldId = block.id;
	counters.block += 1;
	const base = `${ prefix }-${ counters.block }`;
	block.id = uniqueId( base, usedBlockIds );
	idMap[ oldId ] = block.id;
	if ( typeof block.attributes?.id === 'string' ) {
		const oldDomId = block.attributes.id;
		counters.dom += 1;
		block.attributes.id = uniqueId(
			`${ base }-dom-${ counters.dom }`,
			usedDomIds
		);
		domIdMap[ oldDomId ] = block.attributes.id;
	}
	for ( const child of block.children ) {
		if ( isBlock( child ) ) {
			mapCloneIds(
				child,
				prefix,
				idMap,
				domIdMap,
				counters,
				usedBlockIds,
				usedDomIds
			);
		}
	}
}

function rewriteDomReferences( block, domIdMap ) {
	const idReferenceAttributes = [
		'for',
		'headers',
		'aria-labelledby',
		'aria-describedby',
		'aria-controls',
		'aria-owns',
		'aria-flowto',
		'aria-details',
		'aria-errormessage',
		'aria-activedescendant',
	];
	for ( const name of idReferenceAttributes ) {
		if ( typeof block.attributes?.[ name ] !== 'string' ) {
			continue;
		}
		block.attributes[ name ] = block.attributes[ name ]
			.trim()
			.split( /\s+/ )
			.map( ( id ) => domIdMap[ id ] || id )
			.join( ' ' );
	}
	if ( typeof block.attributes?.href === 'string' ) {
		const id = block.attributes.href.startsWith( '#' )
			? block.attributes.href.slice( 1 )
			: '';
		if ( id && domIdMap[ id ] ) {
			block.attributes.href = `#${ domIdMap[ id ] }`;
		}
	}
}

function rewriteClone( block, idMap, domIdMap ) {
	for ( const action of block.actions || [] ) {
		const target = action.params?.target_block_id;
		if ( target && idMap[ target ] ) {
			action.params.target_block_id = idMap[ target ];
		}
	}
	rewriteDomReferences( block, domIdMap );
	for ( const child of block.children ) {
		if ( isBlock( child ) ) {
			rewriteClone( child, idMap, domIdMap );
		}
	}
}

function componentMetrics( block ) {
	let blocks = 1;
	let depth = 1;
	for ( const child of block.children ) {
		if ( isBlock( child ) ) {
			const childMetrics = componentMetrics( child );
			blocks += childMetrics.blocks;
			depth = Math.max( depth, childMetrics.depth + 1 );
		}
	}
	return { blocks, depth };
}

function jsonBytes( value ) {
	return new TextEncoder().encode( JSON.stringify( value ) ).length;
}

const MAX_BLOCKS = 1000;
const MAX_DEPTH = 50;
const MAX_JSON_BYTES = 2097152;

export const STARTER_TEMPLATES = [
	{
		id: 'starter-hero',
		label: 'Hero landing',
		description: 'Full hero with headline, intro and CTA',
		document: {
			schema_version: 1,
			name: 'Hero landing',
			root: {
				id: 'starter-hero-root',
				type: 'container',
				tag: 'section',
				attributes: { class: 'starter-hero' },
				children: [
					{
						id: 'starter-hero-content',
						type: 'container',
						tag: 'div',
						attributes: { class: 'starter-hero-content' },
						children: [
							{
								id: 'starter-hero-eyebrow',
								type: 'text',
								tag: 'p',
								attributes: { class: 'starter-eyebrow' },
								children: [
									{ kind: 'text', value: 'Build faster' },
								],
								styles: {
									mapped: {
										color: '#a5f3fc',
										'font-size': '14px',
										'font-weight': '700',
										'letter-spacing': '0.12em',
										margin: '0 0 12px',
										'text-align': 'center',
										'text-transform': 'uppercase',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-hero-heading',
								type: 'text',
								tag: 'h1',
								attributes: {},
								children: [
									{
										kind: 'text',
										value: 'Launch your next idea',
									},
								],
								styles: {
									mapped: {
										color: 'white',
										'font-size': '56px',
										'line-height': '1.05',
										margin: '0',
										'text-align': 'center',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-hero-intro',
								type: 'text',
								tag: 'p',
								attributes: { class: 'starter-intro' },
								children: [
									{
										kind: 'text',
										value: 'A focused toolkit for modern product teams.',
									},
								],
								styles: {
									mapped: {
										color: 'white',
										'font-size': '20px',
										'line-height': '1.6',
										margin: '20px auto 0',
										'max-width': '560px',
										'text-align': 'center',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-hero-cta',
								type: 'button',
								tag: 'a',
								attributes: {
									class: 'starter-cta',
									href: '#start',
								},
								children: [
									{ kind: 'text', value: 'Start building' },
								],
								styles: {
									mapped: {
										background: '#6558d3',
										'border-radius': '999px',
										color: '#ffffff',
										display: 'inline-block',
										margin: '28px auto 0',
										padding: '14px 28px',
										'text-align': 'center',
										'text-decoration': 'none',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
						],
						styles: {
							mapped: {
								color: 'white',
								'max-width': '720px',
								'text-align': 'center',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
				],
				styles: {
					mapped: {
						'background-image':
							'linear-gradient(rgba(10, 18, 35, 0.72), rgba(10, 18, 35, 0.72)), url("hero.jpg")',
						'background-position': 'center',
						'background-size': 'cover',
						color: 'white',
						display: 'grid',
						'min-height': '520px',
						padding: '48px 24px',
						'place-items': 'center',
						'text-align': 'center',
					},
					custom_css_fallback: '',
				},
				meta: { source: 'starter-template' },
			},
		},
	},
	{
		id: 'starter-pricing',
		label: 'Pricing card',
		description: 'Single pricing card with features and CTA',
		document: {
			schema_version: 1,
			name: 'Pricing starter',
			root: {
				id: 'starter-pricing-root',
				type: 'container',
				tag: 'article',
				attributes: { class: 'starter-pricing' },
				children: [
					{
						id: 'starter-pricing-plan',
						type: 'text',
						tag: 'h2',
						attributes: {},
						children: [ { kind: 'text', value: 'Professional' } ],
						styles: {
							mapped: {
								color: '#253047',
								'font-size': '22px',
								margin: '0 0 12px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
					{
						id: 'starter-pricing-price',
						type: 'text',
						tag: 'p',
						attributes: { class: 'starter-price' },
						children: [
							{
								id: 'starter-pricing-value',
								type: 'text',
								tag: 'span',
								attributes: {},
								children: [ { kind: 'text', value: '$29' } ],
								styles: {
									mapped: {
										color: '#111827',
										'font-size': '42px',
										'font-weight': '700',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{ kind: 'text', value: '/month' },
						],
						styles: {
							mapped: {
								color: '#667085',
								margin: '0 0 24px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
					{
						id: 'starter-pricing-features',
						type: 'container',
						tag: 'ul',
						attributes: {},
						children: [
							{
								id: 'starter-pricing-feature-1',
								type: 'text',
								tag: 'li',
								attributes: {},
								children: [
									{
										kind: 'text',
										value: 'Unlimited projects',
									},
								],
								styles: {
									mapped: {
										color: '#253047',
										'line-height': '1.8',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-pricing-feature-2',
								type: 'text',
								tag: 'li',
								attributes: {},
								children: [
									{ kind: 'text', value: 'Priority support' },
								],
								styles: {
									mapped: {
										color: '#253047',
										'line-height': '1.8',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-pricing-feature-3',
								type: 'text',
								tag: 'li',
								attributes: {},
								children: [
									{
										kind: 'text',
										value: 'Team collaboration',
									},
								],
								styles: {
									mapped: {
										color: '#253047',
										'line-height': '1.8',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
						],
						styles: {
							mapped: {
								'line-height': '1.8',
								margin: '0 0 28px',
								'padding-left': '20px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
					{
						id: 'starter-pricing-cta',
						type: 'button',
						tag: 'a',
						attributes: { class: 'starter-cta', href: '#signup' },
						children: [
							{ kind: 'text', value: 'Start free trial' },
						],
						styles: {
							mapped: {
								background: '#5b5bd6',
								'border-radius': '8px',
								color: '#ffffff',
								display: 'block',
								padding: '12px 18px',
								'text-align': 'center',
								'text-decoration': 'none',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
				],
				styles: {
					mapped: {
						background: '#ffffff',
						border: '1px solid #d7dce5',
						'border-radius': '16px',
						'box-shadow': '0 16px 40px rgba(30, 41, 59, 0.14)',
						'max-width': '360px',
						padding: '32px',
					},
					custom_css_fallback: '',
				},
				meta: { source: 'starter-template' },
			},
		},
	},
	{
		id: 'starter-testimonial',
		label: 'Testimonial',
		description: 'Quote card with avatar and caption',
		document: {
			schema_version: 1,
			name: 'Testimonial starter',
			root: {
				id: 'starter-testimonial-root',
				type: 'container',
				tag: 'figure',
				attributes: { class: 'starter-testimonial' },
				children: [
					{
						id: 'starter-testimonial-avatar',
						type: 'image',
						tag: 'img',
						attributes: {
							alt: 'Portrait of Maya Chen',
							src: 'avatar.jpg',
						},
						children: [],
						styles: {
							mapped: {
								'border-radius': '50%',
								height: '64px',
								'object-fit': 'cover',
								width: '64px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
					{
						id: 'starter-testimonial-quote',
						type: 'text',
						tag: 'blockquote',
						attributes: {},
						children: [
							{
								kind: 'text',
								value: '“The team shipped in days, not weeks.”',
							},
						],
						styles: {
							mapped: {
								color: '#18181b',
								'font-size': '24px',
								'line-height': '1.45',
								margin: '20px 0',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
					{
						id: 'starter-testimonial-caption',
						type: 'container',
						tag: 'figcaption',
						attributes: {},
						children: [
							{
								id: 'starter-testimonial-name',
								type: 'text',
								tag: 'strong',
								attributes: {},
								children: [
									{ kind: 'text', value: 'Maya Chen' },
								],
								styles: {
									mapped: {
										color: '#3f3f46',
										'font-size': '15px',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-testimonial-role',
								type: 'text',
								tag: 'span',
								attributes: {},
								children: [
									{ kind: 'text', value: 'Product Lead' },
								],
								styles: {
									mapped: {
										color: '#71717a',
										'font-size': '13px',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
						],
						styles: {
							mapped: {
								display: 'flex',
								'flex-direction': 'column',
								gap: '4px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
				],
				styles: {
					mapped: {
						background: '#fffbeb',
						'border-left': '4px solid #f59e0b',
						'border-radius': '12px',
						'max-width': '520px',
						padding: '28px',
					},
					custom_css_fallback: '',
				},
				meta: { source: 'starter-template' },
			},
		},
	},
	{
		id: 'starter-footer',
		label: 'Footer columns',
		description: 'Three-column footer with links',
		document: {
			schema_version: 1,
			name: 'Footer starter',
			root: {
				id: 'starter-footer-root',
				type: 'container',
				tag: 'footer',
				attributes: { class: 'starter-footer' },
				children: [
					{
						id: 'starter-footer-col-1',
						type: 'container',
						tag: 'div',
						attributes: {},
						children: [
							{
								id: 'starter-footer-h1',
								type: 'text',
								tag: 'h2',
								attributes: {},
								children: [
									{ kind: 'text', value: 'Product' },
								],
								styles: {
									mapped: {
										color: '#ffffff',
										'font-size': '14px',
										'letter-spacing': '0.08em',
										margin: '0 0 8px',
										'text-transform': 'uppercase',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-footer-link-1',
								type: 'text',
								tag: 'a',
								attributes: { href: '#' },
								children: [
									{ kind: 'text', value: 'Features' },
								],
								styles: {
									mapped: {
										color: '#d1d5db',
										'font-size': '14px',
										'text-decoration': 'none',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-footer-link-2',
								type: 'text',
								tag: 'a',
								attributes: { href: '#' },
								children: [
									{ kind: 'text', value: 'Pricing' },
								],
								styles: {
									mapped: {
										color: '#d1d5db',
										'font-size': '14px',
										'text-decoration': 'none',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
						],
						styles: {
							mapped: {
								display: 'flex',
								'flex-direction': 'column',
								gap: '10px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
					{
						id: 'starter-footer-col-2',
						type: 'container',
						tag: 'div',
						attributes: {},
						children: [
							{
								id: 'starter-footer-h2',
								type: 'text',
								tag: 'h2',
								attributes: {},
								children: [
									{ kind: 'text', value: 'Company' },
								],
								styles: {
									mapped: {
										color: '#ffffff',
										'font-size': '14px',
										'letter-spacing': '0.08em',
										margin: '0 0 8px',
										'text-transform': 'uppercase',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-footer-link-3',
								type: 'text',
								tag: 'a',
								attributes: { href: '#' },
								children: [ { kind: 'text', value: 'About' } ],
								styles: {
									mapped: {
										color: '#d1d5db',
										'font-size': '14px',
										'text-decoration': 'none',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-footer-link-4',
								type: 'text',
								tag: 'a',
								attributes: { href: '#' },
								children: [
									{ kind: 'text', value: 'Careers' },
								],
								styles: {
									mapped: {
										color: '#d1d5db',
										'font-size': '14px',
										'text-decoration': 'none',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
						],
						styles: {
							mapped: {
								display: 'flex',
								'flex-direction': 'column',
								gap: '10px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
					{
						id: 'starter-footer-col-3',
						type: 'container',
						tag: 'div',
						attributes: {},
						children: [
							{
								id: 'starter-footer-h3',
								type: 'text',
								tag: 'h2',
								attributes: {},
								children: [
									{ kind: 'text', value: 'Resources' },
								],
								styles: {
									mapped: {
										color: '#ffffff',
										'font-size': '14px',
										'letter-spacing': '0.08em',
										margin: '0 0 8px',
										'text-transform': 'uppercase',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-footer-link-5',
								type: 'text',
								tag: 'a',
								attributes: { href: '#' },
								children: [ { kind: 'text', value: 'Guides' } ],
								styles: {
									mapped: {
										color: '#d1d5db',
										'font-size': '14px',
										'text-decoration': 'none',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
							{
								id: 'starter-footer-link-6',
								type: 'text',
								tag: 'a',
								attributes: { href: '#' },
								children: [
									{ kind: 'text', value: 'Support' },
								],
								styles: {
									mapped: {
										color: '#d1d5db',
										'font-size': '14px',
										'text-decoration': 'none',
									},
									custom_css_fallback: '',
								},
								meta: { source: 'starter-template' },
							},
						],
						styles: {
							mapped: {
								display: 'flex',
								'flex-direction': 'column',
								gap: '10px',
							},
							custom_css_fallback: '',
						},
						meta: { source: 'starter-template' },
					},
				],
				styles: {
					mapped: {
						background: '#111827',
						display: 'grid',
						gap: '48px',
						'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
						padding: '48px',
					},
					custom_css_fallback: '',
				},
				meta: { source: 'starter-template' },
			},
		},
	},
];

export function getStarterTemplate( id ) {
	return STARTER_TEMPLATES.find( ( template ) => template.id === id ) || null;
}

function cloneWithFreshIds( root, prefix, usedBlockIds, usedDomIds ) {
	const cloned = clone( root );
	const idMap = Object.create( null );
	const domIdMap = Object.create( null );
	mapCloneIds(
		cloned,
		prefix,
		idMap,
		domIdMap,
		{ block: 0, dom: 0 },
		usedBlockIds,
		usedDomIds
	);
	rewriteClone( cloned, idMap, domIdMap );
	return cloned;
}

export function prepareStarterDocument( templateId ) {
	const template = getStarterTemplate( templateId );
	if ( ! template ) {
		throw new Error( 'Starter template not found.' );
	}
	const prefix = `starter-${ template.id }`;
	const usedBlockIds = new Set();
	const usedDomIds = new Set();
	const root = cloneWithFreshIds(
		template.document.root,
		prefix,
		usedBlockIds,
		usedDomIds
	);
	const document = {
		schema_version: template.document.schema_version,
		name: template.document.name,
		root,
	};
	if ( template.document.design_tokens ) {
		document.design_tokens = clone( template.document.design_tokens );
	}
	return document;
}

function findBlock( block, id ) {
	if ( block.id === id ) {
		return block;
	}
	for ( const child of block.children || [] ) {
		if ( isBlock( child ) ) {
			const match = findBlock( child, id );
			if ( match ) {
				return match;
			}
		}
	}
	return null;
}

function insertAfter( block, targetId, inserted ) {
	for ( let index = 0; index < block.children.length; index++ ) {
		const child = block.children[ index ];
		if ( ! isBlock( child ) ) {
			continue;
		}
		if ( child.id === targetId ) {
			block.children.splice( index + 1, 0, inserted );
			return true;
		}
		if ( insertAfter( child, targetId, inserted ) ) {
			return true;
		}
	}
	return false;
}

export function insertStarter( document, targetId, templateId ) {
	const template = getStarterTemplate( templateId );
	if ( ! template ) {
		throw new Error( 'Starter template not found.' );
	}
	const next = clone( document );
	const target = findBlock( next.root, targetId );
	if ( ! target ) {
		throw new Error( 'The selected insertion target no longer exists.' );
	}
	const usedBlockIds = new Set();
	const usedDomIds = new Set();
	collectUsedIds( next.root, usedBlockIds, usedDomIds );
	const metrics = componentMetrics( template.document.root );
	const existingMetrics = componentMetrics( next.root );
	if ( existingMetrics.blocks + metrics.blocks > MAX_BLOCKS ) {
		throw new Error(
			'Starter template would exceed the 1000 block limit.'
		);
	}
	if ( existingMetrics.depth + metrics.depth > MAX_DEPTH ) {
		throw new Error(
			'Starter template would exceed the 50 level depth limit.'
		);
	}
	const templateBytes = jsonBytes( template.document );
	const nextBytes = jsonBytes( next );
	if ( nextBytes + templateBytes > MAX_JSON_BYTES ) {
		throw new Error(
			'Starter template would exceed the 2 MB document limit.'
		);
	}
	const prefix = `starter-${ template.id }`;
	const clonedRoot = cloneWithFreshIds(
		template.document.root,
		prefix,
		usedBlockIds,
		usedDomIds
	);
	const inserted = insertAfter( next.root, targetId, clonedRoot );
	if ( ! inserted ) {
		// If target is root itself, append as child.
		if ( next.root.id === targetId ) {
			next.root.children.push( clonedRoot );
			return next;
		}
		throw new Error(
			'The starter template cannot be inserted at this position.'
		);
	}
	return next;
}
