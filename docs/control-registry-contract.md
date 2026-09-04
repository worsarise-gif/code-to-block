# Control Registry Contract

Status: **Accepted and normative for the builder-controls overhaul (Task A2)**.

This contract defines the target architecture. It does not claim that every
rule is implemented. Schema v1/v2 behavior remains unchanged until an explicit,
successful migration writes canonical v3 data. The implementation gaps at the
end of this document are release work, not permission to create another
registry or inspector path.

## Identity

The following identities are independent:

| Field | Contract |
|---|---|
| `block.id` | Stable identity within one document. It drives the stable CSS class and must change when a block is duplicated. |
| `block.element` | Semantic element-definition ID, for example `core/button`. It is not inferred again after a known value is persisted. |
| `block.definition_version` | Version of that element's persisted semantic/render contract. It can change without changing the document schema. |
| `block.type` | Broad compatibility renderer family. It is not inspector identity. |
| `block.tag` | Constrained output semantics. It is not inspector identity. |
| `document.schema_version` | Version of the document envelope and storage grammar. |
| `document.registry_version` | Compatibility version of the generated registry manifest contract. |

Unknown explicit `element` IDs are preserved. They must not be silently
re-inferred as a first-party element merely because their `type` or `tag`
resembles one.

## Identifier Grammar

```text
elementId    := namespace "/" name
namespace    := [a-z][a-z0-9-]*
name         := [a-z][a-z0-9-]*
targetId     := [a-z][A-Za-z0-9]*
stateId      := [a-z][A-Za-z0-9]*
breakpointId := [a-z][a-z0-9-]*
```

IDs are stable, untranslated storage values. Labels are translated. Aliases
use the element-ID grammar. Target IDs are local to one definition. The
first-party namespaces `core`, `layout`, `forms`, `commerce`, `woocommerce`,
and `legacy` are reserved. An extension owns one globally unique namespace.

## Definition Shape

A complete definition owns identity, renderer family, allowed semantic tags,
parent/child policy, props/content groups, registered style targets, configured
style grants, configured Advanced grants, insertion metadata, validation,
migration, and render contracts. Definitions are serializable data and never
import React or the editor store.

<!-- contract:registry-example -->
```json
{
  "id": "core/button",
  "version": 1,
  "rendererFamily": "button",
  "allowedTags": ["a", "button"],
  "primaryTarget": "label",
  "targets": [
    {"id": "root", "selector": "&", "domOwner": "renderer"},
    {"id": "label", "selector": "[data-ctb-part=\"label\"]", "domOwner": "renderer"},
    {"id": "icon", "selector": "[data-ctb-part=\"icon\"]", "domOwner": "renderer"}
  ],
  "grants": [
    {
      "group": "typography",
      "target": "label",
      "fields": ["font-family", "font-size", "font-weight"],
      "responsive": true,
      "states": ["hover", "focusVisible", "active", "disabled"],
      "tier": "primary",
      "mergeStrategy": null
    },
    {
      "group": "icon",
      "target": "icon",
      "fields": ["color", "width"],
      "responsive": true,
      "states": ["hover", "focusVisible", "active", "disabled"],
      "tier": "recommended",
      "mergeStrategy": null
    }
  ]
}
```

A group is granted to a target with an explicit field subset, responsive flag,
state subset, disclosure tier, and output merge strategy where needed. A
definition-global `styleGroups` array is a compatibility implementation detail,
not the approved capability model. Two grants cannot write the same canonical
property unless they declare one deterministic merge strategy.

## Target Selection

Target resolution is deterministic:

1. Use the explicitly selected target when it is registered and present.
2. Otherwise use the definition's registered `primaryTarget`.
3. If that target is conditionally absent, use registered `root` and emit a diagnostic.
4. Preserve styles for a temporarily absent registered target.
5. Never remap persisted styles from an unknown target to `root`.
6. PHP rejects an unknown persisted target with its exact JSON path.

Renderer-owned targets use registered direct-child selectors and matching
`data-ctb-part` markers in both editor and frontend output. Arbitrary user
selectors cannot become style targets.

The `forms/field-group` renderer owns one direct-child row and the following
stable descendants in both environments:

```text
row          [data-ctb-part="row"]
label        [data-ctb-part="row"] > [data-ctb-part="label"]
control      [data-ctb-part="row"] [data-ctb-part="control"]
placeholder  [data-ctb-part="row"] [data-ctb-part="control"]::placeholder
help         [data-ctb-part="row"] > [data-ctb-part="help"]
error        [data-ctb-part="row"] > [data-ctb-part="error"]
requiredMark [data-ctb-part="row"] > [data-ctb-part="label"] > [data-ctb-part="requiredMark"]
```

`placeholder` is a pseudo-element of a real control, never a synthetic child.
State selectors are inserted before that pseudo-element, for example
`[data-ctb-part="control"]:focus-visible::placeholder`. The descendant control
selector intentionally supports option controls while the row boundary prevents
matching controls owned by nested field groups.

## Inspector Ownership

- **Content** owns element data, semantics, structure, functional behavior, and
  accessibility fields required to make that content meaningful.
- **Style** owns visual presentation through configured target grants.
- **Advanced** owns placement, motion, visibility/conditions,
  attributes/accessibility, performance, permissions, and developer escape
  hatches.

Advanced cannot mount Style groups. The old global Simple/Advanced field tier is
legacy compatibility metadata only. Progressive disclosure is defined per
element grant as `primary`, `recommended`, or `optional`.

## Registration And Authority

JavaScript definitions are the build-time source of truth. Registry generation
produces a deterministic server manifest. Development and build fail on unknown
groups, controls, targets, states, renderer keys, duplicate IDs/aliases,
unresolved output collisions, or a missing server contract.

Client validation is advisory and catches development/editor errors early. PHP
is authoritative for persistence, sanitization, and rendering. A client-only
definition cannot be saved. A missing or incompatible manifest fails v3 writes
closed while v1/v2 documents continue through the legacy adapter/compiler.

<!-- contract:authority -->
```json
{
  "clientValidation": "advisory-and-development",
  "persistenceAuthority": "php",
  "renderAuthority": "php",
  "manifestSource": "javascript-build-registry",
  "missingManifestV3Policy": "fail-closed",
  "legacyManifestPolicy": "continue-legacy-adapter"
}
```

## Extensions And Conflicts

An extension registers a client/server manifest fragment under its owned
namespace. Client and server fragments must have the same content hash and
compatible registry version before data can be edited or saved.

There is no last-write-wins registration. Duplicate element IDs, alias
collisions, reserved namespace claims, duplicate local target IDs, or unknown
contract references reject the extension fragment atomically. Core definitions
cannot be mutated without a future, separately versioned augmentation API.

<!-- contract:conflict-policy -->
```json
{
  "duplicate": "reject-fragment",
  "aliasCollision": "reject-fragment",
  "reservedNamespace": "reject-fragment",
  "lastWriteWins": false,
  "unknownProductionElement": "read-only-diagnostic",
  "preserveNamespacedData": true
}
```

When an extension is missing, preserve its namespaced data and safe rendered
fallback. Show a read-only diagnostic inspector. Do not expose the global Style
catalog, coerce the node to a core definition, or permit a canonical save under
an unknown definition.

## Versioning

- Increment `definition_version` when one element's persisted props, targets,
  states, migration meaning, or render contract changes incompatibly.
- Increment `registry_version` when the manifest schema or a cross-language
  registry contract changes incompatibly.
- An extension manifest has its own version and compatibility range.
- Label, icon, help text, or palette-keyword changes do not require data
  migration.
- An unknown future definition or registry version is read-only until an
  adapter/migrator succeeds.

Manifest fragments include registry version, extension version, content hash,
definitions, controls/value schemas, target grants, parent/child policy,
renderer keys, state selectors, and output mappings. PHP validates all fields
needed to prove that persisted data is renderable.

## Production Fallback

The Legacy/Unknown inspector shows preserved identity, source version,
read-only content preview, attributes, visibility summary, migration status,
and diagnostics. It cannot mutate content, mount a Style catalog, or write a
canonical document. Legacy v1/v2 documents remain editable through their
explicit compatibility adapter; an unknown v3 definition does not.

## Migration Failure

Migration preview is read-only. Apply is one transaction ordered as validate,
compile, parity check, revision creation, and stale-safe meta update. Any failure
retains the source document and existing CSS. Restoring the source revision
reactivates the legacy adapter; no reverse migrator is required.

<!-- contract:migration-failure -->
```json
{
  "sourceDocumentMutated": false,
  "existingCssMutated": false,
  "canonicalSaveAllowed": false,
  "reportRequired": true,
  "revisionRequiredBeforeApply": true,
  "validateBeforeWrite": true,
  "compileBeforeWrite": true,
  "parityBeforeWrite": true,
  "rollbackUsesSourceRevision": true
}
```

## Current Implementation Status

These gap IDs are mandatory until code and parity tests close them:

- `A2-GAP-001`: Factories mix v3 element identity with legacy `styles` storage.
- `A2-GAP-002`: Style groups/states are definition-global, not target grants.
- `A2-GAP-003`: Definitions and resolver lack primary-target metadata.
- `A2-GAP-004`: JS, PHP schema, and PHP renderer disagree on context grammar.
- `A2-GAP-005`: Legacy, v3, preview, and proposed breakpoint boundaries differ.
- `A2-GAP-006`: Unknown/Legacy fallback is not fully read-only.
- `A2-GAP-007`: Extension registration, namespace ownership, and conflicts are not implemented.
- `A2-GAP-008`: The server manifest omits grants, value schemas, policies, and output mappings.
- `A2-GAP-009`: PHP does not yet enforce target/group/property/Advanced grants or parent-child policy.
- `A2-GAP-010`: Internal renderer part markers are generally absent.
- `A2-GAP-011`: Global/preset source resolution is not integrated into both compilers.
- `A2-GAP-012`: The running editor still stores visibility through legacy `display` fallback.
- `A2-GAP-013`: JS/PHP migrations diverge and migration apply is not atomic.
- `A2-GAP-014`: JS/PHP state-selector expansion is not fully identical.
- `A2-GAP-015`: Legacy v1/v2 accepts nested forms while the v3 registry rejects them.

No gap is resolved by documentation alone. Remove a gap only with focused
implementation, migration/parity evidence, and updated A1 snapshots where the
approved behavior intentionally changes.
