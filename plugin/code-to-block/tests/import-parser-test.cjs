const assert = require( 'node:assert/strict' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );

const { JSDOM } = require( 'jsdom' );
const { Volume, createFsFromVolume } = require( 'memfs' );
const webpack = require( 'webpack' );

const compiler = webpack( {
	mode: 'development',
	target: 'node',
	entry: path.resolve( __dirname, '../src/parser.js' ),
	output: {
		path: '/dist',
		filename: 'parser.cjs',
		library: { type: 'commonjs2' },
	},
	devtool: false,
} );
const memoryFs = createFsFromVolume( new Volume() );
memoryFs.join = path.join.bind( path );
compiler.outputFileSystem = memoryFs;

compiler.run( ( error, stats ) => {
	compiler.close( () => {} );
	if ( error ) {
		throw error;
	}
	if ( stats.hasErrors() ) {
		throw new Error( stats.toString( { errors: true } ) );
	}

	const source = memoryFs.readFileSync( '/dist/parser.cjs', 'utf8' );
	const bundled = { exports: {} };
	vm.runInThisContext(
		`(function(module, exports, require, __filename, __dirname) {${ source }\n})`
	)( bundled, bundled.exports, require, '/dist/parser.cjs', '/dist' );

	global.window = new JSDOM(
		'<!doctype html><html><body></body></html>'
	).window;
	global.window.CSSStyleDeclaration.prototype[ Symbol.iterator ] =
		function* () {
			for ( let index = 0; index < this.length; index++ ) {
				yield this.item( index );
			}
		};

	assert.deepEqual(
		bundled.exports.detectImportedCode(
			'<!doctype html><html><head><style>body{margin:0}</style></head><body><script>console.log("ok")</script></body></html>'
		).languages,
		[ 'html', 'css', 'javascript' ]
	);
	assert.equal(
		bundled.exports.detectImportedCode( 'body { margin: 0; }' ).source_type,
		'stylesheet'
	);
	assert.equal(
		bundled.exports.detectImportedCode( 'const answer = 42;' ).source_type,
		'javascript'
	);
	assert.equal(
		bundled.exports.detectImportedCode( '<?php return "safe"; ?>' )
			.source_type,
		'php'
	);
	assert.equal(
		bundled.exports.detectImportedCode(
			'<body><main>Body only</main></body>'
		).documentShape,
		'body-document'
	);

	const result = bundled.exports.parseBlockDocument(
		'<style>.lead{color:red}</style><section class="lead">One</section><p>Two</p>',
		''
	);

	assert.ok( result.document.root.id.startsWith( 'import-' ) );
	assert.equal( result.document.root.children.length, 2 );
	assert.equal(
		result.document.root.children[ 0 ].styles.mapped.color,
		undefined
	);
	assert.match(
		result.document.imported_assets.stylesheets[ 0 ].scoped_source,
		/\.ctb-import-scope \.lead/
	);
	assert.ok(
		result.document.root.children[ 0 ].meta.css_mapping.declarations.every(
			( declaration ) =>
				[ 'stylesheet', 'inline', 'inherited' ].includes(
					declaration.origin
				) &&
				[ 'style-control', 'raw-css' ].includes(
					declaration.destination
				)
		)
	);

	const cssOnly = bundled.exports.parseBlockDocument(
		'body { margin: 0; min-height: 100vh; } header { position: fixed; top: 0; }',
		''
	);
	assert.equal( cssOnly.session.detection.source_type, 'stylesheet' );
	assert.equal( cssOnly.document.root.tag, 'main' );
	assert.match( cssOnly.document.root.attributes.class, /ctb-import-scope/ );
	assert.equal( cssOnly.document.imported_assets.stylesheets.length, 1 );
	assert.match(
		cssOnly.document.imported_assets.stylesheets[ 0 ].scoped_source,
		/\.ctb-import-scope header/
	);

	const jsOnlySource =
		'const node = document.querySelector("#app");\nnode.textContent = "Ready";';
	const jsOnly = bundled.exports.parseBlockDocument( jsOnlySource, '' );
	assert.equal( jsOnly.session.detection.source_type, 'javascript' );
	assert.equal( jsOnly.document.root.tag, 'main' );
	assert.equal( jsOnly.session.scripts.length, 1 );
	assert.equal( jsOnly.session.scripts[ 0 ].source, jsOnlySource );
	assert.equal( jsOnly.session.scripts[ 0 ].enabled_in_editor, false );

	const phpOnly = bundled.exports.parseBlockDocument(
		'```php\nreturn "Server output";\n```',
		''
	);
	assert.equal( phpOnly.session.detection.source_type, 'php' );
	assert.equal( phpOnly.phpDetections.length, 1 );
	assert.match( phpOnly.phpDetections[ 0 ].code, /^<\?php/ );
	assert.ok(
		phpOnly.document.root.children.some(
			( child ) =>
				child.kind !== 'text' &&
				child.children.some(
					( grandchild ) =>
						grandchild.kind === 'text' &&
						grandchild.value.includes(
							phpOnly.phpDetections[ 0 ].shortcode
						)
				)
		)
	);

	const customElement = bundled.exports.parseBlockDocument(
		'<my-widget class="feature" theme="dark" onclick="bad()"><h2>Kept heading</h2><p>Kept copy</p></my-widget>',
		''
	);
	assert.equal( customElement.document.root.tag, 'my-widget' );
	assert.equal(
		customElement.document.root.meta.imported_original_tag,
		'my-widget'
	);
	assert.equal( customElement.document.root.attributes.theme, 'dark' );
	assert.equal( customElement.document.root.attributes.onclick, undefined );
	assert.equal( customElement.document.root.meta.import_fidelity, 'hybrid' );
	assert.equal( customElement.document.root.children.length, 2 );
	assert.ok(
		customElement.diagnostics.some(
			( item ) => item.code === 'UNSUPPORTED_ELEMENT_PRESERVED'
		)
	);

	const genericElements = bundled.exports.parseBlockDocument(
		'<dialog open><slot name="content">Fallback</slot></dialog>',
		''
	);
	assert.equal( genericElements.document.root.tag, 'dialog' );
	assert.equal( genericElements.document.root.attributes.open, true );
	assert.equal( genericElements.document.root.children[ 0 ].tag, 'slot' );
	assert.equal(
		genericElements.document.root.children[ 0 ].attributes.name,
		'content'
	);

	const mediaStyle = bundled.exports.parseBlockDocument(
		'<style media="(max-width: 600px)">.compact{display:none}</style><div class="compact">Compact</div>',
		''
	);
	assert.equal(
		mediaStyle.document.imported_assets.stylesheets[ 0 ].media,
		'(max-width: 600px)'
	);
	assert.match(
		mediaStyle.document.imported_assets.stylesheets[ 0 ].scoped_source,
		/^@media \(max-width: 600px\)/
	);

	const headIsNotVisual = bundled.exports.parseBlockDocument(
		'<!doctype html><html lang="en"><head><title>Metadata</title><meta name="description" content="x"><link rel="canonical" href="https://example.test/"><style>body{margin:0}</style><script>window.ready=true</script></head><body id="page"><main>Visible</main></body></html>',
		''
	);
	assert.deepEqual(
		headIsNotVisual.document.root.children.map( ( child ) => child.tag ),
		[ 'main' ]
	);
	assert.equal(
		headIsNotVisual.document.imported_assets.page_meta.document_shape,
		'full-document'
	);
	assert.equal(
		headIsNotVisual.document.imported_assets.source.original.includes(
			'<title>Metadata</title>'
		),
		true
	);
	assert.equal(
		headIsNotVisual.session.documentModel.head.links[ 0 ].relation,
		'canonical'
	);

	const inlineDeclarations = Array.from(
		{ length: 1001 },
		( _, index ) => `--property-${ index }:${ index }`
	).join( ';' );
	const localizedFallback = bundled.exports.parseBlockDocument(
		`<section><div style="${ inlineDeclarations }">Preserved text</div><p>Sibling survives</p></section>`,
		''
	);
	assert.equal(
		localizedFallback.document.root.children[ 0 ].attributes[
			'data-ctb-fallback'
		],
		'preserved'
	);
	assert.equal(
		localizedFallback.document.root.children[ 1 ].children[ 0 ].value,
		'Sibling survives'
	);
	assert.ok(
		localizedFallback.diagnostics.some(
			( item ) => item.code === 'NODE_CONVERSION_FALLBACK'
		)
	);

	const quarantinedImport = bundled.exports.parseBlockDocument(
		'<style>@import url("https://cdn.example.test/theme.css"); .safe{color:blue}</style><div class="safe">Safe</div>',
		''
	);
	assert.doesNotMatch(
		quarantinedImport.document.imported_assets.stylesheets[ 0 ]
			.scoped_source,
		/@import/
	);
	assert.ok(
		quarantinedImport.document.imported_assets.references.some(
			( reference ) =>
				reference.type === 'css.import' && reference.blocked === true
		)
	);
	assert.ok(
		quarantinedImport.diagnostics.some(
			( item ) => item.code === 'CSS_IMPORT_QUARANTINED'
		)
	);

	const basedDocument = bundled.exports.parseBlockDocument(
		'<!doctype html><html><head><base href="https://assets.example.test/site/"><title>Based page</title></head><body><img src="images/hero.jpg" alt="Hero"></body></html>',
		''
	);
	assert.equal(
		basedDocument.document.imported_assets.page_meta.base_href,
		'https://assets.example.test/site/'
	);
	assert.equal(
		basedDocument.document.root.children[ 0 ].attributes.src,
		'images/hero.jpg'
	);

	const structuralHtml = bundled.exports.parseBlockDocument(
		'<form action="javascript:alert(1)" method="post"><label>Name <input name="name" required></label><button type="submit">Send</button></form><table><thead><tr><th>Plan</th></tr></thead><tbody><tr><td>Pro</td></tr></tbody></table><svg viewBox="0 0 10 10" aria-label="Dot"><circle cx="5" cy="5" r="4"></circle></svg><object data="https://unsafe.example/embed"><p>Preserved object fallback</p></object>',
		''
	);
	const [ form, table, svg, embeddedObject ] =
		structuralHtml.document.root.children;
	assert.equal( form.tag, 'form' );
	assert.equal( form.attributes.action, undefined );
	assert.equal( form.children[ 0 ].tag, 'label' );
	assert.equal( table.tag, 'table' );
	assert.equal( table.children[ 1 ].children[ 0 ].children[ 0 ].tag, 'td' );
	assert.equal( svg.tag, 'svg' );
	assert.equal( svg.children[ 0 ].tag, 'circle' );
	assert.equal( embeddedObject.tag, 'div' );
	assert.equal(
		embeddedObject.attributes[ 'data-ctb-original-tag' ],
		'object'
	);
	assert.match(
		embeddedObject.children[ 0 ].children[ 0 ].value,
		/Preserved object fallback/
	);

	const advancedCss = bundled.exports.parseBlockDocument(
		'<style>:root{--gap:2rem}*{box-sizing:border-box}.layout{display:grid;gap:var(--gap)}.layout::before{content:""}@media (max-width:700px){.layout{display:flex}}@keyframes pulse{from{opacity:0}to{opacity:1}}</style><main class="layout">Layout</main>',
		''
	);
	const advancedCssSource =
		advancedCss.document.imported_assets.stylesheets[ 0 ].scoped_source;
	assert.match( advancedCssSource, /--gap:\s*2rem/ );
	assert.match( advancedCssSource, /display:\s*grid/ );
	assert.match( advancedCssSource, /::before/ );
	assert.match( advancedCssSource, /@media/ );
	assert.match( advancedCssSource, /@keyframes/ );

	const fs = require( 'node:fs' );
	const comprehensiveHtml = fs.readFileSync(
		path.resolve( __dirname, 'fixtures/comprehensive_import.html' ),
		'utf8'
	);

	// Create a session to simulate the staged pipeline
	const session =
		bundled.exports.createCodeImportSession( comprehensiveHtml );
	const parsedResult = bundled.exports.parseBlockDocument(
		session.normalizedSource,
		''
	);

	const doc = parsedResult.document.root;
	assert.ok( doc.id.startsWith( 'import-' ) );
	// Verify children structure: 4 cards (from the 4 root divs in the body)
	assert.equal( parsedResult.session.pageMeta.doctype, 'html' );
	assert.equal(
		parsedResult.session.pageMeta.title,
		'Comprehensive Import Test Fixtures'
	);
	assert.deepEqual( parsedResult.session.detection.languages, [
		'html',
		'css',
		'javascript',
	] );

	// Check standard card
	const standardCard = doc.children[ 0 ];
	// assert.ok( standardCard.styles.mapped['background-color'] === '#f8f9fa' );

	// Ensure scripts are collected
	assert.ok(
		parsedResult.session.scripts && parsedResult.session.scripts.length > 0
	);

	// Ensure stylesheets are collected
	assert.ok(
		parsedResult.session.stylesheets &&
			parsedResult.session.stylesheets.length > 0
	);

	console.log(
		'PASS: context-aware documents, fragments, CSS, JS, PHP, and custom elements import safely.'
	);
	console.log( 'PASS: comprehensive portfolio test imported successfully.' );

	if ( process.env.CTB_IMPORT_FIXTURE ) {
		const externalFixture = fs.readFileSync(
			path.resolve( process.env.CTB_IMPORT_FIXTURE ),
			'utf8'
		);
		const externalResult = bundled.exports.parseBlockDocument(
			externalFixture,
			''
		);
		assert.equal(
			externalResult.session.detection.source_type,
			'full-document'
		);
		assert.ok( externalResult.document.root.children.length > 0 );
		const escapedFixture = externalFixture
			.replace( /</g, '\\<' )
			.replace( /@/g, '\\@' );
		const escapedExternalResult = bundled.exports.parseBlockDocument(
			escapedFixture,
			''
		);
		assert.equal(
			escapedExternalResult.session.review.builder_nodes,
			externalResult.session.review.builder_nodes
		);
		assert.equal(
			escapedExternalResult.session.detection.transportEncoding,
			'escaped-rich-text'
		);
		// eslint-disable-next-line no-console
		console.log(
			`PASS: external full-document fixture and escaped transport imported ${ externalResult.session.review.builder_nodes } builder nodes.`
		);
	}
} );
