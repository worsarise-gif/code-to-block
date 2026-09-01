export default function NavigatorTree( { children } ) {
	return (
		<div className="p-4">
			<h4 className="m-0 mb-4 text-[13px] font-semibold text-slate-900">
				Navigator
			</h4>
			<div className="ctb-navigator-tree flex flex-col gap-1 font-poppins">
				{ children }
			</div>
		</div>
	);
}
