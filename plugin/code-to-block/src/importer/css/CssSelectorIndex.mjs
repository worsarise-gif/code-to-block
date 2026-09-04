/**
 * A basic selector index to allow fast lookup of rules that might apply to a node.
 * This does not perfectly replicate browser specificity matching, but groups
 * imported AST rules by their target identifiers (classes, IDs, tags) so we
 * can quickly answer "Which rules affect me?" during conversion.
 */
export class CssSelectorIndex {
	#classIndex = new Map();
	#idIndex = new Map();
	#tagIndex = new Map();
	#universalRules = [];

	constructor( stylesheets = [] ) {
		this.indexStylesheets( stylesheets );
	}

	indexStylesheets( stylesheets ) {
		for ( const sheet of stylesheets ) {
			if ( ! sheet.ast || sheet.disabled ) {
				continue;
			}
			sheet.ast.walkRules( ( rule ) => {
				// Don't index rules inside @keyframes
				if ( rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes' ) {
					return;
				}
				this.#indexRule( rule, sheet );
			} );
		}
	}

	#indexRule( rule, sheet ) {
		// rule.selectors is an array of selectors (e.g. ['.btn', '#header', 'a'])
		const record = { rule, stylesheetId: sheet.id };

		for ( const selector of rule.selectors ) {
			if ( selector.includes( '#' ) ) {
				const match = selector.match( /#([a-zA-Z0-9_-]+)/ );
				if ( match ) {
					this.#addToIndex( this.#idIndex, match[ 1 ], record );
				}
			} else if ( selector.includes( '.' ) ) {
				const classes = selector.match( /\.([a-zA-Z0-9_-]+)/g ) || [];
				for ( const cls of classes ) {
					this.#addToIndex( this.#classIndex, cls.substring( 1 ), record );
				}
			} else if ( /^[a-zA-Z]+/.test( selector ) ) {
				const match = selector.match( /^([a-zA-Z0-9_-]+)/ );
				if ( match ) {
					this.#addToIndex( this.#tagIndex, match[ 1 ].toLowerCase(), record );
				}
			} else {
				this.#universalRules.push( record );
			}
		}
	}

	#addToIndex( map, key, record ) {
		if ( ! map.has( key ) ) {
			map.set( key, [] );
		}
		map.get( key ).push( record );
	}

	/**
	 * Returns all CSS rules that MIGHT apply to the given element characteristics.
	 * 
	 * @param {Object} query 
	 * @param {string} query.tag
	 * @param {string} query.id
	 * @param {Array<string>} query.classes
	 * @returns {Array<Object>}
	 */
	getMatchingRules( { tag, id, classes = [] } ) {
		const matches = new Set();
		
		for ( const rule of this.#universalRules ) {
			matches.add( rule );
		}
		
		if ( tag && this.#tagIndex.has( tag.toLowerCase() ) ) {
			for ( const rule of this.#tagIndex.get( tag.toLowerCase() ) ) {
				matches.add( rule );
			}
		}

		if ( id && this.#idIndex.has( id ) ) {
			for ( const rule of this.#idIndex.get( id ) ) {
				matches.add( rule );
			}
		}

		for ( const cls of classes ) {
			if ( this.#classIndex.has( cls ) ) {
				for ( const rule of this.#classIndex.get( cls ) ) {
					matches.add( rule );
				}
			}
		}

		return Array.from( matches );
	}
}
