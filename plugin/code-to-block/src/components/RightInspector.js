import { createElement, useState } from '@wordpress/element';

export default function RightInspector({
    BlockDynamicControl,
    BlockSlotControl,
	selectedBlock,
	activeTab,
	setActiveTab,
	duplicateBlock,
	deleteBlock,
	documentRootId,
    updateBlockContent,
    updateBlockAttribute,
    setBlockDynamicProperties,
    setBlockSlotProperties,
    localUpdateHistoryStatus,
    VOID_TAGS,
    styleTabContent,
    advancedTabContent,
    navigatorDock
}) {
    // Stub states for new mockup controls
    const [mockSubtitle, setMockSubtitle] = useState("Design, customize, and launch modern websites with a powerful visual builder.");
    const [mockDynamicSubtitle, setMockDynamicSubtitle] = useState(false);
    const [mockNewTab, setMockNewTab] = useState(false);
    const [mockWrap, setMockWrap] = useState('Normal');
    const [mockAlign, setMockAlign] = useState('Left');

	if (!selectedBlock) {
		return (
			<aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-10" data-purpose="right-panel" style={{ width: '320px', zIndex: 10, fontFamily: '"Poppins", sans-serif' }}>
				<div className="flex-1 flex items-center justify-center text-center text-slate-500 text-sm p-8">
					<div>
						<i className="fa-solid fa-arrow-pointer text-2xl mb-3 opacity-20 block"></i>
						Select an element on the canvas to view and edit its properties.
					</div>
				</div>
			</aside>
		);
	}

    // Helper to find the first text child if applicable
    const firstTextChild = (selectedBlock.children || []).find((child) => child.kind === 'text');

	return (
		<aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-10" data-purpose="right-panel" style={{ width: '320px', zIndex: 10, fontFamily: '"Poppins", sans-serif' }}>
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				{/* Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
						<h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#0f172a' }}>{ selectedBlock.tag.charAt(0).toUpperCase() + selectedBlock.tag.slice(1) }</h3>
						<div style={{ display: 'flex', gap: '4px' }}>
							<button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><i className="fa-solid fa-cloud-arrow-down"></i></button>
							<button
								style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
								disabled={ selectedBlock.id === documentRootId || selectedBlock.permissions?.locked }
								onClick={ () => duplicateBlock( selectedBlock.id ) }
							><i className="fa-solid fa-clone"></i></button>
							<button
								style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
								disabled={ selectedBlock.id === documentRootId || selectedBlock.permissions?.locked }
								onClick={ () => deleteBlock( selectedBlock.id ) }
							><i className="fa-solid fa-trash-can"></i></button>
						</div>
					</div>
					<div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
						<span>#{ selectedBlock.id.split('-')[0] }</span>
					</div>
				</div>

                {/* Tabs */}
				<div className="flex border-b border-slate-200 shrink-0 bg-white px-4" style={{ gap: '16px' }}>
					<button
						className={ `py-3 text-[12px] font-medium transition-colors cursor-pointer bg-transparent outline-none border-b-2 ${ activeTab === 'content' ? 'border-[#4f46e5] text-[#4f46e5]' : 'border-transparent text-slate-500 hover:text-slate-700' }` }
						onClick={ () => setActiveTab( 'content' ) }
						style={{ paddingBottom: '10px' }}
					>
						Content
					</button>
					<button
						className={ `py-3 text-[12px] font-medium transition-colors cursor-pointer bg-transparent outline-none border-b-2 ${ activeTab === 'style' ? 'border-[#4f46e5] text-[#4f46e5]' : 'border-transparent text-slate-500 hover:text-slate-700' }` }
						onClick={ () => setActiveTab( 'style' ) }
						style={{ paddingBottom: '10px' }}
					>
						Style
					</button>
					<button
						className={ `py-3 text-[12px] font-medium transition-colors cursor-pointer bg-transparent outline-none border-b-2 ${ activeTab === 'advanced' ? 'border-[#4f46e5] text-[#4f46e5]' : 'border-transparent text-slate-500 hover:text-slate-700' }` }
						onClick={ () => setActiveTab( 'advanced' ) }
						style={{ paddingBottom: '10px' }}
					>
						Advanced
					</button>
				</div>

				<div className="flex-1 overflow-auto p-4 bg-white" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
					{ activeTab === 'content' && (
                        <div className="ctb-tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            { selectedBlock.permissions?.locked ? (
                                <div className="ctb-locked-notice" style={{ fontSize: '12px', color: '#ef4444', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '6px' }}>Locked elements are read-only.</div>
                            ) : null }

                            <fieldset disabled={ selectedBlock.permissions?.locked } style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Content Source */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#334155' }}>Content Source</label>
                                    </div>
                                    <select
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#fff', color: '#334155', outline: 'none' }}
                                        value={ selectedBlock.is_dynamic ? 'Dynamic' : 'HTML' }
                                        onChange={(e) => {
                                            setBlockDynamicProperties(selectedBlock.id, e.target.value === 'Dynamic', selectedBlock.dynamic_source);
                                            localUpdateHistoryStatus('Updated dynamic binding');
                                        }}
                                    >
                                        <option value="HTML">HTML</option>
                                        <option value="Dynamic">Dynamic</option>
                                    </select>
                                </div>

                                {/* Preserved Existing Core Components */}
                                <BlockDynamicControl
                                    block={ selectedBlock }
                                    onChange={ ( id, isDynamic, dynamicSource ) => {
                                        setBlockDynamicProperties( id, isDynamic, dynamicSource );
                                        localUpdateHistoryStatus( 'Updated dynamic binding' );
                                    } }
                                />
                                <BlockSlotControl
                                    block={ selectedBlock }
                                    onChange={ ( id, isSlot, label, type ) => {
                                        setBlockSlotProperties( id, isSlot, label, type );
                                        localUpdateHistoryStatus( 'Updated slot properties' );
                                    } }
                                />


                                {/* Text Content mapped to "Title" */}
                                { !VOID_TAGS.has(selectedBlock.tag) && !selectedBlock.is_dynamic ? (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '500', color: '#334155' }}>Title</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Dynamic</span>
                                                <div
                                                    style={{ width: '28px', height: '16px', backgroundColor: selectedBlock.is_dynamic ? '#4f46e5' : '#e2e8f0', borderRadius: '16px', position: 'relative', cursor: 'pointer' }}
                                                    onClick={() => setBlockDynamicProperties(selectedBlock.id, !selectedBlock.is_dynamic, selectedBlock.dynamic_source)}
                                                >
                                                    <div style={{ width: '12px', height: '12px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: selectedBlock.is_dynamic ? '14px' : '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: 'left 0.2s' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <textarea
                                                rows="3"
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#fff', color: '#334155', outline: 'none', resize: 'vertical' }}
                                                key={ `${ selectedBlock.id }:content` }
                                                            defaultValue={ ( selectedBlock.children || [] ).filter( ( child ) => child.kind === 'text' ).map( ( child ) => child.value ).join( '' ) }
                                                onBlur={ ( event ) => updateBlockContent( selectedBlock.id, event.target.value ) }
                                            ></textarea>
                                            <i className="fa-solid fa-database" style={{ position: 'absolute', right: '10px', bottom: '12px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }} onClick={() => console.log('Pending DB binding')}></i>
                                        </div>
                                    </div>
                                ) : null }

                                {/* Subtitle Mock */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#334155' }}>Subtitle</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Dynamic</span>
                                            <div
                                                style={{ width: '28px', height: '16px', backgroundColor: mockDynamicSubtitle ? '#4f46e5' : '#e2e8f0', borderRadius: '16px', position: 'relative', cursor: 'pointer' }}
                                                onClick={() => setMockDynamicSubtitle(!mockDynamicSubtitle)}
                                            >
                                                <div style={{ width: '12px', height: '12px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: mockDynamicSubtitle ? '14px' : '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: 'left 0.2s' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', gap: '8px', overflowX: 'auto' }}>
                                            <select style={{ border: 'none', background: 'transparent', fontSize: '11px', outline: 'none', color: '#475569', cursor: 'pointer', padding: '0 4px' }} onChange={(e) => console.log('Format:', e.target.value)}>
                                                <option>Paragraph</option>
                                            </select>
                                            <div style={{ width: '1px', height: '12px', backgroundColor: '#cbd5e1' }}></div>
                                            <button style={{ border: 'none', background: 'transparent', padding: '4px', cursor: 'pointer', color: '#475569' }} onClick={() => console.log('Bold')}><i className="fa-solid fa-bold text-[11px]"></i></button>
                                            <button style={{ border: 'none', background: 'transparent', padding: '4px', cursor: 'pointer', color: '#475569' }} onClick={() => console.log('Italic')}><i className="fa-solid fa-italic text-[11px]"></i></button>
                                            <button style={{ border: 'none', background: 'transparent', padding: '4px', cursor: 'pointer', color: '#475569' }} onClick={() => console.log('Underline')}><i className="fa-solid fa-underline text-[11px]"></i></button>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <textarea
                                                rows="3"
                                                style={{ width: '100%', padding: '8px 12px', border: 'none', fontSize: '12px', backgroundColor: '#fff', color: '#334155', outline: 'none', resize: 'vertical' }}
                                                value={ mockSubtitle }
                                                onChange={ ( event ) => setMockSubtitle(event.target.value) }
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                {/* HTML Tag & Alignment Mock */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>HTML Tag</label>
                                        <input
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#f8fafc', color: '#64748b', outline: 'none' }}
                                            value={ selectedBlock.tag.toUpperCase() }
                                            readOnly
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Alignment</label>
                                        <div style={{ display: 'flex', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '2px' }}>
                                            <button style={{ flex: 1, border: 'none', padding: '6px 0', background: mockAlign === 'Left' ? '#fff' : 'transparent', boxShadow: mockAlign === 'Left' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', borderRadius: '4px', cursor: 'pointer', color: mockAlign === 'Left' ? '#4f46e5' : '#64748b' }} onClick={() => setMockAlign('Left')}><i className="fa-solid fa-align-left text-[11px]"></i></button>
                                            <button style={{ flex: 1, border: 'none', padding: '6px 0', background: mockAlign === 'Center' ? '#fff' : 'transparent', boxShadow: mockAlign === 'Center' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', borderRadius: '4px', cursor: 'pointer', color: mockAlign === 'Center' ? '#4f46e5' : '#64748b' }} onClick={() => setMockAlign('Center')}><i className="fa-solid fa-align-center text-[11px]"></i></button>
                                            <button style={{ flex: 1, border: 'none', padding: '6px 0', background: mockAlign === 'Right' ? '#fff' : 'transparent', boxShadow: mockAlign === 'Right' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', borderRadius: '4px', cursor: 'pointer', color: mockAlign === 'Right' ? '#4f46e5' : '#64748b' }} onClick={() => setMockAlign('Right')}><i className="fa-solid fa-align-right text-[11px]"></i></button>
                                        </div>
                                    </div>
                                </div>

                                {/* Text Wrap Mock */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#334155' }}>Text Wrap</label>
                                    <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '2px' }}>
                                        <button style={{ border: 'none', padding: '4px 12px', backgroundColor: mockWrap === 'Normal' ? '#fff' : 'transparent', boxShadow: mockWrap === 'Normal' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '500', color: mockWrap === 'Normal' ? '#4f46e5' : '#64748b', cursor: 'pointer' }} onClick={() => setMockWrap('Normal')}>Normal</button>
                                        <button style={{ border: 'none', padding: '4px 12px', backgroundColor: mockWrap === 'Balance' ? '#fff' : 'transparent', boxShadow: mockWrap === 'Balance' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '500', color: mockWrap === 'Balance' ? '#4f46e5' : '#64748b', cursor: 'pointer' }} onClick={() => setMockWrap('Balance')}>Balance</button>
                                    </div>
                                </div>

                                <div style={{ width: '100%', height: '1px', backgroundColor: '#e2e8f0', margin: '8px 0' }}></div>

                                {/* Link / Targets */}
                                { selectedBlock.tag === 'a' ? (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Link</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#fff', color: '#334155', outline: 'none' }}
                                                    defaultValue={ selectedBlock.attributes?.href || '' }
                                                    onBlur={ ( event ) => updateBlockAttribute( selectedBlock.id, 'href', event.target.value ) }
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '500', color: '#334155' }}>Open in new tab</label>
                                            <div
                                                style={{ width: '32px', height: '18px', backgroundColor: selectedBlock.attributes?.target === '_blank' ? '#4f46e5' : '#e2e8f0', borderRadius: '16px', position: 'relative', cursor: 'pointer' }}
                                                onClick={() => {
                                                    const isTarget = selectedBlock.attributes?.target === '_blank';
                                                    updateBlockAttribute( selectedBlock.id, 'target', !isTarget ? '_blank' : '' );
                                                    updateBlockAttribute( selectedBlock.id, 'rel', !isTarget ? 'noopener noreferrer' : '' );
                                                }}
                                            >
                                                <div style={{ width: '14px', height: '14px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: selectedBlock.attributes?.target === '_blank' ? '16px' : '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: 'left 0.2s' }}></div>
                                            </div>
                                        </div>
                                    </>
                                ) : null }

                                {/* Media Source */}
                                { selectedBlock.tag === 'img' || selectedBlock.tag === 'iframe' ? (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0f172a', margin: '0 0 12px 0' }}>Media</label>
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                            <div style={{ width: '120px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                <img src={ selectedBlock.attributes?.src || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" } style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                                                <button style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', backgroundColor: '#fff', borderRadius: '6px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-slate-50 transition-colors" onClick={() => console.log('Mock Edit')}><i className="fa-solid fa-pen text-[12px]"></i></button>
                                                <button style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', backgroundColor: '#fff', borderRadius: '6px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-slate-50 transition-colors" onClick={() => console.log('Mock Change')}><i className="fa-regular fa-image text-[12px]"></i></button>
                                                <button style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', backgroundColor: '#fff', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-red-50 transition-colors" onClick={() => console.log('Mock Delete')}><i className="fa-solid fa-trash-can text-[12px]"></i></button>
                                            </div>
                                        </div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>Source URL</label>
                                        <input
                                            type="text"
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#fff', color: '#334155', outline: 'none' }}
                                            defaultValue={ selectedBlock.attributes?.src || '' }
                                            onBlur={ ( event ) => updateBlockAttribute( selectedBlock.id, 'src', event.target.value ) }
                                        />
                                    </div>
                                ) : null }
                                { selectedBlock.tag === 'img' ? (
                                    <div style={{ marginTop: '8px' }}>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>Alt text</label>
                                        <input
                                            type="text"
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#fff', color: '#334155', outline: 'none' }}
                                            defaultValue={ selectedBlock.attributes?.alt || '' }
                                            onBlur={ ( event ) => updateBlockAttribute( selectedBlock.id, 'alt', event.target.value ) }
                                        />
                                    </div>
                                ) : null }

                                {/* Button List Mock */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>Buttons</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <i className="fa-solid fa-grip-vertical text-[#94a3b8] text-[10px] cursor-grab"></i>
                                                <span style={{ fontSize: '12px', color: '#334155' }}>Get Started</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontWeight: '500' }}>Primary</span>
                                                <i className="fa-solid fa-gear text-[#94a3b8] text-[12px] cursor-pointer hover:text-slate-700"></i>
                                                <i className="fa-solid fa-xmark text-[#94a3b8] text-[12px] cursor-pointer hover:text-slate-700"></i>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <i className="fa-solid fa-grip-vertical text-[#94a3b8] text-[10px] cursor-grab"></i>
                                                <span style={{ fontSize: '12px', color: '#334155' }}>Explore Features</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#ecfdf5', color: '#047857', borderRadius: '4px', fontWeight: '500' }}>Outline</span>
                                                <i className="fa-solid fa-gear text-[#94a3b8] text-[12px] cursor-pointer hover:text-slate-700"></i>
                                                <i className="fa-solid fa-xmark text-[#94a3b8] text-[12px] cursor-pointer hover:text-slate-700"></i>
                                            </div>
                                        </div>
                                    </div>
                                    <button style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} className="hover:bg-slate-100 transition-colors" onClick={() => console.log('Pending integration')}>
                                        <i className="fa-solid fa-plus text-[10px]"></i> Add Button
                                    </button>
                                </div>
                            </fieldset>
                        </div>
                    ) }

					{ activeTab === 'style' && styleTabContent }
					{ activeTab === 'advanced' && advancedTabContent }
				</div>

				{navigatorDock}

                {/* Bottom Action Bar */}
				<div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
					<button style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '500', color: '#64748b', cursor: 'pointer' }} className="hover:text-slate-900 transition-colors" onClick={() => console.log('Pending DB integration')}>
						Save
					</button>
					<button style={{ border: 'none', backgroundColor: '#4f46e5', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} className="hover:bg-indigo-700 transition-colors" onClick={() => console.log('Pending integration')}>
						Apply Changes
					</button>
				</div>
			</div>
		</aside>
	);
}
