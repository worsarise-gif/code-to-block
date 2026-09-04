import { registry } from './BlockAdapterRegistry.mjs';
import { genericElementAdapter } from './GenericElementAdapter.mjs';
import { createPrimitiveBlock } from '../../store/block-commands.mjs';

/**
 * Main recursive converter for DOM nodes into Builder Blocks.
 */
export class DomToBlockConverter {
	#diagnostics;
	
	constructor( diagnostics ) {
		this.#diagnostics = diagnostics || [];
	}

	convertNode( node ) {
		try {
			switch ( node.nodeType ) {
				case Node.TEXT_NODE:
					return this.convertTextNode( node );
				case Node.COMMENT_NODE:
					// Preserve comments? Or drop them? For now, ignore.
					return null;
				case Node.ELEMENT_NODE:
					return this.convertElementNode( node );
				default:
					return this.fallback( node );
			}
		} catch ( error ) {
			this.#diagnostics.push( {
				severity: 'warning',
				code: 'NODE_CONVERSION_FAILED',
				message: `Failed to convert node: ${error.message}`,
				recoverable: true
			} );
			return this.fallbackFactory( node, error );
		}
	}

	convertTextNode( node ) {
		const text = node.textContent;
		// If it's purely whitespace and doesn't matter, we could drop it.
		// But let's create a text block.
		if ( ! text.trim() ) {
			return null;
		}
		
		return {
			kind: 'text',
			value: text,
			id: `text-${Math.random().toString(36).substring(2, 8)}`
		};
	}

	convertElementNode( element ) {
		// Create a context object to pass recursively back to `convertNode`
		const context = {
			convertNode: ( n ) => this.convertNode( n ),
			diagnostics: this.#diagnostics
		};

		// 1. Try to find a native/semantic adapter registered for this element
		const adapter = registry.findAdapter( element, context );
		if ( adapter ) {
			return adapter.convert( element, context );
		}

		// 2. Generic semantic element block fallback
		return genericElementAdapter.convert( element, context );
	}

	fallback( node ) {
		// For things like CDATA or unknown nodes
		return null;
	}

	fallbackFactory( node, error ) {
		// If conversion crashed mid-way, return a safe fallback block that just warns
		const block = createPrimitiveBlock( 'container' );
		block.htmlId = 'conversion-error';
		block.classes = [ 'ctb-conversion-error' ];
		block.attributes = { 'data-error': error.message };
		return block;
	}
}
