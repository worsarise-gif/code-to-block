import { useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import '../../editor.css';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';

export function AccessibilityPanel( { issues, onSelect } ) {
	if ( ! issues.length ) {
		return (
			<details
				className="ctb-a11y-panel"
				style={ {
					border: '1px solid #bcb6a8',
					marginTop: '12px',
					padding: '0 10px 10px',
				} }
			>
				<summary
					style={ {
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						cursor: 'pointer',
						padding: '10px 0',
						fontSize: '11px',
						fontWeight: 700,
					} }
				>
					<span>Accessibility — helps identify common issues</span>
					<small
						style={ {
							color: '#2e7d32',
							fontFamily: 'monospace',
							fontSize: '8px',
						} }
					>
						0 issues
					</small>
				</summary>
				<p
					style={ {
						color: '#686355',
						fontSize: '10px',
						lineHeight: '1.45',
						margin: 0,
					} }
				>
					No common issues detected. Automated checks catch many
					common issues but cannot replace testing with real assistive
					technology and real users.
				</p>
			</details>
		);
	}
	return (
		<details
			className="ctb-a11y-panel"
			style={ {
				border: '1px solid #d8a77a',
				marginTop: '12px',
				padding: '0 10px 10px',
				background: '#fff8e1',
			} }
			open
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>Accessibility — helps identify common issues</span>
				<small
					style={ {
						color: '#b42318',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					{ issues.length } found
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '9px',
					lineHeight: '1.4',
					margin: '0 0 8px',
				} }
			>
				Automated checks catch many common issues but cannot replace
				testing with real assistive technology and real users. This tool
				never claims compliance.
			</p>
			<ul
				style={ {
					listStyle: 'none',
					padding: 0,
					margin: 0,
					display: 'grid',
					gap: '6px',
				} }
			>
				{ issues.map( ( issue, idx ) => (
					<li
						key={ `${ issue.block_id }-${ issue.type }-${ idx }` }
						style={ {
							background: '#fff',
							border: '1px solid #d3cec1',
							borderLeft: '3px solid #d57a2a',
							padding: '8px',
							fontSize: '9px',
						} }
					>
						<div
							style={ {
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
							} }
						>
							<strong>{ issue.type }</strong>
							<button
								type="button"
								onClick={ () => onSelect( issue.block_id ) }
								style={ {
									background: '#171d35',
									color: '#fff',
									border: '1px solid #171d35',
									borderRadius: '3px',
									padding: '3px 6px',
									fontSize: '8px',
									cursor: 'pointer',
									fontFamily: 'monospace',
								} }
							>
								{ issue.block_id }
							</button>
						</div>
						<p style={ { margin: '4px 0 0', lineHeight: '1.4' } }>
							{ issue.message }
						</p>
						<small
							style={ {
								color: '#686355',
								display: 'block',
								marginTop: '4px',
								lineHeight: '1.3',
							} }
						>
							{ issue.why }
						</small>
					</li>
				) ) }
			</ul>
		</details>
	);
}

export function DiagnosticsPanel( { postId } ) {
	const [ data, setData ] = useState( null );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( '' );
	async function run() {
		if ( ! postId ) {
			setError( 'Save the post first.' );
			return;
		}
		setLoading( true );
		setError( '' );
		try {
			const res = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/diagnostics`,
			} );
			setData( res );
		} catch ( e ) {
			setError( e.message || 'Diagnostics failed.' );
		} finally {
			setLoading( false );
		}
	}
	return (
		<details
			className="ctb-woo-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>Diagnostics</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					Woo conflict check
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 8px',
				} }
			>
				Lists active plugins and flags heuristic conflicts with
				cart/checkout/session. Safe — no plugins are deactivated.
			</p>
			<button
				type="button"
				onClick={ run }
				disabled={ loading }
				style={ {
					background: '#171d35',
					color: '#fff',
					border: '1px solid #171d35',
					borderRadius: '3px',
					padding: '6px 8px',
					fontSize: '9px',
					fontWeight: 700,
					cursor: 'pointer',
				} }
			>
				{ loading ? 'Checking…' : 'Run diagnostics' }
			</button>
			{ error ? (
				<p
					style={ {
						color: '#9f2525',
						fontSize: '10px',
						marginTop: '8px',
					} }
				>
					{ error }
				</p>
			) : null }
			{ data ? (
				<div
					style={ { marginTop: '10px', display: 'grid', gap: '6px' } }
				>
					<div
						style={ {
							fontSize: '10px',
							display: 'flex',
							gap: '8px',
						} }
					>
						<span>
							WooCommerce:{ ' ' }
							{ data.has_woo ? 'active' : 'not active' }
						</span>
						<span>·</span>
						<span>{ data.commerce_blocks } commerce block(s)</span>
					</div>
					<div style={ { marginTop: '4px' } }>
						<a
							href={ `${
								window.codeToBlockEditorSettings?.liveUrl || '/'
							}?ctb_safe_mode=1` }
							target="_blank"
							rel="noopener noreferrer"
							style={ {
								display: 'inline-block',
								background: '#d57a2a',
								color: '#fff',
								border: '1px solid #c2691e',
								borderRadius: '3px',
								padding: '4px 8px',
								fontSize: '9px',
								fontWeight: 700,
								textDecoration: 'none',
							} }
						>
							Open Live Preview in Safe Mode (Isolate CSS/JS
							Conflicts)
						</a>
					</div>
					<ul
						style={ {
							listStyle: 'none',
							padding: 0,
							margin: 0,
							display: 'grid',
							gap: '4px',
						} }
					>
						{ data.plugins.map( ( p ) => (
							<li
								key={ p.file }
								style={ {
									fontSize: '9px',
									padding: '6px',
									background: p.flagged
										? '#fff8df'
										: '#f7f5ee',
									border: `1px solid ${
										p.flagged ? '#d8a77a' : '#d3cec1'
									}`,
									borderLeft: `3px solid ${
										p.flagged ? '#d57a2a' : '#bcb6a8'
									}`,
								} }
							>
								<strong>{ p.name }</strong>{ ' ' }
								<small style={ { color: '#686355' } }>
									{ p.version }
								</small>
								{ p.flagged ? (
									<div
										style={ {
											color: '#81530d',
											marginTop: '2px',
										} }
									>
										Flagged: { p.reason }
									</div>
								) : null }
								<div
									style={ {
										color: '#686355',
										fontFamily: 'monospace',
										fontSize: '8px',
									} }
								>
									{ p.file }
								</div>
							</li>
						) ) }
					</ul>
					<small
						style={ {
							color: '#686355',
							fontSize: '8px',
							lineHeight: '1.4',
						} }
					>
						{ data.note }
					</small>
				</div>
			) : null }
		</details>
	);
}

export function ParityWarningsPanel( { warnings, onSelect } ) {
	if ( ! warnings.length ) {
		return null;
	}
	return (
		<div className="ctb-parity-warnings" role="alert">
			<strong>Parity check</strong>
			<p>
				The editor and the live site disagree on { warnings.length }{ ' ' }
				block
				{ warnings.length === 1 ? '' : 's' }.
			</p>
			<ul>
				{ warnings.map( ( warning ) => (
					<li key={ `${ warning.block_id }:${ warning.context }` }>
						<button
							type="button"
							onClick={ () => onSelect( warning.block_id ) }
						>
							{ warning.block_id }
						</button>
						<span> — { warning.message }</span>
						<small> ({ warning.context })</small>
					</li>
				) ) }
			</ul>
		</div>
	);
}

