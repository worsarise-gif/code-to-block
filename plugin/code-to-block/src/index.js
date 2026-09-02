import TopHeader from './components/TopHeader.js';
import LeftRail from './components/LeftRail.js';
import RightInspector from './components/RightInspector.js';
import CenterCanvas from './components/CenterCanvas.js';
import NavigatorTree from './components/NavigatorTree.js';
import RevisionHistory from './components/RevisionHistory.js';
import {
	GuidedRolePanel,
	GuidedRolesManager,
	RoleEditDecisionDialog,
} from './components/GuidedRoleControls.js';
import {
	Component,
	createElement,
	createRoot,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	pointerWithin,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import apiFetch from '@wordpress/api-fetch';
import { create } from 'zustand';

import {
	contentHash,
	freshPreviewUrl,
	installNavigationGuard,
	publishSavedDocument,
	autosaveDocument,
} from './editor-persistence.mjs';

import './editor.css';
import {
	controlVisibilityReason,
	isMappedControlVisible,
	mergeMappedStyleUpdates,
	normalizeCustomCssFallback,
	previewCustomCssFallback,
	styleControlLabel,
	STYLE_CONTROL_FIELDS,
} from './custom-css.mjs';
import {
	blockHasTokenOverride,
	countTokenConsumers,
	designTokenDeclarations,
	effectiveTokenBindings,
	getDesignToken,
	TOKEN_CATEGORIES,
	TOKEN_PROPERTIES,
	tokenCssValue,
	tokenIdFromLabel,
	tokenIdIsValid,
	tokenReference,
	tokensForProperty,
} from './design-tokens.mjs';
import {
	commitDocument,
	markSavedSnapshot,
	redoDocument,
	resetDocumentHistory,
	syncSavedDocument,
	undoDocument,
} from './history.mjs';
import { rankDropCandidates, resolveDropIntent } from './drop-intent.mjs';
import { createImportCodeService } from './importer/ImportCodeService.mjs';
import { materializeCommerce } from './commerce-preview.mjs';
import {
	CommerceProductEditor,
	createProductDraft,
} from './commerce-product-editor';
import { sanitizeRichTextHtml } from './rich-text.mjs';
import { normalizeReactAttributes } from './react-attributes.mjs';
import {
	BREAKPOINTS,
	breakpointCascade,
	countStyleOverrides,
	effectiveMappedStyles,
	inheritedMappedStyles,
	isBlockHidden,
	isHiddenOverridden,
	ownStyleSet,
	setOwnStyleSet,
} from './responsive-styles.mjs';
import {
	canMoveBlock,
	countBlocks,
	findBlock,
	findBlockLocation,
	moveBlockSibling,
} from './tree.mjs';
import {
	createPrimitiveBlock,
	setHiddenInFallback,
	setStyleSetBindings,
	updateBlockStyleSet,
	updateEditableBlock,
} from './store/block-commands.mjs';
import {
	COMPONENT_FAILURE_MESSAGE,
	createComponentDocument,
	insertComponent,
	isSavedComponentBlock,
	materializeComponents,
} from './reusable-components.mjs';
import {
	insertStarter as insertStarterTemplate,
	prepareStarterDocument,
} from './starter-templates.mjs';
import { runAccessibilityChecks } from './accessibility.mjs';
import { WIDGET_LIBRARY } from './widget-library.mjs';
import {
	adjustRoleInStyleSet,
	applyRoleToStyleSet,
	countRoleUsage,
	ensureGuidedRoleDesignSystem,
	guidedRolesEnabled,
	migrateGuidedRolesDocument,
	normalizeImportedStyles,
	recommendStyleRoles,
	rejoinRoleProperty,
	resolveImportReviewFlag,
	restoreBalancedRole,
	roleBindingForProperty,
	roleCatalog,
	rolePreviewStyles,
	sanitizeGuidedRoleTelemetry,
	semanticDetentFromPointerDelta,
	setRolePropertyOverride,
	updateRolePropertyGlobally,
} from './semantic-roles.mjs';
import { canInsertElement } from './elements/registry.mjs';
import { allowedTagForBlock, resolveInspector } from './elements/resolver.mjs';

const VOID_TAGS = new Set( [
	'br',
	'col',
	'hr',
	'img',
	'input',
	'source',
	'track',
	'wbr',
] );
const IMPORT_SCOPE_CLASS = 'ctb-import-scope';

import { useEditorStore, EXAMPLE_DOCUMENT } from './store/editor-store.mjs';

import { SkeletonLoader, Block, CanvasDragHandles, BlockContent } from './components/canvas/CanvasComponents.js';
import { AccessibilityPanel, DiagnosticsPanel, ParityWarningsPanel } from './components/panels/DiagnosticsPanels.js';
import { ScriptDetections, PhpDetection, PhpDetections } from './components/panels/CodeDetectionsPanel.js';
import { ExplainPanel } from './components/panels/ExplainPanel.js';
import { WooCommercePanel } from './components/panels/WooCommercePanel.js';
import { FormsPanel } from './components/panels/FormsPanel.js';
import { WidgetLibraryPanel } from './components/panels/WidgetLibraryPanel.js';
import { SeoPanel } from './components/panels/SeoPanel.js';
import { DesignTokenRow, DesignTokenPanel } from './components/panels/DesignTokenPanel.js';
import { BlockVisibilityControl, BreakpointSwitcher, ResponsiveColorOverride, MappedStyleControls, RawCssControl } from './components/controls/StyleControls.js';
import { BlockDynamicControl, BlockSlotControl, BlockAnimationControl, BlockActions } from './components/controls/BlockControls.js';
import { TokenBindingControl } from './components/controls/TokenControls.js';
import { ScrubbableInput } from './components/controls/ScrubbableInput.js';
import { ContextMenu } from './components/ContextMenu.js';
import { Editor } from './components/Editor.js';














class SavedComponentBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { failed: false };
	}

	static getDerivedStateFromError() {
		return { failed: true };
	}

	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}





























const GSAP_ANIMATION_BEHAVIORS = new Set( [
	'scroll-scrub',
	'stagger-sequence',
] );
const CSS_ANIMATION_BEHAVIORS = new Set( [ 'css-reveal' ] );
let editorGsapPromise;







const rootElement = document.getElementById( 'code-to-block-editor-root' );
if ( rootElement ) {
	createRoot( rootElement ).render( <Editor /> );
}
