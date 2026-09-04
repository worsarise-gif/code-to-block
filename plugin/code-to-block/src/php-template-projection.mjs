const UNRESOLVED = Symbol( 'unresolved-php-expression' );

function isUnresolved( value ) {
	return value === UNRESOLVED;
}

function phpString( value ) {
	if ( value === null || value === false ) {
		return '';
	}
	if ( value === true ) {
		return '1';
	}
	return [ 'string', 'number' ].includes( typeof value )
		? String( value )
		: UNRESOLVED;
}

function decodeString( source, quote ) {
	if ( quote === "'" ) {
		return source.replace( /\\\\/g, '\\' ).replace( /\\'/g, "'" );
	}
	if ( /(?:^|[^\\])\$[a-z_]/i.test( source ) ) {
		return UNRESOLVED;
	}
	return source.replace( /\\([\\"nrt$])/g, ( match, escaped ) => {
		const replacements = {
			'\\': '\\',
			'"': '"',
			n: '\n',
			r: '\r',
			t: '\t',
			$: '$',
		};
		return replacements[ escaped ] ?? match;
	} );
}

function skipSpaceAndComments( source, start ) {
	let index = start;
	while ( index < source.length ) {
		if ( /\s/.test( source[ index ] ) ) {
			index += 1;
		} else if ( source.startsWith( '//', index ) ) {
			const end = source.indexOf( '\n', index + 2 );
			index = end < 0 ? source.length : end + 1;
		} else if ( source[ index ] === '#' ) {
			const end = source.indexOf( '\n', index + 1 );
			index = end < 0 ? source.length : end + 1;
		} else if ( source.startsWith( '/*', index ) ) {
			const end = source.indexOf( '*/', index + 2 );
			index = end < 0 ? source.length : end + 2;
		} else {
			break;
		}
	}
	return index;
}

class LiteralParser {
	constructor( source ) {
		this.source = source;
		this.index = 0;
	}

	parse() {
		const value = this.parseValue();
		this.index = skipSpaceAndComments( this.source, this.index );
		return this.index === this.source.length ? value : UNRESOLVED;
	}

	parseValue() {
		this.index = skipSpaceAndComments( this.source, this.index );
		const character = this.source[ this.index ];
		if ( character === '[' ) {
			return this.parseArray();
		}
		if ( character === "'" || character === '"' ) {
			return this.parseString();
		}
		const number = this.source
			.slice( this.index )
			.match( /^-?\d+(?:\.\d+)?/ );
		if ( number ) {
			this.index += number[ 0 ].length;
			return Number( number[ 0 ] );
		}
		const constant = this.source
			.slice( this.index )
			.match( /^(true|false|null)\b/i );
		if ( constant ) {
			this.index += constant[ 0 ].length;
			if ( constant[ 1 ].toLowerCase() === 'true' ) {
				return true;
			}
			return constant[ 1 ].toLowerCase() === 'false' ? false : null;
		}
		return UNRESOLVED;
	}

	parseString() {
		const quote = this.source[ this.index++ ];
		let raw = '';
		while ( this.index < this.source.length ) {
			if ( this.source[ this.index ] === '\\' ) {
				raw += this.source.slice( this.index, this.index + 2 );
				this.index += 2;
			} else if ( this.source[ this.index ] === quote ) {
				this.index += 1;
				return decodeString( raw, quote );
			} else {
				raw += this.source[ this.index++ ];
			}
		}
		return UNRESOLVED;
	}

	parseArray() {
		this.index += 1;
		const entries = [];
		let autoIndex = 0;
		while ( this.index < this.source.length ) {
			this.index = skipSpaceAndComments( this.source, this.index );
			if ( this.source[ this.index ] === ']' ) {
				this.index += 1;
				const sequential = entries.every(
					( entry, index ) => entry[ 0 ] === index
				);
				return sequential
					? entries.map( ( entry ) => entry[ 1 ] )
					: Object.fromEntries(
							entries.map( ( [ key, value ] ) => [
								String( key ),
								value,
							] )
					  );
			}
			const first = this.parseValue();
			if ( isUnresolved( first ) ) {
				return UNRESOLVED;
			}
			this.index = skipSpaceAndComments( this.source, this.index );
			let key = autoIndex;
			let value = first;
			if ( this.source.startsWith( '=>', this.index ) ) {
				this.index += 2;
				key = first;
				value = this.parseValue();
				if ( isUnresolved( value ) ) {
					return UNRESOLVED;
				}
			}
			entries.push( [ key, value ] );
			autoIndex =
				typeof key === 'number' && key >= autoIndex
					? key + 1
					: autoIndex + 1;
			this.index = skipSpaceAndComments( this.source, this.index );
			if ( this.source[ this.index ] === ',' ) {
				this.index += 1;
				continue;
			}
			if ( this.source[ this.index ] !== ']' ) {
				return UNRESOLVED;
			}
		}
		return UNRESOLVED;
	}
}

function splitTopLevel( source, delimiter ) {
	const parts = [];
	let start = 0;
	let roundDepth = 0;
	let squareDepth = 0;
	let quote = '';
	for ( let index = 0; index < source.length; index++ ) {
		const character = source[ index ];
		if ( quote ) {
			if ( character === '\\' ) {
				index += 1;
			} else if ( character === quote ) {
				quote = '';
			}
			continue;
		}
		if ( character === "'" || character === '"' ) {
			quote = character;
		} else if ( character === '(' ) {
			roundDepth += 1;
		} else if ( character === ')' ) {
			roundDepth -= 1;
		} else if ( character === '[' ) {
			squareDepth += 1;
		} else if ( character === ']' ) {
			squareDepth -= 1;
		} else if (
			character === delimiter &&
			roundDepth === 0 &&
			squareDepth === 0
		) {
			parts.push( source.slice( start, index ) );
			start = index + 1;
		}
	}
	parts.push( source.slice( start ) );
	return parts;
}

function isWrapped( source ) {
	if ( source[ 0 ] !== '(' || source[ source.length - 1 ] !== ')' ) {
		return false;
	}
	let depth = 0;
	let quote = '';
	for ( let index = 0; index < source.length; index++ ) {
		const character = source[ index ];
		if ( quote ) {
			if ( character === '\\' ) {
				index += 1;
			} else if ( character === quote ) {
				quote = '';
			}
		} else if ( character === "'" || character === '"' ) {
			quote = character;
		} else if ( character === '(' ) {
			depth += 1;
		} else if ( character === ')' && --depth === 0 ) {
			return index === source.length - 1;
		}
	}
	return false;
}

function variableValue( expression, environment ) {
	const variable = expression.match( /^\$([a-z_][a-z0-9_]*)/i );
	if (
		! variable ||
		! Object.prototype.hasOwnProperty.call( environment, variable[ 1 ] )
	) {
		return UNRESOLVED;
	}
	let value = environment[ variable[ 1 ] ];
	let rest = expression.slice( variable[ 0 ].length );
	while ( rest.trim() ) {
		const access = rest.match(
			/^\s*\[\s*(?:'([^']*)'|"([^"]*)"|(\d+))\s*\]/
		);
		if ( ! access || value === null || typeof value !== 'object' ) {
			return UNRESOLVED;
		}
		const key = access[ 1 ] ?? access[ 2 ] ?? Number( access[ 3 ] );
		if ( ! Object.prototype.hasOwnProperty.call( value, key ) ) {
			return UNRESOLVED;
		}
		value = value[ key ];
		rest = rest.slice( access[ 0 ].length );
	}
	return value;
}

function escapeHtml( value ) {
	const string = phpString( value );
	return isUnresolved( string )
		? UNRESOLVED
		: string
				.replace( /&/g, '&amp;' )
				.replace( /</g, '&lt;' )
				.replace( />/g, '&gt;' )
				.replace( /"/g, '&quot;' )
				.replace( /'/g, '&#039;' );
}

function callFunction( name, argumentSource, environment ) {
	const parts = splitTopLevel( argumentSource, ',' );
	const normalized = name.toLowerCase().replace( /^\\/, '' );
	const first = evaluateExpression( parts[ 0 ] || '', environment );
	if ( normalized === 'json_encode' ) {
		try {
			const encoded = JSON.stringify( first );
			return isUnresolved( first ) || typeof encoded !== 'string'
				? UNRESOLVED
				: encoded.replace( /</g, '\\u003C' ).replace( />/g, '\\u003E' );
		} catch {
			return UNRESOLVED;
		}
	}
	if ( normalized === 'date' ) {
		return first === 'Y' ? String( new Date().getFullYear() ) : UNRESOLVED;
	}
	if (
		[ 'htmlspecialchars', 'esc_html', 'esc_attr', 'esc_textarea' ].includes(
			normalized
		)
	) {
		return escapeHtml( first );
	}
	if ( normalized === 'strtoupper' || normalized === 'strtolower' ) {
		const string = phpString( first );
		if ( isUnresolved( string ) ) {
			return UNRESOLVED;
		}
		return normalized === 'strtoupper'
			? string.toUpperCase()
			: string.toLowerCase();
	}
	if ( normalized === 'trim' ) {
		const string = phpString( first );
		return isUnresolved( string ) ? UNRESOLVED : string.trim();
	}
	if ( normalized === 'substr' ) {
		const start = evaluateExpression( parts[ 1 ] || '', environment );
		const length =
			parts.length > 2
				? evaluateExpression( parts[ 2 ], environment )
				: undefined;
		const string = phpString( first );
		if ( isUnresolved( string ) || ! Number.isFinite( start ) ) {
			return UNRESOLVED;
		}
		return Number.isFinite( length )
			? string.slice( start, start + length )
			: string.slice( start );
	}
	if ( normalized === 'str_replace' ) {
		const replacement = evaluateExpression( parts[ 1 ] || '', environment );
		const subject = evaluateExpression( parts[ 2 ] || '', environment );
		const values = [ first, replacement, subject ].map( phpString );
		return values.some( isUnresolved )
			? UNRESOLVED
			: values[ 2 ].split( values[ 0 ] ).join( values[ 1 ] );
	}
	return UNRESOLVED;
}

function evaluateExpression( rawExpression, environment ) {
	let expression = String( rawExpression ).trim().replace( /;\s*$/, '' );
	while ( isWrapped( expression ) ) {
		expression = expression.slice( 1, -1 ).trim();
	}
	const concatenated = splitTopLevel( expression, '.' );
	if ( concatenated.length > 1 ) {
		const values = concatenated.map( ( part ) =>
			phpString( evaluateExpression( part, environment ) )
		);
		return values.some( isUnresolved ) ? UNRESOLVED : values.join( '' );
	}
	if ( expression.startsWith( '!' ) ) {
		const value = evaluateExpression( expression.slice( 1 ), environment );
		return isUnresolved( value ) ? UNRESOLVED : ! value;
	}
	if ( expression.startsWith( '$' ) ) {
		return variableValue( expression, environment );
	}
	const functionCall = expression.match(
		/^([a-z_\\][a-z0-9_\\]*)\s*\(([\s\S]*)\)$/i
	);
	if ( functionCall ) {
		return callFunction(
			functionCall[ 1 ],
			functionCall[ 2 ],
			environment
		);
	}
	return new LiteralParser( expression ).parse();
}

function skipQuotedOrComment( source, index ) {
	const character = source[ index ];
	if ( character === "'" || character === '"' ) {
		let cursor = index + 1;
		while ( cursor < source.length ) {
			if ( source[ cursor ] === '\\' ) {
				cursor += 2;
			} else if ( source[ cursor++ ] === character ) {
				break;
			}
		}
		return cursor;
	}
	return skipSpaceAndComments( source, index );
}

function captureAssignment( source, start ) {
	let roundDepth = 0;
	let squareDepth = 0;
	for ( let index = start; index < source.length; index++ ) {
		const skipped = skipQuotedOrComment( source, index );
		if ( skipped !== index ) {
			index = skipped - 1;
			continue;
		}
		if ( source[ index ] === '(' ) {
			roundDepth += 1;
		} else if ( source[ index ] === ')' ) {
			roundDepth -= 1;
		} else if ( source[ index ] === '[' ) {
			squareDepth += 1;
		} else if ( source[ index ] === ']' ) {
			squareDepth -= 1;
		} else if (
			source[ index ] === ';' &&
			roundDepth === 0 &&
			squareDepth === 0
		) {
			return { source: source.slice( start, index ), end: index + 1 };
		}
	}
	return null;
}

function collectLiteralAssignments( code, environment ) {
	const source = String( code )
		.replace( /^\s*<\?php\b/i, '' )
		.replace( /\?>\s*$/, '' );
	let braceDepth = 0;
	for ( let index = 0; index < source.length; index++ ) {
		const skipped = skipQuotedOrComment( source, index );
		if ( skipped !== index ) {
			index = skipped - 1;
			continue;
		}
		if ( source[ index ] === '{' ) {
			braceDepth += 1;
		} else if ( source[ index ] === '}' ) {
			braceDepth = Math.max( 0, braceDepth - 1 );
		} else if ( braceDepth === 0 && source[ index ] === '$' ) {
			const variable = source
				.slice( index + 1 )
				.match( /^[a-z_][a-z0-9_]*/i );
			if ( ! variable ) {
				continue;
			}
			let operator = index + variable[ 0 ].length + 1;
			while ( /\s/.test( source[ operator ] || '' ) ) {
				operator += 1;
			}
			if (
				source[ operator ] !== '=' ||
				source[ operator + 1 ] === '='
			) {
				continue;
			}
			const assignment = captureAssignment( source, operator + 1 );
			if ( ! assignment ) {
				continue;
			}
			const value = new LiteralParser( assignment.source ).parse();
			if ( ! isUnresolved( value ) ) {
				environment[ variable[ 0 ] ] = value;
			}
			index = assignment.end - 1;
		}
	}
}

function phpBody( code ) {
	return String( code )
		.replace( /^\s*<\?php\b/i, '' )
		.replace( /\?>\s*$/, '' )
		.trim();
}

function phpKind( code ) {
	const body = phpBody( code );
	if ( /^echo\b/i.test( body ) ) {
		return 'echo';
	}
	for ( const kind of [
		'foreach',
		'endforeach',
		'elseif',
		'else',
		'endif',
		'if',
	] ) {
		if ( new RegExp( `^${ kind }\\b`, 'i' ).test( body ) ) {
			return kind;
		}
	}
	return 'statement';
}

function expressionBetweenParentheses( code ) {
	const body = phpBody( code );
	const start = body.indexOf( '(' );
	const end = body.lastIndexOf( ')' );
	return start >= 0 && end > start ? body.slice( start + 1, end ) : '';
}

function splitHtml( html, detections ) {
	const byShortcode = new Map(
		detections.map( ( item ) => [ item.shortcode, item ] )
	);
	const tokens = [];
	const pattern = /\[ctb_[a-z0-9_-]{2,80}\]/gi;
	let cursor = 0;
	let match;
	while ( ( match = pattern.exec( html ) ) ) {
		const detection = byShortcode.get( match[ 0 ] );
		if ( ! detection ) {
			continue;
		}
		if ( match.index > cursor ) {
			tokens.push( {
				type: 'html',
				value: html.slice( cursor, match.index ),
			} );
		}
		tokens.push( {
			type: 'php',
			detection,
			kind: phpKind( detection.code ),
		} );
		cursor = pattern.lastIndex;
	}
	if ( cursor < html.length ) {
		tokens.push( { type: 'html', value: html.slice( cursor ) } );
	}
	return tokens;
}

function findClose( tokens, start, openKind, closeKind ) {
	let depth = 0;
	for ( let index = start; index < tokens.length; index++ ) {
		if ( tokens[ index ].type !== 'php' ) {
			continue;
		}
		if ( tokens[ index ].kind === openKind ) {
			depth += 1;
		} else if ( tokens[ index ].kind === closeKind && --depth === 0 ) {
			return index;
		}
	}
	return -1;
}

function parseForeach( code, environment ) {
	const match = expressionBetweenParentheses( code ).match(
		/^([\s\S]+?)\s+as\s+(?:\$([a-z_][a-z0-9_]*)\s*=>\s*)?\$([a-z_][a-z0-9_]*)\s*$/i
	);
	if ( ! match ) {
		return null;
	}
	const collection = evaluateExpression( match[ 1 ], environment );
	return isUnresolved( collection ) ||
		collection === null ||
		typeof collection !== 'object'
		? null
		: {
				entries: Array.isArray( collection )
					? collection.map( ( value, key ) => [ key, value ] )
					: Object.entries( collection ),
				keyVariable: match[ 2 ] || '',
				valueVariable: match[ 3 ],
		  };
}

function markRange( tokens, start, end, annotations, status ) {
	for ( let index = start; index < end; index++ ) {
		if ( tokens[ index ].type === 'php' ) {
			annotations.set( tokens[ index ].detection.tag, status );
		}
	}
}

function renderTokens( tokens, start, end, environment, annotations ) {
	let output = '';
	for ( let index = start; index < end; index++ ) {
		const token = tokens[ index ];
		if ( token.type === 'html' ) {
			output += token.value;
			continue;
		}
		if ( token.kind === 'echo' ) {
			const expression = phpBody( token.detection.code )
				.replace( /^echo\b/i, '' )
				.replace( /;\s*$/, '' );
			const value = phpString(
				evaluateExpression( expression, environment )
			);
			annotations.set(
				token.detection.tag,
				isUnresolved( value ) ? 'unresolved' : 'resolved'
			);
			output += isUnresolved( value ) ? token.detection.shortcode : value;
			continue;
		}
		if ( token.kind === 'foreach' ) {
			const close = findClose( tokens, index, 'foreach', 'endforeach' );
			const loop = parseForeach( token.detection.code, environment );
			if ( close < 0 || ! loop ) {
				annotations.set( token.detection.tag, 'unresolved' );
				output += token.detection.shortcode;
				continue;
			}
			annotations.set( token.detection.tag, 'structural' );
			annotations.set( tokens[ close ].detection.tag, 'structural' );
			for ( const [ key, value ] of loop.entries ) {
				const childEnvironment = {
					...environment,
					[ loop.valueVariable ]: value,
				};
				if ( loop.keyVariable ) {
					childEnvironment[ loop.keyVariable ] = key;
				}
				output += renderTokens(
					tokens,
					index + 1,
					close,
					childEnvironment,
					annotations
				);
			}
			index = close;
			continue;
		}
		if ( token.kind === 'if' ) {
			const close = findClose( tokens, index, 'if', 'endif' );
			const condition = evaluateExpression(
				expressionBetweenParentheses( token.detection.code ),
				environment
			);
			if ( close < 0 || isUnresolved( condition ) ) {
				annotations.set( token.detection.tag, 'unresolved' );
				output += token.detection.shortcode;
				continue;
			}
			annotations.set( token.detection.tag, 'structural' );
			annotations.set( tokens[ close ].detection.tag, 'structural' );
			if ( condition ) {
				output += renderTokens(
					tokens,
					index + 1,
					close,
					environment,
					annotations
				);
			} else {
				markRange( tokens, index + 1, close, annotations, 'omitted' );
			}
			index = close;
			continue;
		}
		if (
			[ 'foreach', 'endforeach', 'elseif', 'else', 'endif' ].includes(
				token.kind
			)
		) {
			annotations.set( token.detection.tag, 'structural' );
			continue;
		}
		collectLiteralAssignments( token.detection.code, environment );
		annotations.set( token.detection.tag, 'non-rendering' );
	}
	return output;
}

/**
 * Builds a static visual projection for a mixed PHP/HTML template without
 * executing PHP. Only literal data and a narrow expression allowlist resolve.
 *
 * @param {string} html       HTML containing inert PHP shortcodes.
 * @param {Array}  detections PHP detections from extractPhpSnippets().
 * @return {Object} Projected HTML and annotated detections.
 */
export function projectPhpTemplate( html, detections ) {
	const environment = {};
	for ( const detection of detections ) {
		if ( phpKind( detection.code ) === 'statement' ) {
			collectLiteralAssignments( detection.code, environment );
		}
	}
	const annotations = new Map();
	const tokens = splitHtml( html, detections );
	const projectedHtml = renderTokens(
		tokens,
		0,
		tokens.length,
		environment,
		annotations
	);
	let projectedCount = 0;
	let unresolvedCount = 0;
	const phpDetections = detections.map( ( detection ) => {
		const projection = annotations.get( detection.tag ) || 'unresolved';
		const requiresReview = projectedHtml.includes( detection.shortcode );
		if ( requiresReview ) {
			unresolvedCount += 1;
			return { ...detection, projection, requiresReview: true };
		}
		projectedCount += 1;
		const descriptions = {
			'non-rendering':
				'Non-output PHP was kept out of the visual canvas and was not executed.',
			structural:
				'Applied as static template structure without executing PHP.',
			omitted:
				'Omitted from the static canvas because its literal condition was not active.',
		};
		return {
			...detection,
			projection,
			requiresReview: false,
			status: 'projected',
			description:
				descriptions[ projection ] ||
				'Resolved from literal template data without executing PHP.',
		};
	} );
	return {
		html: projectedHtml,
		phpDetections,
		projectedCount,
		unresolvedCount,
		runtimeCodeSkipped: phpDetections.some(
			( detection ) =>
				! detection.requiresReview &&
				detection.projection === 'non-rendering' &&
				/(?:\$_(?:COOKIE|ENV|FILES|GET|POST|REQUEST|SERVER|SESSION)\b|\b(?:if|switch|try)\s*\()/i.test(
					detection.code
				)
		),
	};
}
