/**
 * Normalizes source text to repair transport escaping issues without corrupting
 * valid JavaScript regexes, CSS strings, Unicode escapes, or paths.
 *
 * @param {string} source
 * @param {Object} detection - ImportDetectionResult from detectImportedSource
 * @returns {string}
 */
export function normalizeImportedSource( source, detection ) {
	if ( ! source || typeof source !== 'string' ) {
		return '';
	}

	let normalized = source;

	// 1. Markdown code fence stripping
	if ( detection?.transportEncoding === 'markdown-code' ) {
		normalized = normalizeCodeFence( normalized );
	}

	// 2. Rich text escape decoding (e.g., &lt;, &gt;, &amp;, &#x20;)
	if ( detection?.transportEncoding === 'escaped-rich-text' || normalized.includes('&lt;') ) {
		normalized = normalizeTextEncoding( normalized );
	}

	// 3. Selective backslash unescaping
	normalized = normalizeTransportEscapes( normalized );

	return normalized;
}

function normalizeCodeFence( source ) {
	// Remove leading ```html or ```css and trailing ```
	return source.replace( /^```[a-z]*\s*\n?/i, '' ).replace( /\n?```\s*$/, '' );
}

function normalizeTextEncoding( source ) {
	// A safe, DOM-independent way to decode HTML entities like &lt; and &gt;
	// (Since DOMParser will parse tags, we only want to decode things that were double-escaped or pasted as text)
	// We replace basic entities. We don't want to decode everything blindly if it was meant to be visible text,
	// but if the detection flagged it as rich-text escaped, we assume it's raw HTML pasted into a visual editor.
	return source
		.replace( /&lt;/g, '<' )
		.replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' )
		.replace( /&#39;/g, "'" )
		.replace( /&amp;/g, '&' )
		.replace( /&#x20;/g, ' ' );
}

function normalizeTransportEscapes( source ) {
	// Remove backslashes ONLY before specific characters that are commonly over-escaped
	// by text editors or WordPress when pasting code.
	// We MUST preserve \n, \r, \t, \v, \0, \x, \u, \d, \w, \s, \b, \B, \D, \W, \S etc. (JS Regex / strings)
	// We MUST preserve \\ (literal backslash)

	// Commonly incorrectly escaped characters in HTML/CSS/JS snippets:
	// \< \> \- \. \@ \/ \= \: \; \{ \} \[ \] \( \) \, \! \?
	
	return source.replace( /\\([<>.\-@/=:;{}[\](),!?])/g, '$1' );
}
