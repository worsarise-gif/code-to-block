import re

with open("plugin/code-to-block/src/custom-css.mjs", "r") as f:
    content = f.read()

def add_options(prop, options):
    global content
    options_str = '", "'.join(options)
    options_array = f'options: [ "{options_str}" ],\n\t\t'

    # regex to find the tier field and insert options before it
    pattern = rf"(property:\s*'{prop}',[\s\S]*?tier:\s*'(simple|advanced)',\n\t}})"

    def replacer(match):
        full_match = match.group(1)
        # insert options just before tier
        return re.sub(r"tier:", options_array + "tier:", full_match)

    content = re.sub(pattern, replacer, content)

add_options('text-transform', ['none', 'capitalize', 'uppercase', 'lowercase'])
add_options('text-decoration', ['none', 'underline', 'overline', 'line-through'])
add_options('display', ['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'none'])
add_options('flex-direction', ['row', 'row-reverse', 'column', 'column-reverse'])
add_options('flex-wrap', ['nowrap', 'wrap', 'wrap-reverse'])
add_options('justify-content', ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'])
add_options('align-items', ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'])
add_options('align-content', ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around'])
add_options('align-self', ['auto', 'flex-start', 'flex-end', 'center', 'baseline', 'stretch'])
add_options('object-fit', ['fill', 'contain', 'cover', 'none', 'scale-down'])
add_options('position', ['static', 'relative', 'absolute', 'fixed', 'sticky'])
add_options('overflow', ['visible', 'hidden', 'clip', 'scroll', 'auto'])
# fonts
add_options('font-family', ['Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 'Courier', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact', 'Inter, sans-serif', 'sans-serif', 'serif', 'monospace'])

with open("plugin/code-to-block/src/custom-css.mjs", "w") as f:
    f.write(content)
