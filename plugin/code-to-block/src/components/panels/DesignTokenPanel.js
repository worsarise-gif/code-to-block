import { useEffect, useState } from '@wordpress/element';
import '../../editor.css';
import { countTokenConsumers, TOKEN_CATEGORIES, tokenIdFromLabel, tokenIdIsValid, tokenReference } from '../../design-tokens.mjs';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';
import { tokenValueIsValid } from '../../utils/editor-utils.js';

export function DesignTokenRow( { category, id, token, usage, onSave, onDelete } ) {
	const [ label, setLabel ] = useState( token.label );
	const [ value, setValue ] = useState( token.value );
	const [ error, setError ] = useState( '' );
	const changed = label !== token.label || value !== token.value;

	useEffect( () => {
		setLabel( token.label );
		setValue( token.value );
		setError( '' );
	}, [ token.label, token.value ] );

	function saveToken() {
		const nextLabel = label.trim();
		if ( ! nextLabel ) {
			setError( 'Token name is required.' );
			return;
		}
		const nextValue = value.trim();
		if ( ! nextValue || ! tokenValueIsValid( category, nextValue ) ) {
			setError( 'Enter a valid value for this token category.' );
			return;
		}
		onSave( category, id, { label: nextLabel, value: nextValue } );
		setError( '' );
	}

	return (
		<div className="ctb-token-row">
			<div className="ctb-token-row-heading">
				<code>{ id }</code>
				<span>{ usage } uses</span>
			</div>
			<label htmlFor={ `ctb-token-${ category }-${ id }-label` }>
				<span>Name</span>
				<input
					id={ `ctb-token-${ category }-${ id }-label` }
					type="text"
					value={ label }
					onChange={ ( event ) => setLabel( event.target.value ) }
				/>
			</label>
			<label htmlFor={ `ctb-token-${ category }-${ id }-value` }>
				<span>Value</span>
				<input
					id={ `ctb-token-${ category }-${ id }-value` }
					type="text"
					value={ value }
					onChange={ ( event ) => setValue( event.target.value ) }
				/>
			</label>
			<div className="ctb-token-row-actions">
				<button
					type="button"
					disabled={ ! changed }
					onClick={ saveToken }
				>
					Update
				</button>
				<button
					type="button"
					disabled={ usage > 0 }
					title={
						usage ? 'Remove token references before deleting.' : ''
					}
					onClick={ () => onDelete( category, id ) }
				>
					Delete
				</button>
			</div>
			{ error ? (
				<p className="ctb-token-error" role="alert">
					{ error }
				</p>
			) : null }
		</div>
	);
}

export function DesignTokenPanel( { document, onSave, onDelete } ) {
	const [ category, setCategory ] = useState( 'colors' );
	const [ label, setLabel ] = useState( '' );
	const [ value, setValue ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const tokenCount = TOKEN_CATEGORIES.reduce(
		( total, item ) =>
			total +
			Object.keys( document.design_tokens?.[ item.id ] || {} ).length,
		0
	);

	function addToken() {
		const id = tokenIdFromLabel( label );
		if ( ! tokenIdIsValid( id ) ) {
			setError( 'Use a name beginning with a letter.' );
			return;
		}
		if ( document.design_tokens?.[ category ]?.[ id ] ) {
			setError( 'A token with this generated ID already exists.' );
			return;
		}
		const nextValue = value.trim();
		if ( ! nextValue || ! tokenValueIsValid( category, nextValue ) ) {
			setError( 'Enter a valid value for this token category.' );
			return;
		}
		const nextLabel = label.trim();
		onSave( category, id, { label: nextLabel, value: nextValue } );
		setLabel( '' );
		setValue( '' );
		setError( '' );
	}

	return (
		<details className="ctb-design-token-panel">
			<summary>
				<span>Global design tokens</span>
				<small>{ tokenCount } defined</small>
			</summary>
			<p className="ctb-token-help">
				Define once, then link compatible controls on any block.
			</p>
			<div className="ctb-token-create">
				<label htmlFor="ctb-token-category">
					<span>Category</span>
					<select
						id="ctb-token-category"
						value={ category }
						onChange={ ( event ) =>
							setCategory( event.target.value )
						}
					>
						{ TOKEN_CATEGORIES.map( ( item ) => (
							<option key={ item.id } value={ item.id }>
								{ item.label }
							</option>
						) ) }
					</select>
				</label>
				<label htmlFor="ctb-token-new-label">
					<span>Name</span>
					<input
						id="ctb-token-new-label"
						type="text"
						placeholder="Brand"
						value={ label }
						onChange={ ( event ) => setLabel( event.target.value ) }
					/>
				</label>
				<label htmlFor="ctb-token-new-value">
					<span>Value</span>
					<input
						id="ctb-token-new-value"
						type="text"
						placeholder={
							category === 'colors' ? '#6558d3' : '32px'
						}
						value={ value }
						onChange={ ( event ) => setValue( event.target.value ) }
					/>
				</label>
				<button type="button" onClick={ addToken }>
					Add token
				</button>
			</div>
			{ error ? (
				<p className="ctb-token-error" role="alert">
					{ error }
				</p>
			) : null }
			{ TOKEN_CATEGORIES.map( ( item ) => {
				const tokens = Object.entries(
					document.design_tokens?.[ item.id ] || {}
				);
				return tokens.length ? (
					<section key={ item.id } className="ctb-token-category">
						<h4>{ item.label }</h4>
						{ tokens.map( ( [ id, token ] ) => (
							<DesignTokenRow
								key={ id }
								category={ item.id }
								id={ id }
								token={ token }
								usage={ countTokenConsumers(
									document,
									tokenReference( item.id, id )
								) }
								onSave={ onSave }
								onDelete={ onDelete }
							/>
						) ) }
					</section>
				) : null;
			} ) }
		</details>
	);
}

