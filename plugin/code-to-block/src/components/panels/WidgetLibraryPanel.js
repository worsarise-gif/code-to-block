import '../../editor.css';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';
import { WIDGET_LIBRARY } from '../../widget-library.mjs';

export function WidgetLibraryPanel( { onInsert } ) {
	return (
		<details
			className="ctb-widget-library-panel"
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
				<span>Widget Library — 8 pre-built</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					On File 4
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
				Pre-built arrangements of existing blocks with slots, built on
				reusable-components. No second architecture.
			</p>
			<div style={ { display: 'grid', gap: '6px' } }>
				{ WIDGET_LIBRARY.map( ( w ) => (
					<div
						key={ w.id }
						style={ {
							background: '#f7f5ee',
							border: '1px solid #d3cec1',
							padding: '9px',
							display: 'grid',
							gap: '4px',
						} }
					>
						<strong style={ { fontSize: '11px' } }>
							{ w.label }
						</strong>
						<small style={ { color: '#686355', fontSize: '9px' } }>
							{ w.description }
						</small>
						<button
							type="button"
							onClick={ () => onInsert( w.block ) }
							style={ {
								background: '#171d35',
								color: '#fff',
								border: '1px solid #171d35',
								borderRadius: '3px',
								padding: '6px',
								fontSize: '9px',
								fontWeight: 700,
								cursor: 'pointer',
								marginTop: '4px',
							} }
						>
							Insert after selection
						</button>
					</div>
				) ) }
			</div>
		</details>
	);
}

