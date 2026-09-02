import '../../editor.css';
import { styleControlLabel } from '../../custom-css.mjs';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';
import { isSavedComponentBlock } from '../../reusable-components.mjs';

export function ExplainPanel( { block } ) {
	const declarations = block.meta?.css_mapping?.declarations;
	const importedRules = block.meta?.imported_css_rules || [];
	const mapped = Array.isArray( declarations )
		? declarations.filter(
				( declaration ) => declaration.destination === 'style-control'
		  )
		: [];
	const fallback = Array.isArray( declarations )
		? declarations.filter(
				( declaration ) => declaration.destination === 'raw-css'
		  )
		: [];
	const count = mapped.length + fallback.length;

	function MappingRows( { items, destination } ) {
		return (
			<ul className="ctb-explain-list">
				{ items.map( ( declaration, index ) => (
					<li key={ `${ declaration.property }-${ index }` }>
						<div className="ctb-explain-route">
							<code>{ declaration.property }</code>
							<span aria-hidden="true">→</span>
							<strong>
								{ destination === 'style-control'
									? styleControlLabel( declaration.control )
									: 'Raw CSS' }
							</strong>
						</div>
						<code className="ctb-explain-value">
							{ declaration.value }
							{ declaration.important ? ' !important' : '' }
						</code>
						<small>{ declaration.origin }</small>
					</li>
				) ) }
			</ul>
		);
	}

	return (
		<>
			<details className="ctb-explain-panel" open={ count > 0 }>
				<summary>
					<span>Explain CSS</span>
					<small>
						{ count ? `${ count } resolved` : 'no import data' }
					</small>
				</summary>
				<p className="ctb-explain-help">
					This is the resolved CSS captured at import. Later style
					edits do not rewrite this record.
				</p>
				{ isSavedComponentBlock( block ) ? (
					<p className="ctb-explain-empty">
						Mapping is stored inside the linked component, not on
						this instance.
					</p>
				) : null }
				{ ! isSavedComponentBlock( block ) && ! count ? (
					<p className="ctb-explain-empty">
						No CSS mapping was recorded for this block.
					</p>
				) : null }
				{ mapped.length ? (
					<section className="ctb-explain-group">
						<h4>Mapped to controls</h4>
						<MappingRows
							items={ mapped }
							destination="style-control"
						/>
					</section>
				) : null }
				{ fallback.length ? (
					<section className="ctb-explain-group">
						<h4>Preserved as raw CSS</h4>
						<MappingRows items={ fallback } destination="raw-css" />
					</section>
				) : null }
			</details>
			{ importedRules.length ? (
				<details className="ctb-explain-panel" open>
					<summary>
						<span>Styles from imported CSS</span>
						<small>{ importedRules.length } matched</small>
					</summary>
					<ul className="ctb-explain-list">
						{ importedRules.map( ( rule, index ) => (
							<li
								key={ `${ rule.stylesheet_id }-${ rule.order }-${ index }` }
							>
								<div className="ctb-explain-route">
									<code>{ rule.selector }</code>
									<strong>{ rule.condition }</strong>
								</div>
								<code className="ctb-explain-value">
									{ rule.declarations
										.map(
											( declaration ) =>
												`${ declaration.property }: ${
													declaration.value
												}${
													declaration.important
														? ' !important'
														: ''
												};`
										)
										.join( ' ' ) }
								</code>
							</li>
						) ) }
					</ul>
				</details>
			) : null }
		</>
	);
}

