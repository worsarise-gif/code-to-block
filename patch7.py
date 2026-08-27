import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

# Modify BlockContent to add canvas drag handles
# We need to wrap the rendered block if it is selected.
# Wait, we can't easily wrap the block with another element if it relies on a specific DOM structure.
# Instead of `return createElement( block.tag, attributes, childrenNodes );`
# We could append absolute positioned handles to `childrenNodes` if `selectedBlockId === selectionId`.
# But `childrenNodes` only works for non-void tags and elements that allow children.
# Alternatively, since we can inject React components, let's create a `<CanvasDragHandles>` component and append it to childrenNodes.

handles_component = """
function CanvasDragHandles( { blockId } ) {
	const activeBreakpoint = useEditorStore( ( state ) => state.activeBreakpoint );
	const updateEditableBlock = ( mutate ) => {
		useEditorStore.getState().updateBlock( blockId, mutate );
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
			const match = String( currentVal ).match( /^(-?\d*\.?\d+)(.*)$/ );
			let startNum = 0;
			let unit = 'px';
			if ( match ) {
				startNum = parseFloat( match[ 1 ] );
				unit = match[ 2 ] || 'px';
			}

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

				const newNum = startNum + ( delta * multiplier * 0.5 );
				const formattedValue = newNum.toFixed( 1 ).replace( /\.0$/, '' );

				updateEditableBlock( ( draft ) => {
					if ( ! draft.styles ) draft.styles = { mapped: {}, custom_css_fallback: '' };
					if ( ! draft.styles.mapped ) draft.styles.mapped = {};
					draft.styles.mapped[ property ] = `${ formattedValue }${ unit }`;
				} );
			};

			const handleMouseUp = () => {
				window.removeEventListener( 'mousemove', handleMouseMove );
				window.removeEventListener( 'mouseup', handleMouseUp );
				// te() to warn unsaved changes
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
				className={ `ctb-canvas-drag-handle is-${ edge }` }
				style={ positionStyles }
				onMouseDown={ handleMouseDown }
				title={ `Drag to adjust ${ property }` }
			/>
		);
	};

	return (
		<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
			<div style={{ pointerEvents: 'auto', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
				{ createHandle( 'padding-top', 'top' ) }
				{ createHandle( 'padding-right', 'right' ) }
				{ createHandle( 'padding-bottom', 'bottom' ) }
				{ createHandle( 'padding-left', 'left' ) }
			</div>
		</div>
	);
}
"""

content = content.replace("function BlockContent(", handles_component + "\nfunction BlockContent(")

pattern_return = r'''\s*return createElement\(\s*block\.tag,\s*attributes,\s*childrenNodes\s*\);\n\}'''

replacement = '''
	if ( selectedBlockId === selectionId && !VOID_TAGS.has( block.tag ) ) {
		// Only render drag handles if element is relative/absolute/fixed/sticky OR if we enforce relative position for handles
		if ( !attributes.style.position || attributes.style.position === 'static' ) {
			attributes.style.position = 'relative';
		}
		childrenNodes.push( <CanvasDragHandles key="canvas-drag-handles" blockId={ selectionId } /> );
	}

	return createElement( block.tag, attributes, childrenNodes );
}'''

content = re.sub(pattern_return, replacement, content)

with open("plugin/code-to-block/src/index.js", "w") as f:
    f.write(content)
