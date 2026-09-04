const CODE_FENCE =
	/^\s*```(html|css|javascript|js|php)?\s*\n([\s\S]*?)\n```\s*$/i;

function normalizedLanguage( language ) {
	return String( language || '' ).toLowerCase() === 'js'
		? 'javascript'
		: String( language || '' ).toLowerCase();
}

export function readCodeFence( rawSource ) {
	const match = String( rawSource || '' )
		.replace( /\r\n?/g, '\n' )
		.match( CODE_FENCE );
	return match
		? { language: normalizedLanguage( match[ 1 ] ), source: match[ 2 ] }
		: null;
}

export function detectTransportEncoding( rawSource ) {
	const source = String( rawSource || '' );
	const fenced = Boolean( readCodeFence( source ) );
	const escaped = /\\<(?:!doctype|\/?[a-z][\w:-]*\b)/i.test( source );
	if ( fenced && escaped ) {
		return 'mixed';
	}
	if ( fenced ) {
		return 'markdown-code';
	}
	if ( escaped ) {
		return /(?:^|[^\\])<(?:!doctype|\/?[a-z][\w:-]*\b)/i.test( source )
			? 'mixed'
			: 'escaped-rich-text';
	}
	return 'raw';
}

function looksLikeStandaloneCss( source ) {
	return (
		/(?:^|})\s*(?:@(?:media|supports|container|font-face|keyframes|layer)\b|[^{};]+)\s*\{[\s\S]*\}\s*$/i.test(
			source
		) &&
		/(?:^|[;{])\s*(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)\s*:/i.test( source )
	);
}

function looksLikeStandaloneJavaScript( source ) {
	return /(?:^|[;{}\n])\s*(?:import\s|export\s|(?:const|let|var|class|function)\s+[A-Za-z_$]|document\.|window\.|console\.|[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(?:addEventListener|querySelector|getElementById|alert|setTimeout|setInterval|fetch)\s*\()/m.test(
		source
	);
}

export function detectDocumentShape( source, signals = {} ) {
	const value = String( source || '' );
	const hasDoctype =
		signals.hasDoctype ?? /<!doctype\s+html(?:\s|>)/i.test( value );
	const hasHtmlElement =
		signals.hasHtmlElement ?? /<html(?:\s|>)/i.test( value );
	if ( hasDoctype || hasHtmlElement ) {
		return 'full-document';
	}
	const hasBodyElement =
		signals.hasBodyElement ?? /<body(?:\s|>)/i.test( value );
	if ( hasBodyElement ) {
		return 'body-document';
	}
	const hasHeadElement =
		signals.hasHeadElement ?? /<head(?:\s|>)/i.test( value );
	const hasVisualMarkup =
		/<(?!\/?(?:html|head|body|title|meta|link|style|script|base)\b)[a-z][\w:-]*(?:\s|\/?>)/i.test(
			value
		);
	const hasHeadAssets =
		/<(?:title|meta|link|style|script|base)(?:\s|>)/i.test( value );

	if ( hasHeadElement || ( hasHeadAssets && hasVisualMarkup ) ) {
		return 'headless-document';
	}
	if ( hasVisualMarkup && hasHeadAssets ) {
		return 'mixed-source';
	}
	if ( hasVisualMarkup ) {
		const starts = value.match( /<[a-z][\w:-]*(?:\s|\/?>)/gi ) || [];
		return starts.length === 1 ? 'single-node' : 'fragment';
	}
	return 'unknown';
}

function malformedLikely( source ) {
	const value = String( source || '' );
	const openAngles = ( value.match( /</g ) || [] ).length;
	const closeAngles = ( value.match( />/g ) || [] ).length;
	return (
		openAngles !== closeAngles ||
		/<(?:html|head|body)\b[^>]*$|<\/[a-z][\w:-]*\s*$/im.test( value )
	);
}

/**
 * Advisory capability detection. The HTML parser remains authoritative.
 *
 * @param {string} rawSource Source pasted into the importer.
 * @return {Object} Source capabilities and document-shape signals.
 */
export function detectImportedSource( rawSource ) {
	const raw = String( rawSource || '' ).replace( /\r\n?/g, '\n' );
	const fence = readCodeFence( raw );
	const source = fence?.source || raw;
	const fenceLanguage = fence?.language || '';
	const hasDoctype = /<!doctype\s+html(?:\s|>)/i.test( source );
	const hasHtmlElement = /<html(?:\s|>)/i.test( source );
	const hasHeadElement = /<head(?:\s|>)/i.test( source );
	const hasBodyElement = /<body(?:\s|>)/i.test( source );
	const tagMarkup =
		/<(?:meta|title|style|script|link|base|\/?[a-z][\w:-]*)(?:\s|\/?>)/i.test(
			source
		);
	const containsPhp =
		/<\?(?:php\b|=)/i.test( source ) || fenceLanguage === 'php';
	const hasWpTemplateHeader =
		/(?:\/\*[\s\S]*?Template Name:[^\r\n*]+[\s\S]*?\*\/)/i.test( source );
	const hasWpTemplateTags =
		/\b(?:get_header|get_footer|get_sidebar|the_title|the_content|the_post|have_posts|wp_head|wp_footer)\s*\(/i.test(
			source
		);
	const hasPhpEchoMarkup =
		/(?:echo|print)\s*(?:<<<['"]?HTML['"]?[\s\S]*?HTML;|['"][^'"]*<[a-z][\w:-]*[^'"]*['"])/i.test(
			source
		);
	const styleBlocks = ( source.match( /<style(?:\s|>)/gi ) || [] ).length;
	const scriptBlocks = ( source.match( /<script(?:\s|>)/gi ) || [] ).length;
	const standaloneCss =
		fenceLanguage === 'css' ||
		( ! tagMarkup && ! containsPhp && looksLikeStandaloneCss( source ) );
	const standaloneJavaScript =
		fenceLanguage === 'javascript' ||
		( ! tagMarkup &&
			! containsPhp &&
			! standaloneCss &&
			looksLikeStandaloneJavaScript( source ) );
	const containsHtml =
		( tagMarkup || hasPhpEchoMarkup ) &&
		! standaloneCss &&
		! standaloneJavaScript;
	const containsCss =
		styleBlocks > 0 ||
		standaloneCss ||
		/(?:echo|print)[\s\S]*?<style(?:\s|>)/i.test( source );
	const containsJavaScript =
		scriptBlocks > 0 ||
		standaloneJavaScript ||
		/(?:echo|print)[\s\S]*?<script(?:\s|>)/i.test( source );
	const documentShape = detectDocumentShape( source, {
		hasDoctype:
			hasDoctype ||
			( hasWpTemplateTags &&
				/\bget_header\b/i.test( source ) &&
				/\bget_footer\b/i.test( source ) ),
		hasHtmlElement,
		hasHeadElement,
		hasBodyElement,
	} );
	const languages = [];
	if ( containsHtml ) {
		languages.push( 'html' );
	}
	if ( containsCss ) {
		languages.push( 'css' );
	}
	if ( containsJavaScript ) {
		languages.push( 'javascript' );
	}
	if ( containsPhp ) {
		languages.push( 'php' );
	}

	let sourceType = 'plain-text';
	if ( documentShape === 'full-document' ) {
		sourceType = 'full-document';
	} else if (
		containsPhp &&
		( containsHtml ||
			containsCss ||
			containsJavaScript ||
			hasWpTemplateHeader ||
			hasWpTemplateTags )
	) {
		sourceType = 'php-template';
	} else if ( languages.length > 1 ) {
		sourceType = 'mixed';
	} else if ( containsHtml ) {
		sourceType = 'html-fragment';
	} else if ( standaloneCss ) {
		sourceType = 'stylesheet';
	} else if ( standaloneJavaScript ) {
		sourceType = 'javascript';
	} else if ( containsPhp ) {
		sourceType = 'php';
	}

	return {
		containsHtml,
		containsCss,
		containsJavaScript,
		containsPhp,
		documentShape,
		hasDoctype,
		hasHtmlElement,
		hasHeadElement,
		hasBodyElement,
		styleBlocks,
		scriptBlocks,
		externalStylesheets: (
			source.match(
				/<link\b(?=[^>]*\brel\s*=\s*["']?stylesheet\b)[^>]*>/gi
			) || []
		).length,
		externalScripts: (
			source.match( /<script\b(?=[^>]*\bsrc\s*=)[^>]*>/gi ) || []
		).length,
		transportEncoding: detectTransportEncoding( raw ),
		malformedLikely: containsHtml && malformedLikely( source ),

		// Compatibility aliases consumed by existing importer callers.
		source_type: sourceType,
		languages,
		full_document: documentShape === 'full-document',
		has_html: containsHtml,
		standalone_css: standaloneCss,
		standalone_javascript: standaloneJavaScript,
		has_php: containsPhp,
		hasWpTemplateHeader,
		hasWpTemplateTags,
		is_wordpress_template: hasWpTemplateHeader || hasWpTemplateTags,
		fenced_language: fenceLanguage,
	};
}
