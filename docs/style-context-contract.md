# Style Context Contract

Status: **Accepted and normative for the builder-controls overhaul (Task A2)**.

This contract defines canonical v3 style storage, context identity, source
precedence, selector stability, and legacy isolation. Current implementation
differences are listed explicitly and remain work for later phases.

## Storage

Styles are sparse by registered target and canonical context. Inherited values,
defaults, and empty branches are not serialized locally.

<!-- contract:style-storage -->
```json
{
  "style": {
    "targets": {
      "label": {
        "contexts": {
          "base": {
            "declarations": {"color": "#112233"}
          },
          "bp:tablet|state:hover": {
            "declarations": {"transform": "translateY(-2px)"}
          }
        }
      }
    }
  }
}
```

## Strict Context Grammar

```text
contextKey :=
    "base"
  | "bp:" breakpointId
  | "state:" stateId
  | "bp:" breakpointId "|state:" stateId
```

Breakpoint always precedes state. Exactly one of each segment is allowed.
Desktop/default are represented by omission and canonicalize to `base`, but
`bp:desktop` and `state:default` are invalid persisted keys. Empty, reordered,
duplicated, concatenated, or unregistered segments are invalid. Persisted input
must already equal its canonical formatted form.

<!-- contract:style-context -->
```json
{
  "validContextKeys": [
    "base",
    "bp:tablet",
    "bp:mobile",
    "state:hover",
    "state:focusVisible",
    "bp:tablet|state:hover",
    "bp:mobile|state:focusVisible"
  ],
  "invalidContextKeys": [
    "",
    "bp:desktop",
    "state:default",
    "state:hover|bp:tablet",
    "bp:tablet|bp:mobile",
    "state:hover|state:active",
    "bp:watch",
    "state:unknown",
    "bp:tabletstate:hover",
    "bp:tablet|state:hover|state:active"
  ],
  "localPrecedence": [
    "base",
    "matchingBreakpointChain",
    "state",
    "breakpointState"
  ],
  "mobileHoverSequence": [
    "base",
    "bp:tablet",
    "bp:mobile",
    "state:hover",
    "bp:tablet|state:hover",
    "bp:mobile|state:hover"
  ],
  "sourcePrecedence": [
    "browserTheme",
    "builderBaseline",
    "definition",
    "globalElementStyle",
    "groupPresetStack",
    "elementPreset",
    "localBase",
    "localBreakpoint",
    "localState",
    "localBreakpointState",
    "customDeclarations",
    "legacyImportant"
  ]
}
```

## Breakpoint Inheritance

The identity/inheritance contract is desktop first:

```text
desktop
tablet -> desktop
mobile -> tablet -> desktop
```

Numeric CSS boundaries are not changed by A2. Current v3 code emits 768px and
390px; the legacy compiler emits 1024px and 767px; the specification proposes
980px and 767px after migration. Preview widths are 768px and 390px and are not
CSS-boundary definitions. A later site breakpoint registry and explicit
migration must choose/change numeric boundaries atomically across importer,
preview, compilers, presets, and tests.

## Context And Source Precedence

Within one target, a mobile hover value resolves through the exact sequence in
the machine-readable contract above. Default/base values flow into states; only
the requested state participates. `focusVisible -> focus` and
`loading -> disabled` are not normative semantic aliases and must not be relied
on for persisted meaning.

Across sources, precedence is the 12-level `sourcePrecedence` list above, lowest
to highest. Option-group presets apply in declared stack order. Design tokens
are references, not another layer. Every effective control value reports its
winning source. Editing a shared source is a different command from writing a
local override.

## Set, Clear, Reset, And Detach

- **Set** writes one declaration/binding to the active target and context.
- **Clear/reset** removes that local declaration and prunes empty context and
  target branches, revealing the next lower source.
- **Clear context** removes only the active context.
- **Detach** resolves a referenced token/preset value and writes that value as a
  local declaration while recording the detach operation in history.
- Temporarily hidden controls and absent conditional targets retain stored data
  until an explicit clear/remove action.

Every write uses the normal immutable document command and bounded history
path. Preview scrubbing may be transient, but pointer release creates one
history entry.

## Validation

For each persisted value PHP verifies the resolved element, registered target,
canonical context, target grant, field/property membership, responsive/state
eligibility, value schema, safe CSS, and configured Advanced grant. Errors
include an exact JSON path. Client validation is advisory; it cannot expand
server capability.

## Stable Selectors

Canonical v3 blocks use:

```text
ctb-e-<8-character FNV-1a-32 hash of block.id>
:where(#ctb-page-<postId>) .ctb-e-<hash>
```

Registered non-root targets append a renderer-owned direct-child selector with
a matching `data-ctb-part` marker. Reordering cannot change selector identity.
Duplicating a block creates a new block ID and therefore a new class. User CSS
cannot register arbitrary target selectors.

The manifest/render contract owns state-selector expansion. JS and PHP consume
the same selector table; neither keeps an independent broader/narrower map.

## Important And Visibility

Canonical mapped v3 declarations never gain `!important` automatically.
Validated target custom declarations may explicitly retain it. Imported legacy
important declarations remain in the compatibility compiler until migration
parity proves they can be changed. The builder focus/safety baseline and the
final visibility utility may use controlled importance.

Visibility is `advanced.visibility`, not a layout `display` value. The final
utility is emitted after ordinary layout styles, inherits by breakpoint, and
can explicitly restore visibility at a smaller breakpoint without destroying
the element's authored display mode. Clearing visibility never edits a layout
declaration. Converting legacy `display:none` requires import/visibility
provenance; arbitrary authored display values remain Style data.

## Legacy Compatibility And Migration

Schema v1/v2 continues through the frozen legacy reader/compiler until one page
migration validates, compiles, passes parity, and saves atomically. Migration
maps root base/responsive/state style sets to canonical root contexts, preserves
token/role bindings and raw fallback declarations, and isolates imported
selector/media data that cannot be safely decomposed. It does not normalize the
source fixture or silently discard unsupported fields.

Dual-read/canonical-write means old revisions remain readable and restorable;
only a successfully migrated page writes v3 thereafter.

## Current Implementation Status

The following registry contract gap IDs also govern this contract:

- `A2-GAP-001`: Mixed v3 identity and legacy style factory output.
- `A2-GAP-002`: Definition-global grants cannot enforce target contexts.
- `A2-GAP-003`: Resolver target fallback lacks a primary target diagnostic.
- `A2-GAP-004`: Context parsers/validators disagree and accept noncanonical keys.
- `A2-GAP-005`: Breakpoint boundaries differ between active paths.
- `A2-GAP-006`: Unknown fallback can still expose editable style controls.
- `A2-GAP-007`: Extension context/grant registration is not implemented.
- `A2-GAP-008`: Manifest lacks the complete style/render contract.
- `A2-GAP-009`: PHP accepts safe declarations beyond configured grants.
- `A2-GAP-010`: Non-root renderer part markers are generally absent.
- `A2-GAP-011`: The partial JS source resolver is not integrated into both compilers.
- `A2-GAP-012`: Current editor visibility still writes legacy display fallback.
- `A2-GAP-013`: JS/PHP migration output and failure behavior diverge.
- `A2-GAP-014`: JS/PHP state selectors are not fully identical.
- `A2-GAP-015`: Legacy nested forms remain accepted and require migration policy.
