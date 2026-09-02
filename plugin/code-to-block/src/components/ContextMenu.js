import '../editor.css';
import { createImportCodeService } from '../importer/ImportCodeService.mjs';

export function ContextMenu( {
	menu,
	onClose,
	onAction,
	hasClipboard,
	hasStylesClipboard,
} ) {
	if ( ! menu ) {
		return null;
	}
	const { x, y, zone } = menu;
	const actions = [];
	if ( 'WIDGET' === zone ) {
		actions.push( { id: 'edit', label: 'Edit' } );
		actions.push( { id: 'duplicate', label: 'Duplicate' } );
		actions.push( { id: 'copy', label: 'Copy' } );
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'delete', label: 'Delete' } );
		actions.push( { id: 'copyStyles', label: 'Copy Styles' } );
		if ( hasStylesClipboard ) {
			actions.push( { id: 'pasteStyles', label: 'Paste Styles' } );
		}
		actions.push( {
			id: 'saveComponent',
			label: 'Save as Reusable Component',
		} );
	} else if ( 'CONTAINER' === zone ) {
		actions.push( { id: 'edit', label: 'Edit' } );
		actions.push( { id: 'duplicate', label: 'Duplicate' } );
		actions.push( { id: 'copy', label: 'Copy' } );
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'delete', label: 'Delete' } );
		actions.push( { id: 'addInner', label: 'Add Inner Container' } );
		actions.push( { id: 'convertLayout', label: 'Convert Layout Mode' } );
		actions.push( { id: 'copyStyles', label: 'Copy Styles' } );
		if ( hasStylesClipboard ) {
			actions.push( { id: 'pasteStyles', label: 'Paste Styles' } );
		}
		actions.push( {
			id: 'saveComponent',
			label: 'Save as Reusable Component',
		} );
	} else if ( 'SLOT' === zone ) {
		actions.push( { id: 'edit', label: 'Edit' } );
		actions.push( { id: 'editSlotLabel', label: 'Edit Slot Label' } );
		actions.push( { id: 'duplicate', label: 'Duplicate' } );
		actions.push( { id: 'copy', label: 'Copy' } );
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'delete', label: 'Delete' } );
		actions.push( { id: 'copyStyles', label: 'Copy Styles' } );
		if ( hasStylesClipboard ) {
			actions.push( { id: 'pasteStyles', label: 'Paste Styles' } );
		}
		actions.push( {
			id: 'saveComponent',
			label: 'Save as Reusable Component',
		} );
	} else if ( 'EMPTY' === zone ) {
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'addBlock', label: 'Add Block' } );
		actions.push( { id: 'pageSettings', label: 'Page Settings' } );
	}
	return (
		<div
			role="menu"
			aria-label={ `${ zone } context menu` }
			style={ {
				position: 'fixed',
				left: Math.min( x, window.innerWidth - 220 ),
				top: Math.min( y, window.innerHeight - 300 ),
				background: '#fff',
				border: '1px solid #bcb6a8',
				boxShadow: '0 8px 24px rgba(23,29,53,0.18)',
				zIndex: 9999,
				minWidth: '200px',
				padding: '4px 0',
				fontFamily: 'Inter, sans-serif',
			} }
			onClick={ ( e ) => e.stopPropagation() }
		>
			<div
				style={ {
					padding: '6px 12px 4px',
					fontSize: '8px',
					letterSpacing: '0.08em',
					textTransform: 'uppercase',
					color: '#686355',
					borderBottom: '1px solid #eee',
					fontWeight: 700,
				} }
			>
				{ zone } · { actions.length } actions
			</div>
			{ actions.map( ( a ) => (
				<button
					key={ a.id }
					role="menuitem"
					type="button"
					onClick={ () => {
						onAction( a.id );
						onClose();
					} }
					style={ {
						display: 'block',
						width: '100%',
						textAlign: 'left',
						padding: '8px 12px',
						background: 'transparent',
						border: '0',
						fontSize: '11px',
						cursor: 'pointer',
					} }
					onMouseEnter={ ( e ) =>
						( e.currentTarget.style.background = '#f3f1eb' )
					}
					onMouseLeave={ ( e ) =>
						( e.currentTarget.style.background = 'transparent' )
					}
				>
					{ a.label }
				</button>
			) ) }
			<div
				style={ {
					borderTop: '1px solid #eee',
					marginTop: '4px',
					padding: '6px 12px',
					fontSize: '8px',
					color: '#686355',
				} }
			>
				Shift+F10 also opens this menu for the focused block
			</div>
		</div>
	);
}

