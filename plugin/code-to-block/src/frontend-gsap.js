import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin( ScrollTrigger );

window.gsap = gsap;
window.ScrollTrigger = ScrollTrigger;

function blockById( page, id ) {
	return [ ...page.querySelectorAll( '[data-ctb-block-id]' ) ].find(
		( element ) => element.getAttribute( 'data-ctb-block-id' ) === id
	);
}

function fromVars( params ) {
	return {
		x: params.from_x,
		y: params.from_y,
		opacity: params.from_opacity,
		scale: params.from_scale,
		rotation: params.from_rotation,
	};
}

function initializeAnimations() {
	const reducedMotion = window.matchMedia(
		'(prefers-reduced-motion: reduce)'
	).matches;
	const animations = [];

	if ( ! reducedMotion ) {
		for ( const source of document.querySelectorAll(
			'.ctb-page [data-ctb-animations]'
		) ) {
			const page = source.closest( '.ctb-page' );
			let actions;
			try {
				actions = JSON.parse( source.dataset.ctbAnimations || '[]' );
			} catch {
				continue;
			}
			for ( const action of actions ) {
				const params = action.params || {};
				const target =
					page && blockById( page, params.target_block_id );
				if ( ! target ) {
					continue;
				}
				if ( action.behavior === 'scroll-scrub' ) {
					animations.push(
						gsap.fromTo( target, fromVars( params ), {
							x: params.to_x,
							y: params.to_y,
							opacity: params.to_opacity,
							scale: params.to_scale,
							rotation: params.to_rotation,
							ease: params.ease,
							duration: 1,
							scrollTrigger: {
								trigger: source,
								start: params.start,
								end: params.end,
								scrub: params.scrub,
							},
						} )
					);
				} else if ( action.behavior === 'stagger-sequence' ) {
					const children = [ ...target.children ].filter( ( child ) =>
						child.classList.contains( 'ctb-block' )
					);
					if ( children.length ) {
						animations.push(
							gsap.from( children, {
								...fromVars( params ),
								duration: params.duration,
								stagger: params.stagger,
								ease: params.ease,
								scrollTrigger: {
									trigger: source,
									start: params.start,
									toggleActions: 'play none none reverse',
								},
							} )
						);
					}
				}
			}
		}
		if ( animations.length ) {
			ScrollTrigger.refresh();
		}
	}

	window.dispatchEvent(
		new CustomEvent( 'code-to-block:gsap-ready', {
			detail: { count: animations.length, reducedMotion },
		} )
	);
	window.addEventListener(
		'pagehide',
		() => animations.forEach( ( animation ) => animation.revert() ),
		{ once: true }
	);
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initializeAnimations, {
		once: true,
	} );
} else {
	initializeAnimations();
}
