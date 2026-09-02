import TopHeader from '../components/TopHeader.js';
import LeftRail from '../components/LeftRail.js';
import RightInspector from '../components/RightInspector.js';
import CenterCanvas from '../components/CenterCanvas.js';
import NavigatorTree from '../components/NavigatorTree.js';
import RevisionHistory from '../components/RevisionHistory.js';
import { GuidedRolePanel, GuidedRolesManager, RoleEditDecisionDialog } from '../components/GuidedRoleControls.js';
import { useEffect, useRef, useState } from '@wordpress/element';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import apiFetch from '@wordpress/api-fetch';
import { contentHash, freshPreviewUrl, installNavigationGuard, publishSavedDocument, autosaveDocument } from '../editor-persistence.mjs';
import '../editor.css';
import { STYLE_CONTROL_FIELDS } from '../custom-css.mjs';
import { effectiveTokenBindings, getDesignToken, tokenCssValue } from '../design-tokens.mjs';
import { createImportCodeService } from '../importer/ImportCodeService.mjs';
import { materializeCommerce } from '../commerce-preview.mjs';
import { BREAKPOINTS, countStyleOverrides, effectiveMappedStyles, inheritedMappedStyles, ownStyleSet } from '../responsive-styles.mjs';
import { canMoveBlock, countBlocks, findBlock } from '../tree.mjs';
import { createComponentDocument, materializeComponents } from '../reusable-components.mjs';
import { runAccessibilityChecks } from '../accessibility.mjs';
import { countRoleUsage, guidedRolesEnabled, migrateGuidedRolesDocument, normalizeImportedStyles, roleBindingForProperty, roleCatalog, rolePreviewStyles, sanitizeGuidedRoleTelemetry } from '../semantic-roles.mjs';
import { resolveInspector } from '../elements/resolver.mjs';
import { useEditorStore } from '../store/editor-store.mjs';
import { SkeletonLoader, Block } from './canvas/CanvasComponents.js';
import { AccessibilityPanel, DiagnosticsPanel, ParityWarningsPanel } from './panels/DiagnosticsPanels.js';
import { ScriptDetections, PhpDetections } from './panels/CodeDetectionsPanel.js';
import { ExplainPanel } from './panels/ExplainPanel.js';
import { DesignTokenPanel } from './panels/DesignTokenPanel.js';
import { BreakpointSwitcher, ResponsiveColorOverride, MappedStyleControls, RawCssControl } from './controls/StyleControls.js';
import { BlockDynamicControl, BlockSlotControl, BlockAnimationControl, BlockActions } from './controls/BlockControls.js';
import { ContextMenu } from './ContextMenu.js';
import { resolveDocumentDropIntent, dragEventPoint, buildPreviewStyles, buildEditorStyleSnapshot, collisionStrategy, cursorOffsetModifier, breakpointStyleSummary, loadEditorGsap, documentHasGsapAnimation } from '../utils/editor-utils.js';

const importCodeService = createImportCodeService();

export function Editor() {
	const editorSettings = window.codeToBlockEditorSettings || {};
	const document = useEditorStore( ( state ) => state.document );
	const setDocument = useEditorStore( ( state ) => state.setDocument );
	const resetDocument = useEditorStore( ( state ) => state.resetDocument );
	const syncSavedTree = useEditorStore(
		( state ) => state.syncSavedDocument
	);
	const markSavedTree = useEditorStore(
		( state ) => state.markSavedSnapshot
	);
	const undo = useEditorStore( ( state ) => state.undo );
	const redo = useEditorStore( ( state ) => state.redo );
	const canUndo = useEditorStore( ( state ) => state.past.length > 0 );
	const canRedo = useEditorStore( ( state ) => state.future.length > 0 );
	const moveBlock = useEditorStore( ( state ) => state.moveBlock );
	const moveSelectedBlock = useEditorStore(
		( state ) => state.moveBlockSibling
	);
	const insertWooCommerceBlock = useEditorStore(
		( state ) => state.insertWooCommerceBlock
	);
	const selectBlock = useEditorStore( ( state ) => state.selectBlock );
	const setBlockHidden = useEditorStore( ( state ) => state.setBlockHidden );
	const updateBlockContent = useEditorStore(
		( state ) => state.updateBlockContent
	);
	const updateBlockAttribute = useEditorStore(
		( state ) => state.updateBlockAttribute
	);
	const updateBlockProp = useEditorStore(
		( state ) => state.updateBlockProp
	);
	const updateBlockTag = useEditorStore( ( state ) => state.updateBlockTag );
	const setBlockVisibilityConditions = useEditorStore(
		( state ) => state.setBlockVisibilityConditions
	);
	const setBlockStateStyles = useEditorStore(
		( state ) => state.setBlockStateStyles
	);
	const setBlockPermissions = useEditorStore(
		( state ) => state.setBlockPermissions
	);
	const setBlockPerformance = useEditorStore(
		( state ) => state.setBlockPerformance
	);
	const insertPrimitive = useEditorStore(
		( state ) => state.insertPrimitive
	);
	const selectedBlockId = useEditorStore(
		( state ) => state.selectedBlockId
	);
	const updateBlockColor = useEditorStore(
		( state ) => state.updateBlockColor
	);
	const updateBlockCustomCss = useEditorStore(
		( state ) => state.updateBlockCustomCss
	);
	const updateBlockMappedStyles = useEditorStore(
		( state ) => state.updateBlockMappedStyles
	);
	const replaceBlockStyleSet = useEditorStore(
		( state ) => state.replaceBlockStyleSet
	);
	const upsertDesignToken = useEditorStore(
		( state ) => state.upsertDesignToken
	);
	const deleteDesignToken = useEditorStore(
		( state ) => state.deleteDesignToken
	);
	const setBlockTokenBinding = useEditorStore(
		( state ) => state.setBlockTokenBinding
	);
	const removeBlockTokenBinding = useEditorStore(
		( state ) => state.removeBlockTokenBinding
	);
	const setBlockStyleRole = useEditorStore(
		( state ) => state.setBlockStyleRole
	);
	const adjustBlockStyleRole = useEditorStore(
		( state ) => state.adjustBlockStyleRole
	);
	const setBlockRolePropertyOverride = useEditorStore(
		( state ) => state.setBlockRolePropertyOverride
	);
	const rejoinBlockRoleProperty = useEditorStore(
		( state ) => state.rejoinBlockRoleProperty
	);
	const resolveBlockImportReview = useEditorStore(
		( state ) => state.resolveBlockImportReview
	);
	const rejoinGuidedRoleOverride = useEditorStore(
		( state ) => state.rejoinGuidedRoleOverride
	);
	const updateGuidedRoleProperty = useEditorStore(
		( state ) => state.updateGuidedRoleProperty
	);
	const restoreGuidedRole = useEditorStore(
		( state ) => state.restoreGuidedRole
	);
	const setEditorContext = useEditorStore(
		( state ) => state.setEditorContext
	);
	const setBlockSlotProperties = useEditorStore(
		( state ) => state.setBlockSlotProperties
	);
	const setBlockDynamicProperties = useEditorStore(
		( state ) => state.setBlockDynamicProperties
	);
	const addBlockAction = useEditorStore( ( state ) => state.addBlockAction );
	const duplicateBlock = useEditorStore( ( state ) => state.duplicateBlock );
	const deleteBlock = useEditorStore( ( state ) => state.deleteBlock );
	const addInnerContainer = useEditorStore(
		( state ) => state.addInnerContainer
	);
	const convertLayoutMode = useEditorStore(
		( state ) => state.convertLayoutMode
	);
	const insertForm = useEditorStore( ( state ) => state.insertForm );
	const insertFormField = useEditorStore(
		( state ) => state.insertFormField
	);
	const updateFormField = useEditorStore(
		( state ) => state.updateFormField
	);
	const updateFormSettings = useEditorStore(
		( state ) => state.updateFormSettings
	);
	const insertWidget = useEditorStore( ( state ) => state.insertWidget );
	const [ activeId, setActiveId ] = useState( null );
	const [ dropIntent, setDropIntent ] = useState( null );
	const dropIntentRef = useRef( null );
	const [ activeState, setActiveState ] = useState( 'default' );
	const [ isImporterOpen, setIsImporterOpen ] = useState( false );
	const [ isRevisionsOpen, setIsRevisionsOpen ] = useState( false );
	const [ paletteDragging, setPaletteDragging ] = useState( null );
	useEffect( () => {
		if ( ! paletteDragging && ! activeId && dropIntentRef.current ) {
			clearDropIntent();
		}
	}, [ activeId, paletteDragging ] );
	const [ customAttributeName, setCustomAttributeName ] = useState( '' );
	const [ customAttributeValue, setCustomAttributeValue ] = useState( '' );
	const [ unifiedInput, setUnifiedInput ] = useState( '' );
	const [ parseError, setParseError ] = useState( '' );
	const [ importActivity, setImportActivity ] = useState(
		'Paste code, then choose Display in Builder.'
	);
	const liveImportStartedRef = useRef( false );
	const liveImportTimerRef = useRef( null );
	const lastImportedInputRef = useRef( '' );
	const applyImportedCodeRef = useRef( null );
	const importAnalysisRequestRef = useRef( 0 );
	const [ documentLoading, setDocumentLoading ] = useState( true );
	const [ parseWarnings, setParseWarnings ] = useState( [] );
	const [ importReview, setImportReview ] = useState( null );
	const [ scriptDetections, setScriptDetections ] = useState( [] );
	const [ phpDetections, setPhpDetections ] = useState( [] );
	const [ persistenceStatus, setPersistenceStatus ] = useState( '' );
	const [ previewBreakpoint, setPreviewBreakpoint ] = useState( 'desktop' );
	const [ components, setComponents ] = useState( [] );
	const [ , setComponentsLoading ] = useState( false );
	const updateWooSettings = useEditorStore(
		( state ) => state.updateWooSettings
	);
	const [ commerceProducts, setCommerceProducts ] = useState( [] );
	const [ cartHtml, setCartHtml ] = useState( '' );
	const [ checkoutHtml, setCheckoutHtml ] = useState( '' );
	const [ commerceAvailable, setCommerceAvailable ] = useState( false );
	const [ commerceLoading, setCommerceLoading ] = useState( false );
	const [ parityWarnings, setParityWarnings ] = useState( [] );
	const [ a11yIssues, setA11yIssues ] = useState( [] );
	const [ editorAction, setEditorAction ] = useState( '' );
	const [ postStatus, setPostStatus ] = useState(
		editorSettings.postStatus || 'draft'
	);
	const [ serverVersion, setServerVersion ] = useState(
		editorSettings.serverVersion || ''
	);
	const [ lastSavedContentHash, setLastSavedContentHash ] = useState( '' );
	const [ hasNewerAutosave, setHasNewerAutosave ] = useState( false );
	const postId = Number( editorSettings.postId || 0 );

	async function recoverAutosave() {
		try {
			setPersistenceStatus( 'Recovering autosave...' );
			const revisionsResponse = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/revisions`,
			} );
			const autosaveRev = revisionsResponse.revisions.find(
				( r ) => r.is_autosave
			);
			if ( autosaveRev ) {
				const restoreResponse = await apiFetch( {
					path: `/code-to-block/v1/pages/${ postId }/revisions/${ autosaveRev.id }/restore`,
					method: 'POST',
				} );
				resetDocument( restoreResponse.document );
				setHasNewerAutosave( false );
				setPersistenceStatus(
					'Autosave recovered. Save to keep these changes.'
				);
			} else {
				setPersistenceStatus( 'No autosave found to recover.' );
				setHasNewerAutosave( false );
			}
		} catch ( e ) {
			setPersistenceStatus( 'Failed to recover autosave.' );
		}
	}

	const isDirty =
		lastSavedContentHash !== '' &&
		contentHash( document ) !== lastSavedContentHash;

	useEffect( () => {
		const checkDirty = () => isDirty;
		return installNavigationGuard( checkDirty );
	}, [ isDirty ] );

	const documentRef = useRef( document );
	const isDirtyRef = useRef( isDirty );
	useEffect( () => {
		documentRef.current = document;
		isDirtyRef.current = isDirty;
	}, [ document, isDirty ] );

	useEffect( () => {
		if ( ! postId ) {
			return;
		}
		const interval = setInterval( async () => {
			if ( isDirtyRef.current ) {
				const response = await autosaveDocument( {
					apiFetch,
					postId,
					document: documentRef.current,
				} );
				if ( response && response.success ) {
					const time = new Date().toLocaleTimeString( [], {
						hour: '2-digit',
						minute: '2-digit',
					} );
					setPersistenceStatus( `Autosaved at ${ time }` );
				}
			}
		}, 60000 );
		return () => clearInterval( interval );
	}, [ postId ] );

	const [ contextMenu, setContextMenu ] = useState( null );
	const [ clipboardBlock, setClipboardBlock ] = useState( null );
	const [ clipboardStyles, setClipboardStyles ] = useState( null );
	const [ pendingRoleEdit, setPendingRoleEdit ] = useState( null );
	const previewSnapshot = useRef( null );
	const [ activeTab, setActiveTab ] = useState( 'content' );
	useEffect( () => {
		if ( ! isImporterOpen ) {
			liveImportStartedRef.current = false;
			return undefined;
		}
		function closeImporter( event ) {
			if ( event.key === 'Escape' ) {
				setIsImporterOpen( false );
			}
		}
		window.addEventListener( 'keydown', closeImporter );
		return () => window.removeEventListener( 'keydown', closeImporter );
	}, [ isImporterOpen ] );
	useEffect( () => {
		setEditorContext(
			previewBreakpoint,
			activeTab === 'advanced' ? 'advanced' : 'simple'
		);
	}, [ activeTab, previewBreakpoint, setEditorContext ] );
	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 3 } } ),
		useSensor( KeyboardSensor )
	);
	const viewDocument = materializeCommerce(
		materializeComponents( document, components ),
		commerceProducts,
		cartHtml,
		checkoutHtml,
		commerceLoading,
		postId
	);
	const needsEditorGsap = documentHasGsapAnimation( viewDocument.root );
	useEffect( () => {
		if ( needsEditorGsap ) {
			void loadEditorGsap();
		}
	}, [ needsEditorGsap ] );
	const blockCount = countBlocks( viewDocument.root );
	const previewStyles = buildPreviewStyles( viewDocument, previewBreakpoint );
	const activeBlock = activeId ? findBlock( document.root, activeId ) : null;
	const selectedBlock =
		findBlock( document.root, selectedBlockId ) || document.root;
	const selectedParentBlock = ( () => {
		if ( selectedBlock.id === document.root.id ) {
			return null;
		}
		const findParent = ( b, tid ) => {
			for ( const ch of b.children || [] ) {
				if ( ch.kind === 'text' ) {
					continue;
				}
				if ( ch.id === tid ) {
					return b;
				}
				const p = findParent( ch, tid );
				if ( p ) {
					return p;
				}
			}
			return null;
		};
		return findParent( document.root, selectedBlock.id );
	} )();
	const selectedParentDisplay = selectedParentBlock
		? effectiveMappedStyles( selectedParentBlock, previewBreakpoint )
				.display || 'block'
		: 'block';
	const selectedInspector = resolveInspector( selectedBlock, {
		breakpoint: previewBreakpoint,
		state: activeState,
		parentDisplay: selectedParentDisplay,
	} );
	const selectedStyleSet = ownStyleSet( selectedBlock, previewBreakpoint );
	const selectedInheritedMapped = inheritedMappedStyles(
		selectedBlock,
		previewBreakpoint
	);
	const selectedEffectiveMapped = effectiveMappedStyles(
		selectedBlock,
		previewBreakpoint
	);
	const selectedEffectiveBindings = effectiveTokenBindings(
		selectedBlock,
		previewBreakpoint
	);
	const selectedColor = selectedEffectiveMapped.color || '#000000';
	const selectedOwnColor = selectedStyleSet.mapped.color || '';
	const selectedColorReference = selectedEffectiveBindings.color || '';
	const selectedColorToken = getDesignToken(
		document.design_tokens,
		selectedColorReference
	);
	const selectedColorLinked = Boolean(
		selectedColorReference &&
			selectedColor === tokenCssValue( selectedColorReference )
	);
	const selectedMappedStyleKey =
		STYLE_CONTROL_FIELDS.map(
			( field ) => selectedStyleSet.mapped[ field.property ] || ''
		).join( '|' ) + JSON.stringify( selectedStyleSet.role_bindings || {} );
	useEffect( () => {
		cancelGuidedRolePreview();
	}, [ selectedBlockId, activeTab, previewBreakpoint ] );
	const selectedOverrideCount = countStyleOverrides( selectedStyleSet );
	const activeBreakpoint = BREAKPOINTS.find(
		( breakpoint ) => breakpoint.id === previewBreakpoint
	);
	const selectedBreakpointSummary = breakpointStyleSummary(
		previewBreakpoint,
		selectedOverrideCount
	);
	const canMoveSelectedUp = canMoveBlock(
		document.root,
		selectedBlock.id,
		-1
	);
	const canMoveSelectedDown = canMoveBlock(
		document.root,
		selectedBlock.id,
		1
	);
	const getZoneForBlock = ( block ) => {
		if ( ! block ) {
			return 'EMPTY';
		}
		if ( block.is_content_slot ) {
			return 'SLOT';
		}
		if ( block.type === 'container' ) {
			return 'CONTAINER';
		}
		return 'WIDGET';
	};
	const handleBlockContextMenu = ( event, block ) => {
		event.preventDefault();
		event.stopPropagation();
		const zone = getZoneForBlock( block );
		setContextMenu( {
			x: event.clientX,
			y: event.clientY,
			blockId: block.id,
			zone,
		} );
		selectBlock( block.id );
	};
	const handleEmptyContextMenu = ( event ) => {
		if ( event.target.closest( '[data-ctb-block-id]' ) ) {
			return;
		}
		event.preventDefault();
		setContextMenu( {
			x: event.clientX,
			y: event.clientY,
			blockId: null,
			zone: 'EMPTY',
		} );
	};
	const handleContextAction = ( actionId ) => {
		const currentState = useEditorStore.getState();
		const currentSelectedBlockId = currentState.selectedBlockId;
		const currentDocument = currentState.document;

		const targetId = contextMenu?.blockId || currentSelectedBlockId;
		const targetBlock = targetId
			? findBlock( currentDocument.root, targetId )
			: null;
		switch ( actionId ) {
			case 'edit':
				if ( targetId ) {
					selectBlock( targetId );
				}
				break;
			case 'editSlotLabel':
				if ( targetId ) {
					selectBlock( targetId );
				}
				setPersistenceStatus(
					'Edit the Slot label in the Client Content panel.'
				);
				break;
			case 'duplicate':
				if ( targetId ) {
					duplicateBlock( targetId );
					setPersistenceStatus(
						'Block duplicated. Unsaved changes.'
					);
				}
				break;
			case 'delete':
				if ( targetId ) {
					deleteBlock( targetId );
					setPersistenceStatus( 'Block deleted. Unsaved changes.' );
				}
				break;
			case 'copy': {
				const src = targetBlock
					? JSON.parse( JSON.stringify( targetBlock ) )
					: null;
				if ( src ) {
					setClipboardBlock( src );
					setPersistenceStatus(
						'Block copied to internal clipboard.'
					);
				}
				break;
			}
			case 'paste': {
				if ( ! clipboardBlock ) {
					break;
				}
				// Paste after target as duplicate with new IDs (reuse duplicate logic via store: create paste by duplicating clipboard)
				const doc = JSON.parse( JSON.stringify( currentDocument ) );
				const used = new Set();
				const collect = ( b ) => {
					used.add( b.id );
					for ( const c of b.children || [] ) {
						if ( c.kind !== 'text' ) {
							collect( c );
						}
					}
				};
				collect( doc.root );
				const clone = JSON.parse( JSON.stringify( clipboardBlock ) );
				const remap = ( node, usedSet ) => {
					const old = node.id;
					node.id = `${ old }-paste-${ Date.now()
						.toString( 36 )
						.slice( -3 ) }`;
					while ( usedSet.has( node.id ) ) {
						node.id +=
							`-` + Math.random().toString( 36 ).slice( 2, 3 );
					}
					usedSet.add( node.id );
					if ( node.attributes?.id ) {
						node.attributes.id = `${ node.id }-dom`;
					}
					for ( const ch of node.children || [] ) {
						if ( ch.kind !== 'text' ) {
							remap( ch, usedSet );
						}
					}
				};
				remap( clone, used );
				const parent = ( () => {
					const findParent = ( b, tid ) => {
						for ( const ch of b.children ) {
							if ( ch.kind === 'text' ) {
								continue;
							}
							if ( ch.id === tid ) {
								return b;
							}
							const p = findParent( ch, tid );
							if ( p ) {
								return p;
							}
						}
						return null;
					};
					return findParent( doc.root, targetId );
				} )();
				if ( parent ) {
					const idx = parent.children.findIndex(
						( c ) => c.kind !== 'text' && c.id === targetId
					);
					if ( -1 !== idx ) {
						parent.children.splice( idx + 1, 0, clone );
					} else {
						parent.children.push( clone );
					}
					// Use commit via store: we have no direct paste store method, so use setDocument via commitDocument helper
					// Instead, use the store's duplicate logic indirectly: setDocument via commitDocument
					const nextDoc = doc;
					// Directly use zustand commit
					const state = useEditorStore.getState();
					useEditorStore.setState( {
						document: nextDoc,
						past: [ ...state.past, state.document ],
						future: [],
					} );
					setPersistenceStatus(
						'Pasted after selection. Unsaved changes.'
					);
					selectBlock( clone.id );
				} else if ( ! targetId ) {
					// Empty canvas paste: add to root
					const root = doc.root;
					root.children.push( clone );
					const state = useEditorStore.getState();
					useEditorStore.setState( {
						document: doc,
						past: [ ...state.past, state.document ],
						future: [],
					} );
					setPersistenceStatus(
						'Pasted to canvas. Unsaved changes.'
					);
				}
				break;
			}
			case 'copyStyles': {
				if ( targetBlock ) {
					setClipboardStyles(
						JSON.parse( JSON.stringify( targetBlock.styles ) )
					);
					setPersistenceStatus( 'Styles copied.' );
				}
				break;
			}
			case 'pasteStyles': {
				if ( targetBlock && clipboardStyles ) {
					replaceBlockStyleSet(
						targetId,
						clipboardStyles,
						previewBreakpoint
					);
					setPersistenceStatus( 'Styles pasted. Unsaved changes.' );
				}
				break;
			}
			case 'saveComponent': {
				// Trigger save as reusable component for target block
				const name = window.prompt( 'Component name?' );
				if ( name && targetBlock ) {
					const prevSelected = selectedBlockId;
					selectBlock( targetId );
					// Use existing saveSelectedAsComponent flow (async)
					saveSelectedAsComponent( name )
						.then( ( msg ) => setPersistenceStatus( msg ) )
						.catch( ( e ) => setPersistenceStatus( e.message ) );
				}
				break;
			}
			case 'addInner':
				if ( targetId ) {
					addInnerContainer( targetId );
					setPersistenceStatus(
						'Inner container added. Unsaved changes.'
					);
				}
				break;
			case 'convertLayout': {
				if ( targetBlock ) {
					const cur = targetBlock.styles?.mapped?.display || 'block';
					const next =
						cur === 'flex'
							? 'grid'
							: cur === 'grid'
							? 'block'
							: 'flex';
					convertLayoutMode( targetId, next );
					setPersistenceStatus(
						`Layout converted to ${ next }. Unsaved changes.`
					);
				}
				break;
			}
			case 'addBlock': {
				// Add a simple container block to root
				const doc = JSON.parse( JSON.stringify( currentDocument ) );
				const newId = `ctb-add-${ Date.now().toString( 36 ) }`;
				doc.root.children.push( {
					id: newId,
					type: 'container',
					tag: 'div',
					attributes: { class: 'ctb-new-block' },
					children: [ { kind: 'text', value: 'New block' } ],
					styles: {
						mapped: { padding: '16px', border: '1px dashed #ccc' },
						custom_css_fallback: '',
					},
					meta: { source: 'editor' },
				} );
				const state = useEditorStore.getState();
				useEditorStore.setState( {
					document: doc,
					past: [ ...state.past, state.document ],
					future: [],
				} );
				setPersistenceStatus(
					'Block added to canvas. Unsaved changes.'
				);
				selectBlock( newId );
				break;
			}
			case 'pageSettings':
				setPersistenceStatus(
					'Page settings are in the Document details rail (name, tokens, SEO).'
				);
				break;
			default:
				break;
		}
	};

	async function refreshComponents() {
		if ( ! postId ) {
			setComponents( [] );
			return [];
		}
		setComponentsLoading( true );
		try {
			const records = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/components`,
			} );
			setComponents( records );
			return records;
		} finally {
			setComponentsLoading( false );
		}
	}

	useEffect( () => {
		if ( ! postId ) {
			setComponents( [] );
			return;
		}
		setComponentsLoading( true );
		void apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/components`,
		} )
			.then( setComponents )
			.catch( ( error ) => {
				setPersistenceStatus(
					error.message || 'Saved component library failed to load.'
				);
			} )
			.finally( () => setComponentsLoading( false ) );
	}, [ postId ] );

	useEffect( () => {
		if ( ! postId ) {
			setCommerceProducts( [] );
			setCommerceAvailable( false );
			return;
		}
		setCommerceLoading( true );
		void apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/products`,
		} )
			.then( ( response ) => {
				setCommerceProducts( response.products || [] );
				setCartHtml( response.cart_html || '' );
				setCheckoutHtml( response.checkout_html || '' );
				setCommerceAvailable( Boolean( response.available ) );
			} )
			.catch( ( error ) => {
				setCommerceProducts( [] );
				setCommerceAvailable( false );
				setPersistenceStatus(
					error.message ||
						'WooCommerce product previews failed to load.'
				);
			} )
			.finally( () => setCommerceLoading( false ) );
	}, [ postId ] );

	useEffect( () => {
		if ( ! postId ) {
			setDocumentLoading( false );
			return;
		}
		let active = true;
		setDocumentLoading( true );
		setPersistenceStatus( 'Loading...' );
		void apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/block-tree`,
		} )
			.then( ( savedDocument ) => {
				if ( active ) {
					const migratedDocument =
						migrateGuidedRolesDocument( savedDocument );
					resetDocument( migratedDocument );
					setScriptDetections( [] );
					setPhpDetections( [] );
					setParityWarnings( [] );
					setA11yIssues( runAccessibilityChecks( migratedDocument ) );
					setPersistenceStatus( 'Loaded.' );
					setDocumentLoading( false );
				}
			} )
			.catch( ( error ) => {
				if ( active ) {
					setPersistenceStatus( error.message || 'Load failed.' );
					setDocumentLoading( false );
				}
			} );
		return () => {
			active = false;
		};
	}, [ postId, resetDocument ] );

	useEffect( () => {
		const onPointerDown = ( e ) => {
			if ( e.button !== 0 ) {
				return;
			}
			if ( e.target.closest( '[role="menu"]' ) ) {
				return;
			}
			setContextMenu( null );
		};
		window.addEventListener( 'pointerdown', onPointerDown );
		return () => window.removeEventListener( 'pointerdown', onPointerDown );
	}, [] );

	useEffect( () => {
		const onKeyDown = ( e ) => {
			if (
				( e.shiftKey && 'F10' === e.key ) ||
				'ContextMenu' === e.key
			) {
				const block = selectedBlock;
				if ( block ) {
					e.preventDefault();
					const zone = getZoneForBlock( block );
					const escapedId = window.CSS.escape( block.id );
					const el = window.document.querySelector(
						`[data-block-id="${ escapedId }"]`
					);
					const rect = el?.getBoundingClientRect();
					const x = rect
						? rect.left + rect.width / 2
						: window.innerWidth / 2;
					const y = rect
						? rect.top + rect.height / 2
						: window.innerHeight / 2;
					setContextMenu( { x, y, blockId: block.id, zone } );
				}
			}
		};
		window.addEventListener( 'keydown', onKeyDown );
		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ selectedBlock ] );

	useEffect( () => {
		function handleHistoryShortcut( event ) {
			if ( ! ( event.ctrlKey || event.metaKey ) || event.altKey ) {
				return;
			}
			if (
				event.target instanceof window.HTMLElement &&
				event.target.closest(
					'input, textarea, [contenteditable="true"]'
				)
			) {
				return;
			}

			const key = event.key.toLowerCase();
			const wantsUndo = key === 'z' && ! event.shiftKey;
			const wantsRedo = ( key === 'z' && event.shiftKey ) || key === 'y';
			const state = useEditorStore.getState();
			if ( wantsUndo && state.past.length > 0 ) {
				event.preventDefault();
				state.undo();
				updateHistoryStatus( 'Undid change.' );
			} else if ( wantsRedo && state.future.length > 0 ) {
				event.preventDefault();
				state.redo();
				updateHistoryStatus( 'Redid change.' );
			}
		}

		window.addEventListener( 'keydown', handleHistoryShortcut );
		return () =>
			window.removeEventListener( 'keydown', handleHistoryShortcut );
	}, [] );

	function updateHistoryStatus( action ) {
		const state = useEditorStore.getState();
		const saveStatus =
			state.document === state.savedDocument
				? 'All changes saved.'
				: 'Unsaved changes.';
		setPersistenceStatus( `${ action } ${ saveStatus }` );
	}

	function undoChange() {
		if ( canUndo ) {
			undo();
			updateHistoryStatus( 'Undid change.' );
		}
	}

	function redoChange() {
		if ( canRedo ) {
			redo();
			updateHistoryStatus( 'Redid change.' );
		}
	}

	function applyCustomCss( customCss ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		updateBlockCustomCss( selectedBlock.id, customCss, previewBreakpoint );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } CSS changed. Unsaved changes.`
			);
		}
	}

	function applyMappedStyles( styles ) {
		const changedRoleProperty = Object.entries( styles ).find(
			( [ property, value ] ) =>
				value !== ( selectedStyleSet.mapped?.[ property ] || '' ) &&
				roleBindingForProperty( selectedStyleSet, property )
		);
		if ( changedRoleProperty ) {
			const [ property, value ] = changedRoleProperty;
			const source = roleBindingForProperty( selectedStyleSet, property );
			setPendingRoleEdit( {
				property,
				value,
				scope: source.scope,
				binding: source.binding,
			} );
			recordGuidedRoleEvent( 'guided_advanced_exact_edit_started', {
				role_id: source.binding.roleId,
				context_category: source.scope,
				breakpoint_category: previewBreakpoint,
				action_result: 'decision_required',
			} );
			return;
		}
		const documentBeforeEdit = useEditorStore.getState().document;
		updateBlockMappedStyles( selectedBlock.id, styles, previewBreakpoint );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } styles changed. Unsaved changes.`
			);
		}
	}

	function recordGuidedRoleEvent( eventName, payload ) {
		const event = sanitizeGuidedRoleTelemetry( eventName, payload );
		if ( ! event ) {
			return;
		}
		window.dispatchEvent(
			new window.CustomEvent( 'ctb-guided-role-event', { detail: event } )
		);
	}

	function cancelGuidedRolePreview() {
		const snapshot = previewSnapshot.current;
		if ( ! snapshot ) {
			return;
		}
		for ( const [ property, value ] of Object.entries( snapshot.values ) ) {
			if ( value ) {
				snapshot.element.style.setProperty( property, value );
			} else {
				snapshot.element.style.removeProperty( property );
			}
		}
		snapshot.element.classList.remove( 'is-guided-role-preview' );
		delete snapshot.element.dataset.guidedPreviewScope;
		previewSnapshot.current = null;
	}

	function previewGuidedRole( roleId, scope ) {
		cancelGuidedRolePreview();
		const escapedId = window.CSS.escape( selectedBlock.id );
		const element = window.document.querySelector(
			`[data-block-id="${ escapedId }"]`
		);
		if ( ! element ) {
			return;
		}
		const styles = rolePreviewStyles( document, roleId, scope );
		const values = Object.fromEntries(
			Object.keys( styles ).map( ( property ) => [
				property,
				element.style.getPropertyValue( property ),
			] )
		);
		previewSnapshot.current = { element, values };
		for ( const [ property, value ] of Object.entries( styles ) ) {
			element.style.setProperty( property, value );
		}
		element.classList.add( 'is-guided-role-preview' );
		element.dataset.guidedPreviewScope = scope;
	}

	function selectGuidedRole( roleId, scope ) {
		cancelGuidedRolePreview();
		const before = useEditorStore.getState().document;
		setBlockStyleRole(
			selectedBlock.id,
			roleId,
			scope,
			previewBreakpoint,
			roleCatalog( document )[ roleId ]?.builtIn ? 'built-in' : 'user'
		);
		if ( useEditorStore.getState().document !== before ) {
			setPersistenceStatus(
				`${
					roleCatalog( document )[ roleId ]?.labelKey || roleId
				} selected. Unsaved changes.`
			);
			recordGuidedRoleEvent( 'guided_role_selected', {
				role_id: roleId,
				context_category: scope,
				breakpoint_category: previewBreakpoint,
				action_result: 'committed',
			} );
		}
	}

	function adjustGuidedRole( scope, adjustment ) {
		adjustBlockStyleRole(
			selectedBlock.id,
			scope,
			adjustment,
			previewBreakpoint
		);
		setPersistenceStatus( 'Guided adjustment applied. Unsaved changes.' );
		const binding = selectedStyleSet.role_bindings?.[ scope ];
		recordGuidedRoleEvent( 'guided_relative_adjustment_used', {
			role_id: binding?.roleId || '',
			context_category: scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
	}

	function rejoinGuidedRole( scope, property ) {
		rejoinBlockRoleProperty(
			selectedBlock.id,
			scope,
			property,
			previewBreakpoint
		);
		setPersistenceStatus( 'Local override removed. Unsaved changes.' );
		const binding = selectedStyleSet.role_bindings?.[ scope ];
		recordGuidedRoleEvent( 'guided_override_rejoined', {
			role_id: binding?.roleId || '',
			context_category: scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
	}

	function resolveGuidedImportReview( flagId, useRole ) {
		resolveBlockImportReview(
			selectedBlock.id,
			flagId,
			useRole,
			previewBreakpoint
		);
		setPersistenceStatus(
			useRole
				? 'Imported difference rejoined to the site role. Unsaved changes.'
				: 'Imported difference kept as a local override. Unsaved changes.'
		);
	}

	function rejoinOverrideFromManager( element, override ) {
		rejoinGuidedRoleOverride(
			element.blockId,
			element.scope,
			override.property,
			element.breakpoint || 'desktop',
			element.state || ''
		);
		selectBlock( element.blockId );
		setPersistenceStatus( 'Role override rejoined. Unsaved changes.' );
		recordGuidedRoleEvent( 'guided_override_rejoined', {
			role_id: element.roleId,
			context_category: element.scope,
			breakpoint_category: element.breakpoint || 'desktop',
			action_result: 'committed',
		} );
	}

	function applyPendingRoleEditGlobally() {
		if ( ! pendingRoleEdit ) {
			return;
		}
		updateGuidedRoleProperty(
			pendingRoleEdit.binding.roleId,
			pendingRoleEdit.property,
			pendingRoleEdit.value,
			pendingRoleEdit.scope,
			pendingRoleEdit.binding
		);
		recordGuidedRoleEvent( 'guided_global_role_updated', {
			role_id: pendingRoleEdit.binding.roleId,
			context_category: pendingRoleEdit.scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
		setPendingRoleEdit( null );
		setPersistenceStatus(
			'Guided role updated everywhere. Unsaved changes.'
		);
	}

	function applyPendingRoleEditLocally() {
		if ( ! pendingRoleEdit ) {
			return;
		}
		setBlockRolePropertyOverride(
			selectedBlock.id,
			pendingRoleEdit.scope,
			pendingRoleEdit.property,
			pendingRoleEdit.value,
			previewBreakpoint
		);
		recordGuidedRoleEvent( 'guided_local_override_created', {
			role_id: pendingRoleEdit.binding.roleId,
			context_category: pendingRoleEdit.scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
		setPendingRoleEdit( null );
		setPersistenceStatus(
			'Local style override created. Unsaved changes.'
		);
	}

	function restoreGuidedRoleDefaults( roleId ) {
		if (
			! window.confirm( `Restore ${ roleId } to the Balanced defaults?` )
		) {
			return;
		}
		restoreGuidedRole( roleId );
		setPersistenceStatus(
			'Guided role defaults restored. Unsaved changes.'
		);
	}

	function clearColorOverride() {
		updateBlockColor( selectedBlock.id, '', previewBreakpoint );
		setPersistenceStatus(
			`${ activeBreakpoint.label } color override cleared. Unsaved changes.`
		);
	}

	function saveDesignToken( category, id, token ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		upsertDesignToken( category, id, token );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ token.label } token changed. Unsaved changes.`
			);
		}
	}

	function removeDesignToken( category, id ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		deleteDesignToken( category, id );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus( 'Design token deleted. Unsaved changes.' );
		}
	}

	function linkSelectedToken( property, reference ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		setBlockTokenBinding(
			selectedBlock.id,
			property,
			reference,
			previewBreakpoint
		);
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } token linked. Unsaved changes.`
			);
		}
	}

	function overrideSelectedToken( property, reference ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		setBlockTokenBinding(
			selectedBlock.id,
			property,
			reference,
			previewBreakpoint,
			true
		);
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } token overridden for this block. Unsaved changes.`
			);
		}
	}

	function unlinkSelectedToken( property, reference ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		removeBlockTokenBinding(
			selectedBlock.id,
			property,
			reference,
			previewBreakpoint
		);
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } token unlinked. Unsaved changes.`
			);
		}
	}

	function moveSelected( direction ) {
		const documentBeforeMove = useEditorStore.getState().document;
		moveSelectedBlock( selectedBlock.id, direction );
		if ( useEditorStore.getState().document !== documentBeforeMove ) {
			setPersistenceStatus( 'Unsaved changes.' );
		}
	}

	async function saveSelectedAsComponent( name ) {
		if ( ! postId ) {
			throw new Error(
				'Save the WordPress post once before saving a component.'
			);
		}
		const componentDocument = createComponentDocument(
			useEditorStore.getState().document,
			selectedBlock,
			name
		);
		const component = await apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/components`,
			method: 'POST',
			data: componentDocument,
		} );
		await refreshComponents();
		return `${ component.name } saved to the component library.`;
	}

	function insertWooCommerceBlockAtSelection( wooType, options ) {
		const documentBeforeInsert = useEditorStore.getState().document;
		insertWooCommerceBlock( selectedBlock.id, wooType, options );
		if ( useEditorStore.getState().document === documentBeforeInsert ) {
			throw new Error(
				'The WooCommerce block could not be inserted here.'
			);
		}
		setPersistenceStatus(
			`WooCommerce ${ wooType } inserted. Unsaved changes.`
		);
	}

	async function updateProductData( productId, updates ) {
		try {
			setCommerceLoading( true );
			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/products/${ productId }`,
				method: 'PUT',
				data: updates,
			} );
			if ( response.success ) {
				setCommerceProducts( ( prev ) =>
					prev.map( ( p ) =>
						p.id === response.product.id ? response.product : p
					)
				);
				setPersistenceStatus( 'WooCommerce product saved.' );
				return response.product;
			}
			throw new Error( 'WooCommerce did not confirm the product save.' );
		} catch ( e ) {
			console.error( e );
			throw e;
		} finally {
			setCommerceLoading( false );
		}
	}

	async function createProductData( payload ) {
		try {
			setCommerceLoading( true );
			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/products`,
				method: 'POST',
				data: payload,
			} );
			if ( response.success && response.product ) {
				setCommerceProducts( ( current ) =>
					[ ...current, response.product ].sort( ( left, right ) =>
						left.name.localeCompare( right.name )
					)
				);
				setPersistenceStatus( 'WooCommerce product created.' );
				return response.product;
			}
			throw new Error( 'WooCommerce did not confirm product creation.' );
		} catch ( error ) {
			console.error( error );
			throw error;
		} finally {
			setCommerceLoading( false );
		}
	}

	function mapDetectedAction( detection ) {
		const documentBeforeAction = useEditorStore.getState().document;
		addBlockAction( detection.sourceBlockId, detection.action );
		if ( useEditorStore.getState().document !== documentBeforeAction ) {
			setScriptDetections( ( current ) =>
				current.map( ( item ) =>
					item.id === detection.id
						? { ...item, status: 'mapped' }
						: item
				)
			);
			setPersistenceStatus( 'Action mapped. Unsaved changes.' );
		}
	}

	function storeDropIntent( nextIntent ) {
		dropIntentRef.current = nextIntent;
		setDropIntent( ( current ) =>
			JSON.stringify( current ) === JSON.stringify( nextIntent )
				? current
				: nextIntent
		);
	}

	function clearDropIntent() {
		storeDropIntent( null );
	}

	function resolveDndEventIntent( event ) {
		if ( ! event.over ) {
			return null;
		}
		const root = useEditorStore.getState().document.root;
		const targetId = String( event.over.id );
		const activeBlockId = String( event.active.id );
		const point = dragEventPoint( event );
		let intent = resolveDocumentDropIntent( {
			root,
			targetId,
			activeId: activeBlockId,
			point,
			rect: event.over.rect,
		} );

		if ( ! intent && event.over.rect ) {
			intent = resolveDocumentDropIntent( {
				root,
				targetId,
				activeId: activeBlockId,
				point: {
					x: event.over.rect.left + event.over.rect.width / 2,
					y: event.over.rect.top + event.over.rect.height / 2,
				},
				rect: event.over.rect,
			} );
		}
		return intent;
	}

	function updateDragIntent( event ) {
		storeDropIntent( resolveDndEventIntent( event ) );
	}

	function startDrag( event ) {
		setActiveId( event.active.id );
		clearDropIntent();
	}

	function finishDrag( event ) {
		const currentState = useEditorStore.getState();
		const intent = resolveDndEventIntent( event ) || dropIntentRef.current;
		if (
			intent?.valid &&
			event.active.id !== currentState.document.root.id
		) {
			const documentBeforeMove = currentState.document;
			moveBlock( event.active.id, intent.targetId, intent.position );
			if ( useEditorStore.getState().document !== documentBeforeMove ) {
				setPersistenceStatus( 'Unsaved changes.' );
			}
		}
		setActiveId( null );
		clearDropIntent();
	}

	function cancelDrag() {
		setActiveId( null );
		clearDropIntent();
	}

	function resolvePaletteEventIntent( event ) {
		const eventTarget =
			event.target?.nodeType === 1
				? event.target
				: event.target?.parentElement;
		const targetNode = eventTarget?.closest?.( '[data-block-id]' );
		const root = useEditorStore.getState().document.root;
		const targetId = targetNode?.dataset.blockId || root.id;
		const rect = (
			targetNode || event.currentTarget
		)?.getBoundingClientRect?.();
		if ( ! rect ) {
			return null;
		}
		return resolveDocumentDropIntent( {
			root,
			targetId,
			point: { x: event.clientX, y: event.clientY },
			rect,
		} );
	}

	function updatePaletteDropIntent( event ) {
		storeDropIntent( resolvePaletteEventIntent( event ) );
	}

	function addPrimitiveAtDrop( primitive, event ) {
		const intent =
			resolvePaletteEventIntent( event ) || dropIntentRef.current;
		const before = useEditorStore.getState().document;
		if ( intent?.valid ) {
			insertPrimitive( intent.targetId, primitive, intent.position );
		}
		if ( useEditorStore.getState().document !== before ) {
			setPersistenceStatus( 'Element added. Unsaved changes.' );
		}
		setPaletteDragging( null );
		clearDropIntent();
	}

	async function reviewPhpDetections( detections ) {
		if ( ! detections.length ) {
			return;
		}
		const canRegisterPhp = Boolean(
			window.codeToBlockEditorSettings?.canRegisterPhp
		);
		if ( ! postId || ! canRegisterPhp ) {
			const description = ! postId
				? 'Save the WordPress post once before requesting a server review.'
				: 'PHP registration requires trusted administrator code privileges and may be disabled by site policy.';
			setPhpDetections( ( current ) =>
				current.map( ( detection ) => ( {
					...detection,
					status: 'unavailable',
					description,
				} ) )
			);
			return;
		}

		await Promise.all(
			detections.map( async ( detection ) => {
				try {
					const response = await apiFetch( {
						path: `/code-to-block/v1/pages/${ postId }/php-shortcodes`,
						method: 'POST',
						data: { tag: detection.tag, code: detection.code },
					} );
					setPhpDetections( ( current ) =>
						current.map( ( item ) =>
							item.id === detection.id &&
							item.code === detection.code &&
							item.tag === detection.tag
								? {
										...item,
										status: response.review.status,
										description:
											response.review.description,
										blockedReasons:
											response.review.blocked_reasons ||
											[],
										warnings:
											response.review.warnings || [],
										reviewHash: response.review.hash,
										confirmationPhrase:
											response.confirmation_phrase,
								  }
								: item
						)
					);
				} catch ( error ) {
					setPhpDetections( ( current ) =>
						current.map( ( item ) =>
							item.id === detection.id &&
							item.code === detection.code &&
							item.tag === detection.tag
								? {
										...item,
										status: 'error',
										description:
											error.message ||
											'Server review failed.',
								  }
								: item
						)
					);
				}
			} )
		);
	}

	async function registerPhpShortcode( detection, confirmation ) {
		const response = await apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/php-shortcodes`,
			method: 'POST',
			data: {
				tag: detection.tag,
				code: detection.code,
				reviewed_hash: detection.reviewHash,
				register: true,
				confirmation,
			},
		} );
		setPhpDetections( ( current ) =>
			current.map( ( item ) =>
				item.id === detection.id &&
				item.code === detection.code &&
				item.tag === detection.tag
					? {
							...item,
							status: 'registered',
							description: response.review.description,
							warnings: response.review.warnings || [],
					  }
					: item
			)
		);
		setPersistenceStatus(
			`${ response.shortcode } registered. Save the tree to publish its placeholder.`
		);
		return response;
	}

	async function prepareImportedCode( source ) {
		if ( ! source.trim() ) {
			setParseError(
				'Paste HTML, CSS, JavaScript, PHP, or text before importing.'
			);
			setImportActivity( 'Waiting for code.' );
			setImportReview( null );
			return null;
		}
		setImportActivity( 'Parsing code...' );
		const requestId = ++importAnalysisRequestRef.current;
		try {
			const shortcodePrefix = `ctb_php_${ postId || 'draft' }`;

			const result = await importCodeService.analyze( source, {
				shortcodePrefix,
				canExecuteScripts: editorSettings.canUnfilteredHtml !== false,
			} );
			if ( requestId !== importAnalysisRequestRef.current ) {
				return null;
			}
			setImportReview( { source, result } );
			lastImportedInputRef.current = source;
			setImportActivity(
				`Ready: ${ result.session.review.builder_nodes } builder nodes parsed. Choose Display in Builder to apply them.`
			);
			setParseWarnings( result.warnings );
			setScriptDetections( result.scriptDetections );
			setPhpDetections(
				result.phpDetections.map( ( detection ) => ( {
					...detection,
					status: 'reviewing',
				} ) )
			);
			setParseError( '' );
			void reviewPhpDetections( result.phpDetections );
			return result;
		} catch ( error ) {
			if ( requestId !== importAnalysisRequestRef.current ) {
				return null;
			}
			setParseError( error.message );
			setImportActivity( 'Fix the code below to continue.' );
			setImportReview( null );
			setParseWarnings( [] );
			setScriptDetections( [] );
			setPhpDetections( [] );
			return null;
		}
	}
	applyImportedCodeRef.current = prepareImportedCode;

	function commitImportedCode( result ) {
		if ( ! result ) {
			return false;
		}
		let normalized;
		importCodeService.commit( result.session.id, {
			transformCandidate: ( candidate ) => {
				normalized = normalizeImportedStyles(
					candidate,
					useEditorStore.getState().document
				);
				return normalized.document;
			},
			commitDocument: ( candidate ) => setDocument( candidate ),
		} );
		liveImportStartedRef.current = true;
		setPersistenceStatus(
			`Imported ${ countBlocks(
				normalized.document.root
			) } blocks. Unsaved changes.`
		);
		setImportActivity(
			'Displayed in the builder. One Undo restores the previous page.'
		);
		setParseWarnings( [
			...result.warnings,
			`${ normalized.summary.mappedElements } elements mapped to existing roles.`,
			...normalized.summary.normalizedGroups.map(
				( group ) =>
					`${ group.count } ${ group.label } normalized to ${ group.roleId }.`
			),
			`${ normalized.summary.retainedOverrides } deliberate differences kept as local overrides.`,
		] );
		recordGuidedRoleEvent( 'guided_import_normalized', {
			role_id: 'multiple',
			context_category: 'import',
			breakpoint_category: 'desktop',
			action_result: 'committed',
		} );
		setIsImporterOpen( false );
		return true;
	}

	async function applyImportNow() {
		window.clearTimeout( liveImportTimerRef.current );
		const result =
			importReview?.source === unifiedInput
				? importReview.result
				: await applyImportedCodeRef.current( unifiedInput );
		commitImportedCode( result );
	}

	function importCode( event ) {
		event.preventDefault();
		void applyImportNow();
	}

	useEffect( () => {
		window.clearTimeout( liveImportTimerRef.current );
		if (
			! isImporterOpen ||
			! unifiedInput.trim() ||
			unifiedInput === lastImportedInputRef.current
		) {
			return undefined;
		}

		setImportActivity( 'Waiting for you to finish typing...' );
		const source = unifiedInput;
		liveImportTimerRef.current = window.setTimeout( () => {
			if ( source !== lastImportedInputRef.current ) {
				void applyImportedCodeRef.current( source );
			}
		}, 700 );
		return () => window.clearTimeout( liveImportTimerRef.current );
	}, [ isImporterOpen, unifiedInput ] );

	async function checkParity() {
		if ( ! postId ) {
			setParityWarnings( [] );
			return;
		}
		try {
			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/parity`,
			} );
			setParityWarnings( response.warnings || [] );
		} catch {
			setParityWarnings( [] );
		}
	}

	async function saveDocument( statusMessage = 'Saving...' ) {
		if ( ! postId ) {
			setPersistenceStatus(
				'Save the WordPress post once before saving its block tree.'
			);
			return null;
		}

		setPersistenceStatus( statusMessage );
		try {
			const documentToSave = useEditorStore.getState().document;

			// Run accessibility checks at save-time
			const a11y = runAccessibilityChecks( documentToSave );
			setA11yIssues( a11y );

			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/block-tree`,
				method: 'POST',
				data: {
					document: documentToSave,
					base_server_version: serverVersion,
					editor_styles: buildEditorStyleSnapshot(
						materializeComponents( documentToSave, components )
					),
				},
			} );
			const savedDocument = response.document || response;
			setParityWarnings( response.parity_warnings || [] );

			if ( response.server_version ) {
				setServerVersion( response.server_version );
			}

			const savedHash =
				response.content_hash || contentHash( savedDocument );
			setLastSavedContentHash( savedHash );

			const currentHash = contentHash(
				useEditorStore.getState().document
			);
			const hasUnsavedChanges = currentHash !== savedHash;

			if ( ! hasUnsavedChanges ) {
				syncSavedTree( savedDocument );
				setPersistenceStatus( 'Saved.' );
			} else {
				markSavedTree( documentToSave, savedDocument );
				setPersistenceStatus( 'Unsaved changes.' );
			}
			return { hasUnsavedChanges };
		} catch ( error ) {
			setPersistenceStatus( error.message || 'Save failed.' );
			return null;
		}
	}

	async function previewDocument() {
		if ( editorAction || ! editorSettings.previewUrl ) {
			return;
		}
		const previewWindow = window.open( 'about:blank', '_blank' );
		if ( ! previewWindow ) {
			setPersistenceStatus(
				'Preview was blocked. Allow pop-ups and try again.'
			);
			return;
		}

		previewWindow.opener = null;
		previewWindow.document.title = 'Preparing preview...';
		previewWindow.document.body.textContent = 'Preparing preview...';
		setEditorAction( 'preview' );
		try {
			const saveResult = await saveDocument( 'Saving before preview...' );
			if ( ! saveResult ) {
				previewWindow.close();
				return;
			}
			previewWindow.location.replace(
				freshPreviewUrl(
					editorSettings.previewUrl,
					window.location.href
				)
			);
		} catch ( error ) {
			previewWindow.close();
			setPersistenceStatus( error.message || 'Preview failed.' );
		} finally {
			setEditorAction( '' );
		}
	}

	async function publishDocument( targetStatus = 'publish' ) {
		if ( editorAction ) {
			return;
		}
		setEditorAction( 'publish' );
		try {
			if ( ! editorSettings.canPublish && targetStatus !== 'draft' ) {
				await saveDocument();
				return;
			}
			const result = await publishSavedDocument( {
				apiFetch,
				postRestPath: editorSettings.postRestPath,
				postStatus,
				targetStatus,
				saveDocument,
			} );
			if ( ! result ) {
				return;
			}
			const nextStatus = result.post.status || targetStatus;

			let completedAction = 'Saved';
			if ( nextStatus === 'publish' ) {
				completedAction =
					postStatus === 'publish' ? 'Updated' : 'Published';
			} else if ( nextStatus === 'pending' ) {
				completedAction = 'Submitted for review';
			} else if ( nextStatus === 'private' ) {
				completedAction = 'Made private';
			} else if ( nextStatus === 'draft' && postStatus !== 'draft' ) {
				completedAction = 'Unpublished to draft';
			}

			setPostStatus( nextStatus );
			setPersistenceStatus(
				result.saveResult.hasUnsavedChanges
					? `${ completedAction }. Unsaved changes.`
					: `${ completedAction }.`
			);
		} catch ( error ) {
			setPersistenceStatus( error.message || 'Status change failed.' );
		} finally {
			setEditorAction( '' );
		}
	}

	async function loadDocument() {
		if ( ! postId ) {
			setPersistenceStatus(
				'Save the WordPress post once before loading a block tree.'
			);
			return;
		}

		setPersistenceStatus( 'Loading...' );
		try {
			const savedResponse = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/block-tree`,
			} );
			const savedDocument = savedResponse.document || savedResponse;
			const migratedDocument =
				migrateGuidedRolesDocument( savedDocument );
			resetDocument( migratedDocument );

			if ( savedResponse.server_version ) {
				setServerVersion( savedResponse.server_version );
			}
			if ( savedResponse.post_status ) {
				setPostStatus( savedResponse.post_status );
			}
			setLastSavedContentHash( contentHash( migratedDocument ) );

			setScriptDetections( [] );
			setPhpDetections( [] );
			setParityWarnings( [] );
			setA11yIssues( runAccessibilityChecks( migratedDocument ) );

			if ( savedResponse.has_newer_autosave ) {
				setHasNewerAutosave( true );
			}

			setPersistenceStatus( 'Loaded.' );
		} catch ( error ) {
			setPersistenceStatus( error.message || 'Load failed.' );
		}
	}

	const historyLog = document.history || [];

	// Breadcrumb path computation
	const breadcrumbPath = [];
	if ( selectedBlock ) {
		let current = selectedBlock;
		while ( current ) {
			breadcrumbPath.unshift( current );
			current = getParentBlock( document.root, current.id );
		}
	}

	function getParentBlock( root, targetId ) {
		if ( ! root.children || root.children.length === 0 ) {
			return null;
		}
		for ( const child of root.children ) {
			if ( child.id === targetId ) {
				return root;
			}
			const found = getParentBlock( child, targetId );
			if ( found ) {
				return found;
			}
		}
		return null;
	}

	const renderNavigatorNode = ( node, depth = 0 ) => {
		const isSelected = selectedBlock?.id === node.id;
		return (
			<div key={ node.id } className="ctb-nav-node-container">
				<button
					type="button"
					className={ `ctb-nav-node ${
						isSelected ? 'is-selected' : ''
					}` }
					data-block-id={ node.id }
					style={ { paddingLeft: `${ depth * 12 + 8 }px` } }
					onClick={ () => selectBlock( node.id ) }
				>
					{ node.tag } { node.id.substring( 0, 4 ) }
				</button>
				{ node.children &&
					node.children
						.filter( ( child ) => child.kind !== 'text' )
						.map( ( child ) =>
							renderNavigatorNode( child, depth + 1 )
						) }
			</div>
		);
	};

	const originalUpdateHistoryStatus = updateHistoryStatus;
	const localUpdateHistoryStatus = ( action ) => {
		originalUpdateHistoryStatus( action );
	};

	function addPrimitiveAtSelection( primitive ) {
		const before = useEditorStore.getState().document;
		insertPrimitive( selectedBlock.id, primitive );
		if ( useEditorStore.getState().document !== before ) {
			setPersistenceStatus( 'Element added. Unsaved changes.' );
		}
	}

	return (
		<section
			className={ `h-screen w-screen flex flex-col overflow-hidden bg-white text-gray-800 font-poppins${
				activeId ? ' cursor-grabbing' : ''
			}` }
			aria-label="Code to Block visual editor"
		>
			<TopHeader
				documentName={ document.name }
				previewBreakpoint={ previewBreakpoint }
				setPreviewBreakpoint={ setPreviewBreakpoint }
				canUndo={ canUndo }
				canRedo={ canRedo }
				undoChange={ undoChange }
				redoChange={ redoChange }
				persistenceStatus={ persistenceStatus }
				canPreview={ Boolean( editorSettings.previewUrl ) }
				canPublish={ Boolean( editorSettings.canPublish ) }
				postStatus={ postStatus }
				editorAction={ editorAction }
				previewDocument={ previewDocument }
				publishDocument={ publishDocument }
				setIsImporterOpen={ setIsImporterOpen }
				setIsRevisionsOpen={ setIsRevisionsOpen }
				isDirty={ isDirty }
			>
				<BreakpointSwitcher
					value={ previewBreakpoint }
					onChange={ setPreviewBreakpoint }
					compact
				/>
			</TopHeader>

			{ hasNewerAutosave && (
				<div className="ctb-autosave-notice p-4 bg-yellow-50 border-b border-yellow-200 flex justify-between items-center text-sm text-yellow-800">
					<p>
						An autosave of this page is newer than the saved
						version.
					</p>
					<div className="flex gap-2">
						<button
							onClick={ recoverAutosave }
							className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded text-yellow-900 transition-colors"
						>
							Recover Autosave
						</button>
						<button
							onClick={ () => setHasNewerAutosave( false ) }
							className="px-3 py-1 hover:bg-yellow-100 rounded text-yellow-800 transition-colors"
						>
							Dismiss
						</button>
					</div>
				</div>
			) }

			{ isRevisionsOpen && (
				<div
					className="ctb-import-panel"
					role="dialog"
					aria-labelledby="ctb-revisions-title"
				>
					<div className="ctb-import-heading">
						<div>
							<h3 id="ctb-revisions-title">Revision History</h3>
						</div>
						<div className="ctb-import-actions">
							<button
								type="button"
								className="ctb-import-close"
								onClick={ () => setIsRevisionsOpen( false ) }
							>
								Close
							</button>
						</div>
					</div>
					<RevisionHistory
						postId={ postId }
						apiFetch={ apiFetch }
						onRestore={ ( restoredDoc ) => {
							resetDocument( restoredDoc );
							setIsRevisionsOpen( false );
							setPersistenceStatus(
								'Revision loaded. Save to keep these changes.'
							);
						} }
					/>
				</div>
			) }

			{ isImporterOpen &&
				( () => {
					const analyzed =
						importReview?.source === unifiedInput
							? importReview.result
							: null;
					const detection = analyzed?.session.detection;
					const detectedHtml = detection?.containsHtml
						? [ analyzed.session.normalizedSource ]
						: [];
					const detectedCss = (
						analyzed?.session.stylesheets || []
					).map( ( stylesheet ) => stylesheet.source_text );
					const detectedJs = ( analyzed?.session.scripts || [] ).map(
						( script ) =>
							script.src
								? `<script src="${ script.src }"></script>`
								: script.source
					);
					const detectedPhp = ( analyzed?.phpDetections || [] ).map(
						( detectionItem ) => detectionItem.code
					);
					const hasDetected =
						detectedHtml.length > 0 ||
						detectedCss.length > 0 ||
						detectedJs.length > 0 ||
						detectedPhp.length > 0;
					return (
						<form
							className="ctb-import-panel"
							onSubmit={ importCode }
							role="dialog"
							aria-labelledby="ctb-import-title"
						>
							<div className="ctb-import-heading">
								<div>
									<p className="ctb-kicker">
										Unified Importer
									</p>
									<h3 id="ctb-import-title">
										Paste your code
									</h3>
									<p className="ctb-import-description">
										Paste a complete HTML document, an HTML
										fragment, CSS, JavaScript, or PHP. The
										latest source is parsed and displayed in
										the isolated builder canvas in one step.
										Scripts remain disabled while editing.
									</p>
									<p
										className="ctb-import-live-status"
										aria-live="polite"
									>
										{ importActivity }
									</p>
								</div>
								<div className="ctb-import-actions">
									<button
										type="button"
										className="ctb-import-close"
										onClick={ () =>
											setIsImporterOpen( false )
										}
									>
										Close
									</button>
								</div>
							</div>
							<div className="ctb-import-commit-bar">
								<p id="ctb-import-commit-help">
									{ importReview?.source === unifiedInput
										? `${ importReview.result.session.review.builder_nodes } builder nodes are ready to display.`
										: 'The latest HTML will be parsed before it is displayed.' }
								</p>
								<button
									type="submit"
									disabled={ ! unifiedInput.trim() }
									aria-describedby="ctb-import-commit-help"
								>
									Apply HTML &amp; Display Full Screen
								</button>
							</div>
							<div className="ctb-import-fields">
								<label htmlFor="ctb-import-unified">
									<span className="screen-reader-text">
										Combined HTML, CSS, JS, PHP
									</span>
									<textarea
										id="ctb-import-unified"
										aria-label="Code to import"
										placeholder="Paste your combined code here..."
										value={ unifiedInput }
										onChange={ ( event ) => {
											setUnifiedInput(
												event.target.value
											);
											setParseError( '' );
											setParseWarnings( [] );
											setImportReview( null );
											setScriptDetections( [] );
										} }
										autoFocus
										style={ { minHeight: '250px' } }
									/>
								</label>
								{ importReview?.source === unifiedInput ? (
									<section
										className="ctb-import-review"
										aria-label="Import review"
									>
										<div className="ctb-import-review-grid">
											<span>
												Document
												<strong>
													{ importReview.result
														.session.review
														.document_type ===
													'full-document'
														? 'Full HTML document'
														: 'Fragment / generated root' }
												</strong>
											</span>
											<span>
												Detected
												<strong>
													{
														importReview.result
															.session.review
															.source_type
													}{ ' ' }
													·{ ' ' }
													{ importReview.result.session.review.detected_languages.join(
														', '
													) || 'plain text' }
												</strong>
											</span>
											<span>
												Builder nodes
												<strong>
													{
														importReview.result
															.session.review
															.builder_nodes
													}
												</strong>
											</span>
											<span>
												Stylesheets
												<strong>
													{
														importReview.result
															.session.review
															.stylesheets
													}
												</strong>
											</span>
											<span>
												CSS variables
												<strong>
													{
														importReview.result
															.session.review
															.css_variables
													}
												</strong>
											</span>
											<span>
												Mapped responsive rules
												<strong>
													{
														importReview.result
															.session.review
															.mapped_responsive
													}
												</strong>
											</span>
											<span>
												Mapped state rules
												<strong>
													{
														importReview.result
															.session.review
															.mapped_states
													}
												</strong>
											</span>
											<span>
												Deferred custom CSS
												<strong>
													{
														importReview.result
															.session.review
															.custom_css
													}
												</strong>
											</span>
											<span>
												Unsupported elements
												<strong>
													{
														importReview.result
															.session.review
															.unsupported_elements
													}
												</strong>
											</span>
											<span>
												Media conditions
												<strong>
													{
														importReview.result
															.session.review
															.media_conditions
															.length
													}
												</strong>
											</span>
											<span>
												Keyframes
												<strong>
													{
														importReview.result
															.session.review
															.keyframes.length
													}
												</strong>
											</span>
											<span>
												Scripts
												<strong>
													{
														importReview.result
															.session.review
															.scripts
													}{ ' ' }
													(Preview/Publish only)
												</strong>
											</span>
											<span>
												External assets
												<strong>
													{
														importReview.result
															.session.review
															.external_assets
													}
												</strong>
											</span>
										</div>
										{ importReview.result.session.pageMeta
											.title ? (
											<p>
												<strong>Page title:</strong>{ ' ' }
												{
													importReview.result.session
														.pageMeta.title
												}
											</p>
										) : null }
										<details>
											<summary>Normalized source</summary>
											<pre>
												{
													importReview.result.session
														.normalizedSource
												}
											</pre>
										</details>
										<details>
											<summary>
												Structure, styles, and
												diagnostics
											</summary>
											<p>
												Roots:{ ' ' }
												{ importReview.result.document.root.children
													?.filter(
														( child ) =>
															child.kind !==
															'text'
													)
													.map(
														( child ) => child.tag
													)
													.join( ', ' ) ||
													importReview.result.document
														.root.tag }
											</p>
											<p>
												Media:{ ' ' }
												{ importReview.result.session.review.media_conditions.join(
													', '
												) || 'None' }
											</p>
											<p>
												Keyframes:{ ' ' }
												{ importReview.result.session.review.keyframes.join(
													', '
												) || 'None' }
											</p>
										</details>
									</section>
								) : null }
								{ hasDetected && (
									<div
										className="ctb-import-detection"
										style={ {
											marginTop: '12px',
											padding: '12px',
											background: '#f8f9fa',
											borderRadius: '4px',
											fontSize: '13px',
										} }
									>
										<strong>Detected blocks:</strong>
										<ul
											style={ {
												margin: '8px 0 0',
												paddingLeft: '20px',
											} }
										>
											{ detectedHtml.map( ( source ) => (
												<li key="html-structure">
													<details>
														<summary>
															HTML structure
														</summary>
														<pre>{ source }</pre>
													</details>
												</li>
											) ) }
											{ detectedCss.map(
												( source, index ) => (
													<li
														key={ `css-${ index }` }
													>
														<details>
															<summary>
																Stylesheet{ ' ' }
																{ index + 1 }
															</summary>
															<pre>
																{ source }
															</pre>
														</details>
													</li>
												)
											) }
											{ detectedJs.map(
												( source, index ) => (
													<li key={ `js-${ index }` }>
														<details>
															<summary>
																Script block{ ' ' }
																{ index + 1 }
															</summary>
															<pre>
																{ source }
															</pre>
														</details>
													</li>
												)
											) }
											{ detectedPhp.map(
												( source, index ) => (
													<li
														key={ `php-${ index }` }
													>
														<details>
															<summary>
																PHP snippet{ ' ' }
																{ index + 1 }
															</summary>
															<pre>
																{ source }
															</pre>
														</details>
													</li>
												)
											) }
										</ul>
										{ detectedPhp.length > 0 && (
											<p
												style={ {
													marginTop: '8px',
													color: '#8a3b16',
													background:
														'rgba(255, 241, 223, 0.9)',
													padding: '8px',
													borderRadius: '4px',
												} }
											>
												PHP code requires your explicit
												confirmation before it's
												registered.
											</p>
										) }
									</div>
								) }
							</div>
							{ parseError ? (
								<p
									className="ctb-import-message is-error"
									role="alert"
								>
									{ parseError }
								</p>
							) : null }
							{ parseWarnings.length > 0 ? (
								<div
									className="ctb-import-message is-warning"
									role="status"
								>
									<strong>Imported with warnings:</strong>
									<ul>
										{ parseWarnings.map( ( warning ) => (
											<li key={ warning }>{ warning }</li>
										) ) }
									</ul>
								</div>
							) : null }
							<ScriptDetections
								detections={ scriptDetections }
								onMap={ mapDetectedAction }
							/>
							<PhpDetections
								detections={ phpDetections }
								onRegister={ registerPhpShortcode }
							/>
						</form>
					);
				} )() }
			<div className="flex-1 flex min-h-0 overflow-hidden">
				<LeftRail
					paletteDragging={ paletteDragging }
					addPrimitiveAtSelection={ addPrimitiveAtSelection }
					setPaletteDragging={ setPaletteDragging }
				/>

				{ /* CANVAS WITH BREADCRUMBS */ }
				<CenterCanvas
					previewStyles={ previewStyles }
					importedPageRoot={
						document.imported_assets?.page_meta || {}
					}
					breadcrumbPath={ breadcrumbPath }
					selectBlock={ selectBlock }
					DndContext={ DndContext }
					sensors={ sensors }
					collisionStrategy={ collisionStrategy }
					startDrag={ startDrag }
					updateDragIntent={ updateDragIntent }
					finishDrag={ finishDrag }
					cancelDrag={ cancelDrag }
					paletteDragging={ paletteDragging }
					previewBreakpoint={ previewBreakpoint }
					documentLoading={ documentLoading }
					SkeletonLoader={ SkeletonLoader }
					DragOverlay={ DragOverlay }
					activeBlock={ activeBlock }
					dropIntent={ dropIntent }
					updatePaletteDropIntent={ updatePaletteDropIntent }
					addPrimitiveAtDrop={ addPrimitiveAtDrop }
					clearDropIntent={ clearDropIntent }
					overlayModifiers={ [ cursorOffsetModifier ] }
				>
					{ documentLoading ? (
						<div className="ctb-editor-skeleton-layout">
							<SkeletonLoader type="image" />
							<SkeletonLoader type="rich_text" />
							<br />
							<SkeletonLoader type="text" />
							<SkeletonLoader type="link" />
							<br />
							<div
								style={ {
									display: 'flex',
									gap: '20px',
								} }
							>
								<div style={ { flex: 1 } }>
									<SkeletonLoader type="rich_text" />
								</div>
								<div style={ { flex: 1 } }>
									<SkeletonLoader type="rich_text" />
								</div>
							</div>
						</div>
					) : (
						<Block
							block={ viewDocument.root }
							styleIndexes={ previewStyles.indexes }
							isRoot
							onContextMenu={ handleBlockContextMenu }
							dropIntent={ dropIntent }
						/>
					) }
				</CenterCanvas>

				{ /* RIGHT PANEL - Inspector Tabs */ }
				<RightInspector
					BlockDynamicControl={ BlockDynamicControl }
					BlockSlotControl={ BlockSlotControl }
					navigatorDock={
						<NavigatorTree>
							{ renderNavigatorNode( document.root ) }
						</NavigatorTree>
					}
					selectedBlock={ selectedBlock }
					inspectorModel={ selectedInspector }
					activeTab={ activeTab }
					setActiveTab={ setActiveTab }
					duplicateBlock={ duplicateBlock }
					deleteBlock={ deleteBlock }
					documentRootId={ document.root.id }
					updateBlockContent={ updateBlockContent }
					updateBlockAttribute={ updateBlockAttribute }
					updateBlockProp={ updateBlockProp }
					updateBlockTag={ updateBlockTag }
					updateBlockMappedStyles={ updateBlockMappedStyles }
					setBlockHidden={ setBlockHidden }
					previewBreakpoint={ previewBreakpoint }
					setBlockDynamicProperties={ setBlockDynamicProperties }
					setBlockSlotProperties={ setBlockSlotProperties }
					localUpdateHistoryStatus={ localUpdateHistoryStatus }
					VOID_TAGS={ VOID_TAGS }
					styleTabContent={
						<div
							className="ctb-tab-pane"
							style={ { padding: '16px' } }
						>
							<h4>Style context</h4>
							<p className="ctb-muted">
								Target:{ ' ' }
								<strong>
									{
										selectedInspector.tabs.style
											.activeTarget
									}
								</strong>
							</p>
							<ExplainPanel block={ selectedBlock } />
							<BreakpointSwitcher
								value={ previewBreakpoint }
								onChange={ setPreviewBreakpoint }
								compact
							/>
							<p>{ selectedBreakpointSummary }</p>
							{ selectedInspector.tabs.style.properties.includes(
								'color'
							) ? (
								<ResponsiveColorOverride
									breakpoint={ previewBreakpoint }
									color={ selectedColor }
									ownColor={ selectedOwnColor }
									onClear={ clearColorOverride }
								/>
							) : null }
							{ guidedRolesEnabled( document ) ? (
								<GuidedRolePanel
									document={ document }
									block={ selectedBlock }
									styleSet={ selectedStyleSet }
									effectiveMapped={ selectedEffectiveMapped }
									onSelectRole={ selectGuidedRole }
									onAdjustRole={ adjustGuidedRole }
									onPreviewRole={ previewGuidedRole }
									onCancelPreview={ cancelGuidedRolePreview }
									onRejoin={ rejoinGuidedRole }
									onResolveImportReview={
										resolveGuidedImportReview
									}
								/>
							) : null }
							<h4>Element styles</h4>
							<MappedStyleControls
								key={ `${ selectedBlock.id }:${ previewBreakpoint }:${ selectedMappedStyleKey }` }
								styleSet={ selectedStyleSet }
								inheritedMapped={ selectedInheritedMapped }
								effectiveMapped={ selectedEffectiveMapped }
								effectiveBindings={ selectedEffectiveBindings }
								designTokens={ document.design_tokens }
								breakpoint={ previewBreakpoint }
								panelMode="advanced"
								searchQuery=""
								allowedProperties={
									selectedInspector.tabs.style.properties
								}
								parentDisplayValue={ selectedParentDisplay }
								onApply={ applyMappedStyles }
								onLinkToken={ linkSelectedToken }
								onRemoveToken={ unlinkSelectedToken }
								onOverrideToken={ overrideSelectedToken }
							/>
							<details className="ctb-document-design-system">
								<summary>Document design system</summary>
								<div className="ctb-document-design-system-content">
									<GuidedRolesManager
										document={ document }
										onRestoreRole={
											restoreGuidedRoleDefaults
										}
										onSelectElement={ selectBlock }
										onRejoinOverride={
											rejoinOverrideFromManager
										}
									/>
									<DesignTokenPanel
										document={ document }
										onSave={ saveDesignToken }
										onDelete={ removeDesignToken }
									/>
								</div>
							</details>
						</div>
					}
					advancedTabContent={
						<div
							className="ctb-tab-pane"
							style={ { padding: '16px' } }
						>
							<h4>Responsive</h4>
							<BreakpointSwitcher
								value={ previewBreakpoint }
								onChange={ setPreviewBreakpoint }
								compact
							/>
							<p className="ctb-muted">
								{ selectedBreakpointSummary }
							</p>
							<h4>Attributes & accessibility</h4>
							<fieldset
								disabled={ selectedBlock.permissions?.locked }
								className="ctb-inspector-fields ctb-attribute-fields"
							>
								{ [
									[ 'id', 'ID' ],
									[ 'class', 'CSS classes' ],
									[ 'title', 'Title' ],
									[ 'role', 'ARIA role' ],
									[ 'aria-label', 'ARIA label' ],
									[ 'tabindex', 'Tab index' ],
								].map( ( [ attribute, label ] ) => (
									<label key={ attribute }>
										<span>{ label }</span>
										<input
											key={ `${ selectedBlock.id }:${ attribute }` }
											defaultValue={
												selectedBlock.attributes?.[
													attribute
												] || ''
											}
											onBlur={ ( event ) =>
												updateBlockAttribute(
													selectedBlock.id,
													attribute,
													event.target.value
												)
											}
										/>
									</label>
								) ) }
								<div className="ctb-custom-attribute-row">
									<input
										aria-label="Custom attribute name"
										placeholder="data-name"
										value={ customAttributeName }
										onChange={ ( event ) =>
											setCustomAttributeName(
												event.target.value
											)
										}
									/>
									<input
										aria-label="Custom attribute value"
										placeholder="Value"
										value={ customAttributeValue }
										onChange={ ( event ) =>
											setCustomAttributeValue(
												event.target.value
											)
										}
									/>
									<button
										type="button"
										onClick={ () => {
											updateBlockAttribute(
												selectedBlock.id,
												customAttributeName,
												customAttributeValue
											);
											setCustomAttributeName( '' );
											setCustomAttributeValue( '' );
										} }
									>
										Add
									</button>
								</div>
							</fieldset>
							<h4>Custom CSS & behavior</h4>
							<RawCssControl
								key={ `${ selectedBlock.id }:${ previewBreakpoint }:raw` }
								styleSet={ selectedStyleSet }
								breakpoint={ previewBreakpoint }
								onApply={ applyCustomCss }
							/>
							<BlockAnimationControl block={ selectedBlock } />
							<BlockActions block={ selectedBlock } />
							<DiagnosticsPanel postId={ postId } />
							<ParityWarningsPanel
								warnings={ parityWarnings }
								onSelect={ selectBlock }
							/>
							<AccessibilityPanel
								issues={ a11yIssues }
								onSelect={ selectBlock }
							/>
						</div>
					}
				/>
				<RoleEditDecisionDialog
					pending={ pendingRoleEdit }
					affectedCount={
						pendingRoleEdit
							? countRoleUsage(
									document,
									pendingRoleEdit.binding.roleId
							  ).uses
							: 0
					}
					onGlobal={ applyPendingRoleEditGlobally }
					onLocal={ applyPendingRoleEditLocally }
					onCancel={ () => setPendingRoleEdit( null ) }
				/>

				{ /* FAR-RIGHT PANEL - Settings & Data */ }

				<ContextMenu
					menu={ contextMenu }
					onClose={ () => setContextMenu( null ) }
					onAction={ handleContextAction }
					hasClipboard={ !! clipboardBlock }
					hasStylesClipboard={ !! clipboardStyles }
				/>
			</div>
		</section>
	);
}

