import selectorParser from 'postcss-selector-parser';
import { calculate } from 'specificity';
import { isKeyframeRule, selectorForStaticMatching } from './scope-imported-css.mjs';
import { diagnostic } from '../ImportDiagnosticsCollector.mjs';

const MAX_SELECTORS = 2000;

export function stylesheetMatches( document, stylesheets, diagnostics ) {
	const matches = new Map();
	const elements = [ ...document.body.querySelectorAll( '*' ) ];
	let selectorCount = 0;
	let order = 0;
	for ( const stylesheet of stylesheets ) {
		stylesheet.ast.walkRules( ( rule ) => {
			if ( isKeyframeRule( rule ) ) {
				return;
			}
			for ( const selector of rule.selectors ) {
				selectorCount += 1;
				if ( selectorCount > MAX_SELECTORS ) {
					throw new Error(
						`CSS cannot contain more than ${ MAX_SELECTORS } selectors.`
					);
				}
				let staticSelector;
				let specificity;
				const pseudoStates = [];
				try {
					selectorParser( ( selectors ) => {
						selectors.walkPseudos( ( pseudo ) => {
							const name = pseudo.value.toLowerCase();
							if (
								[
									':hover',
									':focus',
									':focus-visible',
								].includes( name )
							) {
								pseudoStates.push(
									name === ':hover' ? 'hover' : 'focus'
								);
							}
						} );
					} ).processSync( selector );
					staticSelector = selectorForStaticMatching( selector );
					specificity = calculate( selector );
				} catch {
					diagnostics.push(
						diagnostic(
							'warning',
							'SELECTOR_NOT_NATIVE_EDITABLE',
							`Selector was preserved but could not be indexed: ${ selector }`,
							'css',
							rule
						)
					);
					continue;
				}
				let selected;
				try {
					selected = staticSelector.trim()
						? elements.filter( ( element ) =>
								element.matches( staticSelector )
						  )
						: [];
				} catch {
					selected = [];
				}
				const declarations = rule.nodes
					.filter( ( node ) => node.type === 'decl' )
					.map( ( declaration ) => ( {
						property: declaration.prop,
						value: declaration.value,
						important: Boolean( declaration.important ),
					} ) );
				for ( const element of selected ) {
					matches.set( element, [
						...( matches.get( element ) || [] ),
						{
							selector,
							declarations,
							specificity,
							order: order++,
							condition:
								rule.parent.type === 'atrule'
									? `@${ rule.parent.name } ${ rule.parent.params }`.trim()
									: 'base',
							pseudo_states: pseudoStates,
							stylesheet_id: stylesheet.asset.id,
						},
					] );
				}
			}
		} );
	}
	return matches;
}
