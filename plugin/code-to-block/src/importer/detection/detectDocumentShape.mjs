/**
 * Analyzes the raw source code string and returns an advisory classification
 * of its contents before rigorous parsing.
 *
 * The result is used to inform the downstream normalizers and parsers,
 * but it does not rigidly dictate exactly how the DOMParser behaves.
 *
 * @param {string} source
 * @returns {Object} ImportDetectionResult
 */
export function detectImportedSource( source ) {
	const result = {
		containsHtml: false,
		containsCss: false,
		containsJavaScript: false,
		containsPhp: false,
		documentShape: 'unknown', // full-document, body-document, headless-document, fragment, single-node, mixed-source
		hasDoctype: false,
		hasHtmlElement: false,
		hasHeadElement: false,
		hasBodyElement: false,
		styleBlocks: 0,
		scriptBlocks: 0,
		externalStylesheets: 0,
		externalScripts: 0,
		transportEncoding: 'raw', // raw, escaped-rich-text, markdown-code, mixed
		malformedLikely: false,
	};

	if ( typeof source !== 'string' ) {
		return result;
	}

	// Basic presence checks (Advisory only)
	result.containsPhp = /<\?php/i.test( source );
	result.hasDoctype = /<!doctype\s+html/i.test( source );
	result.hasHtmlElement = /<html/i.test( source );
	result.hasHeadElement = /<head/i.test( source );
	result.hasBodyElement = /<body/i.test( source );

	// Block counts
	const styleMatches = source.match( /<style[\s>]/gi );
	result.styleBlocks = styleMatches ? styleMatches.length : 0;

	const scriptMatches = source.match( /<script[\s>]/gi );
	result.scriptBlocks = scriptMatches ? scriptMatches.length : 0;

	const externalStyleMatches = source.match( /<link[^>]+rel=["']stylesheet["']/gi );
	result.externalStylesheets = externalStyleMatches ? externalStyleMatches.length : 0;

	const externalScriptMatches = source.match( /<script[^>]+src=["']/gi );
	result.externalScripts = externalScriptMatches ? externalScriptMatches.length : 0;

	// Determine languages present
	result.containsHtml = /<[a-z]+[\s>]/i.test( source );
	result.containsCss = result.styleBlocks > 0 || ( ! result.containsHtml && /[\.\#][a-z0-9_-]+\s*\{/i.test( source ) );
	result.containsJavaScript = result.scriptBlocks > 0 || ( ! result.containsHtml && /const |let |var |function |=>/i.test( source ) );

	// Determine document shape
	if ( result.hasDoctype || result.hasHtmlElement ) {
		result.documentShape = 'full-document';
	} else if ( result.hasBodyElement ) {
		result.documentShape = 'body-document';
	} else if ( result.hasHeadElement || result.styleBlocks > 0 || result.scriptBlocks > 0 ) {
		result.documentShape = 'headless-document';
	} else if ( result.containsHtml ) {
		// Differentiate between fragment and single-node
		const firstTag = source.match( /^\s*(<[a-z0-9-]+[^>]*>)/i );
		const lastTag = source.match( /(<\/[a-z0-9-]+>)\s*$/i );
		if ( firstTag && lastTag ) {
			// Very naive single-node check (advisory). The actual parser validates this.
			result.documentShape = 'single-node';
		} else {
			result.documentShape = 'fragment';
		}
	} else if ( result.containsCss && ! result.containsHtml ) {
		result.documentShape = 'mixed-source';
	}

	// Determine encoding
	if ( /&#[0-9x]+;/.test( source ) || /&lt;/.test( source ) || /\\</.test( source ) ) {
		result.transportEncoding = 'escaped-rich-text';
	} else if ( /```html/.test( source ) ) {
		result.transportEncoding = 'markdown-code';
	}

	return result;
}
