import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';

/**
 * Parses raw CSS text into an AST using PostCSS and safe-parser to handle malformed CSS.
 * 
 * @param {string} sourceText 
 * @returns {import('postcss').Root}
 */
export function parseCssToAst( sourceText ) {
	return postcss().process( sourceText, {
		parser: safeParser,
		from: undefined,
	} ).root;
}

/**
 * Processes all styles from a decomposed HTML document and creates an ordered
 * array of ImportedStylesheet models.
 * 
 * @param {Array} styles Array of style objects from decomposeImportedDocument
 * @param {Array} links  Array of link objects from decomposeImportedDocument
 * @returns {Array} Array of ImportedStylesheet models
 */
export function parseImportedStylesheets( styles = [], links = [] ) {
	const stylesheets = [];
	let orderIndex = 0;

	// 1. Process External Stylesheets (Links)
	// We only include external stylesheets that the user policy allows fetching later.
	// For now, we inventory them.
	for ( const link of links ) {
		if ( link.relation === 'stylesheet' && link.href ) {
			stylesheets.push( {
				id: `ext-style-${ orderIndex + 1 }`,
				origin: 'external-link',
				media: link.media || undefined,
				url: link.href,
				sourceText: '', // Filled during fetch phase if allowed
				ast: null,
				order: orderIndex++,
				disabled: false,
			} );
		}
	}

	// 2. Process Inline <style> blocks
	for ( const style of styles ) {
		let ast = null;
		try {
			ast = parseCssToAst( style.sourceText );
		} catch ( error ) {
			// CSS is extremely malformed
			ast = postcss.root();
		}

		stylesheets.push( {
			id: style.id,
			origin: 'style-element',
			media: style.media,
			sourceText: style.sourceText,
			ast,
			order: orderIndex++,
			disabled: false,
		} );
	}

	return stylesheets;
}
