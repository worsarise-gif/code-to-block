import { attributesObject } from '../html/HtmlDocumentParser.mjs';

/**
 * Extracts script assets from the decomposed document.
 * Applies the initial execution policy based on source types.
 *
 * @param {Object} head Head model from decomposeImportedDocument
 * @param {Array<Element>} renderRoots Render roots from decomposeImportedDocument
 * @returns {Array<Object>} Array of ImportedScriptAsset
 */
export function extractScriptAssets( head, renderRoots ) {
	const scripts = [];
	let scriptId = 0;

	// Extract scripts from head
	if ( head.scriptElements ) {
		for ( const scriptEl of head.scriptElements ) {
			scripts.push( createScriptAsset( scriptEl, 'head', ++scriptId ) );
		}
	}

	// Extract scripts from body (recursive)
	for ( const root of renderRoots ) {
		extractBodyScripts( root, scripts, () => ++scriptId );
	}

	return scripts;
}

function extractBodyScripts( element, scripts, nextId ) {
	// If it's a script tag itself
	if ( element.tagName.toLowerCase() === 'script' ) {
		scripts.push( createScriptAsset( element, 'body', nextId() ) );
		// We remove it from the DOM so it doesn't get converted into a visual block
		element.remove();
		return;
	}

	// Check for inline event handlers (e.g., onclick)
	for ( const attr of Array.from( element.attributes ) ) {
		if ( attr.name.startsWith( 'on' ) ) {
			scripts.push( {
				id: `script-${ nextId() }`,
				sourceType: 'event-handler',
				source: attr.value,
				placement: 'inline',
				attributes: { event: attr.name },
				executionPolicy: 'disabled', // Disabled in editor for safety
				securityStatus: 'requires-trust',
			} );
			// Remove the inline event handler for safety during parsing
			element.removeAttribute( attr.name );
		}
	}

	// Recurse down
	// We iterate backwards because we might remove children
	for ( let i = element.children.length - 1; i >= 0; i-- ) {
		extractBodyScripts( element.children[ i ], scripts, nextId );
	}
}

function createScriptAsset( element, placement, id ) {
	const attributes = attributesObject( element );
	const isExternal = !! attributes.src;
	
	return {
		id: `script-${ id }`,
		sourceType: isExternal ? 'external-script' : 'inline-script',
		source: element.textContent || '',
		src: attributes.src || undefined,
		placement,
		type: attributes.type || 'text/javascript',
		async: attributes.async !== undefined,
		defer: attributes.defer !== undefined,
		module: attributes.type === 'module',
		attributes,
		executionPolicy: 'preview-only', // Safe default
		securityStatus: 'requires-trust',
	};
}
