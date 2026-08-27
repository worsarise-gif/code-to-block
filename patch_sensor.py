import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

# Change activationConstraint distance from 6 to 3 to make it more responsive.
content = content.replace("useSensor( PointerSensor, { activationConstraint: { distance: 6 } } ),",
                          "useSensor( PointerSensor, { activationConstraint: { distance: 3 } } ),")

with open("plugin/code-to-block/src/index.js", "w") as f:
    f.write(content)
