import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

# Replace <input type="text" ... /> in MappedStyleControls with conditional <select> rendering
# First we find the block that renders the input field
pattern_to_replace = r'''(<input
\s*id=\{\s*`ctb-\$\{\s*breakpoint\s*\}\-\$\{\s*field\.property\s*\}`\s*\}
\s*type="text"
\s*disabled=\{\s*linked\s*\}
\s*placeholder=\{
\s*breakpoint !== 'desktop' &&
\s*inheritedMapped\[ field\.property \]
\s*\?\s*`Inherits \$\{
\s*inheritedMapped\[
\s*field\.property
\s*\]
\s*\}
\s*`
\s*:\s*field\.placeholder
\s*\}
\s*value=\{\s*values\[\s*field\.property\s*\]\s*\}
\s*onChange=\{\s*\(\s*event\s*\)\s*=>
\s*setValues\(\s*\{
\s*\.\.\.values,
\s*\[\s*field\.property\s*\]:
\s*event\.target\.value,
\s*\}\s*\)
\s*\}
\s*/>)'''

replacement = '''{ field.options ? (
									<select
										id={ `ctb-${ breakpoint }-${ field.property }` }
										disabled={ linked }
										value={ values[ field.property ] || '' }
										onChange={ ( event ) =>
											setValues( {
												...values,
												[ field.property ]: event.target.value,
											} )
										}
									>
										<option value="">
											{ breakpoint !== 'desktop' && inheritedMapped[ field.property ]
												? `Inherits ${ inheritedMapped[ field.property ] }`
												: field.placeholder || 'Default' }
										</option>
										{ field.options.map( ( opt ) => (
											<option key={ opt } value={ opt }>
												{ opt }
											</option>
										) ) }
									</select>
								) : (
									<input
										id={ `ctb-${ breakpoint }-${ field.property }` }
										type="text"
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
									/>
								) }'''

content = re.sub(pattern_to_replace, replacement, content)

with open("plugin/code-to-block/src/index.js", "w") as f:
    f.write(content)
