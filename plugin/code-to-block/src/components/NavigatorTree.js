import { createElement, useState } from '@wordpress/element';

export default function NavigatorTree({
    children // The renderNavigatorNode call
}) {
    return (
        <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: '#0f172a' }}>Navigator</h4>
                <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                    <i className="fa-solid fa-xmark text-[14px]"></i>
                </button>
            </div>

            <div className="ctb-navigator-tree" style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: '"Poppins", sans-serif' }}>
                { children }

                {/* Fallback mock if completely empty */}
                {!children && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '12px', color: '#334155' }}>
                            <i className="fa-solid fa-chevron-down text-[10px] text-[#94a3b8]"></i>
                            <i className="fa-solid fa-border-all text-[#94a3b8]"></i>
                            <span>Body</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
