import { closestCenter, pointerWithin } from '@dnd-kit/core';
import '../editor.css';
import { previewCustomCssFallback } from '../custom-css.mjs';
import { designTokenDeclarations, getDesignToken, TOKEN_PROPERTIES } from '../design-tokens.mjs';
import { rankDropCandidates, resolveDropIntent } from '../drop-intent.mjs';
import { createImportCodeService } from '../importer/ImportCodeService.mjs';
import { breakpointCascade } from '../responsive-styles.mjs';
import { findBlock, findBlockLocation } from '../tree.mjs';

export function resolveDocumentDropIntent( {
	root,
	targetId,
	activeId = null,
	point,
	rect,
} ) {
	const targetLocation = findBlockLocation( root, targetId );
	const source = activeId ? findBlock( root, activeId ) : null;
	if ( ! targetLocation || ( activeId && ! source ) ) {
		return null;
	}

	const target = targetLocation.block;
	const canContain =
		target.type === 'container' && ! VOID_TAGS.has( target.tag );
	let reason = '';
	if ( activeId === root.id ) {
		reason = 'The document root cannot be moved.';
	} else if ( source?.permissions?.locked ) {
		reason = 'This block is locked.';
	} else if ( target.permissions?.locked ) {
		reason = 'The target block is locked.';
	} else if ( activeId === target.id ) {
		reason = 'A block cannot be dropped onto itself.';
	} else if ( activeId && targetLocation.ancestorIds.includes( activeId ) ) {
		reason = 'A block cannot be moved into one of its descendants.';
	}

	return resolveDropIntent( {
		point,
		candidates: [
			{
				id: target.id,
				rect,
				depth: targetLocation.depth,
				parentId: targetLocation.parentId,
				index: targetLocation.index,
				childCount: ( target.children || [] ).filter(
					( child ) => child.kind !== 'text'
				).length,
				canContain,
				allowSibling: target.id !== root.id,
				valid: ! reason,
				reason,
			},
		],
	} );
}

export function dragEventPoint( event ) {
	const activatorEvent = event.activatorEvent;
	if (
		Number.isFinite( activatorEvent?.clientX ) &&
		Number.isFinite( activatorEvent?.clientY )
	) {
		return {
			x: activatorEvent.clientX + ( event.delta?.x || 0 ),
			y: activatorEvent.clientY + ( event.delta?.y || 0 ),
		};
	}

	const translated = event.active.rect.current.translated;
	return translated
		? {
				x: translated.left + translated.width / 2,
				y: translated.top + translated.height / 2,
		  }
		: null;
}

export function toReactStyles( styles, resourceBase = '' ) {
	return Object.fromEntries(
		Object.entries( styles ).map( ( [ property, value ] ) => [
			property.startsWith( '--' )
				? property
				: property.replace( /-([a-z])/g, ( match, letter ) =>
						letter.toUpperCase()
				  ),
			normalizeCssUrls( value, resourceBase ),
		] )
	);
}

export function normalizeResourceUrl( value, resourceBase = '' ) {
	if ( /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test( value ) ) {
		return value;
	}

	const siteUrl =
		window.codeToBlockEditorSettings?.siteUrl || window.location.origin;
	try {
		const baseUrl = resourceBase
			? new URL( resourceBase, siteUrl ).href
			: siteUrl;
		return new URL( value, baseUrl ).href;
	} catch {
		return new URL( value, siteUrl ).href;
	}
}

export function normalizeCssUrls( value, resourceBase = '' ) {
	return String( value ).replace(
		/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
		( match, quote, url ) =>
			`url(${ quote }${ normalizeResourceUrl(
				url,
				resourceBase
			) }${ quote })`
	);
}

export function previewDeclarations( styleSet, important = false, resourceBase = '' ) {
	if ( ! styleSet ) {
		return '';
	}

	const suffix = important ? ' !important' : '';
	const mapped = Object.entries( styleSet.mapped || {} )
		.map(
			( [ property, value ] ) =>
				`${ property }:${ normalizeCssUrls(
					value,
					resourceBase
				).replace( /\s*!important\s*$/i, '' ) }${ suffix };`
		)
		.join( '' );
	const fallback = previewCustomCssFallback(
		String( styleSet.custom_css_fallback || '' )
	);
	return mapped + ( fallback ? `${ fallback.replace( /;+$/, '' ) };` : '' );
}

export function buildPreviewStyles( document, activeBreakpoint ) {
	const indexes = {};
	const base = [];
	const responsive = [];
	let index = 0;
	const resourceBase = document.imported_assets?.page_meta?.base_href || '';
	const tokenDeclarations = designTokenDeclarations( document.design_tokens );
	if ( tokenDeclarations ) {
		base.push( `.ctb-canvas-stage{${ tokenDeclarations }}` );
	}
	for ( const stylesheet of document.imported_assets?.stylesheets || [] ) {
		if ( stylesheet.scoped_source ) {
			base.push(
				normalizeCssUrls( stylesheet.scoped_source, resourceBase )
			);
		}
	}
	const importedTokenDeclarations = Object.entries(
		document.imported_assets?.token_bindings || {}
	)
		.map( ( [ cssName, reference ] ) => {
			const token = getDesignToken( document.design_tokens, reference );
			return token
				? `${ cssName }:${ normalizeCssUrls(
						token.value,
						resourceBase
				  ) };`
				: '';
		} )
		.filter( Boolean )
		.join( '' );
	if ( importedTokenDeclarations ) {
		base.push( `.${ IMPORT_SCOPE_CLASS }{${ importedTokenDeclarations }}` );
	}

	function visit( block ) {
		const currentIndex = index++;
		indexes[ block.id ] = currentIndex;
		const selector = `.ctb-canvas-stage .ctb-preview-block-${ currentIndex }`;
		const fallback = previewCustomCssFallback(
			String( block.styles.custom_css_fallback || '' )
		);
		if ( fallback ) {
			base.push( `${ selector }{${ fallback.replace( /;+$/, '' ) };}` );
		}

		for ( const state of [ 'hover', 'focus', 'active' ] ) {
			const declarations = previewDeclarations(
				block.states?.[ state ],
				true,
				resourceBase
			);
			if ( declarations ) {
				base.push( `${ selector }:${ state }{${ declarations }}` );
			}
		}

		for ( const viewport of breakpointCascade( activeBreakpoint ) ) {
			const declarations = previewDeclarations(
				block.responsive_overrides?.[ viewport ],
				true,
				resourceBase
			);
			if ( declarations ) {
				responsive.push( `${ selector }{${ declarations }}` );
			}
		}

		for ( const child of block.children ) {
			if ( child.kind !== 'text' ) {
				visit( child );
			}
		}
	}

	visit( document.root );
	return { indexes, css: [ ...base, ...responsive ].join( '\n' ) };
}

export function buildEditorStyleSnapshot( document ) {
	const snapshot = {};

	function visit( block ) {
		const styles = {
			base: block.styles,
			tablet: block.responsive_overrides?.tablet,
			mobile: block.responsive_overrides?.mobile,
			hover: block.states?.hover,
			focus: block.states?.focus,
			active: block.states?.active,
		};
		for ( const [ context, styleSet ] of Object.entries( styles ) ) {
			const declarations = previewDeclarations( styleSet, true );
			if ( declarations ) {
				snapshot[ block.id ] ||= {};
				snapshot[ block.id ][ context ] = declarations;
			}
		}
		for ( const child of block.children || [] ) {
			if ( child.kind !== 'text' ) {
				visit( child );
			}
		}
	}

	visit( document.root );
	return snapshot;
}

export function collisionStrategy( args ) {
	const pointerCollisions = pointerWithin( args );
	if ( ! pointerCollisions.length ) {
		return closestCenter( args );
	}

	const activeId = String( args.active.id );
	const activeData = args.active.data.current || {};
	const ranked = rankDropCandidates(
		pointerCollisions.map( ( collision, order ) => {
			const container = collision.data?.droppableContainer;
			const data = container?.data.current || {};
			const invalid =
				activeData.locked ||
				data.locked ||
				String( collision.id ) === activeId ||
				( data.ancestorIds || [] ).includes( activeId );
			return {
				id: collision.id,
				depth: data.depth,
				order,
				valid: ! invalid,
				rect: args.droppableRects.get( collision.id ),
			};
		} )
	);
	const rank = new Map(
		ranked.map( ( candidate, index ) => [ candidate.id, index ] )
	);
	return pointerCollisions.sort(
		( left, right ) => rank.get( left.id ) - rank.get( right.id )
	);
}

export function cursorOffsetModifier( {
	activatorEvent,
	draggingNodeRect,
	transform,
} ) {
	if (
		! activatorEvent ||
		! draggingNodeRect ||
		! Number.isFinite( activatorEvent.clientX ) ||
		! Number.isFinite( activatorEvent.clientY )
	) {
		return transform;
	}

	return {
		...transform,
		x: transform.x + activatorEvent.clientX - draggingNodeRect.left + 14,
		y: transform.y + activatorEvent.clientY - draggingNodeRect.top + 14,
	};
}

export function colorPickerValue( color ) {
	if ( /^#[0-9a-f]{6}$/i.test( color ) ) {
		return color;
	}
	if ( /^#[0-9a-f]{3}$/i.test( color ) ) {
		return `#${ color
			.slice( 1 )
			.split( '' )
			.map( ( character ) => character.repeat( 2 ) )
			.join( '' ) }`;
	}
	return '#000000';
}

export function breakpointStyleSummary( breakpoint, count ) {
	if ( breakpoint === 'desktop' ) {
		return `${ count } base declarations`;
	}
	if ( count ) {
		return `${ count } explicit ${ breakpoint } overrides`;
	}
	return `No explicit ${ breakpoint } overrides; inherited values are previewed.`;
}

export function tokenValueIsValid( category, value ) {
	return TOKEN_PROPERTIES[ category ].some( ( property ) =>
		window.CSS.supports( property, value )
	);
}

export function loadEditorGsap() {
	if ( ! editorGsapPromise ) {
		editorGsapPromise = Promise.all( [
			import( 'gsap' ),
			import( 'gsap/ScrollTrigger' ),
		] ).then( ( [ core, plugin ] ) => {
			core.gsap.registerPlugin( plugin.ScrollTrigger );
			return { gsap: core.gsap, ScrollTrigger: plugin.ScrollTrigger };
		} );
	}
	return editorGsapPromise;
}

export function documentHasGsapAnimation( block ) {
	if (
		block.actions?.some(
			( action ) =>
				action.animation_type === 'js_library' &&
				GSAP_ANIMATION_BEHAVIORS.has( action.behavior )
		)
	) {
		return true;
	}
	return ( block.children || [] ).some(
		( child ) => child.kind !== 'text' && documentHasGsapAnimation( child )
	);
}

export function defaultGsapAction( behavior, blockId ) {
	if ( behavior === 'css-reveal' ) {
		return {
			trigger: 'load',
			behavior,
			animation_type: 'css_native',
			params: {
				target_block_id: blockId,
				duration: 0.6,
				delay: 0,
				from_y: 30,
			},
		};
	}
	const common = {
		trigger: 'scroll',
		behavior,
		animation_type: 'js_library',
		params: {
			target_block_id: blockId,
			start: 'top 85%',
			ease: behavior === 'scroll-scrub' ? 'none' : 'power2.out',
			from_x: 0,
			from_y: 40,
			from_opacity: 0,
			from_scale: 1,
			from_rotation: 0,
		},
	};
	if ( behavior === 'scroll-scrub' ) {
		Object.assign( common.params, {
			end: 'bottom 20%',
			scrub: 1,
			to_x: 0,
			to_y: 0,
			to_opacity: 1,
			to_scale: 1,
			to_rotation: 0,
		} );
	} else {
		Object.assign( common.params, { duration: 0.6, stagger: 0.12 } );
	}
	return common;
}

