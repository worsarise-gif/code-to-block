import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

# Replace <input type="text" ... /> in MappedStyleControls with conditional <select> rendering
# Using a simpler regex
pattern_to_replace = r'''(<input\s*id=\{\s*`ctb-\$\{\s*breakpoint\s*\}\-\$\{\s*field\.property\s*\}`\s*\}.*?onChange=\{\s*\(\s*event\s*\)\s*=>.*?\n\s*\}\s*/>)'''

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
\\1
								) }'''

content = re.sub(pattern_to_replace, replacement, content, flags=re.DOTALL)

with open("plugin/code-to-block/src/index.js", "w") as f:
    f.write(content)
