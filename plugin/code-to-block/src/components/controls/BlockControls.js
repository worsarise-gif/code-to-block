import '../../editor.css';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';
import { useEditorStore } from '../../store/editor-store.mjs';
import { defaultGsapAction } from '../../utils/editor-utils.js';

export function BlockDynamicControl( { block, onChange } ) {
	const handleToggle = ( event ) => {
		const isDynamic = event.target.checked;
		onChange(
			block.id,
			isDynamic,
			isDynamic ? 'wc_product_title' : undefined
		);
	};

	const handleSourceChange = ( event ) => {
		onChange( block.id, true, event.target.value );
	};

	return (
		<div className="ctb-slot-control">
			<label className="ctb-slot-toggle">
				<input
					type="checkbox"
					checked={ !! block.is_dynamic }
					onChange={ handleToggle }
				/>
				<span>Bind to WooCommerce data</span>
			</label>
			{ block.is_dynamic ? (
				<label
					className="ctb-slot-label-input"
					style={ { marginTop: '8px' } }
				>
					<span>Data Source</span>
					<select
						value={ block.dynamic_source || '' }
						onChange={ handleSourceChange }
						style={ {
							width: '100%',
							marginTop: '4px',
							padding: '4px',
						} }
					>
						<option value="wc_product_title">Product Title</option>
						<option value="wc_product_price">Product Price</option>
						<option value="wc_product_short_description">
							Short Description
						</option>
						<option value="wc_product_stock_status">
							Stock Status
						</option>
						{ block.tag === 'img' && (
							<option value="wc_product_image">
								Product Image
							</option>
						) }
					</select>
				</label>
			) : null }
		</div>
	);
}

export function BlockSlotControl( { block, onChange } ) {
	const canBeSlot = [ 'text', 'image', 'button' ].includes( block.type );
	if ( ! canBeSlot ) {
		return null;
	}

	const handleToggle = ( event ) => {
		const isSlot = event.target.checked;
		let defaultType = 'text';
		if ( block.type === 'image' ) {
			defaultType = 'image';
		}
		if ( block.type === 'button' ) {
			defaultType = 'link';
		}

		onChange(
			block.id,
			isSlot,
			isSlot ? block.slot_label || 'New Slot' : undefined,
			isSlot ? defaultType : undefined
		);
	};

	const handleLabelChange = ( event ) => {
		onChange( block.id, true, event.target.value, block.slot_content_type );
	};

	const handleTypeChange = ( event ) => {
		onChange( block.id, true, block.slot_label, event.target.value );
	};

	return (
		<div className="ctb-slot-control">
			<p className="ctb-style-group-title">Client Content</p>
			<label className="ctb-slot-toggle">
				<input
					type="checkbox"
					checked={ !! block.is_content_slot }
					onChange={ handleToggle }
				/>
				<span>Make editable for clients</span>
			</label>
			{ block.is_content_slot ? (
				<>
					<label className="ctb-slot-label-input">
						<span>Slot label</span>
						<input
							type="text"
							value={ block.slot_label || '' }
							onChange={ handleLabelChange }
							placeholder="e.g. Hero Headline"
						/>
					</label>
					<label className="ctb-slot-label-input">
						<span>Content type</span>
						{ block.type === 'text' ? (
							<select
								value={ block.slot_content_type || 'text' }
								onChange={ handleTypeChange }
							>
								<option value="text">text</option>
								<option value="rich_text">rich_text</option>
							</select>
						) : (
							<input
								type="text"
								value={ block.slot_content_type || '' }
								disabled
							/>
						) }
					</label>
					<small
						style={ {
							color: '#686355',
							fontSize: '9px',
							marginTop: '4px',
							display: 'block',
						} }
					>
						{ block.type === 'text'
							? 'text = single line, rich_text = multi-line'
							: block.type === 'image'
							? 'image = URL to src'
							: 'link = URL to href' }
					</small>
				</>
			) : null }
		</div>
	);
}

export function BlockAnimationControl( { block } ) {
	const addBlockAction = useEditorStore( ( state ) => state.addBlockAction );
	const updateBlockAction = useEditorStore(
		( state ) => state.updateBlockAction
	);
	const removeBlockAction = useEditorStore(
		( state ) => state.removeBlockAction
	);
	const animations = ( block.actions || [] )
		.map( ( action, index ) => ( { action, index } ) )
		.filter(
			( item ) =>
				GSAP_ANIMATION_BEHAVIORS.has( item.action.behavior ) ||
				CSS_ANIMATION_BEHAVIORS.has( item.action.behavior )
		);

	function updateParam( index, action, key, value ) {
		updateBlockAction( block.id, index, {
			...action,
			params: { ...action.params, [ key ]: value },
		} );
	}

	const numberFields = {
		'scroll-scrub': [
			[ 'scrub', 'Scrub smoothing', 0.1 ],
			[ 'from_y', 'From Y', 1 ],
			[ 'to_y', 'To Y', 1 ],
			[ 'from_opacity', 'From opacity', 0.05 ],
			[ 'to_opacity', 'To opacity', 0.05 ],
			[ 'from_scale', 'From scale', 0.05 ],
			[ 'to_scale', 'To scale', 0.05 ],
			[ 'from_rotation', 'From rotation', 1 ],
			[ 'to_rotation', 'To rotation', 1 ],
		],
		'stagger-sequence': [
			[ 'duration', 'Duration', 0.05 ],
			[ 'stagger', 'Stagger delay', 0.01 ],
			[ 'from_y', 'From Y', 1 ],
			[ 'from_opacity', 'From opacity', 0.05 ],
			[ 'from_scale', 'From scale', 0.05 ],
			[ 'from_rotation', 'From rotation', 1 ],
		],
		'css-reveal': [
			[ 'duration', 'Duration', 0.05 ],
			[ 'delay', 'Delay', 0.05 ],
			[ 'from_y', 'From Y', 1 ],
		],
	};

	return (
		<section
			className="ctb-block-actions"
			aria-label={ `Animations for ${ block.id }` }
		>
			<p className="ctb-style-group-title">Motion</p>
			<p>
				CSS reveal adds no JavaScript. Scroll and stagger load GSAP and
				ScrollTrigger only on pages that use them.
			</p>
			<div className="ctb-structure-controls">
				<button
					type="button"
					disabled={ animations.some(
						( item ) => item.action.behavior === 'css-reveal'
					) }
					onClick={ () =>
						addBlockAction(
							block.id,
							defaultGsapAction( 'css-reveal', block.id )
						)
					}
				>
					Add CSS reveal
				</button>
				<button
					type="button"
					disabled={ animations.some(
						( item ) => item.action.behavior === 'scroll-scrub'
					) }
					onClick={ () =>
						addBlockAction(
							block.id,
							defaultGsapAction( 'scroll-scrub', block.id )
						)
					}
				>
					Add scroll scrub
				</button>
				<button
					type="button"
					disabled={ animations.some(
						( item ) => item.action.behavior === 'stagger-sequence'
					) }
					onClick={ () =>
						addBlockAction(
							block.id,
							defaultGsapAction( 'stagger-sequence', block.id )
						)
					}
				>
					Add child stagger
				</button>
			</div>
			{ animations.map( ( { action, index } ) => (
				<div
					className="ctb-block-action"
					key={ `${ action.behavior }:${ index }` }
				>
					<strong>
						{ action.behavior === 'scroll-scrub'
							? 'Scroll scrub'
							: action.behavior === 'stagger-sequence'
							? 'Stagger children'
							: 'CSS reveal' }
					</strong>
					{ action.behavior !== 'css-reveal' ? (
						<label className="ctb-slot-label-input">
							<span>Start</span>
							<select
								value={ action.params.start }
								onChange={ ( event ) =>
									updateParam(
										index,
										action,
										'start',
										event.target.value
									)
								}
							>
								<option value="top bottom">
									Top enters viewport
								</option>
								<option value="top 85%">Top reaches 85%</option>
								<option value="top center">
									Top reaches center
								</option>
								<option value="center center">
									Centers align
								</option>
							</select>
						</label>
					) : null }
					{ action.behavior === 'scroll-scrub' ? (
						<label className="ctb-slot-label-input">
							<span>End</span>
							<select
								value={ action.params.end }
								onChange={ ( event ) =>
									updateParam(
										index,
										action,
										'end',
										event.target.value
									)
								}
							>
								<option value="bottom top">
									Bottom leaves viewport
								</option>
								<option value="bottom 20%">
									Bottom reaches 20%
								</option>
								<option value="+=500">
									500px scroll distance
								</option>
								<option value="+=1000">
									1000px scroll distance
								</option>
							</select>
						</label>
					) : null }
					{ action.behavior !== 'css-reveal' ? (
						<label className="ctb-slot-label-input">
							<span>Ease</span>
							<select
								value={ action.params.ease }
								onChange={ ( event ) =>
									updateParam(
										index,
										action,
										'ease',
										event.target.value
									)
								}
							>
								<option value="none">None</option>
								<option value="power1.out">Power 1</option>
								<option value="power2.out">Power 2</option>
								<option value="power3.out">Power 3</option>
							</select>
						</label>
					) : null }
					<div className="ctb-mapped-style-controls">
						{ numberFields[ action.behavior ].map(
							( [ key, label, step ] ) => (
								<label
									className="ctb-mapped-style-field"
									key={ key }
								>
									<span>{ label }</span>
									<input
										type="number"
										step={ step }
										value={ action.params[ key ] }
										onChange={ ( event ) =>
											updateParam(
												index,
												action,
												key,
												Number( event.target.value )
											)
										}
									/>
								</label>
							)
						) }
					</div>
					<button
						type="button"
						onClick={ () => removeBlockAction( block.id, index ) }
					>
						Remove animation
					</button>
				</div>
			) ) }
		</section>
	);
}

export function BlockActions( { block } ) {
	const actions = ( block.actions || [] ).filter(
		( action ) =>
			! GSAP_ANIMATION_BEHAVIORS.has( action.behavior ) &&
			! CSS_ANIMATION_BEHAVIORS.has( action.behavior )
	);
	if ( ! actions.length ) {
		return null;
	}

	return (
		<section
			className="ctb-block-actions"
			aria-label={ `Actions for ${ block.id }` }
		>
			<p className="ctb-style-group-title">Action bindings</p>
			{ actions.map( ( action, index ) => {
				const unverified = action.behavior === 'unverified-script';
				return (
					<div
						key={ `${ action.trigger }:${ action.behavior }:${ index }` }
						className={ `ctb-block-action${
							unverified ? ' is-unverified' : ''
						}` }
					>
						<strong>
							{ unverified
								? 'Unverified script / never executed'
								: `${ action.trigger } -> ${ action.behavior }` }
						</strong>
						{ unverified ? (
							<>
								<p>{ action.params.description }</p>
								<pre>{ action.params.code }</pre>
							</>
						) : (
							<p>
								Target{ ' ' }
								<code>{ action.params.target_block_id }</code>
								{ action.params.class_name
									? ` / .${ action.params.class_name }`
									: '' }
							</p>
						) }
					</div>
				);
			} ) }
		</section>
	);
}

