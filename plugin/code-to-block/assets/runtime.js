( function () {
	'use strict';

	function findTarget( page, blockId ) {
		return Array.prototype.find.call(
			page.querySelectorAll( '[data-ctb-block-id]' ),
			( element ) => element.dataset.ctbBlockId === blockId
		);
	}

	function initializeLazyMedia( root ) {
		const scope = root && root.querySelectorAll ? root : document;
		for ( const media of scope.querySelectorAll( '[data-ctb-lazy-media]' ) ) {
			if ( media.dataset.ctbLazyBound === 'true' ) continue;
			media.dataset.ctbLazyBound = 'true';
			const loaded = () => media.classList.add( 'is-loaded' );
			const failed = () => media.classList.add( 'is-error' );
			media.addEventListener( 'load', loaded, { once: true } );
			media.addEventListener( 'error', failed, { once: true } );
			if ( media instanceof HTMLImageElement && media.complete ) {
				if ( media.naturalWidth > 0 ) loaded(); else failed();
			}
		}
	}

	initializeLazyMedia( document );
	document.addEventListener( 'DOMContentLoaded', () => initializeLazyMedia( document ), { once: true } );
	if ( typeof MutationObserver !== 'undefined' ) {
		new MutationObserver( ( records ) => {
			for ( const record of records ) {
				for ( const node of record.addedNodes ) {
					if ( node instanceof Element ) initializeLazyMedia( node );
				}
			}
		} ).observe( document.documentElement, { childList: true, subtree: true } );
	}

	function applyAction( source, page, action ) {
		if (
			! action ||
			action.trigger !== 'click' ||
			! action.params ||
			typeof action.params.target_block_id !== 'string'
		) {
			return false;
		}

		const target = findTarget( page, action.params.target_block_id );
		if ( ! target ) {
			return false;
		}

		const className = action.params.class_name;
		if (
			[ 'toggle-class', 'add-class', 'remove-class' ].includes(
				action.behavior
			) &&
			( typeof className !== 'string' ||
				! /^[a-z_][a-z0-9_-]*$/i.test( className ) )
		) {
			return false;
		}

		switch ( action.behavior ) {
			case 'toggle-class':
				target.classList.toggle( className );
				break;
			case 'add-class':
				target.classList.add( className );
				break;
			case 'remove-class':
				target.classList.remove( className );
				break;
			case 'show':
				target.hidden = false;
				break;
			case 'hide':
				target.hidden = true;
				break;
			case 'toggle-visibility':
				target.hidden = ! target.hidden;
				source.setAttribute( 'aria-expanded', String( ! target.hidden ) );
				break;
			default:
				return false;
		}

		return true;
	}

	document.addEventListener( 'click', ( event ) => {
		if ( ! ( event.target instanceof Element ) ) {
			return;
		}
		const source = event.target.closest( '[data-ctb-actions]' );
		const page = source && source.closest( '.ctb-page' );
		if ( ! source || ! page ) {
			return;
		}

		let actions;
		try {
			actions = JSON.parse( source.dataset.ctbActions );
		} catch ( error ) {
			return;
		}
		if ( ! Array.isArray( actions ) ) {
			return;
		}

		let handled = false;
		for ( const action of actions ) {
			handled = applyAction( source, page, action ) || handled;
		}
		if ( handled ) {
			event.preventDefault();
			// Focus management: toggle-visibility opens into target, close returns to trigger
			for ( const action of actions ) {
				if ( action.behavior === 'toggle-visibility' || action.behavior === 'show' ) {
					const target = findTarget( page, action.params.target_block_id );
					if ( target && ! target.hidden ) {
						// Move focus into first focusable inside target if any, else target itself
						const focusable = target.querySelector( 'a, button, [tabindex]:not([tabindex="-1"]), input, select, textarea' );
						const toFocus = focusable || target;
						if ( toFocus.focus ) {
							try { toFocus.focus(); } catch ( e ) {}
						}
					}
				}
				if ( action.behavior === 'hide' ) {
					try { source.focus(); } catch ( e ) {}
				}
			}
		}
	} );

	document.addEventListener( 'keydown', ( event ) => {
		if ( ! ( event.target instanceof Element ) ) {
			return;
		}
		
		let source = event.target.closest( '[data-ctb-actions]' );
		let page = source && source.closest( '.ctb-page' );
		
		// If focus is inside a target block instead of the trigger, try to find the trigger.
		if ( ! source ) {
			const targetBlock = event.target.closest( '[data-ctb-block-id]' );
			if ( targetBlock ) {
				page = targetBlock.closest( '.ctb-page' );
				if ( page ) {
					const allTriggers = Array.prototype.slice.call( page.querySelectorAll( '[data-ctb-actions]' ) );
					for ( const t of allTriggers ) {
						try {
							const acts = JSON.parse( t.dataset.ctbActions );
							if ( Array.isArray( acts ) && acts.some( a => a.params && a.params.target_block_id === targetBlock.dataset.ctbBlockId ) ) {
								source = t;
								break;
							}
						} catch ( e ) {}
					}
				}
			}
		}

		if ( ! source || ! page ) {
			return;
		}
		const key = event.key;
		let actions;
		try {
			actions = JSON.parse( source.dataset.ctbActions );
		} catch ( error ) {
			return;
		}
		if ( ! Array.isArray( actions ) ) {
			return;
		}
		// Enter/Space act as click for keyboard users (mandatory for dropdowns)
		if ( key === 'Enter' || key === ' ' || key === 'Spacebar' ) {
			let handled = false;
			for ( const action of actions ) {
				handled = applyAction( source, page, action ) || handled;
			}
			if ( handled ) {
				event.preventDefault();
				// Same focus management as click
				for ( const action of actions ) {
					if ( action.behavior === 'toggle-visibility' || action.behavior === 'show' ) {
						const target = findTarget( page, action.params.target_block_id );
						if ( target && ! target.hidden ) {
							const focusable = target.querySelector( 'a, button, [tabindex]:not([tabindex="-1"]), input, select, textarea' );
							const toFocus = focusable || target;
							if ( toFocus.focus ) {
								try { toFocus.focus(); } catch ( e ) {}
							}
						} else if ( target && target.hidden ) {
							try { source.focus(); } catch ( e ) {}
						}
					}
				}
			}
		}
		// Escape closes open toggle-visibility targets and returns focus to trigger
		if ( key === 'Escape' || key === 'Esc' ) {
			for ( const action of actions ) {
				if ( action.behavior === 'toggle-visibility' || action.behavior === 'show' || action.behavior === 'hide' ) {
					const target = findTarget( page, action.params.target_block_id );
					if ( target && ! target.hidden ) {
						target.hidden = true;
						source.setAttribute( 'aria-expanded', 'false' );
						try { source.focus(); } catch ( e ) {}
						event.preventDefault();
					}
				}
			}
		}
		// Arrow navigation within dropdown: if target is open, allow ArrowDown/ArrowUp to move focus between focusables
		if ( key === 'ArrowDown' || key === 'ArrowUp' ) {
			for ( const action of actions ) {
				const target = findTarget( page, action.params.target_block_id );
				if ( target && ! target.hidden ) {
					const focusables = Array.prototype.slice.call( target.querySelectorAll( 'a, button, [tabindex]:not([tabindex="-1"]), input, select, textarea' ) );
					if ( focusables.length ) {
						const active = document.activeElement;
						let idx = focusables.indexOf( active );
						if ( -1 === idx ) idx = key === 'ArrowDown' ? -1 : 0;
						const next = key === 'ArrowDown'
							? focusables[ ( idx + 1 ) % focusables.length ]
							: focusables[ ( idx - 1 + focusables.length ) % focusables.length ];
						if ( next && next.focus ) {
							try { next.focus(); } catch ( e ) {}
							event.preventDefault();
						}
					}
				}
			}
		}
	} );

	document.addEventListener( 'submit', ( event ) => {
		const form = event.target.closest( 'form.ctb-form' );
		if ( ! form || ! form.closest( '.ctb-page' ) ) return;
		event.preventDefault();
		const formData = new FormData( form );
		const url = form.action;
		const messageEl = form.querySelector( '.ctb-form-message' );
		if ( messageEl ) messageEl.textContent = 'Submitting…';
		// Client-side quick validation for immediate feedback (server is source of truth)
		const required = form.querySelectorAll( '[required]' );
		for ( const el of required ) {
			if ( ! el.value.trim() ) {
				if ( messageEl ) messageEl.textContent = 'Please fill in all required fields.';
				el.focus();
				return;
			}
			if ( el.type === 'email' && el.value && ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( el.value ) ) {
				if ( messageEl ) messageEl.textContent = 'Please enter a valid email.';
				el.focus();
				return;
			}
		}
		fetch( url, { method: 'POST', body: formData, credentials: 'same-origin' } )
			.then( ( r ) => r.json().then( ( j ) => ( { ok: r.ok, json: j, status: r.status } ) ) )
			.then( ( { ok, json } ) => {
				if ( ok && json.success ) {
					if ( messageEl ) messageEl.textContent = json.message || 'Thanks!';
					form.reset();
				} else {
					const errs = json.data && json.data.errors ? ' ' + Object.values( json.data.errors ).join( ' ' ) : '';
					const msg = json.message || 'Submission failed.';
					if ( messageEl ) messageEl.textContent = msg + errs;
				}
			} )
			.catch( () => { if ( messageEl ) messageEl.textContent = 'Submission failed.'; } );
	} );
} )();
