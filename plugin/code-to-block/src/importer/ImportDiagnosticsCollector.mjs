export class ImportDiagnosticsCollector {
	#items = [];

	push( ...items ) {
		return this.#items.push( ...items );
	}

	filter( callback ) {
		return this.#items.filter( callback );
	}

	add( severity, code, message, source = 'source', details = {} ) {
		const item = {
			severity,
			code,
			message,
			source,
			recoverable: details.recoverable !== false,
			...( details.range ? { range: details.range } : {} ),
			...( details.nodeId ? { nodeId: details.nodeId } : {} ),
			...( details.assetId ? { assetId: details.assetId } : {} ),
		};
		this.#items.push( item );
		return item;
	}

	info( code, message, source, details ) {
		return this.add( 'info', code, message, source, details );
	}

	warning( code, message, source, details ) {
		return this.add( 'warning', code, message, source, details );
	}

	error( code, message, source, details = {} ) {
		return this.add( 'error', code, message, source, {
			...details,
			recoverable: details.recoverable ?? false,
		} );
	}

	security( code, message, source, details ) {
		return this.add( 'security', code, message, source, details );
	}

	toArray() {
		return this.#items.map( ( item ) => ( { ...item } ) );
	}
}
