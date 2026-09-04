import {
	detectTransportEncoding,
	readCodeFence,
} from '../detection/detect-imported-source.mjs';

function protectRegexLiterals( source ) {
	const protectedValues = [];
	const value = source.replace(
		/(^|[=(,:;!&|?{}\[\]\n]\s*)(\/(?![/*])(?:\\.|[^/\n\\])+\/[dgimsuvy]*)/g,
		( match, prefix, literal ) => {
			const token = `__CTB_REGEX_${ protectedValues.length }__`;
			protectedValues.push( literal );
			return prefix + token;
		}
	);
	return {
		value,
		restore: ( normalized ) =>
			normalized.replace(
				/__CTB_REGEX_(\d+)__/g,
				( match, index ) => protectedValues[ Number( index ) ] ?? match
			),
	};
}

export function normalizeCodeFence( source ) {
	return readCodeFence( source )?.source || String( source || '' );
}

export function normalizeTextEncoding( source ) {
	return String( source || '' )
		.replace( /\r\n?/g, '\n' )
		.replace(
			/^[\uFEFF\u200B-\u200D\u2060]+|[\u200B-\u200D\u2060]+$/g,
			''
		);
}

export function normalizeTransportEscapes( source, encoding ) {
	if ( ! [ 'escaped-rich-text', 'mixed' ].includes( encoding ) ) {
		return source;
	}
	const protectedRegex = protectRegexLiterals( source );
	const normalized = protectedRegex.value
		.replace( /^(?:&#x20;|&#32;)+/gim, ( encoded ) =>
			' '.repeat( encoded.match( /&#(?:x20|32);/gi )?.length || 0 )
		)
		.replace( /\\([<>@*])/g, '$1' )
		.replace( /\\--/g, '--' )
		.replace( /([A-Za-z_$][\w$]*)\\\.(?=[A-Za-z_$])/g, '$1.' );
	return protectedRegex.restore( normalized );
}

/**
 * Reverses known copy/paste transport escapes without deleting meaningful
 * JavaScript, CSS-string, Unicode, or Windows-path backslashes.
 *
 * @param {string} rawSource Source pasted into the importer.
 * @return {string} Normalized source.
 */
export function normalizeImportedSource( rawSource ) {
	const encoding = detectTransportEncoding( rawSource );
	const text = normalizeTextEncoding( rawSource );
	return normalizeTransportEscapes( normalizeCodeFence( text ), encoding );
}

export function extractWordPressTemplateMetadata( source ) {
	const raw = String( source || '' );
	const templateMatch = raw.match(
		/(?:\/\*[\s\S]*?Template Name:\s*([^\r\n*]+)[\s\S]*?\*\/)/i
	);
	const templateName = templateMatch ? templateMatch[ 1 ].trim() : null;
	const hasHeader = /\bget_header\s*\(/i.test( raw );
	const hasFooter = /\bget_footer\s*\(/i.test( raw );
	const hasSidebar = /\bget_sidebar\s*\(/i.test( raw );
	return {
		templateName,
		hasHeader,
		hasFooter,
		hasSidebar,
		isTemplate: Boolean( templateName || hasHeader || hasFooter ),
	};
}

export function createNormalizedSource( rawSource ) {
	const raw = String( rawSource || '' );
	return {
		raw,
		normalized: normalizeImportedSource( raw ),
		transportEncoding: detectTransportEncoding( raw ),
		wpTemplate: extractWordPressTemplateMetadata( raw ),
	};
}
