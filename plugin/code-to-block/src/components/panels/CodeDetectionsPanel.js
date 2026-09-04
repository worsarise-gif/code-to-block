import { useState } from '@wordpress/element';
import '../../editor.css';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';

export function ScriptDetections( { detections, onMap } ) {
	if ( ! detections.length ) {
		return null;
	}
	const labels = {
		recognized: 'Recognized / confirmation required',
		mapped: 'Mapped action',
		unverified: 'Unverified / not executable',
		preserved: 'Preserved / Preview and Publish only',
		blocked: 'Preserved / disabled by permission',
	};
	const contextFor = ( detection ) => {
		if ( detection.status === 'unverified' ) {
			return (
				<p>
					Attached to <code>{ detection.attachedBlockId }</code> for
					manual review only.
				</p>
			);
		}
		if ( [ 'recognized', 'mapped' ].includes( detection.status ) ) {
			return (
				<p>
					Source <code>{ detection.sourceBlockId }</code>
					{ ' -> ' }target <code>{ detection.targetBlockId }</code>
				</p>
			);
		}
		if ( detection.status === 'blocked' ) {
			return (
				<p>
					Preserved for review, but execution requires the WordPress
					<code>unfiltered_html</code> capability.
				</p>
			);
		}
		return (
			<p>
				Disabled in the editor iframe. Execution is limited to the
				separate opener-detached WordPress page.
			</p>
		);
	};

	return (
		<section
			className="ctb-script-detections"
			aria-label="Detected JavaScript"
		>
			<div className="ctb-script-detections-heading">
				<strong>Detected JavaScript</strong>
				<span>
					{ detections.length } script
					{ detections.length === 1 ? '' : 's' }
				</span>
			</div>
			{ detections.map( ( detection ) => (
				<article
					key={ detection.id }
					className={ `ctb-script-detection is-${ detection.status }` }
				>
					<div>
						<span className="ctb-script-status">
							{ labels[ detection.status ] }
						</span>
						<p>{ detection.description }</p>
						{ contextFor( detection ) }
					</div>
					<pre>{ detection.code }</pre>
					{ detection.status === 'recognized' ? (
						<button
							type="button"
							onClick={ () => onMap( detection ) }
						>
							Confirm and map action
						</button>
					) : null }
				</article>
			) ) }
		</section>
	);
}

export function PhpDetection( { detection, onRegister } ) {
	const [ confirmation, setConfirmation ] = useState( '' );
	const [ message, setMessage ] = useState( '' );
	const [ registering, setRegistering ] = useState( false );
	const phrase = detection.confirmationPhrase || '';
	const canRegister = detection.status === 'safe' && confirmation === phrase;

	async function register() {
		setRegistering( true );
		setMessage( 'Repeating server scan and registering...' );
		try {
			await onRegister( detection, confirmation );
			setMessage( `Registered ${ detection.shortcode }.` );
		} catch ( error ) {
			setMessage( error.message || 'Registration failed.' );
		} finally {
			setRegistering( false );
		}
	}

	const labels = {
		pending: 'Awaiting server review',
		reviewing: 'Server review in progress',
		safe: 'Passed scan / confirmation required',
		warning: 'Strong warning / cannot register',
		blocked: 'Blocked / cannot register',
		registered: 'Registered after confirmation',
		projected: 'Projected safely into builder content',
		unavailable: 'Registration unavailable',
		error: 'Review failed',
	};

	return (
		<article className={ `ctb-php-detection is-${ detection.status }` }>
			<div className="ctb-php-review-summary">
				<span className="ctb-php-status">
					{ labels[ detection.status ] || detection.status }
				</span>
				<p>{ detection.description }</p>
				{ detection.requiresReview !== false ? (
					<p>
						Canvas placeholder: <code>{ detection.shortcode }</code>
					</p>
				) : (
					<p>
						No PHP was executed and no shortcode placeholder was
						added to the canvas.
					</p>
				) }
				{ detection.blockedReasons?.length ? (
					<ul className="ctb-php-reasons">
						{ detection.blockedReasons.map( ( reason ) => (
							<li key={ reason }>{ reason }</li>
						) ) }
					</ul>
				) : null }
				{ detection.warnings?.length ? (
					<ul className="ctb-php-warnings">
						{ detection.warnings.map( ( warning ) => (
							<li key={ warning }>{ warning }</li>
						) ) }
					</ul>
				) : null }
			</div>
			<div>
				<p className="ctb-php-code-label">Full detected PHP</p>
				<pre>{ detection.code }</pre>
			</div>
			{ detection.status === 'safe' ? (
				<div className="ctb-php-confirmation">
					<p>
						This grants the snippet PHP execution privileges
						whenever <code>{ detection.shortcode }</code> is
						rendered.
					</p>
					<label htmlFor={ `ctb-php-confirm-${ detection.id }` }>
						Type <code>{ phrase }</code>
						<input
							id={ `ctb-php-confirm-${ detection.id }` }
							type="text"
							autoComplete="off"
							value={ confirmation }
							onChange={ ( event ) =>
								setConfirmation( event.target.value )
							}
						/>
					</label>
					<button
						type="button"
						disabled={ ! canRegister || registering }
						onClick={ register }
					>
						Confirm and register shortcode
					</button>
					{ message ? <p role="status">{ message }</p> : null }
				</div>
			) : null }
			{ detection.status === 'registered' ? (
				<p className="ctb-php-registered" role="status">
					Registered only after the server repeated its scan and
					matched the reviewed source hash.
				</p>
			) : null }
		</article>
	);
}

export function PhpDetections( { detections, onRegister } ) {
	if ( ! detections.length ) {
		return null;
	}

	return (
		<section className="ctb-php-detections" aria-label="Detected PHP">
			<div className="ctb-php-detections-heading">
				<div>
					<strong>Detected PHP</strong>
					<p>
						Static review reduces obvious risk; it is not a PHP
						sandbox.
					</p>
				</div>
				<span>
					{ detections.length } block
					{ detections.length === 1 ? '' : 's' }
				</span>
			</div>
			{ detections.map( ( detection ) => (
				<PhpDetection
					key={ detection.tag }
					detection={ detection }
					onRegister={ onRegister }
				/>
			) ) }
		</section>
	);
}
