import '../../editor.css';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';

export function FormsPanel( {
	selectedBlock,
	onInsertForm,
	onInsertField,
	onUpdateField,
	onUpdateFormSettings,
} ) {
	const isForm = selectedBlock?.type === 'form';
	const isField = selectedBlock?.type === 'form_field';
	return (
		<details
			className="ctb-forms-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
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
				<span>Forms — native or external</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					Blocks
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 8px',
				} }
			>
				Build with our blocks, choose where submissions go. One visual
				builder, two destinations (native DB+email or external plugin).
				Native spam defenses are server-side enforced.
			</p>
			<button
				type="button"
				onClick={ () => onInsertForm() }
				style={ {
					width: '100%',
					background: '#171d35',
					color: '#fff',
					border: '1px solid #171d35',
					borderRadius: '3px',
					padding: '8px',
					fontSize: '10px',
					fontWeight: 700,
					cursor: 'pointer',
					marginBottom: '8px',
				} }
			>
				Insert Contact Form after selection
			</button>
			{ isForm ? (
				<div
					style={ {
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
						display: 'grid',
						gap: '8px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>
						Form Settings ({ selectedBlock.id })
					</strong>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Submission Handling</span>
						<select
							value={
								selectedBlock.attributes?.[
									'data-submission'
								] || 'native'
							}
							onChange={ ( e ) =>
								onUpdateFormSettings( selectedBlock.id, {
									'data-submission': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						>
							<option value="native">
								Native (DB + email, server-side spam checks)
							</option>
							<option value="external">
								External Plugin (shortcode)
							</option>
						</select>
					</label>
					{ ( selectedBlock.attributes?.[ 'data-submission' ] ||
						'native' ) === 'native' ? (
						<label
							style={ {
								display: 'grid',
								gap: '4px',
								fontSize: '10px',
								fontWeight: 700,
							} }
						>
							<span>Email To</span>
							<input
								type="text"
								value={
									selectedBlock.attributes?.[
										'data-email-to'
									] || ''
								}
								onChange={ ( e ) =>
									onUpdateFormSettings( selectedBlock.id, {
										'data-email-to': e.target.value,
									} )
								}
								placeholder="admin@example.com"
								style={ { padding: '5px', fontSize: '10px' } }
							/>
							<small
								style={ { color: '#686355', fontWeight: 400 } }
							>
								Uses wp_mail(). Blank = admin_email.
							</small>
						</label>
					) : (
						<label
							style={ {
								display: 'grid',
								gap: '4px',
								fontSize: '10px',
								fontWeight: 700,
							} }
						>
							<span>External Shortcode</span>
							<input
								type="text"
								value={
									selectedBlock.attributes?.[
										'data-external-shortcode'
									] || ''
								}
								onChange={ ( e ) =>
									onUpdateFormSettings( selectedBlock.id, {
										'data-external-shortcode':
											e.target.value,
									} )
								}
								placeholder='[contact-form-7 id="123"]'
								style={ {
									padding: '5px',
									fontSize: '10px',
									fontFamily: 'monospace',
								} }
							/>
							<small
								style={ { color: '#686355', fontWeight: 400 } }
							>
								Only Contact Form 7 / WPForms / Formidable /
								Gravity / Ninja shortcodes are rendered. Others
								show as note.
							</small>
						</label>
					) }
					<div
						style={ {
							display: 'grid',
							gap: '6px',
							marginTop: '6px',
						} }
					>
						<span style={ { fontSize: '10px', fontWeight: 700 } }>
							Add Field to this Form
						</span>
						<div
							style={ {
								display: 'grid',
								gridTemplateColumns: '1fr 1fr',
								gap: '4px',
							} }
						>
							{ [
								'text',
								'email',
								'textarea',
								'select',
								'checkbox',
								'radio',
								'file',
							].map( ( t ) => (
								<button
									key={ t }
									type="button"
									onClick={ () =>
										onInsertField( selectedBlock.id, t )
									}
									style={ {
										padding: '6px',
										fontSize: '9px',
										border: '1px solid #171d35',
										background: '#fff',
										cursor: 'pointer',
										borderRadius: '3px',
									} }
								>
									{ t }
								</button>
							) ) }
						</div>
					</div>
				</div>
			) : null }
			{ isField ? (
				<div
					style={ {
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
						display: 'grid',
						gap: '8px',
						marginTop: '8px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>
						Field: { selectedBlock.id }
					</strong>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Type</span>
						<select
							value={
								selectedBlock.attributes?.[
									'data-field-type'
								] || 'text'
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-type': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						>
							{ [
								'text',
								'email',
								'tel',
								'url',
								'number',
								'textarea',
								'select',
								'checkbox',
								'radio',
								'file',
							].map( ( o ) => (
								<option key={ o } value={ o }>
									{ o }
								</option>
							) ) }
						</select>
					</label>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Label</span>
						<input
							type="text"
							value={
								selectedBlock.attributes?.[
									'data-field-label'
								] || ''
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-label': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						/>
					</label>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Name (field key)</span>
						<input
							type="text"
							value={
								selectedBlock.attributes?.[
									'data-field-name'
								] || ''
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-name': e.target.value,
								} )
							}
							style={ {
								padding: '5px',
								fontSize: '10px',
								fontFamily: 'monospace',
							} }
						/>
					</label>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Placeholder</span>
						<input
							type="text"
							value={
								selectedBlock.attributes?.[
									'data-field-placeholder'
								] || ''
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-placeholder': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						/>
					</label>
					<label
						style={ {
							display: 'flex',
							gap: '6px',
							alignItems: 'center',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<input
							type="checkbox"
							checked={
								!! selectedBlock.attributes?.[
									'data-field-required'
								]
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-required': e.target.checked
										? true
										: '',
								} )
							}
						/>{ ' ' }
						Required
					</label>
					{ [ 'select', 'checkbox', 'radio' ].includes(
						selectedBlock.attributes?.[ 'data-field-type' ]
					) ? (
						<label
							style={ {
								display: 'grid',
								gap: '4px',
								fontSize: '10px',
								fontWeight: 700,
							} }
						>
							<span>Options (comma separated)</span>
							<input
								type="text"
								value={
									selectedBlock.attributes?.[
										'data-field-options'
									] || ''
								}
								onChange={ ( e ) =>
									onUpdateField( selectedBlock.id, {
										'data-field-options': e.target.value,
									} )
								}
								placeholder="Option 1, Option 2"
								style={ { padding: '5px', fontSize: '10px' } }
							/>
						</label>
					) : null }
				</div>
			) : null }
		</details>
	);
}

