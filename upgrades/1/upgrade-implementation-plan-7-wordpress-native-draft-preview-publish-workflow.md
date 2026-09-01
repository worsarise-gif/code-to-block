# Upgrade Implementation Plan 7 — WordPress-Native Draft, Preview, Revisions & Publish Workflow

**Purpose**: Build a production-grade Save Draft, autosave, preview, update, publish, pending-review, private, and scheduled-publish workflow for the existing builder. The workflow must behave like a first-class WordPress editor: WordPress remains the source of truth for post status, permissions, revisions, post locks, timestamps, permalinks, and lifecycle hooks, while the builder provides the visual editing experience. This upgrade extends the builder's existing document/persistence architecture; it must not create a parallel publishing database, duplicate WordPress post statuses, or bypass normal WordPress save hooks.

The interaction should feel comparable to Divi 5's current workflow: page-level save/publish controls stay inside the builder, users can save into WordPress-native statuses, Preview is available without leaving the builder, and the user should never need to return to wp-admin just to safely save or publish a page.

---

# Non-Negotiable Implementation Rules

1. **WordPress is the source of truth for publication state.** Use native WordPress post statuses and post APIs. Do not create builder-only equivalents such as `builder_draft`, `builder_published`, or a custom status table for ordinary page publishing.

2. **Extend the current builder persistence layer instead of replacing it.** If the builder currently stores its canonical document in `post_content`, keep that storage contract unless an explicit migration is required. If it stores canonical builder JSON in registered post meta, continue using that storage. This plan adds a WordPress-aware persistence adapter around the existing model.

3. **Never update `wp_posts` with direct SQL for normal save/publish operations.** Use WordPress APIs such as `wp_insert_post()`, `wp_update_post()`, `wp_publish_post()`, registered REST controllers, and revision/autosave APIs so normal cache invalidation and plugin/theme hooks continue to run.

4. **Do not manually fire WordPress save or status-transition hooks after calling WordPress post APIs.** `wp_update_post()`/`wp_insert_post()` already trigger the appropriate core hooks. Manually firing them again can cause duplicate email notifications, duplicate cache purges, duplicate webhook activity, or plugin bugs.

5. **Autosave must never publish or unpublish a page.** Autosave records recoverable work only. The existing live version must remain unchanged until the user performs an explicit manual save/update/publish action.

6. **Preview must never temporarily publish a draft.** Preview unsaved work from a WordPress autosave/revision or isolated preview payload. A draft must remain a draft in the database before, during, and after Preview.

7. **A status change must always be explicit.** A normal Save action preserves the current WordPress status. A user must deliberately choose Publish, Submit for Review, Make Private, Schedule, or Save as Draft.

8. **Unpublishing requires confirmation.** If a currently published page is changed to Draft, Pending, or another non-public status, show a confirmation explaining that the public URL will stop showing that published version.

9. **Server-side capability checks are authoritative.** Hiding a button in React/Vue is not security. Every save, publish, schedule, restore, and custom-code request must be checked on the server with WordPress capabilities.

10. **Do not check WordPress roles by name.** Never code logic such as `if current user is administrator`. Use capability checks such as `current_user_can( 'edit_post', $post_id )` and the post type's mapped `publish_posts` capability.

11. **Use WordPress cookie authentication and REST nonces inside wp-admin/builder sessions.** Send a valid `wp_rest` nonce through `X-WP-Nonce`. Do not invent a separate login token for the builder.

12. **Imported/custom JavaScript must respect WordPress's `unfiltered_html` capability.** A user who is not permitted by WordPress to save unfiltered code must not be able to bypass that restriction through the builder.

13. **Canonical content persistence and generated caches are separate concerns.** If the page is saved successfully but CSS compilation/cache regeneration fails, do not tell the user that their page was lost. Save the canonical document first, mark generated assets stale, and retry/regenerate them independently.

14. **One canonical save request may be active per document at a time.** Queue/coalesce later requests. Never let two overlapping manual saves race and allow the slower request to overwrite the newer request.

15. **Use optimistic concurrency in addition to post locking.** Post locking prevents normal simultaneous editing, but stale browser tabs and network retries can still exist. The server must reject a save based on an outdated server version instead of silently overwriting newer content.

16. **Existing pages must continue rendering before and after this upgrade without being re-saved.** Do not require every page on the site to be opened and saved to remain compatible.

17. **The builder UI must distinguish these concepts clearly:**
    - local unsaved changes;
    - autosaved recovery copy;
    - manually saved WordPress document;
    - current public/live revision;
    - current WordPress post status.

18. **Never display “Published” or “Saved” until the server confirms it.** Optimistic UI may display “Publishing…” or “Saving…”, but success text and status badges must come from the server response.

19. **WordPress scheduling must use WordPress's `future` status and normal scheduling mechanism.** Do not build a second JavaScript timer or custom scheduler.

20. **All UI strings must be translatable with WordPress internationalization functions.** Do not hardcode English strings into PHP responses when they should be translated.

---

# Target User Experience

The builder's page bar should provide the following page-level actions without requiring a trip back to wp-admin:

- Preview
- Save Draft / Save / Update depending on context
- Publish
- Save as Draft
- Submit for Review
- Make Private
- Schedule
- View Page
- Revision History
- Exit Builder

The current page status must always be visible near the save/publish controls.

Recommended status labels:

| WordPress status | Builder label |
|---|---|
| `auto-draft` | Unsaved page |
| `draft` | Draft |
| `pending` | Pending review |
| `publish` | Published |
| `private` | Private |
| `future` | Scheduled |
| `trash` | Trashed / unavailable for editing |

Do not invent different internal names for these states.

---

# Required State Model

Implement a single editor save-state store for each open document.

Minimum client state:

```ts
type WordPressPostStatus =
  | 'auto-draft'
  | 'draft'
  | 'pending'
  | 'publish'
  | 'private'
  | 'future'
  | 'trash';

interface BuilderSaveState {
  postId: number;
  postType: string;

  wpStatus: WordPressPostStatus;

  serverVersion: string;
  serverModifiedGmt: string | null;
  lastSavedContentHash: string | null;

  localContentHash: string;
  isDirty: boolean;

  isSaving: boolean;
  isAutosaving: boolean;
  isPublishing: boolean;

  lastManualSaveAt: string | null;
  lastAutosaveAt: string | null;

  latestAutosaveId: number | null;
  latestRevisionId: number | null;

  lockOwnerId: number | null;
  lockOwnerName: string | null;
  hasEditLock: boolean;

  saveError: BuilderSaveError | null;
  conflict: BuilderConflict | null;

  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canUseUnfilteredHtml: boolean;
}
```

`isDirty` must be derived from the canonical local builder document compared with the last server-confirmed canonical document/hash. UI-only state such as which inspector tab is open, panel widths, current zoom, current selected element, and workspace layout must not mark the page as dirty.

---

# WordPress Persistence Contract

Before coding save/publish behavior, identify which existing storage method the builder already uses.

Supported patterns:

### Pattern A — Builder document stored in `post_content`

Use `post_content` as the canonical revisioned builder serialization. Keep WordPress native revisions automatically covering the canonical document.

### Pattern B — Builder document stored in post meta

Keep that model. Register the canonical meta field with `register_post_meta()` or `register_meta()` and, when WordPress 6.4+ is available, enable native post-meta revisions with `revisions_enabled => true`.

Example shape:

```php
register_post_meta(
    '',
    '_nexo_builder_document',
    [
        'single'            => true,
        'type'              => 'string',
        'show_in_rest'      => true,
        'revisions_enabled' => true,
        'sanitize_callback' => 'nexo_sanitize_builder_document',
        'auth_callback'     => 'nexo_auth_builder_document_meta',
    ]
);
```

Use the builder's real plugin prefix instead of `nexo` if different.

### Pattern C — Hybrid storage

If the current builder stores a canonical JSON document in meta and a generated/fallback representation in `post_content`, the JSON/meta document remains canonical. Do not compare the rendered fallback to determine dirty state.

### WordPress versions below 6.4

Native post-meta revisions became available in WordPress 6.4. If the plugin supports older WordPress versions and its canonical document is stored exclusively in post meta, implement one of these explicit compatibility paths:

1. Raise the minimum WordPress version for the new revision-aware builder feature to 6.4; or
2. Preserve revisionable canonical serialization in `post_content`; or
3. Implement a tested compatibility hook that copies/restores the required builder meta to revisions.

Do not silently advertise complete revision recovery on older versions if the canonical builder data is not actually revisioned.

---

# Server Save Payload

Create one normalized composite request format used by manual saves, publishing, status changes, and optionally autosave.

Example:

```json
{
  "requestId": "0c4d72e0-4c79-4dce-8f89-b9a4d31d0c59",
  "postId": 123,
  "postType": "page",
  "baseServerVersion": "173ac2d...",
  "reason": "manual",
  "post": {
    "title": "About Us",
    "slug": "about-us",
    "status": "draft",
    "excerpt": "",
    "date": null,
    "template": ""
  },
  "builder": {
    "schemaVersion": 7,
    "document": {}
  }
}
```

Rules:

- `baseServerVersion` is required for update requests.
- `status` is always explicit in a manual status-changing request.
- A normal manual Save copies the current status into the request; it must not infer a new status from the button label alone.
- The client must not send fields the user is not allowed to modify.
- The server must ignore or reject unknown protected fields rather than writing arbitrary request keys into `wp_posts`.

---

# Server Save Response

Every successful save response must return authoritative server data.

Example:

```json
{
  "ok": true,
  "postId": 123,
  "postType": "page",
  "status": "draft",
  "statusLabel": "Draft",
  "serverVersion": "62f06ce...",
  "modified": "2026-08-29T03:15:22",
  "modifiedGmt": "2026-08-29T03:15:22",
  "permalink": "https://example.com/about-us/",
  "previewUrl": "https://example.com/?page_id=123&preview=true...",
  "latestRevisionId": 456,
  "latestAutosaveId": null,
  "contentHash": "57bc40...",
  "compiledAssets": {
    "state": "ready"
  }
}
```

The client must update its local baseline only from this successful response.

---

# Error Contract

Normalize REST errors into predictable codes.

Minimum error set:

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `invalid_request` | malformed request |
| 400 | `invalid_status` | unsupported/invalid status |
| 401 | `rest_not_logged_in` | authentication expired |
| 403 | `cannot_edit_post` | user lacks edit permission |
| 403 | `cannot_publish_post` | user lacks publish permission |
| 403 | `unfiltered_html_required` | custom code exceeds user's allowed capability |
| 404 | `post_not_found` | post was removed or invalid |
| 409 | `post_locked` | another user owns the current edit lock |
| 409 | `stale_document` | server document changed since the client's base version |
| 422 | `invalid_builder_document` | builder schema/content failed validation |
| 422 | `publish_validation_failed` | a blocking publish requirement failed |
| 500 | `save_failed` | WordPress persistence failed |
| 503 | `temporary_save_failure` | transient server/cache/database condition |

Every error must include a user-safe message plus structured details for the UI. Never return PHP notices, stack traces, database credentials, or filesystem paths to the browser in production.

---

# Step 1 — Audit and Wrap the Existing Persistence Layer

Find the builder's current load/save path before adding new endpoints. Identify:

- where the builder document is stored;
- how it is serialized;
- how page title/status are currently saved;
- whether a REST route already exists;
- whether the builder writes directly to WordPress posts or through a custom table;
- whether generated CSS/JS assets are persisted separately;
- how imported HTML/CSS/JS from Upgrade Plan 6 is stored;
- how front-end rendering currently retrieves the document.

Create a single `BuilderDocumentRepository`/equivalent service around the existing implementation rather than adding save logic independently inside UI components.

Minimum responsibilities:

```php
interface Builder_Document_Repository {
    public function load( int $post_id );
    public function validate( array $document );
    public function sanitize( array $document, int $user_id, int $post_id );
    public function persist_with_post( int $post_id, array $post_fields, array $document );
    public function get_content_hash( int $post_id ): string;
    public function get_server_version( int $post_id ): string;
}
```

Do not migrate data merely to fit this interface. Adapt the repository to the storage already used by the builder.

## Checkpoint for Step 1

Open one pre-upgrade builder page and one newly created page. Log/document the exact canonical storage location and verify the repository can load both into byte-for-byte or semantically equivalent builder documents without saving either page.

---

# Step 2 — Register Builder Meta Correctly With WordPress

For every builder-owned meta field that is canonical page content, register it through WordPress.

Use:

- `single => true` where appropriate;
- a strict data type;
- `sanitize_callback`;
- `auth_callback`;
- `show_in_rest` only when required;
- `revisions_enabled => true` for canonical revisionable meta on WordPress 6.4+.

Do not mark generated caches, temporary preview payloads, lock state, or UI workspace preferences as revisioned canonical content.

Recommended categories:

### Revisioned canonical data

- builder document;
- page-scoped custom CSS if part of page design;
- allowed page-scoped custom code if part of page content;
- page-scoped design-system overrides if part of the document.

### Non-revisioned derived data

- compiled CSS filename/hash;
- last compile timestamp;
- generated selector index;
- render cache key;
- lint result cache.

### User preference data

Store workspace preferences, panel state, and personal builder settings in user meta, not page meta.

## Checkpoint for Step 2

On WordPress 6.4+, save a page, change one builder property, save again, and inspect its WordPress revisions. Confirm the canonical builder meta exists on the revision and can be retrieved from that revision. Confirm generated cache metadata is not unnecessarily duplicated into every revision.

---

# Step 3 — Implement a WordPress Capability Policy Service

Create one server-side policy class/function set used by every builder route.

Required checks:

```php
current_user_can( 'edit_post', $post_id );
current_user_can( 'delete_post', $post_id );
```

For publication capability, resolve the post type object:

```php
$post_type_object = get_post_type_object( get_post_type( $post_id ) );
$can_publish = $post_type_object
    && current_user_can( $post_type_object->cap->publish_posts );
```

Custom HTML/JavaScript capability:

```php
$can_unfiltered_html = current_user_can( 'unfiltered_html' );
```

Important:

- Do not assume the post type is `page`.
- Do not hardcode `publish_pages`.
- Do not assume administrators always have `unfiltered_html`; WordPress multisite changes that behavior.
- Do not trust capability booleans previously sent by the browser.
- Return current capabilities when loading the builder so the UI can present the correct actions, but always re-check when the action executes.

## Checkpoint for Step 3

Test at least these users:

1. Administrator/editor who can publish.
2. Contributor-like user who can edit/submit but cannot publish.
3. User who cannot edit the target page.
4. Multisite user without `unfiltered_html` if multisite is supported.

Confirm the server rejects unauthorized REST calls even when invoked manually outside the UI.

---

# Step 4 — Add REST Authentication and Route Registration

Use WordPress REST routes registered on `rest_api_init`. Every private route must define a real `permission_callback`.

Recommended namespace:

```text
/nexo-builder/v1
```

Use the actual plugin slug/prefix if different.

Recommended routes:

```text
GET    /documents/{id}
POST   /documents/{id}/save
POST   /documents/{id}/autosave
POST   /documents/{id}/preview
POST   /documents/{id}/lock
DELETE /documents/{id}/lock
GET    /documents/{id}/revisions
POST   /documents/{id}/revisions/{revision_id}/restore
```

Where core REST endpoints can perform the operation without breaking the builder document contract, reuse them. Custom routes are justified for composite builder-document operations that must validate builder data plus WordPress post fields together.

Inside the logged-in builder, authenticate with normal WordPress cookies and a `wp_rest` nonce sent using:

```http
X-WP-Nonce: <nonce>
```

Do not expose Application Passwords or create a custom bearer token for normal in-dashboard editing.

## Checkpoint for Step 4

With a valid login and nonce, load and save a permitted page. Repeat the same save with the nonce removed and verify it fails as unauthenticated. Repeat with a logged-in user lacking `edit_post` permission and verify it returns 403.

---

# Step 5 — Add Authoritative Server Versioning and Conflict Detection

Create a server version for the canonical document.

The version can be a stable hash derived from:

- canonical serialized builder document;
- relevant revisioned post fields;
- optionally `post_modified_gmt`;
- schema version.

Example concept:

```php
$server_version = hash(
    'sha256',
    $canonical_document_json . '|' .
    $post->post_title . '|' .
    $post->post_status . '|' .
    $post->post_modified_gmt
);
```

On every manual save:

1. Read current server version.
2. Compare with request `baseServerVersion`.
3. If they differ and request is not an explicitly approved conflict resolution, return HTTP 409 `stale_document`.
4. Do not persist the stale request.
5. Return enough metadata for the UI to offer Reload, Compare, or Save a Copy.

Do not use `post_modified` alone as the only conflict key if two writes may happen inside the same timestamp resolution.

## Checkpoint for Step 5

Open the same page in two browser sessions. Save a change in browser A. Without reloading browser B, attempt a different manual save. Confirm browser B receives a conflict and browser A's newer content remains unchanged.

---

# Step 6 — Implement WordPress Post Locking

Integrate WordPress's native editing lock instead of creating an unrelated builder lock table.

Use `wp_check_post_lock()` to detect another editor and `wp_set_post_lock()`/normal WordPress lock behavior to claim/refresh a lock.

Refresh the lock using WordPress Heartbeat or an equivalent authenticated periodic builder request. Keep the refresh interval comfortably below the WordPress lock expiration window.

When another user holds the lock:

- load the page read-only by default;
- display the editor's display name;
- disable manual Save/Publish;
- do not disable Preview of the currently loaded local copy;
- provide a Take Over action only if consistent with your product permissions/policy;
- re-check the lock server-side before every manual save even if the UI believes it owns the lock.

Release/allow lock expiry when the builder closes. Do not depend on a browser unload request as the only release path.

## Checkpoint for Step 6

User A opens page 123. User B then opens page 123. Confirm B receives a visible lock notice and cannot save over A. Close A, allow the normal lock release/expiry path, then confirm B can acquire the lock and edit.

---

# Step 7 — Implement Deterministic Dirty-State Tracking

Dirty state must be based on canonical builder data.

On load:

1. Normalize the server document.
2. Generate `lastSavedContentHash`.
3. Set local document from that exact canonical document.
4. Set `isDirty = false`.

On each content/design edit:

1. Update canonical local document.
2. Debounce hash calculation if necessary.
3. Compare against `lastSavedContentHash`.
4. Set `isDirty`.

Do not mark dirty for:

- element selection;
- hovering;
- zoom;
- panel open/close;
- inspector tab;
- canvas viewport width;
- builder theme;
- temporary drag preview before commit.

After a successful server save, replace the baseline with the server-confirmed normalized document/hash. Do not assume the request payload is the final server document because sanitization may modify it.

## Checkpoint for Step 7

Open a clean page, select five different elements, resize the inspector, switch desktop/tablet/mobile preview, and zoom the canvas. The page must remain “Saved.” Change one heading text character; status must change to “Unsaved changes.” Undo that exact edit back to the saved value; status must return to “Saved” without sending a manual save.

---

# Step 8 — Build the Save Queue and Request Coordinator

Create one save coordinator per document.

Rules:

- only one canonical manual save runs at once;
- an autosave must not overwrite a newer completed manual save;
- if the user presses Save repeatedly, coalesce redundant requests;
- if a save is active and the user makes more edits, allow the active save to complete but keep `isDirty = true` for the newer local state;
- do not mark those newer edits saved just because the earlier request succeeded;
- status-changing operations are not silently dropped by coalescing.

Recommended operation priority:

```text
publish/status change > manual save > autosave
```

Use request-specific local content hashes. A response may clear dirty state only if the current local content hash still matches the content hash represented by that save response.

## Checkpoint for Step 8

Throttle the network. Make edit A and press Save. Before the response returns, make edit B. When save A returns, confirm the UI still says Unsaved Changes because edit B has not yet been saved. Save again and confirm only then does the UI become Saved.

---

# Step 9 — Implement Manual “Save Draft”

For a page in `auto-draft` or `draft` status:

1. Validate the builder document.
2. Check edit permission.
3. Check post lock.
4. Check server version.
5. Sanitize builder payload.
6. Save page fields and canonical builder document through WordPress APIs.
7. Explicitly preserve/set status `draft`.
8. Let WordPress create its normal revision where applicable.
9. Return authoritative post status, version, modified time, revision ID, preview URL, and permalink.
10. Update the client baseline only after success.

Use `wp_update_post()`/`wp_insert_post()` and include canonical meta through a supported path such as `meta_input` or registered REST meta so that normal WordPress save hooks see a complete save.

Do not publish just because the page already has a public-looking permalink.

## Checkpoint for Step 9

Create a brand-new page, enter a title and content, click Save Draft, refresh the browser, and reopen the builder. Confirm all content remains, WordPress reports `post_status = draft`, the public anonymous URL does not expose it as a published page, and the builder reports a clean Saved state.

---

# Step 10 — Implement First-Time Publish

For a page that is not currently published:

1. Require publish capability.
2. Validate current edit lock.
3. Validate server version.
4. Run publish validation.
5. Save the latest canonical builder document and post fields.
6. Set WordPress status to `publish`.
7. Allow WordPress to perform its normal status transition and hooks.
8. Regenerate/mark front-end assets current.
9. Return the actual permalink and published status.
10. Change the builder primary action from Publish to Update after server confirmation.

Do not manually call `transition_post_status`, `save_post`, or `wp_after_insert_post` after `wp_update_post()`.

If the same Publish request is retried after a network timeout and the page is already published with the same canonical content, treat the result safely and return the current published state rather than generating duplicate side effects inside builder code.

## Checkpoint for Step 10

Publish a draft while monitoring WordPress hooks or an integration plugin that listens to normal post saves. Confirm the page becomes publicly accessible, status is exactly `publish`, the permalink returned by WordPress is used by the builder, and standard WordPress save/status hooks execute once through the core save path.

---

# Step 11 — Implement Published-Page Update

A published page must not have a confusing “Save Draft” primary action.

For `publish` status:

- primary commit label: **Update**;
- Preview remains available;
- Update preserves `publish`;
- status dropdown may contain explicit actions such as Switch to Draft, Make Private, or Schedule a future change only if supported.

When Update succeeds:

- current public content changes to the new saved revision;
- WordPress status remains `publish`;
- new revision becomes available;
- generated builder assets are invalidated/regenerated;
- the UI returns to Saved/Published.

## Checkpoint for Step 11

Open an already published page. Change a heading and click Update. Confirm the live front end changes only after successful Update, the page status never leaves `publish`, and a previous revision remains recoverable.

---

# Step 12 — Implement Explicit Unpublish-to-Draft Behavior

If a published page is changed to Draft, do not hide the consequence.

Show confirmation:

**Move this published page to Draft?**

Explain:

- it will no longer be publicly available as a published page;
- the builder content will remain saved;
- it can be published again later.

Buttons:

- Cancel
- Move to Draft

After confirmation, send a normal WordPress status transition to `draft`.

Do not implement “Save Draft” on a published page as a way to secretly keep a separate unpublished working copy. WordPress does not natively treat the main post that way. If a future feature needs staged changes to a live page, design that separately using revisions/workflows rather than pretending a published page can simultaneously have a different canonical draft.

## Checkpoint for Step 12

Move a published test page to Draft. Confirm status becomes `draft`, anonymous visitors no longer receive the previously published page as current public content, and republishing restores a normal public page.

---

# Step 13 — Implement Pending Review

If the user can edit but cannot publish:

- do not show an enabled Publish action;
- show **Submit for Review** when appropriate;
- save with WordPress status `pending`;
- display status badge Pending Review;
- continue allowing permitted edits.

For a publisher/editor opening a pending page:

- expose Publish if capability allows;
- expose return-to-draft if appropriate.

Do not emulate review status in builder metadata. Use WordPress `pending`.

## Checkpoint for Step 13

Log in as a user who can edit but cannot publish. Confirm there is no API path that lets them set `publish`. Submit the page for review and verify WordPress status is `pending`. Then log in as a publisher and publish the same page successfully.

---

# Step 14 — Implement Private Status

Allow **Make Private** only when WordPress permissions allow it.

On success:

- set status `private`;
- update button/status labels;
- preserve builder data and revisions;
- use WordPress's normal private-content behavior.

If moving from public to private, show a consequence confirmation similar to unpublishing.

Do not create a CSS/JavaScript “hidden page” flag. Visibility must come from WordPress status/access behavior.

## Checkpoint for Step 14

Set a page Private. Confirm a logged-out visitor cannot consume it as a normal public page, an authorized logged-in user can access it according to WordPress behavior, and the builder shows Private after refresh.

---

# Step 15 — Implement Scheduled Publishing With WordPress `future`

Provide a Schedule action where the current user has permission.

Input rules:

- date and time are entered in the site's WordPress timezone;
- show the site's timezone name/offset in the UI;
- reject invalid past dates for a Schedule action;
- send an ISO or normalized value that the server converts safely;
- set WordPress status `future`;
- let WordPress schedule `publish_future_post`.

Do not build a browser timer to publish the page.

Display:

```text
Scheduled for Aug 31, 2026 at 9:00 AM
Site timezone: Asia/Manila
```

If the schedule is changed, update the WordPress post date/status through core APIs.

Note: WordPress's future publishing relies on its normal cron behavior. Do not hide that platform behavior by creating a separate scheduler inside this feature.

## Checkpoint for Step 15

Schedule a test page a few minutes in the future on a test site with working WordPress cron. Verify status is `future`, the scheduled date matches the site's timezone, and WordPress changes it to `publish` through its normal scheduling path.

---

# Step 16 — Implement Autosave Using WordPress Revision Semantics

Autosave is a recovery mechanism, not a manual save.

Default behavior:

- use the site's WordPress autosave interval when practical;
- WordPress defaults to 60 seconds unless `AUTOSAVE_INTERVAL` is customized;
- optionally trigger an idle autosave sooner for significant changes, but never more aggressively than needed;
- pause autosave when there are no dirty changes;
- do not run multiple autosaves concurrently;
- skip autosave while a manual save/publish is actively committing, then evaluate remaining dirty state afterward.

For published pages, autosave must store unsaved work in an autosave/revision and must not update the live parent post.

For draft pages, preserve WordPress-consistent behavior and ensure the recovery copy does not unexpectedly change status.

If canonical builder data lives in revision-enabled meta on WordPress 6.4+, include that meta in the autosave.

UI text examples:

```text
Autosaving…
Autosaved at 11:42 PM
Unsaved changes
Saved
```

Do not replace the primary Save/Update action with autosave. Users must still be able to create an intentional saved revision.

## Checkpoint for Step 16

Open a published page, change content, and wait for autosave without pressing Update. Refresh the public front end in another browser: it must still show the old published content. Recover/open the autosave and confirm the unsaved builder change exists there.

---

# Step 17 — Implement Crash/Refresh Recovery

When loading the builder:

1. Load current canonical parent post.
2. Query the current user's latest autosave for that post.
3. Compare autosave time/content with the canonical parent.
4. If autosave contains newer meaningful changes, show a recovery prompt.

Prompt example:

**We found newer autosaved changes**

- Autosaved: 11:42 PM
- Last manual save: 11:36 PM

Actions:

- Restore Autosave
- Compare
- Discard Autosave

Do not silently replace a manually saved document with an autosave.

Restoring an autosave into the editor should initially load it as local dirty state unless the user explicitly commits it, or use the native restore flow followed by a server-confirmed save depending on the selected architecture. Whichever path is chosen must be deterministic and tested.

## Checkpoint for Step 17

Create unsaved changes, allow autosave, then simulate a browser crash. Reopen the page. Confirm the user is offered the newer autosave and can restore it without overwriting the saved page until they deliberately save/update.

---

# Step 18 — Implement WordPress Revision History

Expose a Revision History panel from the builder.

Each revision row should show:

- revision ID;
- author;
- date/time in site/local display;
- whether it was a manual revision or autosave;
- status context if available;
- optional summary such as “Heading text changed” if a reliable builder diff exists.

Use WordPress revision data rather than a builder-only revision table.

Restore through `wp_restore_post_revision()` or a tested WordPress-native restore path. With WordPress 6.4+ revisioned post meta, WordPress can also restore registered revisioned meta.

After restore:

1. invalidate/regenerate builder caches;
2. reload canonical document from the server;
3. obtain a new server version;
4. clear stale undo history;
5. show a clear “Revision restored” notification.

Do not merge arbitrary current local unsaved changes into a restored revision automatically.

## Checkpoint for Step 18

Save three intentionally different versions of a page. Open Revision History, restore version 1, refresh the builder, and confirm both the visual layout and revisioned builder meta match version 1. Confirm a subsequent save creates a new revision rather than deleting revision history.

---

# Step 19 — Implement Preview Without Publishing

Preview must support:

- draft;
- pending;
- private when user can access it;
- scheduled;
- published;
- local unsaved changes.

For local unsaved changes:

1. create/update a WordPress autosave or secure preview snapshot;
2. obtain a server-generated preview URL tied to the current user and post;
3. open it inside the builder Preview Mode iframe or a new tab;
4. render from the preview/autosave content;
5. do not change parent post status.

Prefer WordPress mechanisms such as `get_preview_post_link()` and normal preview/autosave behavior where compatible with the builder's storage model.

Security:

- preview tokens/nonces must be user/session scoped;
- unauthorized logged-out users must not gain draft access by copying an expired/internal preview URL;
- preview should not be indexed;
- preview must not pollute public page cache.

For the HTML/CSS/JS import feature from Upgrade Plan 6, imported JavaScript may run in the isolated Preview environment when the current user is authorized, but it remains disabled inside the editing canvas itself.

## Checkpoint for Step 19

Create unsaved edits on a draft and enter Preview Mode. Confirm Preview shows the unsaved version, the database parent remains `draft`, opening the ordinary public URL in a logged-out browser does not expose the draft, and leaving Preview returns to the same unsaved editor state.

---

# Step 20 — Build the Page-Bar Save/Publish UI State Machine

Update the existing top bar; do not add a second save toolbar.

Use a status-aware primary/secondary action layout.

Recommended behavior:

### `auto-draft`

- Secondary: Save Draft
- Primary: Publish, if allowed
- If cannot publish: Save Draft / Submit for Review

### `draft`

- Secondary: Save Draft
- Primary: Publish, if allowed
- Dropdown: Submit for Review, Make Private, Schedule as permissions allow

### `pending`

- Secondary: Save
- Primary for publisher: Publish
- Primary for non-publisher: Save
- Dropdown: Move to Draft as permitted

### `publish`

- Primary: Update
- Badge: Published
- Dropdown: Move to Draft, Make Private
- Preview/View Page available

### `private`

- Primary: Update
- Badge: Private
- Dropdown: Publish, Move to Draft as permitted

### `future`

- Primary: Update Scheduled Page
- Badge: Scheduled
- Display scheduled date/time
- Dropdown: Publish Now, Move to Draft, reschedule as permitted

Save-state indicator must be separate from publication status.

Example:

```text
Draft · Unsaved changes
Draft · Saving…
Draft · Saved
Published · Unsaved changes
Published · Updating…
Published · Updated
```

This prevents the word “Saved” from being mistaken for “Published.”

## Checkpoint for Step 20

Cycle one page through Draft → Published → Private → Draft → Scheduled. After every transition, refresh the builder and confirm the visible status badge and available actions are reconstructed from the WordPress server status, not leftover client state.

---

# Step 21 — Add a Pre-Publish Review Panel

Before first publication, open a compact review panel/modal rather than instantly publishing on the first Publish click.

Show:

- title;
- target permalink/slug;
- visibility;
- immediate publish vs schedule;
- optional template;
- blocking validation issues;
- non-blocking warnings.

Suggested actions:

- Cancel
- Publish

Do not overwhelm the user with every WordPress field. Keep advanced fields in Page Settings.

For subsequent updates to an already published page, do not require this modal on every Update unless a critical status/visibility change is being made.

## Checkpoint for Step 21

On a draft, click Publish. Confirm the review panel shows the correct title/permalink and does not alter WordPress status. Click Cancel and verify nothing is published. Repeat and confirm only the final Publish action changes status.

---

# Step 22 — Define Blocking Validation vs Non-Blocking Warnings

Separate invalid data from design advice.

### Block a save when

- builder document cannot be parsed;
- schema is unsupported/corrupted;
- required server invariants fail;
- request is stale/conflicted;
- user is unauthorized;
- server sanitization cannot produce a safe canonical document.

### Block publish when

- canonical document cannot render safely;
- required WordPress title/page invariant enforced by the product is missing;
- prohibited custom code is present for a user without permission;
- a critical builder dependency is unresolved and would cause a broken page.

### Do not block publish merely because

- an image lacks alt text;
- a link is `#`;
- a design warning exists;
- spacing appears unusual;
- SEO metadata is incomplete.

Those should be warnings unless the product explicitly adopts stricter rules.

The UI must label each item:

```text
Error — must fix before publishing
Warning — review recommended
```

## Checkpoint for Step 22

Create one document with a truly invalid builder node and one with only a missing image alt attribute. Confirm the invalid node blocks publish with a specific path/error, while the missing alt attribute is shown as a warning and does not falsely report a server failure.

---

# Step 23 — Integrate Imported HTML/CSS/JS With the Save Pipeline

Upgrade Plan 6 introduced parsing of full HTML documents with embedded CSS/JS. The save/publish workflow must persist those imported results using the same canonical builder document and revision system as manually created builder content.

Requirements:

- imported DOM converted into builder elements saves normally;
- parsed CSS variables and styles are revisioned as part of canonical page design;
- responsive media-query data remains stable through save/reload;
- keyframes/animations remain stable;
- imported IDs/classes remain stable;
- allowed imported JavaScript is revisioned with the page;
- editor canvas does not execute arbitrary imported page JS;
- Preview/published output executes only code that survived server capability/security validation.

If a user lacks `unfiltered_html`:

- do not silently store executable code;
- reject the restricted portion with `unfiltered_html_required`, or
- strip only under an explicitly documented safe-import mode and tell the user exactly what was removed.

Never let an import performed by a low-permission user become a privilege-escalation path.

## Checkpoint for Step 23

Import the full portfolio HTML/CSS/JS document from Upgrade Plan 6, save it as Draft, refresh, Preview, then Publish. Confirm layout/CSS/media queries remain intact across each transition and that JavaScript does not run in the editing canvas but works in authorized Preview/published rendering.

---

# Step 24 — Synchronize Page Settings With WordPress

Page-level settings that belong to WordPress must remain WordPress fields.

At minimum support, if already part of the builder:

- post/page title;
- slug;
- excerpt;
- featured image;
- template;
- author where permitted;
- discussion settings where relevant;
- visibility/status;
- publish/scheduled date.

Do not duplicate title, slug, or post status inside the builder document as authoritative fields.

If the visual canvas contains a separate heading element, it can have its own text; that does not replace `post_title`.

When title/slug changes:

- request WordPress's resulting permalink;
- display the server-returned permalink;
- never construct permalink assumptions entirely in JavaScript because WordPress rewrite structures/plugins may modify it.

## Checkpoint for Step 24

Change the page slug through builder Page Settings and save. Confirm WordPress stores the new slug, the builder receives the actual new permalink, custom permalink plugins/structures are respected, and the URL remains correct after reload.

---

# Step 25 — Preserve WordPress Lifecycle Hooks and Third-Party Compatibility

Because the builder is a WordPress plugin, saves must behave normally to other plugins.

Use normal post APIs so integrations can observe:

- `save_post_{post_type}`;
- `save_post`;
- `post_updated`;
- `transition_post_status`;
- `wp_after_insert_post`;
- status-specific hooks.

Builder callbacks hooked to these events must guard against unwanted recursion.

Typical bailout pattern:

```php
if ( wp_is_post_revision( $post_id ) ) {
    return;
}

if ( wp_is_post_autosave( $post_id ) ) {
    return;
}
```

Use this only where that callback should ignore revisions/autosaves. Do not globally disable WordPress revisions.

Never temporarily remove arbitrary third-party hooks just to make builder saving work.

## Checkpoint for Step 25

Install or simulate a plugin listening to `save_post` and `transition_post_status`. Save a draft, publish it, then update it. Confirm the expected WordPress hooks fire through normal core behavior without duplicate builder-triggered hook calls.

---

# Step 26 — Implement Cache and Generated Asset Invalidation Safely

If the builder generates CSS/JS/cache files:

1. Save canonical WordPress content first.
2. Compute new canonical content hash.
3. Mark previous generated artifacts stale.
4. Generate new assets synchronously only if fast/reliable enough.
5. Otherwise enqueue generation and allow runtime fallback generation.
6. Write generated asset metadata only after successful generation.
7. Never set the canonical document back to the old version because compilation failed.

Use content-addressed filenames where possible:

```text
page-123.57bc40a2.css
```

This avoids stale browser/CDN caches.

For published pages, ensure front-end rendering can fall back safely if the newest compiled asset is not ready.

Do not manually purge every possible caching plugin. Normal WordPress post-save hooks allow established cache plugins to react. Add explicit integration adapters only where necessary.

## Checkpoint for Step 26

Force the builder CSS compiler to fail after a successful WordPress save. Confirm the page content remains saved and recoverable, the UI reports a generated-asset problem rather than “save failed,” and retrying compilation repairs the asset without requiring the user to re-enter content.

---

# Step 27 — Add Network Failure, Authentication Expiry, and Retry Behavior

Differentiate save failures.

### Network disconnected

Show:

```text
Offline — changes are still in this browser.
```

Keep local edits. Do not claim they are saved.

### REST nonce/session expired

On 401/403 authentication failure:

- stop automatic retry loops;
- show Session expired;
- provide Re-authenticate/Reload;
- preserve local document in memory and optional safe local recovery storage before reload.

### Temporary server failure

Allow manual Retry. Use bounded exponential backoff for autosave only. Do not hammer the server.

### Validation error

Do not retry automatically. Point to the problem.

### Conflict

Do not retry automatically with overwrite. Require user decision.

Optional local recovery storage may use IndexedDB/session storage, but it must be clearly a browser recovery copy, not a WordPress draft. Never label it “Saved Draft.”

## Checkpoint for Step 27

Disconnect the network, edit a page, and press Save. Confirm no Saved state appears. Reconnect and Retry, then confirm the same local document is saved once. Simulate an expired nonce and confirm the system stops automatic writes rather than generating repeated failures.

---

# Step 28 — Add Unsaved-Changes Navigation Protection

Intercept builder-controlled navigation:

- switching pages;
- exiting builder;
- closing a page through Page Manager;
- opening another post;
- destructive reload actions.

If `isDirty`:

Prompt:

**You have unsaved changes**

Actions:

- Stay
- Discard Changes
- Save and Continue

`Save and Continue` must wait for server success before navigation.

Use the browser `beforeunload` fallback for actual tab/window closing, understanding that browsers control the message text.

Do not warn when only an autosave exists but the canonical local document matches the latest manually saved baseline unless product policy explicitly wants that distinction.

## Checkpoint for Step 28

Edit a heading and immediately use the Page Manager to navigate elsewhere. Choose Save and Continue. Confirm the first page is saved successfully before navigation occurs and the second page opens only afterward.

---

# Step 29 — Integrate Page Manager With Native Statuses

If the builder has or will have a Divi-like Page Manager, every page row should obtain status from WordPress.

Recommended row metadata:

```text
About Us        Draft
Home            Published
Services        Scheduled · Aug 31
Pricing         Private
Landing Page    Pending review
```

Creating a page from Page Manager should support:

- Draft;
- Published, when user can publish;
- Scheduled, when user can publish and supplies a date.

Use WordPress post creation APIs. Do not create a placeholder builder record without a real WordPress post ID.

Duplicating a page:

- creates a new WordPress post;
- defaults to Draft unless the user explicitly chooses another allowed status;
- copies canonical builder content through the builder repository;
- does not copy edit locks/revision IDs/cache IDs.

Deleting a page uses WordPress Trash behavior where supported.

## Checkpoint for Step 29

Create, duplicate, schedule, and trash pages through the Page Manager. Confirm the same pages/statuses are visible correctly in wp-admin and that changes made from wp-admin are reflected after the builder reloads.

---

# Step 30 — Support Posts and Custom Post Types Correctly

Do not assume every builder document is a `page`.

On builder initialization:

1. read actual `post_type`;
2. obtain `get_post_type_object()`;
3. confirm builder is enabled for that type;
4. use its REST base/capabilities;
5. respect post-type support for revisions and custom fields;
6. respect templates/taxonomies only where applicable.

If a CPT does not support revisions, do not show Revision History as if it is guaranteed.

If registered builder meta is exposed through REST for a CPT, ensure the type supports custom fields where required by WordPress.

## Checkpoint for Step 30

Enable the builder on one custom post type with custom capability mapping. Confirm a permitted editor can save and publish according to that CPT's capabilities and a user lacking its mapped publish capability cannot publish it.

---

# Step 31 — Handle Gutenberg/Classic Editor Coexistence

The builder must coexist with WordPress editing screens.

Rules:

- changes to WordPress title/status/slug made outside the builder are read on next builder load;
- if the builder's canonical content is stored in meta, normal block-editor page fields must not delete it;
- if the builder's canonical serialization is stored in `post_content`, protect against accidental destructive block-editor conversion using the existing builder activation/editing contract;
- do not replace `post_content` with empty content merely because the builder uses meta;
- provide an “Edit with [Builder]” entry point rather than hijacking unrelated post types.

If the same page is changed outside the builder while the builder tab remains open, optimistic concurrency must catch the stale save.

## Checkpoint for Step 31

Open a builder page, change its title in wp-admin from another session, then attempt a stale builder save. Confirm the builder detects a server change/conflict rather than silently reverting the external update.

---

# Step 32 — Implement Security and Sanitization at the Canonical Boundary

Never trust the serialized builder payload just because it was produced by your own JavaScript.

Validate:

- node type against registered builder element types;
- attributes against each control schema;
- URLs through appropriate WordPress sanitizers;
- CSS property names/values through the builder CSS parser;
- HTML according to capability/product policy;
- JavaScript according to `unfiltered_html` and the custom-code policy;
- IDs/references against document integrity rules;
- maximum nesting/depth;
- payload size limits;
- schema version.

Do not run arbitrary PHP from builder content.

Do not allow the document payload to set:

- post author without permission;
- arbitrary post type;
- arbitrary post parent;
- protected meta unrelated to the builder;
- capability fields;
- filesystem paths.

All publish endpoints require the same validation as draft saves. “Draft” is not permission to store an unsafe server-executable payload.

## Checkpoint for Step 32

Manually modify a save request to include an unknown builder node, a protected post meta key, and executable content from a user without `unfiltered_html`. Confirm the server rejects/sanitizes according to policy and no unauthorized data is persisted.

---

# Step 33 — Add Accessible, Non-Confusing Save Feedback

All status feedback must be available to keyboard and screen-reader users.

Requirements:

- buttons have actual text or accessible names;
- split-button/dropdown is keyboard navigable;
- save state is exposed through a polite live region;
- destructive status changes use a focus-trapped accessible dialog;
- focus returns to the action that opened the dialog;
- loading indicators do not remove the accessible button name;
- disabled Publish explains why it is disabled;
- status is not communicated by color alone.

Recommended live-region messages:

```text
Draft saved.
Page published.
Page updated.
Autosaved.
Publish failed. Fix 2 errors before publishing.
Another user is editing this page.
```

Avoid firing an aria-live announcement for every tiny autosave state change if it creates noise.

## Checkpoint for Step 33

Complete Save Draft, Publish, Update, status-menu navigation, and unpublish confirmation using keyboard only. Verify a screen reader receives one meaningful completion/failure announcement per manual action.

---

# Step 34 — Add Performance Limits for Large Builder Documents

Save/publish must remain stable with large imported pages.

Implement:

- canonical JSON normalization before hashing;
- debounced dirty-hash calculation;
- compression only at transport layers where safe/automatic;
- server request size checks with useful errors;
- avoid serializing the full document multiple times during one save;
- asset generation keyed from content hash;
- avoid writing unchanged meta values;
- skip autosave if the canonical hash is unchanged from the previous autosave.

Do not split one canonical page save across dozens of independent REST writes unless the current builder architecture explicitly requires it. Partial saves create confusing mixed versions.

## Checkpoint for Step 34

Load a large page containing hundreds of builder nodes and imported responsive CSS. Make one small edit. Confirm only one canonical manual save operation is required, the UI remains responsive, and duplicate unchanged autosaves are not generated continuously.

---

# Step 35 — Add Builder-Specific Hooks for Extensibility

Add stable plugin hooks around the builder layer while preserving WordPress core hooks.

Examples:

```php
do_action( 'nexo_builder_before_document_save', $post_id, $document, $context );
$document = apply_filters( 'nexo_builder_document_before_save', $document, $post_id, $context );
do_action( 'nexo_builder_after_document_save', $post_id, $document, $context );
do_action( 'nexo_builder_after_publish', $post_id, $document );
do_action( 'nexo_builder_assets_invalidated', $post_id, $content_hash );
```

Context should distinguish:

```text
manual
autosave
publish
status_change
revision_restore
import
```

Do not make these hooks replace WordPress `save_post`/status hooks. They are builder-specific extension points.

Document recursion rules for integrations.

## Checkpoint for Step 35

Register a test plugin callback on both the builder-specific after-save hook and WordPress `save_post`. Save a draft and publish it. Confirm each hook receives the documented context without an infinite update loop.

---

# Step 36 — Implement a Full Error-Recovery Matrix in the UI

Every important operation needs a defined failure state.

| Operation | Failure | UI behavior |
|---|---|---|
| Save Draft | network | retain edits, Retry |
| Save Draft | validation | show exact invalid field/node |
| Save Draft | conflict | Compare / Reload / Save Copy |
| Publish | permission | remove publish path after refresh |
| Publish | validation | pre-publish errors |
| Publish | network unknown | reload status before retrying |
| Autosave | failure | quiet warning; do not mark manually saved |
| Preview | snapshot failure | remain in editor; show Retry |
| Revision restore | failure | leave current page untouched |
| Schedule | invalid date | inline validation |
| Update | asset compile failure | saved content remains; show asset warning |
| Lock refresh | lost lock | stop writes, show conflict/read-only banner |

Critical rule for unknown Publish result:

If a publish request times out after reaching the server, the browser does not know whether it succeeded. Before offering a second Publish request, query the current post status/server version. If it is already published with the submitted content hash, treat it as success.

## Checkpoint for Step 36

Simulate a timeout after the server has actually completed Publish. Confirm the client re-checks server state, discovers the page is already published, and does not perform a second blind publish operation.

---

# Step 37 — Add Automated PHP/REST Tests

Create server tests covering at minimum:

### Persistence

- save new draft;
- update draft;
- publish draft;
- update published page;
- move publish to draft;
- private;
- pending;
- future;
- revision creation;
- revision restore;
- autosave.

### Permissions

- can edit;
- cannot edit;
- can publish;
- cannot publish;
- custom post type capability mapping;
- `unfiltered_html`.

### Concurrency

- stale server version rejected;
- post lock rejected;
- same-content safe retry.

### Security

- invalid nonce;
- missing nonce;
- malformed builder schema;
- protected field injection;
- forbidden custom JavaScript.

### WordPress compatibility

- `save_post` fires through core path;
- status transition works;
- revision metadata restored on supported WP version;
- custom post type behavior.

## Checkpoint for Step 37

The save/publish server test suite must run in CI and pass with no skipped critical status/permission cases. A regression that permits unauthorized publishing must fail CI.

---

# Step 38 — Add Browser End-to-End Tests

Use the project's existing E2E framework.

Minimum scenarios:

1. Create blank page → Save Draft → refresh → still Draft.
2. Draft → Preview unsaved changes → parent remains Draft.
3. Draft → Publish → public URL renders.
4. Published → change → Update → live version changes.
5. Published → unsaved edit → autosave → live version does not change.
6. Published → Move to Draft → public state removed.
7. Contributor → Submit for Review → cannot Publish.
8. Publisher → publish Pending page.
9. Schedule page → status shows Scheduled.
10. Private page.
11. Two-user post lock.
12. Two-tab stale conflict.
13. Browser crash/autosave recovery.
14. Revision restore.
15. Network failure and retry.
16. Session expiration.
17. imported HTML/CSS/JS → Draft → Preview → Publish.
18. custom code denied without `unfiltered_html`.
19. custom post type save/publish.
20. Page Manager navigation with unsaved changes.

Take screenshots or DOM assertions for visible status labels so UI regressions are detected.

## Checkpoint for Step 38

All 20 critical workflows pass against a real WordPress test install, not a mocked status service.

---

# Step 39 — Add Compatibility Testing Across WordPress Configurations

Test at least:

- current supported WordPress version;
- minimum supported WordPress version;
- PHP versions supported by the plugin;
- pretty permalinks and plain permalinks;
- revisions enabled;
- revisions disabled with `WP_POST_REVISIONS`;
- default autosave interval;
- custom `AUTOSAVE_INTERVAL`;
- single site;
- multisite if officially supported;
- object cache enabled;
- no object cache;
- common full-page caching layer;
- classic theme;
- block theme if supported;
- page;
- post;
- supported custom post type.

If meta revisions are unavailable on the minimum supported WordPress version, verify the documented fallback rather than silently skipping revision recovery tests.

## Checkpoint for Step 39

Produce a compatibility matrix in the repository showing pass/fail for the supported WordPress/PHP combinations and all publication-critical features.

---

# Step 40 — Add Migration and Backward Compatibility

This upgrade must not require existing documents to be rewritten immediately.

On load:

- recognize existing builder schema versions;
- normalize them in memory;
- only persist a migrated schema after an intentional save;
- preserve old page status exactly;
- preserve original slug/date/author/template;
- do not mark every old page dirty merely because internal normalization occurred.

If new revisioned meta registration is added, old meta values should become revision-aware from future saves without losing the existing value.

If a page contains legacy builder modules, preserve the existing backward-compatibility renderer until those modules are intentionally migrated.

## Checkpoint for Step 40

Clone a database containing pre-upgrade Draft, Published, Private, and Scheduled builder pages. Install the upgrade and open each page without saving. Confirm their front-end output/status remains unchanged. Save one page and verify only that page receives the new persistence/version metadata.

---

# Step 41 — Add Logging and Diagnostic Data Without Exposing Sensitive Content

For development/debug mode, record structured events:

```text
builder_document_loaded
builder_autosave_started
builder_autosave_completed
builder_manual_save_started
builder_manual_save_completed
builder_publish_started
builder_publish_completed
builder_save_conflict
builder_post_lock_denied
builder_revision_restored
builder_asset_compile_failed
```

Include:

- post ID;
- user ID;
- request ID;
- operation;
- status transition;
- server version prefix;
- duration;
- result/error code.

Do not log complete page content, form submissions, custom JavaScript source, authentication nonces, cookies, or passwords.

Production should default to minimal error logging consistent with WordPress debug configuration.

## Checkpoint for Step 41

Trigger one successful save, one publish, one conflict, and one asset compile failure in debug mode. Confirm each produces a useful structured entry without containing the page's full text or REST nonce.

---

# Step 42 — Roll Out Behind an Internal Feature Version

Introduce a persistence feature/version flag in code, not a confusing end-user toggle.

Recommended process:

1. Ship server support first.
2. Enable new save state controller in development/staging.
3. Run migration compatibility tests.
4. Enable for internal pages.
5. Enable for all newly edited pages while retaining legacy loading.
6. Monitor conflict/save error rates.
7. Remove obsolete save code only after the new path has proven stable.

Do not keep two independently active save systems writing the same page.

## Checkpoint for Step 42

With the new path enabled, verify network logs show exactly one canonical manual save endpoint per manual Save/Publish action and the legacy save handler is not also writing the post.

---

# Step 43 — Final Release Acceptance Scenario

Before marking this file complete, execute this exact end-to-end scenario on a staging WordPress site:

1. Log in as a user who can publish.
2. Create a new WordPress page inside the builder.
3. Build content manually.
4. Import the full HTML/CSS/JS portfolio from Upgrade Plan 6 into the same supported workflow.
5. Confirm the page is locally dirty.
6. Save as Draft.
7. Refresh the browser.
8. Confirm Draft content is intact.
9. Make another edit and wait for autosave.
10. Open a logged-out browser and confirm no draft is publicly visible.
11. Enter Preview and confirm the autosaved/unsaved design is visible only through authorized preview.
12. Return to the builder.
13. Publish.
14. Confirm the server reports `publish`.
15. Confirm the public permalink renders the complete design.
16. Make a new edit without clicking Update.
17. Wait for autosave.
18. Confirm the public page still shows the last manually updated published version.
19. Click Update.
20. Confirm the public page changes.
21. Open Revision History and restore the first published revision.
22. Confirm both builder canvas and public page match the restored version after an intentional Update.
23. Open the page as a second user and verify post locking.
24. Create a stale second-tab change and verify conflict rejection.
25. Change the published page to Draft and verify the explicit unpublish confirmation.
26. Republish it.
27. Schedule a separate page.
28. Verify Page Manager and wp-admin show the same WordPress statuses.

This scenario must pass without directly editing the WordPress database and without requiring the user to leave the builder for ordinary save/publish actions.

---

# Exact UI Copy Recommendations

Use consistent wording across the builder.

### Clean draft

```text
Draft
Saved
Save Draft
Publish
```

### Dirty draft

```text
Draft
Unsaved changes
Save Draft
Publish
```

### Saving

```text
Saving draft…
```

### Successful draft save

```text
Draft saved.
```

### Published clean

```text
Published
Saved
Update
```

### Published dirty

```text
Published
Unsaved changes
Update
```

### Updating

```text
Updating…
```

### Successful update

```text
Page updated.
```

### First publish

```text
Publishing…
Page published.
```

### Autosave

```text
Autosaving…
Autosaved at 11:42 PM
```

### Pending

```text
Pending review
Submit for Review
```

### Scheduled

```text
Scheduled
Scheduled for Aug 31, 2026 at 9:00 AM
```

### Lock

```text
This page is currently being edited by {name}.
You can view it, but saving is disabled until the edit lock is available.
```

### Conflict

```text
A newer version of this page was saved elsewhere.
Your changes have not been overwritten.
```

Actions:

```text
Compare Versions
Reload Latest
Save as Copy
```

### Offline

```text
You're offline. Your latest changes have not been saved to WordPress.
```

Avoid vague messages such as:

```text
Something happened.
Save unsuccessful.
Sync issue.
```

Every failure should tell the user whether their current local changes still exist and what the next safe action is.

---

# Recommended Save/Publish Component Boundaries

Do not put all behavior in one top-bar component.

Recommended modules:

```text
BuilderDocumentRepository
WordPressPostService
BuilderSaveCoordinator
BuilderAutosaveService
BuilderRevisionService
BuilderPostLockService
BuilderPreviewService
BuilderPublishValidationService
BuilderAssetCompiler
BuilderConflictResolver

SaveStatusIndicator
SaveDraftButton
PublishButton
PublishMenu
PrePublishPanel
RevisionHistoryPanel
PostLockBanner
ConflictDialog
AutosaveRecoveryDialog
UnsavedChangesDialog
```

The UI components dispatch intent. Services own persistence behavior.

Example:

```ts
publishButton.onClick(() => {
  publishController.beginPrePublishReview();
});
```

The button must not directly call `fetch('/wp-json/...')` and then manually mutate several stores.

---

# Recommended Server Service Boundaries

```text
class Builder_Document_Repository
class Builder_Document_Validator
class Builder_Document_Sanitizer
class Builder_Permissions
class Builder_Save_Service
class Builder_Autosave_Service
class Builder_Revision_Service
class Builder_Post_Lock_Service
class Builder_Preview_Service
class Builder_Asset_Service
class Builder_REST_Controller
```

`Builder_Save_Service` should orchestrate WordPress APIs; it must not duplicate validation logic already centralized in validator/sanitizer services.

---

# WordPress API Rules for the Coding Agent

Use these rules while implementing:

- Use `current_user_can()` for capabilities.
- Use post-specific meta capabilities such as `edit_post`.
- Resolve post-type publish capabilities from `get_post_type_object()`.
- Use `wp_insert_post()`/`wp_update_post()` for canonical saves.
- Use native post statuses: `draft`, `pending`, `publish`, `private`, `future`.
- Use `wp_check_post_lock()`/WordPress post-lock behavior.
- Use WordPress autosave/revision APIs.
- Use `wp_restore_post_revision()` for native revision restore where appropriate.
- Use registered revisioned meta on WordPress 6.4+ for canonical builder meta.
- Use `get_preview_post_link()`/native preview behavior where compatible.
- Use `get_permalink()`/server-returned permalinks.
- Use `X-WP-Nonce` with a `wp_rest` nonce for authenticated in-WordPress REST requests.
- Use `permission_callback` on every private custom REST route.
- Let WordPress post APIs fire normal save/status hooks.
- Do not write post status with direct `$wpdb` SQL.
- Do not manually call core status hooks after `wp_update_post()`.
- Do not disable WordPress revisions globally.
- Do not bypass `unfiltered_html`.
- Do not expose a draft by temporarily changing it to `publish` for Preview.

---

# What Determines This File Is Complete

This upgrade is complete only when the builder can create and edit a real WordPress page/post, save it as a native Draft, recover autosaved work, preview unsaved changes without publishing them, publish through WordPress permissions and status transitions, update an already published page, move content through Pending/Private/Scheduled states, restore WordPress revisions including canonical builder data, prevent concurrent/stale overwrites, preserve imported HTML/CSS/JS safely, and remain compatible with WordPress hooks, permalinks, post types, caching, revisions, and permission systems. The UI must always distinguish local dirty state from WordPress publication state, and no failure path may falsely tell the user that content is saved or published when the server has not confirmed it.

---

# What This File Does NOT Include

This implementation does not create a collaborative Google-Docs-style real-time multi-user editor; post locking is the compatibility target for this upgrade. It does not create editorial comments, approval chains beyond WordPress Pending Review, custom workflow states, content staging/branching where a published page simultaneously owns a separate future draft, A/B testing, deployment between staging and production sites, external cloud backup, Divi Cloud-style layout storage, scheduled design experiments, SEO scoring, or a custom cron replacement. It also does not redesign the builder's typography/spacing controls, import parser, or complete control interface; those remain the responsibility of Upgrade Plans 4, 5, and 6 and must integrate with this persistence workflow.

---

# Primary Compatibility References Used for This Plan

The implementation should be checked against current WordPress core behavior during coding:

- WordPress REST Posts API: https://developer.wordpress.org/rest-api/reference/posts/
- WordPress REST Post Revisions: https://developer.wordpress.org/rest-api/reference/post-revisions/
- WordPress REST Page Revisions: https://developer.wordpress.org/rest-api/reference/page-revisions/
- REST authentication/nonces: https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- `current_user_can()`: https://developer.wordpress.org/reference/functions/current_user_can/
- `wp_check_post_lock()`: https://developer.wordpress.org/reference/functions/wp_check_post_lock/
- `wp_autosave()`: https://developer.wordpress.org/reference/functions/wp_autosave/
- `wp_save_post_revision()`: https://developer.wordpress.org/reference/functions/wp_save_post_revision/
- `wp_restore_post_revision()`: https://developer.wordpress.org/reference/functions/wp_restore_post_revision/
- `register_meta()`: https://developer.wordpress.org/reference/functions/register_meta/
- WordPress 6.4 revisioned post-meta framework: https://make.wordpress.org/core/2023/10/24/framework-for-storing-revisions-of-post-meta-in-6-4/
- `wp_after_insert_post`: https://developer.wordpress.org/reference/hooks/wp_after_insert_post/
- `transition_post_status`: https://developer.wordpress.org/reference/hooks/transition_post_status/

Divi 5 behavior references used only as UX/product alignment references, not as a replacement for WordPress core behavior:

- Divi 5 top bar and save options: https://www.elegantthemes.com/blog/divi-resources/exploring-divi-5s-new-top-bar-ui
- Divi 5 Page Manager: https://www.elegantthemes.com/blog/divi-resources/how-to-efficiently-manage-your-pages-inside-the-divi-5-builder-itself
- Divi 5 interface/page publishing actions: https://www.elegantthemes.com/blog/divi-resources/part-2-exploring-every-aspect-of-the-divi-5-interface
