import { createElement, useRef, useEffect, useState } from '@wordpress/element';
import { createPortal } from '@wordpress/element';

function ShadowWrapper({ children, previewStyles }) {
    const hostRef = useRef(null);
    const [shadowRoot, setShadowRoot] = useState(null);

    useEffect(() => {
        if (hostRef.current && !hostRef.current.shadowRoot) {
            setShadowRoot(hostRef.current.attachShadow({ mode: 'open' }));
        }
    }, []);

    return (
        <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
            {shadowRoot && createPortal(
                <>
                    <style>{previewStyles}</style>
                    {children}
                </>,
                shadowRoot
            )}
        </div>
    );
}

export default function CenterCanvas({
    previewStyles,
    breadcrumbPath,
    selectBlock,
    DndContext,
    sensors,
    closestCenter,
    setActiveId,
    finishDrag,
    paletteDragging,
    previewBreakpoint,
    documentLoading,
    SkeletonLoader,
    DragOverlay,
    activeBlock,
    addPrimitiveAtSelection,
    setPaletteDragging,
    children // inner elements mapping
}) {
    return (
        <main
            className="ctb-canvas-stage flex-1 flex flex-col overflow-auto relative p-8 items-center"
            style={{ backgroundColor: '#E5E7EB', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}
        >
            <div className="absolute top-4 left-4 z-20 flex items-center bg-indigo-600 text-white text-[10px] font-medium px-2 py-1 rounded shadow-sm">
                { breadcrumbPath && breadcrumbPath.map( ( block, idx ) => (
                    <span key={ block.id } style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ cursor: 'pointer' }} onClick={ () => selectBlock( block.id ) }>
                            { block.tag }
                        </span>
                        { idx < breadcrumbPath.length - 1 && <i className="fa-solid fa-chevron-right text-[8px] mx-1"></i> }
                    </span>
                ) ) }
                { (!breadcrumbPath || breadcrumbPath.length === 0) && <span>Select an element</span> }
            </div>

            <DndContext sensors={ sensors } collisionDetection={ closestCenter } onDragStart={ ( e ) => setActiveId( e.active.id ) } onDragEnd={ finishDrag }>
                <div
                    className={ `ctb-canvas-wrapper w-full bg-white shadow-xl rounded-lg border border-slate-200 overflow-hidden relative ${ paletteDragging ? ' is-palette-target' : '' }` }
                    style={{
                        maxWidth: previewBreakpoint === 'desktop' ? '100%' : previewBreakpoint === 'tablet' ? '768px' : '375px',
                        transition: 'max-width 0.3s ease-in-out',
                        minHeight: '800px',
                        margin: '0 auto',
                        height: '100%'
                    }}
                    onDragOver={ ( event ) => {
                        if ( event.dataTransfer.types.includes( 'application/x-ctb-element' ) ) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                        }
                    } }
                    onDrop={ ( event ) => {
                        const primitive = event.dataTransfer.getData( 'application/x-ctb-element' );
                        if ( primitive ) {
                            event.preventDefault();
                            addPrimitiveAtSelection( primitive );
                            setPaletteDragging( null );
                        }
                    } }
                >
                    <div className={ `ctb-canvas-viewport is-${ previewBreakpoint }` } style={{ height: '100%', width: '100%' }}>
                        { documentLoading && SkeletonLoader ? (
                            <div className="ctb-editor-skeleton-layout p-8">
                                <SkeletonLoader type="image" />
                                <SkeletonLoader type="rich_text" />
                                <br />
                                <SkeletonLoader type="text" />
                                <SkeletonLoader type="link" />
                            </div>
                        ) : (
                            <ShadowWrapper previewStyles={previewStyles?.css || ''}>
                                {children}
                            </ShadowWrapper>
                        ) }
                    </div>
                </div>

                { DragOverlay && activeBlock ? (
                    <DragOverlay>
                        <div className="ctb-drag-overlay" style={{ padding: '8px', background: '#4f46e5', color: 'white', borderRadius: '4px', fontSize: '12px' }}>
                            Moving { activeBlock.id }
                        </div>
                    </DragOverlay>
                ) : null }
            </DndContext>
        </main>
    );
}
