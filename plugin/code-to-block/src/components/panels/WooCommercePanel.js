import { useState } from '@wordpress/element';
import '../../editor.css';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';
import { CommerceProductEditor, createProductDraft } from '../../commerce-product-editor';

export function WooCommercePanel( {
	selectedBlock,
	onUpdateSettings,
	onInsert,
	onUpdateProduct,
	onCreateProduct,
	productSaving,
	products,
	available,
} ) {
	const [ productId, setProductId ] = useState( '' );
	const [ gridLimit, setGridLimit ] = useState( '6' );
	const [ creatingProduct, setCreatingProduct ] = useState( null );

	const isProduct = selectedBlock?.type === 'woocommerce_product';
	const selectedProductData =
		isProduct &&
		products.find(
			( p ) =>
				p.id ===
				Number( selectedBlock.attributes?.[ 'data-product-id' ] || 0 )
		);

	return (
		<details
			className="ctb-woo-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
			open={ isProduct }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>WooCommerce</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
						textTransform: 'uppercase',
					} }
				>
					Blocks
				</small>
			</summary>
			{ isProduct && (
				<div
					style={ {
						marginBottom: '12px',
						padding: '10px',
						background: '#eef3fc',
						border: '1px solid #c9d8f0',
						borderRadius: '4px',
					} }
				>
					<strong
						style={ {
							display: 'block',
							fontSize: '11px',
							marginBottom: '6px',
						} }
					>
						Product Settings
					</strong>

					{ selectedProductData ? (
						<div style={ { display: 'grid', gap: '8px' } }>
							<div>
								<span
									style={ {
										fontSize: '10px',
										fontWeight: 700,
									} }
								>
									Custom Fields:{ ' ' }
								</span>
								<select
									onChange={ ( e ) =>
										onUpdateSettings( selectedBlock.id, {
											'data-bind-custom-field':
												e.target.value,
										} )
									}
									value={
										selectedBlock.attributes?.[
											'data-bind-custom-field'
										] || ''
									}
									style={ {
										width: '100%',
										padding: '4px',
										fontSize: '10px',
									} }
								>
									<option value="">(None bound)</option>
									{ selectedProductData.custom_fields?.map(
										( f ) => (
											<option
												key={ f.key }
												value={ f.key }
											>
												{ f.key }
											</option>
										)
									) }
								</select>
							</div>

							<div
								style={ {
									marginTop: '12px',
									borderTop: '1px solid #c9d8f0',
									paddingTop: '12px',
								} }
							>
								<strong
									style={ {
										display: 'block',
										fontSize: '11px',
										marginBottom: '8px',
									} }
								>
									Edit Product Data
								</strong>
								<CommerceProductEditor
									product={ selectedProductData }
									onSave={ ( payload ) =>
										onUpdateProduct(
											selectedProductData.id,
											payload
										)
									}
									saving={ productSaving }
								/>
							</div>
							{ selectedProductData.type === 'variable' ? (
								<label
									style={ {
										display: 'flex',
										alignItems: 'center',
										gap: '6px',
										fontSize: '10px',
									} }
								>
									<input
										type="checkbox"
										checked={
											selectedBlock.attributes?.[
												'data-show-variations'
											] === 'true'
										}
										onChange={ ( event ) =>
											onUpdateSettings(
												selectedBlock.id,
												{
													'data-show-variations':
														event.target.checked
															? 'true'
															: '',
												}
											)
										}
									/>{ ' ' }
									Show the variation selector on the product
									block
								</label>
							) : null }
						</div>
					) : (
						<p
							style={ {
								fontSize: '10px',
								margin: 0,
								color: '#d32f2f',
							} }
						>
							Selected product not found or invalid.
						</p>
					) }
				</div>
			) }
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 10px',
				} }
			>
				{ available
					? 'Live product data from WooCommerce. Style with the normal panel.'
					: 'WooCommerce is unavailable. Product previews cannot load.' }
			</p>
			<div
				style={ {
					background: '#f7f5ee',
					border: '1px solid #d3cec1',
					padding: '9px',
					marginBottom: '8px',
				} }
			>
				<strong
					style={ {
						display: 'block',
						fontSize: '11px',
						marginBottom: '6px',
					} }
				>
					Create Product
				</strong>
				{ creatingProduct ? (
					<CommerceProductEditor
						product={ creatingProduct }
						onSave={ async ( payload ) => {
							await onCreateProduct( payload );
							setCreatingProduct( null );
						} }
						onCancel={ () => setCreatingProduct( null ) }
						saving={ productSaving }
						submitLabel="Create product"
					/>
				) : (
					<div style={ { display: 'flex', gap: '6px' } }>
						<button
							type="button"
							disabled={ ! available }
							onClick={ () =>
								setCreatingProduct(
									createProductDraft( 'simple' )
								)
							}
						>
							New simple product
						</button>
						<button
							type="button"
							disabled={ ! available }
							onClick={ () =>
								setCreatingProduct(
									createProductDraft( 'variable' )
								)
							}
						>
							New variable product
						</button>
					</div>
				) }
			</div>
			<div style={ { display: 'grid', gap: '8px' } }>
				<div
					style={ {
						display: 'grid',
						gap: '4px',
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>
						Single Product
					</strong>
					<small style={ { color: '#686355', fontSize: '9px' } }>
						Renders title, price, image, short description via
						dynamic bindings.
					</small>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '9px',
							fontWeight: 700,
							marginTop: '6px',
						} }
					>
						<span>Product</span>
						<select
							value={ productId }
							onChange={ ( e ) => setProductId( e.target.value ) }
							style={ {
								border: '1px solid #aaa393',
								borderRadius: '3px',
								padding: '5px 6px',
								fontSize: '10px',
							} }
						>
							<option value="">Select a product</option>
							{ products.map( ( product ) => (
								<option key={ product.id } value={ product.id }>
									{ product.name } ({ product.type })
								</option>
							) ) }
						</select>
					</label>
					<button
						type="button"
						disabled={ ! productId }
						onClick={ () =>
							onInsert( 'woocommerce_product', { productId } )
						}
						style={ {
							background: '#171d35',
							color: '#fff',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: productId ? 'pointer' : 'not-allowed',
							opacity: productId ? 1 : 0.55,
							marginTop: '6px',
						} }
					>
						Insert Product after selection
					</button>
				</div>
				<div
					style={ {
						display: 'grid',
						gap: '4px',
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>Product Grid</strong>
					<small style={ { color: '#686355', fontSize: '9px' } }>
						Loops latest products. Customize template children after
						insert.
					</small>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '9px',
							fontWeight: 700,
							marginTop: '6px',
						} }
					>
						<span>Limit</span>
						<input
							type="text"
							value={ gridLimit }
							onChange={ ( e ) => setGridLimit( e.target.value ) }
							style={ {
								border: '1px solid #aaa393',
								borderRadius: '3px',
								padding: '5px 6px',
								fontSize: '10px',
								width: '80px',
							} }
						/>
					</label>
					<button
						type="button"
						onClick={ () =>
							onInsert( 'woocommerce_product_grid', {
								limit: gridLimit,
							} )
						}
						style={ {
							background: '#171d35',
							color: '#fff',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: 'pointer',
							marginTop: '6px',
						} }
					>
						Insert Grid after selection
					</button>
				</div>
				<div
					style={ {
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '6px',
					} }
				>
					<button
						type="button"
						onClick={ () => onInsert( 'woocommerce_cart', {} ) }
						style={ {
							background: '#fff',
							color: '#171d35',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: 'pointer',
						} }
					>
						Insert Cart
					</button>
					<button
						type="button"
						onClick={ () => onInsert( 'woocommerce_checkout', {} ) }
						style={ {
							background: '#fff',
							color: '#171d35',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: 'pointer',
						} }
					>
						Insert Checkout
					</button>
				</div>
				<small
					style={ {
						color: '#686355',
						fontSize: '8px',
						lineHeight: '1.4',
					} }
				>
					Cart/Checkout use WooCommerce Blocks (Interactivity API),
					not shortcodes — avoids markup-fragility.
				</small>
			</div>
		</details>
	);
}

