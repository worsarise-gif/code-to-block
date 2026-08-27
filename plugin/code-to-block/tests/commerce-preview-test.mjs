import assert from 'node:assert/strict';

import { materializeCommerce } from '../src/commerce-preview.mjs';

let assertions = 0;
function check( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

function dynamic( id, source, tag = 'p' ) {
	return {
		id,
		type: 'text',
		tag,
		attributes: {},
		children: [ { kind: 'text', value: '' } ],
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: { source: 'test' },
		is_dynamic: true,
		dynamic_source: source,
	};
}

const products = [
	{
		id: 10,
		name: 'Shirt',
		price_text: '$20',
		short_description_text: 'Soft',
		stock_text: 'In stock',
		image: { url: '/shirt.jpg', srcset: '', alt: 'Shirt' },
	},
	{
		id: 11,
		name: 'Hat',
		price_text: '$12',
		short_description_text: 'Warm',
		stock_text: 'Out of stock',
		image: { url: '/hat.jpg', srcset: '', alt: 'Hat' },
	},
];
const document = {
	schema_version: 1,
	name: 'Commerce',
	root: {
		id: 'root',
		type: 'container',
		tag: 'main',
		attributes: {},
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: { source: 'test' },
		children: [
			{
				id: 'product',
				type: 'woocommerce_product',
				tag: 'article',
				attributes: { 'data-product-id': '10' },
				styles: { mapped: {}, custom_css_fallback: '' },
				meta: { source: 'test' },
				children: [
					dynamic( 'title', 'wc_product_title', 'h2' ),
					dynamic( 'stock', 'wc_product_stock_status' ),
				],
			},
			{
				id: 'grid',
				type: 'woocommerce_product_grid',
				tag: 'section',
				attributes: { 'data-grid-limit': '2' },
				styles: { mapped: {}, custom_css_fallback: '' },
				meta: { source: 'test' },
				children: [
					{
						id: 'item',
						type: 'container',
						tag: 'article',
						attributes: {},
						styles: { mapped: {}, custom_css_fallback: '' },
						meta: { source: 'test' },
						children: [
							dynamic( 'grid-title', 'wc_product_title', 'h3' ),
						],
					},
				],
			},
		],
	},
};

const preview = materializeCommerce( document, products );
check(
	preview.root.children[ 0 ].children[ 0 ].children[ 0 ].value,
	'Shirt',
	'Explicit products populate canvas text.'
);
check(
	preview.root.children[ 0 ].children[ 1 ].children[ 0 ].value,
	'In stock',
	'Stock status populates the canvas.'
);
check(
	preview.root.children[ 1 ].children.length,
	2,
	'Grid preview repeats real products up to its limit.'
);
check(
	preview.root.children[ 1 ].children[ 1 ].children[ 0 ].children[ 0 ].value,
	'Hat',
	'Each grid item receives its own product context.'
);
check(
	preview.root.children[ 1 ].children[ 0 ].id ===
		preview.root.children[ 1 ].children[ 1 ].id,
	false,
	'Grid preview IDs remain unique.'
);
check(
	preview.root.children[ 1 ].children[ 0 ].meta.commerce_preview_source_id,
	'item',
	'Preview clones retain their canonical selection source.'
);
check(
	document.root.children[ 0 ].children[ 0 ].children[ 0 ].value,
	'',
	'Commerce materialization must not mutate the saved document.'
);

const missing = JSON.parse( JSON.stringify( document ) );
delete missing.root.children[ 0 ].attributes[ 'data-product-id' ];
check(
	materializeCommerce( missing, products ).root.children[ 0 ].children[ 0 ]
		.children[ 0 ].value,
	'Select a valid WooCommerce product.',
	'Missing product context must be explicit.'
);

console.log( `PASS: ${ assertions } commerce-preview assertions.` );
