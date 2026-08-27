import { useEffect, useState } from '@wordpress/element';

const emptyCustomField = () => ( { key: '', value: '' } );
const emptyAttribute = () => ( {
	name: '',
	options: [],
	visible: true,
	variation: true,
} );

export function productToDraft( product = {} ) {
	return {
		id: Number( product.id || 0 ),
		type: product.type === 'simple' ? 'simple' : 'variable',
		name: product.name || '',
		regular_price: product.regular_price || product.price || '',
		sale_price: product.sale_price || '',
		short_description: product.short_description || '',
		custom_fields: ( product.custom_fields || [] ).map( ( field ) => ( {
			key: field.key || '',
			value: field.value || '',
		} ) ),
		attributes: ( product.attributes || [] ).map( ( attribute ) => ( {
			id: Number( attribute.id || 0 ),
			name: attribute.name || '',
			slug: attribute.slug || attributeSlug( attribute.name ),
			options: [ ...( attribute.options || [] ) ],
			option_values: [
				...( attribute.option_values || attribute.options || [] ),
			],
			taxonomy: Boolean( attribute.taxonomy ),
			visible: attribute.visible !== false,
			variation: Boolean( attribute.variation ),
		} ) ),
		variations: ( product.variations || [] ).map( ( variation ) => ( {
			id: Number( variation.id || 0 ),
			attributes: { ...( variation.attributes || {} ) },
			regular_price: variation.regular_price || '',
			sale_price: variation.sale_price || '',
			manage_stock: Boolean( variation.manage_stock ),
			stock_quantity:
				variation.stock_quantity === null ||
				variation.stock_quantity === undefined
					? ''
					: String( variation.stock_quantity ),
			stock_status: variation.stock_status || 'instock',
			enabled: variation.enabled !== false,
		} ) ),
	};
}

export function createProductDraft( type = 'variable' ) {
	return productToDraft( {
		type,
		custom_fields: [],
		attributes: type === 'variable' ? [ emptyAttribute() ] : [],
		variations: [],
	} );
}

function attributeSlug( name ) {
	return String( name || '' )
		.toLowerCase()
		.trim()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-|-$/g, '' );
}

function splitOptions( value ) {
	return String( value || '' )
		.split( /[,\n]/ )
		.map( ( option ) => option.trim() )
		.filter(
			( option, index, options ) =>
				option && options.indexOf( option ) === index
		);
}

export function buildProductPayload( draft ) {
	const customFields = {};
	for ( const field of draft.custom_fields || [] ) {
		const key = String( field.key || '' ).trim();
		if ( key ) {
			customFields[ key ] = String( field.value || '' );
		}
	}
	const payload = {
		type: draft.type,
		name: String( draft.name || '' ).trim(),
		short_description: String( draft.short_description || '' ),
		custom_fields: customFields,
	};
	if ( draft.type === 'simple' ) {
		payload.regular_price = String( draft.regular_price || '' ).trim();
		payload.sale_price = String( draft.sale_price || '' ).trim();
		return payload;
	}
	payload.attributes = ( draft.attributes || [] )
		.map( ( attribute ) => ( {
			id: Number( attribute.id || 0 ),
			name: String( attribute.name || '' ).trim(),
			options: Array.isArray( attribute.options )
				? attribute.options
				: splitOptions( attribute.options ),
			visible: attribute.visible !== false,
			variation: Boolean( attribute.variation ),
		} ) )
		.filter( ( attribute ) => attribute.name );
	payload.variations = ( draft.variations || [] ).map( ( variation ) => ( {
		id: Number( variation.id || 0 ),
		attributes: { ...( variation.attributes || {} ) },
		regular_price: String( variation.regular_price || '' ).trim(),
		sale_price: String( variation.sale_price || '' ).trim(),
		manage_stock: Boolean( variation.manage_stock ),
		stock_quantity: variation.manage_stock
			? Number( variation.stock_quantity || 0 )
			: null,
		stock_status: variation.stock_status || 'instock',
		enabled: variation.enabled !== false,
	} ) );
	return payload;
}

function fieldStyle() {
	return {
		width: '100%',
		boxSizing: 'border-box',
		padding: '6px 7px',
		fontSize: '11px',
	};
}

function ProductVariationEditor( {
	variation,
	attributes,
	onChange,
	onRemove,
} ) {
	const variationAttributes = attributes.filter(
		( attribute ) => attribute.variation && attribute.name
	);
	return (
		<div
			style={ {
				border: '1px solid #d3cec1',
				padding: '10px',
				display: 'grid',
				gap: '8px',
				background: '#fff',
			} }
		>
			<div style={ { display: 'flex', justifyContent: 'space-between' } }>
				<strong style={ { fontSize: '11px' } }>
					{ variation.id
						? `Variation #${ variation.id }`
						: 'New variation' }
				</strong>
				{ ! variation.id ? (
					<button type="button" onClick={ onRemove }>
						Remove
					</button>
				) : null }
			</div>
			<div
				style={ {
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
					gap: '8px',
				} }
			>
				{ variationAttributes.map( ( attribute ) => {
					const slug =
						attribute.slug || attributeSlug( attribute.name );
					return (
						<label key={ slug } style={ { fontSize: '10px' } }>
							{ attribute.name }
							<select
								value={ variation.attributes?.[ slug ] || '' }
								onChange={ ( event ) =>
									onChange( {
										...variation,
										attributes: {
											...( variation.attributes || {} ),
											[ slug ]: event.target.value,
										},
									} )
								}
								style={ fieldStyle() }
							>
								<option value="">Choose…</option>
								{ ( attribute.options || [] ).map(
									( option, index ) => (
										<option
											key={
												attribute.option_values?.[
													index
												] || option
											}
											value={
												attribute.option_values?.[
													index
												] || option
											}
										>
											{ option }
										</option>
									)
								) }
							</select>
						</label>
					);
				} ) }
			</div>
			<div
				style={ {
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gap: '8px',
				} }
			>
				<label style={ { fontSize: '10px' } }>
					Regular price
					<input
						type="number"
						min="0"
						step="0.01"
						value={ variation.regular_price }
						onChange={ ( event ) =>
							onChange( {
								...variation,
								regular_price: event.target.value,
							} )
						}
						style={ fieldStyle() }
					/>
				</label>
				<label style={ { fontSize: '10px' } }>
					Sale price
					<input
						type="number"
						min="0"
						step="0.01"
						value={ variation.sale_price }
						onChange={ ( event ) =>
							onChange( {
								...variation,
								sale_price: event.target.value,
							} )
						}
						style={ fieldStyle() }
					/>
				</label>
			</div>
			<div style={ { display: 'flex', gap: '12px', flexWrap: 'wrap' } }>
				<label style={ { fontSize: '10px' } }>
					<input
						type="checkbox"
						checked={ variation.manage_stock }
						onChange={ ( event ) =>
							onChange( {
								...variation,
								manage_stock: event.target.checked,
							} )
						}
					/>{ ' ' }
					Manage stock
				</label>
				{ variation.manage_stock ? (
					<label style={ { fontSize: '10px' } }>
						Quantity{ ' ' }
						<input
							type="number"
							min="0"
							value={ variation.stock_quantity }
							onChange={ ( event ) =>
								onChange( {
									...variation,
									stock_quantity: event.target.value,
								} )
							}
							style={ { width: '70px' } }
						/>
					</label>
				) : null }
				<label style={ { fontSize: '10px' } }>
					Stock status{ ' ' }
					<select
						value={ variation.stock_status }
						onChange={ ( event ) =>
							onChange( {
								...variation,
								stock_status: event.target.value,
							} )
						}
					>
						<option value="instock">In stock</option>
						<option value="outofstock">Out of stock</option>
						<option value="onbackorder">On backorder</option>
					</select>
				</label>
				<label style={ { fontSize: '10px' } }>
					<input
						type="checkbox"
						checked={ variation.enabled }
						onChange={ ( event ) =>
							onChange( {
								...variation,
								enabled: event.target.checked,
							} )
						}
					/>{ ' ' }
					Enabled
				</label>
			</div>
		</div>
	);
}

export function CommerceProductEditor( {
	product,
	onSave,
	onCancel,
	saving = false,
	submitLabel = 'Save product',
} ) {
	const [ draft, setDraft ] = useState( () => productToDraft( product ) );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		setDraft( productToDraft( product ) );
		setError( '' );
	}, [ product ] );

	const updateList = ( key, index, nextValue ) => {
		setDraft( ( current ) => {
			const list = [ ...( current[ key ] || [] ) ];
			list[ index ] = nextValue;
			return { ...current, [ key ]: list };
		} );
	};
	const removeListItem = ( key, index ) =>
		setDraft( ( current ) => ( {
			...current,
			[ key ]: current[ key ].filter(
				( item, itemIndex ) => itemIndex !== index
			),
		} ) );

	const save = async () => {
		setError( '' );
		const payload = buildProductPayload( draft );
		if ( ! payload.name ) {
			setError( 'Product name is required.' );
			return;
		}
		try {
			await onSave( payload );
		} catch ( saveError ) {
			setError( saveError.message || 'Product could not be saved.' );
		}
	};

	return (
		<div style={ { display: 'grid', gap: '12px' } }>
			<label style={ { fontSize: '11px', fontWeight: 700 } }>
				Product name
				<input
					value={ draft.name }
					onChange={ ( event ) =>
						setDraft( { ...draft, name: event.target.value } )
					}
					style={ fieldStyle() }
				/>
			</label>
			{ draft.type === 'simple' ? (
				<div
					style={ {
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '8px',
					} }
				>
					<label style={ { fontSize: '11px', fontWeight: 700 } }>
						Regular price
						<input
							type="number"
							min="0"
							step="0.01"
							value={ draft.regular_price }
							onChange={ ( event ) =>
								setDraft( {
									...draft,
									regular_price: event.target.value,
								} )
							}
							style={ fieldStyle() }
						/>
					</label>
					<label style={ { fontSize: '11px', fontWeight: 700 } }>
						Sale price
						<input
							type="number"
							min="0"
							step="0.01"
							value={ draft.sale_price }
							onChange={ ( event ) =>
								setDraft( {
									...draft,
									sale_price: event.target.value,
								} )
							}
							style={ fieldStyle() }
						/>
					</label>
				</div>
			) : null }
			<label style={ { fontSize: '11px', fontWeight: 700 } }>
				Short description
				<textarea
					value={ draft.short_description }
					onChange={ ( event ) =>
						setDraft( {
							...draft,
							short_description: event.target.value,
						} )
					}
					rows={ 3 }
					style={ fieldStyle() }
				/>
			</label>

			<fieldset
				style={ { border: '1px solid #d3cec1', padding: '10px' } }
			>
				<legend style={ { fontSize: '11px', fontWeight: 700 } }>
					Custom fields
				</legend>
				{ draft.custom_fields.map( ( field, index ) => (
					<div
						key={ index }
						style={ {
							display: 'grid',
							gridTemplateColumns: '1fr 2fr auto',
							gap: '6px',
							marginBottom: '6px',
						} }
					>
						<input
							aria-label="Custom field key"
							value={ field.key }
							onChange={ ( event ) =>
								updateList( 'custom_fields', index, {
									...field,
									key: event.target.value,
								} )
							}
							placeholder="material"
							style={ fieldStyle() }
						/>
						<input
							aria-label="Custom field value"
							value={ field.value }
							onChange={ ( event ) =>
								updateList( 'custom_fields', index, {
									...field,
									value: event.target.value,
								} )
							}
							placeholder="Organic cotton"
							style={ fieldStyle() }
						/>
						<button
							type="button"
							onClick={ () =>
								removeListItem( 'custom_fields', index )
							}
						>
							Remove
						</button>
					</div>
				) ) }
				<button
					type="button"
					onClick={ () =>
						setDraft( {
							...draft,
							custom_fields: [
								...draft.custom_fields,
								emptyCustomField(),
							],
						} )
					}
				>
					Add custom field
				</button>
			</fieldset>

			{ draft.type === 'variable' ? (
				<>
					<fieldset
						style={ {
							border: '1px solid #d3cec1',
							padding: '10px',
						} }
					>
						<legend style={ { fontSize: '11px', fontWeight: 700 } }>
							Attributes
						</legend>
						{ draft.attributes.map( ( attribute, index ) => (
							<div
								key={ index }
								style={ {
									display: 'grid',
									gridTemplateColumns: '1fr 2fr auto',
									gap: '6px',
									marginBottom: '8px',
								} }
							>
								<input
									aria-label="Attribute name"
									value={ attribute.name }
									disabled={ attribute.taxonomy }
									onChange={ ( event ) =>
										updateList( 'attributes', index, {
											...attribute,
											name: event.target.value,
										} )
									}
									placeholder="Color"
									style={ fieldStyle() }
								/>
								<input
									aria-label="Attribute options"
									defaultValue={ attribute.options.join(
										', '
									) }
									disabled={ attribute.taxonomy }
									onBlur={ ( event ) =>
										updateList( 'attributes', index, {
											...attribute,
											options: splitOptions(
												event.target.value
											),
										} )
									}
									placeholder="Black, White"
									style={ fieldStyle() }
								/>
								<button
									type="button"
									onClick={ () =>
										removeListItem( 'attributes', index )
									}
								>
									Remove
								</button>
								<label style={ { fontSize: '10px' } }>
									<input
										type="checkbox"
										checked={ attribute.variation }
										onChange={ ( event ) =>
											updateList( 'attributes', index, {
												...attribute,
												variation: event.target.checked,
											} )
										}
									/>{ ' ' }
									Used for variations
								</label>
							</div>
						) ) }
						<button
							type="button"
							onClick={ () =>
								setDraft( {
									...draft,
									attributes: [
										...draft.attributes,
										emptyAttribute(),
									],
								} )
							}
						>
							Add attribute
						</button>
					</fieldset>

					<fieldset
						style={ {
							border: '1px solid #d3cec1',
							padding: '10px',
						} }
					>
						<legend style={ { fontSize: '11px', fontWeight: 700 } }>
							Variations
						</legend>
						<div style={ { display: 'grid', gap: '8px' } }>
							{ draft.variations.map( ( variation, index ) => (
								<ProductVariationEditor
									key={ variation.id || `new-${ index }` }
									variation={ variation }
									attributes={ draft.attributes }
									onChange={ ( nextVariation ) =>
										updateList(
											'variations',
											index,
											nextVariation
										)
									}
									onRemove={ () =>
										removeListItem( 'variations', index )
									}
								/>
							) ) }
						</div>
						<button
							type="button"
							style={ { marginTop: '8px' } }
							onClick={ () =>
								setDraft( {
									...draft,
									variations: [
										...draft.variations,
										{
											id: 0,
											attributes: {},
											regular_price: '',
											sale_price: '',
											manage_stock: false,
											stock_quantity: '',
											stock_status: 'instock',
											enabled: true,
										},
									],
								} )
							}
						>
							Add variation
						</button>
					</fieldset>
				</>
			) : null }

			{ error ? (
				<p style={ { color: '#9f2525', margin: 0 } }>{ error }</p>
			) : null }
			<div
				style={ {
					display: 'flex',
					justifyContent: 'flex-end',
					gap: '8px',
				} }
			>
				{ onCancel ? (
					<button
						type="button"
						onClick={ onCancel }
						disabled={ saving }
					>
						Cancel
					</button>
				) : null }
				<button type="button" onClick={ save } disabled={ saving }>
					{ saving ? 'Saving…' : submitLabel }
				</button>
			</div>
		</div>
	);
}
