const PHP_OPEN = /<\?php\b/gi;

function findClosingTag( source, start ) {
	let state = 'code';
	for ( let index = start; index < source.length - 1; index++ ) {
		const character = source[ index ];
		const next = source[ index + 1 ];

		if ( state === 'single' || state === 'double' ) {
			if ( character === '\\' ) {
				index += 1;
			} else if (
				( state === 'single' && character === "'" ) ||
				( state === 'double' && character === '"' )
			) {
				state = 'code';
			}
			continue;
		}
		if ( state === 'line-comment' ) {
			if ( character === '\n' || character === '\r' ) {
				state = 'code';
			}
			continue;
		}
		if ( state === 'block-comment' ) {
			if ( character === '*' && next === '/' ) {
				state = 'code';
				index += 1;
			}
			continue;
		}

		if ( character === "'" ) {
			state = 'single';
		} else if ( character === '"' ) {
			state = 'double';
		} else if (
			( character === '/' && next === '/' ) ||
			character === '#'
		) {
			state = 'line-comment';
			if ( character === '/' ) {
				index += 1;
			}
		} else if ( character === '/' && next === '*' ) {
			state = 'block-comment';
			index += 1;
		} else if ( character === '?' && next === '>' ) {
			return index + 2;
		}
	}
	return -1;
}

function isInsideHtmlTag( source, offset ) {
	let inTag = false;
	let quote = '';
	let inComment = false;
	for ( let index = 0; index < offset; index++ ) {
		const character = source[ index ];
		const next = source.slice( index, index + 4 );
		if ( inComment ) {
			if ( next === '-->' ) {
				inComment = false;
				index += 2;
			}
			continue;
		}
		if ( quote ) {
			if ( character === quote ) {
				quote = '';
			}
			continue;
		}
		if ( ! inTag && next === '<!--' ) {
			inComment = true;
			index += 3;
		} else if ( ! inTag && character === '<' ) {
			inTag = true;
		} else if ( inTag && ( character === '"' || character === "'" ) ) {
			quote = character;
		} else if ( inTag && character === '>' ) {
			inTag = false;
		}
	}
	return inTag;
}

function randomSuffix() {
	const bytes = new Uint8Array( 8 );
	globalThis.crypto.getRandomValues( bytes );
	return Array.from( bytes, ( byte ) =>
		byte.toString( 16 ).padStart( 2, '0' )
	).join( '' );
}

/**
 * Extracts PHP without executing it and leaves inert shortcode text in content.
 *
 * @param {string}   html            HTML and PHP source.
 * @param {string}   shortcodePrefix Prefix for page-owned shortcode tags.
 * @param {Function} createSuffix    Unique suffix factory.
 * @return {{html: string, phpDetections: Array}} Extracted source.
 */
export function extractPhpSnippets(
	html,
	shortcodePrefix = 'ctb_php',
	createSuffix = randomSuffix
) {
	const source = String( html );
	const detections = [];
	let cursor = 0;
	let output = '';
	let match;
	PHP_OPEN.lastIndex = 0;

	while ( ( match = PHP_OPEN.exec( source ) ) ) {
		if ( isInsideHtmlTag( source, match.index ) ) {
			throw new Error(
				'PHP inside an HTML tag or attribute cannot be converted safely.'
			);
		}
		const end = findClosingTag( source, PHP_OPEN.lastIndex );
		if ( end < 0 ) {
			throw new Error( 'Every <?php block must have a closing ?> tag.' );
		}

		const index = detections.length + 1;
		const tag = `${ shortcodePrefix }_${ createSuffix( index ) }`;
		const code = source.slice( match.index, end );
		output += source.slice( cursor, match.index ) + `[${ tag }]`;
		detections.push( {
			id: `php-${ index }`,
			code,
			tag,
			shortcode: `[${ tag }]`,
			status: 'pending',
			description: 'Awaiting a server-side static review.',
			blockedReasons: [],
			warnings: [],
		} );
		cursor = end;
		PHP_OPEN.lastIndex = end;
	}

	output += source.slice( cursor );
	return { html: output, phpDetections: detections };
}
