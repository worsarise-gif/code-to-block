const fs = require('fs');
const path = require('path');

const indexFile = 'src/index.js';
const storeFile = 'src/store/editor-store.mjs';

const lines = fs.readFileSync(indexFile, 'utf8').split('\n');

const voidTagsStart = lines.findIndex(l => l.startsWith('const VOID_TAGS ='));
const storeEndLine = 1911; // We previously determined this

if (voidTagsStart === -1) throw new Error("Could not find VOID_TAGS");

// Extract the core code block
const extractedLines = lines.slice(voidTagsStart, storeEndLine);

// We need to export VOID_TAGS, EXAMPLE_DOCUMENT, and useEditorStore
let code = extractedLines.join('\n');
code = code.replace('const VOID_TAGS =', 'export const VOID_TAGS =');
code = code.replace('const EXAMPLE_DOCUMENT =', 'export const EXAMPLE_DOCUMENT =');
code = code.replace('const useEditorStore =', 'export const useEditorStore =');

// Add the necessary imports to the new file, correctly adjusting paths
const imports = `import { create } from 'zustand';
import apiFetch from '@wordpress/api-fetch';

import {
	ensureGuidedRoleDesignSystem,
	guidedRolesEnabled,
	roleCatalog,
	recommendStyleRoles,
	applyRoleToStyleSet,
	adjustRoleInStyleSet,
	setRolePropertyOverride,
	rejoinRoleProperty,
	resolveImportReviewFlag,
	updateRolePropertyGlobally,
	restoreBalancedRole,
	migrateGuidedRolesDocument,
} from '../semantic-roles.mjs';
import {
	commitDocument,
	resetDocumentHistory,
	syncSavedDocument,
	markSavedSnapshot,
	undoDocument,
	redoDocument,
} from '../history.mjs';
import {
	updateBlockStyleSet,
	setStyleSetBindings,
	setHiddenInFallback,
	updateEditableBlock,
	createPrimitiveBlock,
} from './block-commands.mjs';
import {
	mergeMappedStyleUpdates,
} from '../custom-css.mjs';
import {
	findBlock,
	findBlockLocation,
	countBlocks,
	canMoveBlock,
	moveBlockSibling,
} from '../tree.mjs';
import {
	effectiveMappedStyles,
	ownStyleSet,
	setOwnStyleSet,
} from '../responsive-styles.mjs';
import { canInsertElement } from '../elements/registry.mjs';
import { allowedTagForBlock } from '../elements/resolver.mjs';
import {
	TOKEN_PROPERTIES,
	tokenIdIsValid,
	tokenReference,
	countTokenConsumers,
	getDesignToken,
	tokensForProperty,
	tokenCssValue,
} from '../design-tokens.mjs';
import { insertAtDropPosition } from '../drop-intent.mjs';
import { insertComponent } from '../reusable-components.mjs';
import { prepareStarterDocument, insertStarterTemplate as insertStarter } from '../starter-templates.mjs';

`;

fs.writeFileSync(storeFile, imports + code + '\n');

// Modify index.js to remove the extracted block and insert imports
const newIndexLines = [
	...lines.slice(0, voidTagsStart),
	"import { useEditorStore, VOID_TAGS, EXAMPLE_DOCUMENT } from './store/editor-store.mjs';",
	...lines.slice(storeEndLine)
];

fs.writeFileSync(indexFile, newIndexLines.join('\n'));
console.log('Extraction complete');
