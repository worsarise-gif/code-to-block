import { parseBlockDocument } from '../parser.js';

function applyScriptCapabilityPolicy( result, canExecuteScripts ) {
	if ( canExecuteScripts !== false || ! result.session.scripts.length ) {
		return;
	}
	for ( const script of result.session.scripts ) {
		script.enabled_in_editor = false;
		script.enabled_in_preview = false;
		script.enabled_on_publish = false;
		script.execution_policy = 'disabled';
		script.security_status = 'blocked';
	}
	result.scriptDetections = result.scriptDetections.map( ( detection ) => ( {
		...detection,
		status: 'blocked',
		description:
			'Preserved as a disabled page script because this account cannot publish unfiltered HTML.',
	} ) );
	result.session.scriptDetections = result.scriptDetections;
	result.warnings.push(
		'Imported scripts were preserved but disabled because this account lacks unfiltered_html.'
	);
}

function validateCandidate( result ) {
	if ( ! result?.document?.root || ! result?.session?.id ) {
		throw new Error(
			'The importer did not produce a complete candidate document.'
		);
	}
	if ( result.session.errors?.length ) {
		throw new Error(
			'The candidate import contains blocking diagnostics.'
		);
	}
	return result;
}

/**
 * Owns analyzed import sessions and enforces analyze -> validate -> commit.
 * Editor state is changed only through the single commit callback supplied by
 * the UI/store adapter.
 */
export class ImportCodeService {
	#sessions = new Map();
	#parse;

	constructor( { parse = parseBlockDocument } = {} ) {
		this.#parse = parse;
	}

	async analyze( source, context = {} ) {
		const result = this.#parse(
			source,
			context.css || '',
			context.shortcodePrefix || 'ctb_php'
		);
		applyScriptCapabilityPolicy( result, context.canExecuteScripts );
		validateCandidate( result );
		result.session.state = 'analyzed';
		this.#sessions.set( result.session.id, result );
		return result;
	}

	get( sessionId ) {
		return this.#sessions.get( sessionId ) || null;
	}

	commit( sessionId, options = {} ) {
		const result = this.#sessions.get( sessionId );
		if ( ! result ) {
			throw new Error(
				'The analyzed import session is no longer available.'
			);
		}
		if ( result.session.state === 'committed' ) {
			throw new Error( 'The import session has already been committed.' );
		}
		validateCandidate( result );
		result.session.state = 'validated';
		let candidate;
		try {
			candidate = options.transformCandidate
				? options.transformCandidate( result.document, result )
				: result.document;
		} catch ( error ) {
			result.session.state = 'failed';
			throw error;
		}
		if ( ! candidate?.root ) {
			result.session.state = 'failed';
			throw new Error(
				'The import candidate transform returned no document.'
			);
		}
		if ( options.commitDocument ) {
			options.commitDocument( candidate, result );
		}
		result.session.state = 'committed';
		return { ...result, document: candidate };
	}

	cancel( sessionId ) {
		return this.#sessions.delete( sessionId );
	}

	clear() {
		this.#sessions.clear();
	}
}

export function createImportCodeService() {
	return new ImportCodeService();
}
