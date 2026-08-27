import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

new_handles = """
function CanvasDragHandles( { blockId } ) {
	const activeBreakpoint = useEditorStore( ( state ) => state.activeBreakpoint );
	const updateEditableBlock = ( mutate ) => {
		useEditorStore.getState().updateBlock( blockId, mutate );
	};

	const parseShorthand = ( val ) => {
		const parts = String( val || '' ).split( /\\\\s+/ ).filter( Boolean );
		let top = '0px', right = '0px', bottom = '0px', left = '0px';
		if ( parts.length === 1 ) {
			top = right = bottom = left = parts[ 0 ];
		} else if ( parts.length === 2 ) {
			top = bottom = parts[ 0 ];
			right = left = parts[ 1 ];
		} else if ( parts.length === 3 ) {
			top = parts[ 0 ];
			right = left = parts[ 1 ];
			bottom = parts[ 2 ];
		} else if ( parts.length >= 4 ) {
			top = parts[ 0 ];
			right = parts[ 1 ];
			bottom = parts[ 2 ];
			left = parts[ 3 ];
		}
		return { top, right, bottom, left };
	};

	const parsePart = ( val ) => {
		const match = String( val || '' ).match( /^(-?\\\\d*\\\\.?\\\\d+)(.*)$/ );
		if ( match ) {
			return { num: parseFloat( match[ 1 ] ), strUnit: match[ 2 ] || 'px' };
		}
		return { num: 0, strUnit: 'px' };
	};

	const createHandle = ( property, edge, cursor ) => {
		const handleMouseDown = ( e ) => {
			e.preventDefault();
			e.stopPropagation();
			const startX = e.clientX;
			const startY = e.clientY;

			// get current value from state directly
			const state = useEditorStore.getState();
			const block = findBlock( state.document.root, blockId );
			if ( ! block ) return;

			const currentMapped = block.styles?.mapped || {};
			const currentVal = currentMapped[ property ] || '';

			const parsedVals = parseShorthand( currentVal );
			const startPart = parsePart( parsedVals[ edge ] );

			const handleMouseMove = ( moveEvent ) => {
				const deltaX = moveEvent.clientX - startX;
				const deltaY = moveEvent.clientY - startY;
				let delta = 0;
				if ( edge === 'top' ) delta = deltaY;
				else if ( edge === 'bottom' ) delta = -deltaY;
				else if ( edge === 'left' ) delta = deltaX;
				else if ( edge === 'right' ) delta = -deltaX;

				let multiplier = 1;
				if ( moveEvent.shiftKey ) multiplier = 10;
				else if ( moveEvent.altKey || moveEvent.metaKey ) multiplier = 0.1;

				const newNum = startPart.num + ( delta * multiplier * 0.5 );
				const formattedValue = newNum.toFixed( 1 ).replace( /\\\\.0$/, '' ) + startPart.strUnit;

				parsedVals[ edge ] = formattedValue;

				const newValue = `${ parsedVals.top } ${ parsedVals.right } ${ parsedVals.bottom } ${ parsedVals.left }`;

				updateEditableBlock( ( draft ) => {
					if ( ! draft.styles ) draft.styles = { mapped: {}, custom_css_fallback: '' };
					if ( ! draft.styles.mapped ) draft.styles.mapped = {};
					draft.styles.mapped[ property ] = newValue;
				} );
			};

			const handleMouseUp = () => {
				window.removeEventListener( 'mousemove', handleMouseMove );
				window.removeEventListener( 'mouseup', handleMouseUp );
				useEditorStore.getState().addPast( useEditorStore.getState().document );
			};

			window.addEventListener( 'mousemove', handleMouseMove );
			window.addEventListener( 'mouseup', handleMouseUp );
		};

		const positionStyles = {
			position: 'absolute',
			zIndex: 9999,
		};
		if ( edge === 'top' ) {
			positionStyles.top = '-5px';
			positionStyles.left = '0';
			positionStyles.right = '0';
			positionStyles.height = '10px';
			positionStyles.cursor = 'ns-resize';
		} else if ( edge === 'bottom' ) {
			positionStyles.bottom = '-5px';
			positionStyles.left = '0';
			positionStyles.right = '0';
			positionStyles.height = '10px';
			positionStyles.cursor = 'ns-resize';
		} else if ( edge === 'left' ) {
			positionStyles.left = '-5px';
			positionStyles.top = '0';
			positionStyles.bottom = '0';
			positionStyles.width = '10px';
			positionStyles.cursor = 'ew-resize';
		} else if ( edge === 'right' ) {
			positionStyles.right = '-5px';
			positionStyles.top = '0';
			positionStyles.bottom = '0';
			positionStyles.width = '10px';
			positionStyles.cursor = 'ew-resize';
		}

		return (
			<div
				key={ edge }
				className={ `ctb-canvas-drag-handle is-${ property }-${ edge }` }
				style={ positionStyles }
				onMouseDown={ handleMouseDown }
				title={ `Drag to adjust ${ property } ${ edge }` }
			/>
		);
	};

	return (
		<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
			<div style={{ pointerEvents: 'auto', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
				{ createHandle( 'padding', 'top' ) }
				{ createHandle( 'padding', 'right' ) }
				{ createHandle( 'padding', 'bottom' ) }
				{ createHandle( 'padding', 'left' ) }
			</div>
		</div>
	);
}
"""

content = re.sub(r'function CanvasDragHandles.*?return \(\n\t\t<div.*?</div>\n\t\);\n\}', new_handles, content, flags=re.DOTALL)

with open("plugin/code-to-block/src/index.js", "w") as f:
    f.write(content)
