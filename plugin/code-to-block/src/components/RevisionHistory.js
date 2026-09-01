import { createElement, useEffect, useState } from '@wordpress/element';

export default function RevisionHistory( { postId, apiFetch, onRestore } ) {
	const [ revisions, setRevisions ] = useState( [] );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		if ( ! postId ) {
			return;
		}
		apiFetch( { path: `/code-to-block/v1/pages/${ postId }/revisions` } )
			.then( ( response ) => {
				setRevisions( response.revisions || [] );
				setLoading( false );
			} )
			.catch( ( err ) => {
				setError( err.message || 'Failed to load revisions.' );
				setLoading( false );
			} );
	}, [ postId, apiFetch ] );

	const handleRestore = async ( revisionId ) => {
		try {
			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/revisions/${ revisionId }/restore`,
				method: 'POST',
			} );
			if ( response && response.document ) {
				onRestore( response.document );
			}
		} catch ( err ) {
			window.alert( 'Failed to restore revision: ' + err.message );
		}
	};

	if ( loading ) {
		return <div className="ctb-panel-padding">Loading revisions...</div>;
	}

	if ( error ) {
		return <div className="ctb-panel-padding">Error: { error }</div>;
	}

	if ( revisions.length === 0 ) {
		return <div className="ctb-panel-padding">No revisions found.</div>;
	}

	return (
		<div className="ctb-revision-history">
			{ revisions.map( ( rev ) => (
				<div key={ rev.id } className="ctb-revision-item">
					<div className="ctb-revision-meta">
						<strong>{ rev.is_autosave ? 'Autosave' : 'Revision' }</strong>
						<span className="ctb-revision-date">{ new Date( rev.date ).toLocaleString() }</span>
						<span className="ctb-revision-author">by { rev.author }</span>
					</div>
					<div className="ctb-revision-actions">
						<button
							className="ctb-button-secondary"
							onClick={ () => handleRestore( rev.id ) }
						>
							Restore
						</button>
					</div>
				</div>
			) ) }
		</div>
	);
}
