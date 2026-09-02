import '../../editor.css';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';

export function SeoPanel( { document, onChange } ) {
	const seo = document.seo || {};
	const fields = [
		{
			key: 'title',
			label: 'SEO Title',
			placeholder: 'Page title — 50-60 chars ideal',
			help: 'Title tag — shown in Google results and browser tab. Keep 50-60 chars.',
		},
		{
			key: 'description',
			label: 'Meta Description',
			placeholder: 'Brief summary — 120-160 chars ideal',
			help: 'Meta description — shown under title in search results. Aim 120-160 chars.',
		},
		{
			key: 'canonical',
			label: 'Canonical URL',
			placeholder: 'https://example.com/page/',
			help: 'Canonical — preferred URL for this page. Usually leave blank for auto.',
		},
		{
			key: 'og_title',
			label: 'Open Graph Title',
			placeholder: 'Social sharing title',
			help: 'OG title — for Facebook/Twitter shares. Falls back to SEO Title.',
		},
		{
			key: 'og_description',
			label: 'OG Description',
			placeholder: 'Social sharing description',
			help: 'OG description — for social shares. Falls back to meta description.',
		},
		{
			key: 'og_image',
			label: 'OG Image URL',
			placeholder: 'https://example.com/image.jpg',
			help: 'OG image — preview image for social shares.',
		},
	];
	return (
		<details
			className="ctb-seo-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>SEO</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
						textTransform: 'uppercase',
					} }
				>
					{ Object.keys( seo ).length || '0' } fields
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 8px',
				} }
			>
				Title/description/canonical/Open Graph — editable here and via
				Content Mode. Auto JSON-LD (WebPage/Product/LocalBusiness) is
				generated from your blocks, not typed.
			</p>
			{ fields.map( ( f ) => {
				const val = seo[ f.key ] || '';
				const isDesc =
					f.key === 'description' || f.key === 'og_description';
				const len = val.length;
				const counter = isDesc ? `${ len } / 160` : `${ len } / 60`;
				const warn = isDesc ? len > 160 : len > 60 && f.key === 'title';
				return (
					<label
						key={ f.key }
						style={ {
							display: 'grid',
							gap: '4px',
							marginTop: '8px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span
							style={ {
								display: 'flex',
								justifyContent: 'space-between',
							} }
						>
							<span>{ f.label }</span>
							<span
								style={ {
									color: warn ? '#9f2525' : '#686355',
									fontWeight: 400,
									fontFamily: 'monospace',
									fontSize: '8px',
								} }
							>
								{ val ? counter : '' }
							</span>
						</span>
						{ f.key === 'description' ||
						f.key === 'og_description' ? (
							<textarea
								value={ val }
								onChange={ ( e ) =>
									onChange( f.key, e.target.value )
								}
								placeholder={ f.placeholder }
								rows={ 2 }
								style={ {
									border: '1px solid #aaa393',
									borderRadius: '3px',
									padding: '6px',
									fontSize: '10px',
									fontFamily: 'inherit',
								} }
							/>
						) : (
							<input
								type="text"
								value={ val }
								onChange={ ( e ) =>
									onChange( f.key, e.target.value )
								}
								placeholder={ f.placeholder }
								style={ {
									border: '1px solid #aaa393',
									borderRadius: '3px',
									padding: '6px',
									fontSize: '10px',
								} }
							/>
						) }
						<small
							style={ {
								color: '#686355',
								fontWeight: 400,
								fontSize: '8px',
								lineHeight: '1.3',
							} }
						>
							{ f.help }
						</small>
					</label>
				);
			} ) }
		</details>
	);
}

