const fs = require('fs');

const indexFile = 'src/index.js';
const storeFile = 'src/store/editor-store.mjs';

const lines = fs.readFileSync(indexFile, 'utf8').split('\n');

// Block 1: Store (158 - 1911)
const storeLines = lines.slice(158 - 1, 1911);

// Block 2: Tree mutations (1984 - 2073)
const helperLines = lines.slice(1984 - 1, 2073);

let code = storeLines.join('\n') + '\n\n' + helperLines.join('\n');
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
import { VOID_TAGS, canInsertElement } from '../elements/registry.mjs';
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
import { insertComponent } from '../reusable-components.mjs';
import { prepareStarterDocument, insertStarter as insertStarterTemplate } from '../starter-templates.mjs';

`;

fs.writeFileSync(storeFile, imports + code + '\n');

// Modify index.js to remove the extracted block and insert imports
const newIndexLines = [
	...lines.slice(0, 158 - 1),
	"import { useEditorStore, EXAMPLE_DOCUMENT } from './store/editor-store.mjs';",
	...lines.slice(1911, 1984 - 1),
	...lines.slice(2073)
];

fs.writeFileSync(indexFile, newIndexLines.join('\n'));
console.log('Extraction complete');
