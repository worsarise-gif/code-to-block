function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function previewTextBlock( ownerId, message ) {
	return {
		id: `${ ownerId }-preview-message`,
		type: 'text',
		tag: 'p',
		attributes: { class: 'ctb-commerce-preview-message' },
		children: [ { kind: 'text', value: message } ],
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: {
			source: 'commerce-preview',
			commerce_preview_owner_id: ownerId,
		},
	};
}

function previewHtmlBlock( ownerId, suffix, html ) {
	return {
		id: `${ ownerId }-preview-${ suffix }`,
		type: 'container',
		tag: 'div',
		attributes: {
			class: `ctb-commerce-preview-${ suffix }`,
			dangerouslySetInnerHTML: { __html: html },
		},
		children: [],
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: {
			source: 'commerce-preview',
			commerce_preview_owner_id: ownerId,
		},
	};
}

function applyProduct( block, product ) {
	if ( block.is_dynamic ) {
		switch ( block.dynamic_source ) {
			case 'wc_product_title':
				block.children = [ { kind: 'text', value: product.name } ];
				break;
			case 'wc_product_price':
				block.children = [
					{ kind: 'text', value: product.price_text },
				];
				break;
			case 'wc_product_short_description':
				block.children = [
					{ kind: 'text', value: product.short_description_text },
				];
				break;
			case 'wc_product_stock_status':
				block.children = [
					{ kind: 'text', value: product.stock_text },
				];
				break;
			case 'wc_product_image':
				block.attributes = {
					...block.attributes,
					src: product.image.url,
					srcset: product.image.srcset,
					alt: product.image.alt,
				};
				break;
			default:
				if ( block.dynamic_source.startsWith( 'wc_custom_field_' ) ) {
					const key = block.dynamic_source.substring(
						'wc_custom_field_'.length
					);
					const field = ( product.custom_fields || [] ).find(
						( f ) => f.key === key
					);
					block.children = [
						{ kind: 'text', value: field ? field.value : '' },
					];
				}
				break;
		}
	}
	for ( const child of block.children || [] ) {
		if ( child.kind !== 'text' ) {
			applyProduct( child, product );
		}
	}
}

function markGridPreview( block, ownerId, productId ) {
	const sourceId = block.id;
	block.id = `${ sourceId }-preview-${ productId }`;
	block.meta = {
		...block.meta,
		commerce_preview_owner_id: ownerId,
		commerce_preview_source_id: sourceId,
	};
	for ( const child of block.children || [] ) {
		if ( child.kind !== 'text' ) {
			markGridPreview( child, ownerId, productId );
		}
	}
}

function skeletonBlock( type ) {
	return {
		id: `skeleton-${ Math.random().toString( 36 ).substr( 2, 9 ) }`,
		type: 'skeleton',
		attributes: { 'data-skeleton-type': type },
		children: [],
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: { source: 'commerce-preview' },
	};
}

function materializeBlock(
	block,
	productsById,
	products,
	cartHtml = '',
	checkoutHtml = '',
	isLoading = false,
	contextPostId = 0
) {
	if ( block.type === 'woocommerce_product' ) {
		if ( isLoading ) {
			block.children = [
				skeletonBlock( 'image' ),
				skeletonBlock( 'text' ),
				skeletonBlock( 'link' ),
			];
			return;
		}
		let productId = Number( block.attributes?.[ 'data-product-id' ] || 0 );
		if ( ! productId ) {
			productId = contextPostId;
		}
		const product = productsById.get( productId );
		if ( product ) {
			applyProduct( block, product );
			if (
				block.attributes?.[ 'data-show-variations' ] === 'true' &&
				product.variation_selector_html
			) {
				block.children = [
					...( block.children || [] ),
					previewHtmlBlock(
						block.id,
						'variation-selector',
						product.variation_selector_html
					),
				];
			}
		} else {
			block.children = [
				previewTextBlock(
					block.id,
					'Select a valid WooCommerce product.'
				),
			];
		}
		return;
	}
	if ( block.type === 'woocommerce_product_grid' ) {
		const limit = Math.max(
			1,
			Math.min(
				12,
				Number( block.attributes?.[ 'data-grid-limit' ] || 6 )
			)
		);
		if ( isLoading ) {
			block.children = Array.from( { length: limit } ).map( () => ( {
				id: `grid-skeleton-${ Math.random()
					.toString( 36 )
					.substr( 2, 9 ) }`,
				type: 'container',
				tag: 'div',
				attributes: {},
				children: [
					skeletonBlock( 'image' ),
					skeletonBlock( 'text' ),
					skeletonBlock( 'link' ),
				],
				styles: { mapped: {}, custom_css_fallback: '' },
				meta: { source: 'commerce-preview' },
			} ) );
			return;
		}
		const template = clone( block.children || [] );
		block.children = products.slice( 0, limit ).flatMap( ( product ) =>
			template.map( ( templateBlock ) => {
				const item = clone( templateBlock );
				markGridPreview( item, block.id, product.id );
				applyProduct( item, product );
				return item;
			} )
		);
		if ( ! block.children.length ) {
			block.children = [
				previewTextBlock( block.id, 'No products found.' ),
			];
		}
		return;
	}
	if ( block.type === 'woocommerce_cart' ) {
		if ( isLoading ) {
			block.children = [
				skeletonBlock( 'rich_text' ),
				skeletonBlock( 'link' ),
			];
			return;
		}
		block.attributes = {
			...block.attributes,
			dangerouslySetInnerHTML: {
				__html:
					cartHtml ||
					'<div style="padding:20px;border:1px dashed #ccc;background:#f9f9f9;text-align:center;">Cart block loading...</div>',
			},
		};
		return;
	}
	if ( block.type === 'woocommerce_checkout' ) {
		if ( isLoading ) {
			block.children = [
				skeletonBlock( 'rich_text' ),
				skeletonBlock( 'link' ),
			];
			return;
		}
		block.attributes = {
			...block.attributes,
			dangerouslySetInnerHTML: {
				__html:
					checkoutHtml ||
					'<div style="padding:20px;border:1px dashed #ccc;background:#f9f9f9;text-align:center;">Checkout block loading...</div>',
			},
		};
		return;
	}
	for ( const child of block.children || [] ) {
		if ( child.kind !== 'text' ) {
			materializeBlock(
				child,
				productsById,
				products,
				cartHtml,
				checkoutHtml,
				isLoading,
				contextPostId
			);
		}
	}
}

export function materializeCommerce(
	document,
	products = [],
	cartHtml = '',
	checkoutHtml = '',
	isLoading = false,
	contextPostId = 0
) {
	const resolved = clone( document );
	const productsById = new Map(
		products.map( ( product ) => [ product.id, product ] )
	);
	materializeBlock(
		resolved.root,
		productsById,
		products,
		cartHtml,
		checkoutHtml,
		isLoading,
		contextPostId
	);
	return resolved;
}
