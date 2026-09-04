import { getElement } from './registry.mjs';

const FIELD_TYPES = new Set( [
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
] );

function attributeIsTrue( value ) {
	if ( value === true || value === 1 ) {
		return true;
	}
	return (
		typeof value === 'string' &&
		[ '1', 'true', 'yes', 'on' ].includes( value.trim().toLowerCase() )
	);
}

function ownValue( source, key, fallback ) {
	return Object.prototype.hasOwnProperty.call( source, key )
		? source[ key ]
		: fallback;
}

function stringValue( value, fallback = '' ) {
	return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeOptions( value ) {
	let source = [];
	if ( Array.isArray( value ) ) {
		source = value;
	} else if ( typeof value === 'string' ) {
		source = value.split( ',' );
	}
	return Object.freeze(
		source
			.map( ( option ) => {
				if ( typeof option === 'string' ) {
					const label = option.trim();
					return label ? { label, value: label } : null;
				}
				if ( ! option || typeof option !== 'object' ) {
					return null;
				}
				const label = stringValue(
					option.label,
					stringValue( option.value )
				);
				const optionValue = stringValue( option.value, label );
				return label ? { label, value: optionValue } : null;
			} )
			.filter( Boolean )
			.map( Object.freeze )
	);
}

/**
 * Resolve semantic v3 field props with legacy data attributes as a fallback.
 *
 * @param {Object} block Element block.
 * @return {Object|null} Form Field render model or null for another element.
 */
export function resolveFormFieldRenderModel( block ) {
	const definition = getElement( block?.element );
	if (
		block?.element !== 'forms/field-group' ||
		definition?.rendererFamily !== 'form_field'
	) {
		return null;
	}

	const props = block.props || {};
	const attributes = block.attributes || {};
	const requestedType = stringValue(
		ownValue( props, 'fieldType', attributes[ 'data-field-type' ] ),
		'text'
	).toLowerCase();
	const fieldType = FIELD_TYPES.has( requestedType ) ? requestedType : 'text';
	const label = stringValue(
		ownValue( props, 'label', attributes[ 'data-field-label' ] )
	);
	const name =
		stringValue(
			ownValue( props, 'name', attributes[ 'data-field-name' ] )
		) || String( block.id || 'field' );
	const placeholder = stringValue(
		ownValue( props, 'placeholder', attributes[ 'data-field-placeholder' ] )
	);
	const help = stringValue( ownValue( props, 'help', '' ) );
	const required = attributeIsTrue(
		ownValue( props, 'required', attributes[ 'data-field-required' ] )
	);
	const options = normalizeOptions(
		ownValue( props, 'options', attributes[ 'data-field-options' ] )
	);
	const id = String( block.id || 'field' );

	return Object.freeze( {
		fieldType,
		label,
		name,
		placeholder,
		help,
		required,
		options,
		controlId: `${ id }-input`,
		labelId: `${ id }-label`,
		helpId: `${ id }-help`,
		errorId: `${ id }-error`,
	} );
}

function controlAttributes( model, id, createOptions, extra = {} ) {
	return {
		id,
		name: model.name,
		'data-ctb-part': 'control',
		required: model.required,
		'aria-required': model.required ? 'true' : undefined,
		'aria-describedby': model.help ? model.helpId : undefined,
		'aria-errormessage': model.errorId,
		disabled: createOptions.disabled,
		...extra,
	};
}

/**
 * Create the editor-owned row and registered Form Field target nodes.
 *
 * @param {Object}   block         Element block.
 * @param {Function} createNode    Renderer-provided element factory.
 * @param {Object}   createOptions Rendering options.
 * @return {Array|null} Form Field nodes, or null for another element.
 */
export function createFormFieldTargetNodes(
	block,
	createNode,
	createOptions = { disabled: true }
) {
	const model = resolveFormFieldRenderModel( block );
	if ( ! model || typeof createNode !== 'function' ) {
		return null;
	}

	const options = {
		disabled: createOptions.disabled !== false,
	};
	const requiredMark = model.required
		? createNode(
				'span',
				{
					key: 'required-mark',
					'data-ctb-part': 'requiredMark',
					'aria-hidden': 'true',
				},
				'*'
		  )
		: null;
	const choiceField = [ 'checkbox', 'radio' ].includes( model.fieldType );
	const labelNode = createNode(
		choiceField ? 'span' : 'label',
		{
			key: 'field-label',
			id: model.labelId,
			htmlFor: choiceField ? undefined : model.controlId,
			'data-ctb-part': 'label',
		},
		model.label,
		requiredMark
	);

	let controlNode;
	if ( model.fieldType === 'textarea' ) {
		controlNode = createNode( 'textarea', {
			key: 'field-control',
			...controlAttributes( model, model.controlId, options, {
				placeholder: model.placeholder,
				rows: 4,
			} ),
		} );
	} else if ( model.fieldType === 'select' ) {
		const optionNodes = [
			createNode(
				'option',
				{ key: 'placeholder-option', value: '' },
				model.placeholder || 'Select...'
			),
			...model.options.map( ( option, index ) =>
				createNode(
					'option',
					{ key: `option-${ index }`, value: option.value },
					option.label
				)
			),
		];
		controlNode = createNode(
			'select',
			{
				key: 'field-control',
				...controlAttributes( model, model.controlId, options ),
			},
			optionNodes
		);
	} else if ( choiceField ) {
		const choiceOptions = model.options.length
			? model.options
			: [
					{
						label: model.label || 'Option',
						value: model.label || 'Option',
					},
			  ];
		controlNode = createNode(
			'div',
			{
				key: 'field-options',
				className: 'ctb-form-options',
				role: 'group',
				'aria-labelledby': model.label ? model.labelId : undefined,
			},
			choiceOptions.map( ( option, index ) =>
				createNode(
					'label',
					{ key: `choice-${ index }`, className: 'ctb-form-option' },
					createNode( 'input', {
						...controlAttributes(
							model,
							`${ model.controlId }-${ index }`,
							options,
							{
								type: model.fieldType,
								name:
									model.fieldType === 'checkbox'
										? `${ model.name }[]`
										: model.name,
								value: option.value,
							}
						),
					} ),
					createNode( 'span', null, option.label )
				)
			)
		);
	} else {
		controlNode = createNode( 'input', {
			key: 'field-control',
			...controlAttributes( model, model.controlId, options, {
				type: model.fieldType,
				placeholder:
					model.fieldType === 'file' ? undefined : model.placeholder,
			} ),
		} );
	}

	return [
		createNode(
			'div',
			{
				key: 'field-row',
				className: 'ctb-form-field',
				'data-field-type': model.fieldType,
				'data-ctb-part': 'row',
			},
			labelNode,
			controlNode,
			createNode(
				'small',
				{
					key: 'field-help',
					id: model.helpId,
					'data-ctb-part': 'help',
					hidden: ! model.help,
				},
				model.help
			),
			createNode( 'span', {
				key: 'field-error',
				id: model.errorId,
				'data-ctb-part': 'error',
				role: 'alert',
				'aria-live': 'polite',
				hidden: true,
			} )
		),
	];
}
