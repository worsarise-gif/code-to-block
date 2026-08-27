import { createRoot, useState, useEffect, useRef } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { sanitizeRichTextHtml } from './rich-text.mjs';
import { CommerceProductEditor } from './commerce-product-editor';

function RichTextInput( { id, value, onChange, disabled } ) {
	const editor = useRef( null );
	const [ linkUrl, setLinkUrl ] = useState( '' );

	useEffect( () => {
		const html = sanitizeRichTextHtml( value );
		if (
			editor.current &&
			window.document.activeElement !== editor.current &&
			editor.current.innerHTML !== html
		) {
			editor.current.innerHTML = html;
		}
	}, [ value ] );

	const commit = () =>
		onChange( sanitizeRichTextHtml( editor.current?.innerHTML || '' ) );
	const format = ( command ) => {
		editor.current?.focus();
		window.document.execCommand( command, false );
		commit();
	};
	const createLink = () => {
		if ( linkUrl ) {
			editor.current?.focus();
			window.document.execCommand( 'createLink', false, linkUrl );
			commit();
			setLinkUrl( '' );
		}
	};

	return (
		<div className="ctb-rich-text-control">
			<div
				className="ctb-rich-text-toolbar"
				role="toolbar"
				aria-label="Text formatting"
			>
				{ [
					[ 'bold', 'Bold', 'B' ],
					[ 'italic', 'Italic', 'I' ],
					[ 'underline', 'Underline', 'U' ],
					[ 'strikeThrough', 'Strikethrough', 'S' ],
				].map( ( [ command, label, text ] ) => (
					<button
						key={ command }
						type="button"
						aria-label={ label }
						onMouseDown={ ( event ) => event.preventDefault() }
						onClick={ () => format( command ) }
						disabled={ disabled }
					>
						{ text }
					</button>
				) ) }
				<input
					type="url"
					aria-label="Link URL"
					value={ linkUrl }
					onChange={ ( event ) => setLinkUrl( event.target.value ) }
					placeholder="https://"
					disabled={ disabled }
				/>
				<button
					type="button"
					onMouseDown={ ( event ) => event.preventDefault() }
					onClick={ createLink }
					disabled={ disabled }
				>
					Link
				</button>
				<button
					type="button"
					onMouseDown={ ( event ) => event.preventDefault() }
					onClick={ () => format( 'unlink' ) }
					disabled={ disabled }
				>
					Unlink
				</button>
			</div>
			<div
				id={ id }
				ref={ editor }
				className="ctb-rich-text-editor"
				role="textbox"
				aria-multiline="true"
				contentEditable={ ! disabled }
				suppressContentEditableWarning
				onInput={ commit }
			/>
		</div>
	);
}

function ContentMode() {
	const [ documentData, setDocumentData ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ saveStatus, setSaveStatus ] = useState( '' );
	const [ slotChanges, setSlotChanges ] = useState( {} );
	const [ seoChanges, setSeoChanges ] = useState( {} );
	const [ saving, setSaving ] = useState( false );
	const [ uploadingSlot, setUploadingSlot ] = useState( '' );
	const [ wooProducts, setWooProducts ] = useState( [] );
	const [ selectedWooProduct, setSelectedWooProduct ] = useState( null );

	const postId = new URLSearchParams( window.location.search ).get( 'post' );

	useEffect( () => {
		if ( ! postId ) {
			setError( 'No post ID provided.' );
			setLoading( false );
			return;
		}

		Promise.all( [
			apiFetch( { path: `/code-to-block/v1/pages/${ postId }/content` } ),
			apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/products`,
			} ).catch( () => ( { products: [] } ) ),
		] )
			.then( ( [ doc, prodRes ] ) => {
				setDocumentData( doc );
				if ( prodRes && prodRes.products ) {
					setWooProducts( prodRes.products );
				}
				setLoading( false );
			} )
			.catch( ( err ) => {
				setError( err.message || 'Failed to load document.' );
				setLoading( false );
			} );
	}, [ postId ] );

	const findSlots = ( block, slots = [] ) => {
		if ( block.is_content_slot ) {
			slots.push( block );
		}
		if ( block.children ) {
			block.children.forEach( ( child ) => {
				if ( typeof child === 'object' && child.type ) {
					findSlots( child, slots );
				}
			} );
		}
		return slots;
	};

	const findWooCommerceProducts = ( block, products = [] ) => {
		if ( block.type === 'woocommerce_product' ) {
			products.push( block );
		}
		if ( block.children ) {
			block.children.forEach( ( child ) => {
				if ( typeof child === 'object' && child.type ) {
					findWooCommerceProducts( child, products );
				}
			} );
		}
		return products;
	};

	const handleContentChange = ( blockId, newValue ) => {
		setDocumentData( ( prevDoc ) => {
			const newDoc = JSON.parse( JSON.stringify( prevDoc ) );

			const updateBlockContent = ( block ) => {
				if ( block.id === blockId ) {
					if (
						block.slot_content_type === 'text' ||
						block.slot_content_type === 'rich_text'
					) {
						block.children = [ { kind: 'text', value: newValue } ];
					} else if ( block.slot_content_type === 'image' ) {
						block.attributes = block.attributes || {};
						block.attributes.src = newValue;
					} else if ( block.slot_content_type === 'link' ) {
						block.attributes = block.attributes || {};
						block.attributes.href = newValue;
					}
					return true;
				}
				if ( block.children ) {
					for ( const child of block.children ) {
						if ( typeof child === 'object' && child.type ) {
							if ( updateBlockContent( child ) ) {
								return true;
							}
						}
					}
				}
				return false;
			};

			updateBlockContent( newDoc.root );
			return newDoc;
		} );
		setSlotChanges( ( current ) => ( {
			...current,
			[ blockId ]: newValue,
		} ) );
		setSaveStatus( 'Unsaved changes' );
	};

	const handleSeoChange = ( key, newValue ) => {
		setDocumentData( ( prevDoc ) => {
			const newDoc = JSON.parse( JSON.stringify( prevDoc ) );
			if ( ! newDoc.seo ) {
				newDoc.seo = {};
			}
			if ( '' === ( newValue || '' ).trim() ) {
				delete newDoc.seo[ key ];
				if ( ! Object.keys( newDoc.seo ).length ) {
					delete newDoc.seo;
				}
			} else {
				newDoc.seo[ key ] = String( newValue ).slice( 0, 1000 );
			}
			return newDoc;
		} );
		setSeoChanges( ( current ) => ( { ...current, [ key ]: newValue } ) );
		setSaveStatus( 'Unsaved changes' );
	};

	const uploadImage = async ( blockId, file ) => {
		if ( ! file ) {
			return;
		}
		setUploadingSlot( blockId );
		setSaveStatus( 'Uploading image...' );
		const body = new window.FormData();
		body.append( 'file', file );
		body.append( 'title', file.name );
		try {
			const media = await apiFetch( {
				path: '/wp/v2/media',
				method: 'POST',
				body,
			} );
			handleContentChange( blockId, media.source_url );
		} catch ( err ) {
			setSaveStatus( 'Error: ' + ( err.message || 'Upload failed' ) );
		} finally {
			setUploadingSlot( '' );
		}
	};

	const saveDocument = () => {
		if (
			! Object.keys( slotChanges ).length &&
			! Object.keys( seoChanges ).length
		) {
			setSaveStatus( 'No changes to save' );
			return;
		}
		setSaving( true );
		setSaveStatus( 'Saving...' );
		apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/content`,
			method: 'POST',
			data: { slots: slotChanges, seo: seoChanges },
		} )
			.then( ( response ) => {
				setDocumentData( response.document );
				setSlotChanges( {} );
				setSeoChanges( {} );
				setSaveStatus( 'Saved' );
			} )
			.catch( ( err ) =>
				setSaveStatus( 'Error: ' + ( err.message || 'Save failed' ) )
			)
			.finally( () => setSaving( false ) );
	};

	if ( loading ) {
		return (
			<div className="ctb-content-mode-wrap">
				<p>Loading content...</p>
			</div>
		);
	}
	if ( error ) {
		return (
			<div className="ctb-content-mode-wrap">
				<p className="error">{ error }</p>
			</div>
		);
	}
	if ( ! documentData ) {
		return null;
	}

	const slots = findSlots( documentData.root );
	const seo = documentData.seo || {};
	const seoFields = [
		{
			key: 'title',
			label: 'SEO Title',
			placeholder: 'Page title — 50-60 chars ideal',
			help: 'Title tag — shown in Google results. Keep 50-60 chars.',
			isText: true,
		},
		{
			key: 'description',
			label: 'Meta Description',
			placeholder: 'Brief summary — 120-160 chars ideal',
			help: 'Meta description — shown under title in search. Aim 120-160 chars.',
			isText: false,
		},
		{
			key: 'canonical',
			label: 'Canonical URL',
			placeholder: 'https://example.com/page/',
			help: 'Preferred URL for this page. Blank = auto.',
			isText: true,
		},
		{
			key: 'og_title',
			label: 'Open Graph Title',
			placeholder: 'Social title',
			help: 'For Facebook/Twitter shares. Falls back to SEO Title.',
			isText: true,
		},
		{
			key: 'og_description',
			label: 'OG Description',
			placeholder: 'Social description',
			help: 'Social share description.',
			isText: false,
		},
		{
			key: 'og_image',
			label: 'OG Image URL',
			placeholder: 'https://example.com/image.jpg',
			help: 'Preview image for social shares.',
			isText: true,
		},
	];

	return (
		<div className="ctb-content-mode-wrap">
			<header className="ctb-content-mode-header">
				<h1>Editing Content: { documentData.name }</h1>
				<button
					className="button button-primary button-large"
					onClick={ saveDocument }
					disabled={ saving }
				>
					Save Content
				</button>
				{ saveStatus && (
					<span className="ctb-save-status">{ saveStatus }</span>
				) }
			</header>

			<main className="ctb-content-mode-main">
				<section
					style={ {
						background: '#f8f7f3',
						border: '1px solid #d1cdc1',
						padding: '16px',
						marginBottom: '24px',
						borderRadius: '4px',
					} }
				>
					<h2 style={ { margin: '0 0 4px', fontSize: '16px' } }>
						SEO — same view as other content
					</h2>
					<p
						style={ {
							margin: '0 0 12px',
							fontSize: '12px',
							color: '#686355',
						} }
					>
						Title/description/canonical/Open Graph are editable here
						alongside other page content — not a separate SEO panel.
						JSON-LD (WebPage/Product/LocalBusiness) is
						auto-generated from your blocks.
					</p>
					<div style={ { display: 'grid', gap: '12px' } }>
						{ seoFields.map( ( f ) => {
							const val = seo[ f.key ] || '';
							const counter =
								f.key === 'description' ||
								f.key === 'og_description'
									? `${ val.length } / 160`
									: `${ val.length } / 60`;
							return (
								<div key={ f.key } className="ctb-slot-field">
									<label htmlFor={ `seo-${ f.key }` }>
										{ f.label }{ ' ' }
										<small
											style={ {
												color: '#686355',
												fontWeight: 400,
											} }
										>
											{ val ? counter : '' }
										</small>
									</label>
									{ f.isText ? (
										<input
											id={ `seo-${ f.key }` }
											type="text"
											value={ val }
											onChange={ ( e ) =>
												handleSeoChange(
													f.key,
													e.target.value
												)
											}
											placeholder={ f.placeholder }
											disabled={ saving }
										/>
									) : (
										<textarea
											id={ `seo-${ f.key }` }
											value={ val }
											onChange={ ( e ) =>
												handleSeoChange(
													f.key,
													e.target.value
												)
											}
											placeholder={ f.placeholder }
											rows={ 2 }
											disabled={ saving }
										/>
									) }
									<small
										style={ {
											color: '#686355',
											fontSize: '11px',
										} }
									>
										{ f.help }
									</small>
								</div>
							);
						} ) }
					</div>
				</section>
				{ findWooCommerceProducts( documentData.root ).length > 0 && (
					<section
						style={ {
							background: '#eef3fc',
							border: '1px solid #c9d8f0',
							padding: '16px',
							marginBottom: '24px',
							borderRadius: '4px',
						} }
					>
						<h2 style={ { margin: '0 0 12px', fontSize: '16px' } }>
							WooCommerce Products
						</h2>
						<div style={ { display: 'grid', gap: '8px' } }>
							{ findWooCommerceProducts( documentData.root ).map(
								( block, idx ) => {
									const pid = Number(
										block.attributes?.[
											'data-product-id'
										] || 0
									);
									const product = wooProducts.find(
										( p ) => p.id === pid
									);
									return (
										<div
											key={ block.id || idx }
											style={ {
												padding: '12px',
												background: '#fff',
												border: '1px solid #dcdcdc',
											} }
										>
											<strong
												style={ {
													display: 'block',
													marginBottom: '8px',
													fontSize: '14px',
												} }
											>
												{ product
													? product.name
													: 'Unconfigured Product Block' }
											</strong>
											{ product ? (
												<button
													className="button"
													onClick={ () =>
														setSelectedWooProduct(
															product
														)
													}
												>
													Edit Product Data
												</button>
											) : (
												<p
													style={ {
														margin: 0,
														fontSize: '12px',
														color: '#686355',
													} }
												>
													Configure this block in the
													visual editor to link it to
													a product.
												</p>
											) }
										</div>
									);
								}
							) }
						</div>
					</section>
				) }
				<h2 style={ { fontSize: '14px', marginBottom: '8px' } }>
					Content Slots
				</h2>
				{ slots.length === 0 ? (
					<p>No content slots defined on this page.</p>
				) : (
					<div className="ctb-slots-list">
						{ slots.map( ( slot ) => {
							const label = slot.slot_label || slot.id;
							let value = '';
							if (
								slot.slot_content_type === 'text' ||
								slot.slot_content_type === 'rich_text'
							) {
								value =
									slot.children?.find(
										( c ) => c.kind === 'text'
									)?.value || '';
							} else if ( slot.slot_content_type === 'image' ) {
								value = slot.attributes?.src || '';
							} else if ( slot.slot_content_type === 'link' ) {
								value = slot.attributes?.href || '';
							}
							let field;
							if ( slot.slot_content_type === 'rich_text' ) {
								field = (
									<RichTextInput
										id={ `slot-${ slot.id }` }
										value={ value }
										onChange={ ( newValue ) =>
											handleContentChange(
												slot.id,
												newValue
											)
										}
										disabled={ saving }
									/>
								);
							} else if ( slot.slot_content_type === 'image' ) {
								field = (
									<>
										{ value ? (
											<img
												className="ctb-slot-image-preview"
												src={ value }
												alt=""
											/>
										) : null }
										<input
											id={ `slot-${ slot.id }` }
											type="url"
											value={ value }
											onChange={ ( event ) =>
												handleContentChange(
													slot.id,
													event.target.value
												)
											}
											disabled={
												saving ||
												uploadingSlot === slot.id
											}
										/>
										<input
											type="file"
											accept="image/*"
											onChange={ ( event ) =>
												uploadImage(
													slot.id,
													event.target.files?.[ 0 ]
												)
											}
											disabled={
												saving ||
												Boolean( uploadingSlot )
											}
										/>
										{ uploadingSlot === slot.id ? (
											<small>Uploading...</small>
										) : null }
									</>
								);
							} else {
								field = (
									<input
										id={ `slot-${ slot.id }` }
										type={
											slot.slot_content_type === 'link'
												? 'url'
												: 'text'
										}
										value={ value }
										onChange={ ( event ) =>
											handleContentChange(
												slot.id,
												event.target.value
											)
										}
										disabled={ saving }
									/>
								);
							}

							return (
								<div key={ slot.id } className="ctb-slot-field">
									<label htmlFor={ `slot-${ slot.id }` }>
										{ label }{ ' ' }
										<span className="ctb-slot-type">
											({ slot.slot_content_type })
										</span>
									</label>
									{ field }
								</div>
							);
						} ) }
					</div>
				) }
			</main>

			{ selectedWooProduct && (
				<div
					style={ {
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.5)',
						zIndex: 9999,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					} }
				>
					<div
						style={ {
							background: '#fff',
							padding: '24px',
							width: '720px',
							maxWidth: '90%',
							borderRadius: '4px',
							maxHeight: '90vh',
							overflowY: 'auto',
						} }
					>
						<h2>Edit Product: { selectedWooProduct.name }</h2>
						<CommerceProductEditor
							product={ selectedWooProduct }
							saving={ saving }
							onCancel={ () => setSelectedWooProduct( null ) }
							onSave={ async ( updates ) => {
								setSaving( true );
								try {
									const response = await apiFetch( {
										path: `/code-to-block/v1/pages/${ postId }/products/${ selectedWooProduct.id }`,
										method: 'PUT',
										data: updates,
									} );
									if (
										! response.success ||
										! response.product
									) {
										throw new Error(
											'WooCommerce did not confirm the save.'
										);
									}
									setWooProducts( ( current ) =>
										current.map( ( product ) =>
											product.id === response.product.id
												? response.product
												: product
										)
									);
									setSelectedWooProduct( null );
									setSaveStatus( 'Product saved' );
									return response.product;
								} finally {
									setSaving( false );
								}
							} }
						/>
					</div>
				</div>
			) }
		</div>
	);
}

const rootElement = document.getElementById( 'code-to-block-content-root' );
if ( rootElement ) {
	createRoot( rootElement ).render( <ContentMode /> );
}
