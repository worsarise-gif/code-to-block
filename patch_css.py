import re

with open("plugin/code-to-block/src/editor.css", "r") as f:
    content = f.read()

# Add a drag handle icon on hover, and make the drop target more obvious.

css_updates = """
.ctb-rendered-block.is-draggable {
	cursor: grab;
	touch-action: none;
	position: relative;
}

.ctb-rendered-block.is-draggable:hover::after {
	content: "⣿";
	position: absolute;
	top: 4px;
	left: 4px;
	background: var(--ctb-purple);
	color: white;
	font-size: 12px;
	padding: 2px 4px;
	border-radius: 3px;
	pointer-events: none;
	z-index: 1000;
	opacity: 0.8;
}

.ctb-rendered-block.is-draggable:active {
	cursor: grabbing;
}

.ctb-rendered-block.is-dragging {
	opacity: 0.32;
}

.ctb-rendered-block.is-drop-target {
	box-shadow: 0 0 0 6px rgba(101, 88, 211, 0.4) !important;
	outline: 3px solid var(--ctb-purple);
	background-color: rgba(101, 88, 211, 0.05);
}
"""

content = re.sub(r'\.ctb-rendered-block\.is-draggable\s*\{[\s\S]*?outline:\s*2px\s*solid\s*var\(--ctb-purple\);\n\}', css_updates.strip(), content)

with open("plugin/code-to-block/src/editor.css", "w") as f:
    f.write(content)
