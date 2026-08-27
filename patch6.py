import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

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
