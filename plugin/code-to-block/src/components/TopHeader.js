import { createElement, useState } from '@wordpress/element';

export default function TopHeader({
	documentName,
	previewBreakpoint,
	setPreviewBreakpoint,
	canUndo,
	canRedo,
	undoChange,
	redoChange,
	persistenceStatus,
	previewUrl,
	isImporterOpen,
	setIsImporterOpen,
	saveDocument,
    children // children is the BreakpointSwitcher passed from index.js
}) {
    const [isMyWebsiteOpen, setIsMyWebsiteOpen] = useState(false);
    const [isZoomOpen, setIsZoomOpen] = useState(false);

	return (
		<header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10" data-purpose="top-nav">
			{/* Left: Logo and Project Name */}
            <div className="flex items-center gap-4">
				<div className="w-8 h-8 flex items-center justify-center text-indigo-600 bg-indigo-50 rounded-md">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
				</div>
				<button
                    className="flex items-center gap-2 hover:bg-slate-100 px-2 py-1 rounded text-sm font-medium border-none bg-transparent cursor-pointer"
                    onClick={() => setIsMyWebsiteOpen(!isMyWebsiteOpen)}
                >
					{ documentName || 'My Website' } <i className="fa-solid fa-chevron-down text-[10px] text-slate-500"></i>
				</button>
			</div>

            {/* Center: Viewport, History, Zoom */}
			<div className="flex items-center gap-2">
				<div className="flex bg-slate-100 rounded-md p-0.5 border-none">
                    { children }
				</div>
				<div className="h-4 w-px bg-slate-200 mx-2"></div>
				<button
					type="button"
					className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
					disabled={ ! canUndo }
					title="Undo"
					onClick={ undoChange }
				>
					<i className="fa-solid fa-rotate-left text-sm"></i>
				</button>
				<button
					type="button"
					className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
					disabled={ ! canRedo }
					title="Redo"
					onClick={ redoChange }
				>
					<i className="fa-solid fa-rotate-right text-sm"></i>
				</button>
				<button
                    className="flex items-center gap-2 hover:bg-slate-100 px-2 py-1 rounded text-sm font-medium ml-2 border-none bg-transparent cursor-pointer text-slate-600"
                    onClick={() => setIsZoomOpen(!isZoomOpen)}
                >
					100% <i className="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
				</button>
			</div>

            {/* Right: Actions, Help, Profile */}
			<div className="flex items-center gap-3">
				<span className="text-xs text-slate-500 mr-2">{ persistenceStatus || 'Ready' }</span>
				{ previewUrl && (
					<a
						className="px-4 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors no-underline cursor-pointer shadow-sm"
						href={ previewUrl }
						target="_blank"
						rel="noreferrer"
					>
						Preview
					</a>
				) }
                <button type="button" className="px-4 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer" onClick={ () => setIsImporterOpen( ! isImporterOpen ) }>
                    Import
                </button>
				<div className="flex rounded-md shadow-sm">
					<button
						type="button"
						className="px-4 py-1.5 text-sm font-medium text-white bg-[#4f46e5] rounded-l-md hover:bg-indigo-700 transition-colors border-none cursor-pointer"
						onClick={ saveDocument }
					>
						Publish
					</button>
					<button type="button" className="px-2 py-1.5 bg-[#4f46e5] text-white rounded-r-md border-l border-white/20 hover:bg-indigo-700 cursor-pointer">
						<i className="fa-solid fa-chevron-down text-xs"></i>
					</button>
				</div>
				<button
					type="button"
					className="w-8 h-8 ml-2 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
				>
					<i className="fa-regular fa-circle-question text-lg"></i>
				</button>
				<button
					type="button"
					className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer relative"
				>
					<i className="fa-regular fa-bell text-lg"></i>
					<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
				</button>
				<img alt="User Avatar" className="w-8 h-8 rounded-full border border-slate-200 ml-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7Ex9EHSWAM5mShH9TFzMycnSxvOCa7WvAJhwzXy9AFJlawMVJ8Onae1kmGSI5eoTqNcUeXmNgMDZ1JLW8GUmxogD1T7OQMbkmC1WGEKx9iyxcVqCGHe7-N1domsimVwxfi_JFCki3DT4MgtSM39-N93rZXoLsUru1chHyrT_kECCI3BX-q796CHMRxDIWUIetzebpPiZNbqORFwpHkYf3X3SVMqvzN9G7HrD39iJ0zzHmBdbTnL4x"/>
			</div>
		</header>
	);
}
