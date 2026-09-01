import {
	DEFAULT_BREAKPOINTS,
	DOCUMENT_SCHEMA_VERSION,
	REGISTRY_VERSION,
	canonicalize,
	formatContextKey,
} from '../schema-v3.mjs';
import { inferElementDefinition } from '../elements/registry.mjs';

function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function hasStyleValue( styleSet ) {
	return Boolean(
		styleSet &&
			( Object.keys( styleSet.mapped || {} ).length ||
				String( styleSet.custom_css_fallback || '' ).trim() ||
				Object.keys( styleSet.token_bindings || {} ).length ||
				Object.keys( styleSet.role_bindings || {} ).length )
	);
}

function migrateStyleSet( source, report, sourcePath, targetPath ) {
	const styleSet = source || {};
	const result = {};
	if ( Object.keys( styleSet.mapped || {} ).length ) {
		result.declarations = clone( styleSet.mapped );
		report.push( {
			source: `${ sourcePath }.mapped`,
			target: `${ targetPath }.declarations`,
			action: 'moved',
			confidence: 1,
		} );
	}
	if ( Object.keys( styleSet.token_bindings || {} ).length )
		result.token_bindings = clone( styleSet.token_bindings );
	if ( Object.keys( styleSet.role_bindings || {} ).length )
		result.role_bindings = clone( styleSet.role_bindings );
	if ( String( styleSet.custom_css_fallback || '' ).trim() ) {
		result.custom_declarations = String(
			styleSet.custom_css_fallback
		).trim();
		report.push( {
			source: `${ sourcePath }.custom_css_fallback`,
			target: `${ targetPath }.custom_declarations`,
			action: 'preserved',
			confidence: 1,
		} );
	}
	return result;
}

function migrateBlock( sourceBlock, path, report ) {
	const source = clone( sourceBlock );
	const inference = inferElementDefinition( source );
	const definition = inference.definition;
	const contexts = {};
	if ( hasStyleValue( source.styles ) ) {
		contexts.base = migrateStyleSet(
			source.styles,
			report,
			`${ path }.styles`,
			`${ path }.style.targets.root.contexts.base`
		);
	}
	for ( const breakpoint of [ 'tablet', 'mobile' ] ) {
		const value = source.responsive_overrides?.[ breakpoint ];
		if ( hasStyleValue( value ) ) {
			const contextKey = formatContextKey( breakpoint, 'default' );
			contexts[ contextKey ] = migrateStyleSet(
				value,
				report,
				`${ path }.responsive_overrides.${ breakpoint }`,
				`${ path }.style.targets.root.contexts.${ contextKey }`
			);
		}
	}
	for ( const state of [ 'hover', 'focus', 'active' ] ) {
		const value = source.states?.[ state ];
		if ( hasStyleValue( value ) ) {
			const contextKey = formatContextKey( 'desktop', state );
			contexts[ contextKey ] = migrateStyleSet(
				value,
				report,
				`${ path }.states.${ state }`,
				`${ path }.style.targets.root.contexts.${ contextKey }`
			);
		}
	}
	report.push( {
		source: path,
		target: `${ path }.element`,
		action: 'inferred',
		confidence: inference.confidence,
		reason: inference.reason,
		warning:
			inference.confidence < 0.75
				? 'Ambiguous element retained as a Legacy Element.'
				: '',
	} );
	const block = {
		id: source.id,
		element: definition.id,
		definition_version: definition.version,
		type: source.type,
		tag: source.tag,
		props: clone( source.props || {} ),
		attributes: clone( source.attributes || {} ),
		children: ( source.children || [] ).map( ( child, index ) =>
			child?.kind === 'text'
				? clone( child )
				: migrateBlock(
						child,
						`${ path }.children[${ index }]`,
						report
				  )
		),
		style: Object.keys( contexts ).length
			? { targets: { root: { contexts } } }
			: { targets: {} },
		advanced: {},
		meta: clone( source.meta || { source: 'legacy-migration' } ),
	};
	if ( source.visibility_conditions )
		block.advanced.conditions = clone( source.visibility_conditions );
	if ( source.permissions )
		block.advanced.permissions = clone( source.permissions );
	if ( source.performance )
		block.advanced.performance = clone( source.performance );
	if ( source.actions ) block.advanced.actions = clone( source.actions );
	if ( source.is_dynamic ) {
		block.props.dynamic = true;
		block.props.dynamicSource = source.dynamic_source || '';
	}
	if ( source.is_content_slot ) {
		block.props.slot = {
			label: source.slot_label || '',
			type: source.slot_content_type || 'text',
		};
	}
	if ( source.meta?.imported_css_rules ) {
		block.style.legacy = {
			imported_css_rules: clone( source.meta.imported_css_rules ),
		};
	}
	return canonicalize( block );
}

export function migrateDocumentToV3( sourceDocument ) {
	if ( sourceDocument?.schema_version === DOCUMENT_SCHEMA_VERSION ) {
		return {
			document: canonicalize( clone( sourceDocument ) ),
			report: [],
			alreadyCurrent: true,
		};
	}
	if ( ! [ 1, 2 ].includes( sourceDocument?.schema_version ) ) {
		throw new Error(
			'Only schema versions 1 and 2 can be migrated to version 3.'
		);
	}
	const report = [];
	const document = {
		schema_version: DOCUMENT_SCHEMA_VERSION,
		registry_version: REGISTRY_VERSION,
		name: sourceDocument.name,
		breakpoints: clone( DEFAULT_BREAKPOINTS ),
		root: migrateBlock( sourceDocument.root, '$.root', report ),
		migration_log: [
			{
				from: sourceDocument.schema_version,
				to: DOCUMENT_SCHEMA_VERSION,
				source_hash: stableStringify( canonicalize( sourceDocument ) ),
				warnings: report.filter( ( entry ) => entry.warning ).length,
			},
		],
	};
	for ( const field of [
		'design_tokens',
		'style_roles',
		'feature_flags',
		'slot_values',
		'imported_assets',
		'seo',
	] ) {
		if ( sourceDocument[ field ] !== undefined )
			document[ field ] = clone( sourceDocument[ field ] );
	}
	return {
		document: canonicalize( document ),
		report,
		alreadyCurrent: false,
	};
}

export function adaptDocumentForEditor( sourceDocument ) {
	if ( sourceDocument?.schema_version === DOCUMENT_SCHEMA_VERSION ) {
		return { document: clone( sourceDocument ), mode: 'v3', report: [] };
	}
	const migration = migrateDocumentToV3( sourceDocument );
	return {
		...migration,
		mode: 'legacy-preview',
		sourceDocument: clone( sourceDocument ),
	};
}

export function stableStringify( value ) {
	return JSON.stringify( canonicalize( value ) );
}
