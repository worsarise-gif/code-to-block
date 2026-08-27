import re

with open("plugin/code-to-block/src/index.js", "r") as f:
    content = f.read()

# Make sure scrubbable input correctly replaces the old input
if "<ScrubbableInput" in content:
    print("ScrubbableInput used in render")
else:
    print("ScrubbableInput NOT found in render")
