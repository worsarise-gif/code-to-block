import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

# Fix the stray closing parenthesis in index.js at the end of the input component replacement
pattern = r"""\t\t\t\t\t\t\t\t\t\)\s*\}\n\t\t\t\t\t\t\t\t\)\s*\}\n\t\t\t\t\t\t\t\t</label>"""
replacement = """\t\t\t\t\t\t\t\t\t) }\n\t\t\t\t\t\t\t\t</label>"""

content = re.sub(pattern, replacement, content)

# Also fix the weird substitution for disabled fields
pattern2 = r'''<span\>\n\t\t\t\t\t\t\t\t\t\t\t\{\s*field\.label\s*\}\{\s*'\s*'\s*\}\n\t\t\t\t\t\t\t\t\t\t\t<small\n\t\t\t\t\t\t\t\t\t\t\t\tstyle=\{\s*\{\n\t\t\t\t\t\t\t\t\t\t\t\t\tbackground: '#fff8df',\n\t\t\t\t\t\t\t\t\t\t\t\t\tborder: '1px solid #d8a77a',\n\t\t\t\t\t\t\t\t\t\t\t\t\tpadding: '1px 4px',\n\t\t\t\t\t\t\t\t\t\t\t\t\tborderRadius: '999px',\n\t\t\t\t\t\t\t\t\t\t\t\t\}\s*\}\n\t\t\t\t\t\t\t\t\t\t\t\>\n\t\t\t\t\t\t\t\t\t\t\t\t\{\s*reason\s*\}\n\t\t\t\t\t\t\t\t\t\t\t</small\>\n\t\t\t\t\t\t\t\t\t\t</span\>[\s\S]*?<input\n\t\t\t\t\t\t\t\t\t\t\tid=\{\s*`ctb-\$\{\s*breakpoint\s*\}\-\$\{\s*field\.property\s*\}`\s*\}\n\t\t\t\t\t\t\t\t\t\t\ttype="text"\n\t\t\t\t\t\t\t\t\t\t\tdisabled\n\t\t\t\t\t\t\t\t\t\t\tplaceholder=\{\s*reason\s*\}\n\t\t\t\t\t\t\t\t\t\t\tvalue=\{\s*values\[\s*field\.property\s*\]\s*\}\n\t\t\t\t\t\t\t\t\t\t\tonChange=\{\s*\(\)\s*=>\s*\{\}\s*\}\n\t\t\t\t\t\t\t\t\t\t/>'''
replacement2 = '''<span>
											{ field.label }{ ' ' }
											<small
												style={ {
													background: '#fff8df',
													border: '1px solid #d8a77a',
													padding: '1px 4px',
													borderRadius: '999px',
												} }
											>
												{ reason }
											</small>
										</span>
										<input
											id={ `ctb-${ breakpoint }-${ field.property }` }
											type="text"
											disabled
											placeholder={ reason }
											value={ values[ field.property ] }
											onChange={ () => {} }
										/>'''

content = re.sub(pattern2, replacement2, content)

with open("plugin/code-to-block/src/index.js", "w") as f:
    f.write(content)
