import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

scrubbable_input_component = """
function ScrubbableInput( { id, value, placeholder, disabled, onChange } ) {
	const [ isDragging, setIsDragging ] = useState( false );
	const [ startX, setStartX ] = useState( 0 );
	const [ startValue, setStartValue ] = useState( 0 );
	const [ unit, setUnit ] = useState( '' );

	const parseValue = ( val ) => {
		const match = String( val || '' ).match( /^(-?\d*\.?\d+)(.*)$/ );
		if ( match ) {
			return { num: parseFloat( match[ 1 ] ), strUnit: match[ 2 ] || 'px' };
		}
		return { num: 0, strUnit: 'px' };
	};

	const handleMouseDown = ( e ) => {
		if ( disabled ) {
			return;
		}
		setIsDragging( true );
		setStartX( e.clientX );
		const parsed = parseValue( value );
		setStartValue( parsed.num );
		setUnit( parsed.strUnit );
		e.preventDefault(); // prevent text selection
	};

	useEffect( () => {
		if ( ! isDragging ) {
			return;
		}

		const handleMouseMove = ( e ) => {
			const deltaX = e.clientX - startX;
			let multiplier = 1;
			if ( e.shiftKey ) {
				multiplier = 10;
			} else if ( e.altKey || e.metaKey ) {
				multiplier = 0.1;
			}

			const newValue = startValue + ( deltaX * multiplier * 0.5 ); // 0.5 sensitivity factor
			// format to 1 decimal place to avoid floating point issues, then remove trailing .0
			const formattedValue = newValue.toFixed( 1 ).replace( /\.0$/, '' );
			onChange( { target: { value: `${ formattedValue }${ unit }` } } );
		};

		const handleMouseUp = () => {
			setIsDragging( false );
		};

		window.addEventListener( 'mousemove', handleMouseMove );
		window.addEventListener( 'mouseup', handleMouseUp );

		return () => {
			window.removeEventListener( 'mousemove', handleMouseMove );
			window.removeEventListener( 'mouseup', handleMouseUp );
		};
	}, [ isDragging, startX, startValue, unit, onChange ] );

	const handleWheel = ( e ) => {
		if ( disabled ) {
			return;
		}
		e.preventDefault();
		const parsed = parseValue( value );
		let multiplier = 1;
		if ( e.shiftKey ) {
			multiplier = 10;
		} else if ( e.altKey || e.metaKey ) {
			multiplier = 0.1;
		}
		const delta = e.deltaY < 0 ? 1 : -1;
		const newValue = parsed.num + ( delta * multiplier );
		const formattedValue = newValue.toFixed( 1 ).replace( /\.0$/, '' );
		onChange( { target: { value: `${ formattedValue }${ parsed.strUnit }` } } );
	};

	return (
		<input
			id={ id }
			type="text"
			disabled={ disabled }
			placeholder={ placeholder }
			value={ value }
			onChange={ onChange }
			onMouseDown={ handleMouseDown }
			onWheel={ handleWheel }
			style={ { cursor: isDragging ? 'ew-resize' : 'text' } }
		/>
	);
}
"""

# Insert ScrubbableInput component before MappedStyleControls
content = content.replace("function MappedStyleControls(", scrubbable_input_component + "\nfunction MappedStyleControls(")

# Replace fallback <input> with <ScrubbableInput> in MappedStyleControls
pattern = r'''<input\n\s*id=\{\s*`ctb-\$\{\s*breakpoint\s*\}\-\$\{\s*field\.property\s*\}`\s*\}\n\s*type="text"\n\s*disabled=\{\s*linked\s*\}\n\s*placeholder=\{\n\s*breakpoint !== 'desktop' &&\n\s*inheritedMapped\[ field\.property \]\n\s*\?\s*`Inherits \$\{\n\s*inheritedMapped\[\n\s*field\.property\n\s*\]\n\s*\}\n\s*`\n\s*:\s*field\.placeholder\n\s*\}\n\s*value=\{\s*values\[\s*field\.property\s*\]\s*\}\n\s*onChange=\{\s*\(\s*event\s*\)\s*=>\n\s*setValues\(\s*\{\n\s*\.\.\.values,\n\s*\[\s*field\.property\s*\]:\n\s*event\.target\.value,\n\s*\}\s*\)\n\s*\}\n\s*/>'''

replacement = '''<ScrubbableInput
											id={ `ctb-${ breakpoint }-${ field.property }` }
											disabled={ linked }
											placeholder={
												breakpoint !== 'desktop' &&
												inheritedMapped[ field.property ]
													? `Inherits ${
															inheritedMapped[
																field.property
															]
													  }`
													: field.placeholder
											}
											value={ values[ field.property ] }
											onChange={ ( event ) =>
												setValues( {
													...values,
													[ field.property ]:
														event.target.value,
												} )
											}
										/>'''

content = re.sub(pattern, replacement, content)

with open("plugin/code-to-block/src/index.js", "w") as f:
    f.write(content)
