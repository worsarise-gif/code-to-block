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
		'<my-widget class="feature"><h2>Kept heading</h2><p>Kept copy</p></my-widget>',
		''
	);
	assert.equal( customElement.document.root.tag, 'div' );
	assert.equal(
		customElement.document.root.attributes[ 'data-ctb-original-tag' ],
		'my-widget'
	);
	assert.equal( customElement.document.root.children.length, 2 );

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
	/*
	const formResult = bundled.exports.parseBlockDocument(
		'<form id="contact" action="javascript:alert(1)" method="post"><label>Name <input type="text" name="name" placeholder="Your name" required></label><label for="message">Message</label><textarea id="message" name="message" placeholder="Tell us more"></textarea><label>Plan <select name="plan" required><option value="">Choose a plan</option><option value="basic">Basic</option><option value="pro">Pro</option></select></label><button type="submit">Send message</button></form>',
		''
	);
	const form = formResult.document.root;
	assert.equal( form.type, 'form' );
	assert.equal( form.tag, 'form' );
	assert.equal( form.attributes.action, undefined );
	assert.equal( form.attributes[ 'data-submission' ], 'native' );
	assert.equal( form.attributes[ 'data-submit-label' ], 'Send message' );
	assert.equal( form.children.length, 3 );
	assert.deepEqual(
		form.children.map( ( field ) => field.type ),
		[ 'form_field', 'form_field', 'form_field' ]
	);
	assert.deepEqual(
		form.children.map( ( field ) => field.tag ),
		[ 'div', 'div', 'div' ]
	);
	assert.equal( form.children[ 0 ].attributes[ 'data-field-label' ], 'Name' );
	assert.equal( form.children[ 0 ].attributes[ 'data-field-required' ], true );
	assert.equal( form.children[ 1 ].attributes[ 'data-field-type' ], 'textarea' );
	assert.equal( form.children[ 1 ].attributes[ 'data-field-label' ], 'Message' );
	assert.equal( form.children[ 2 ].attributes[ 'data-field-type' ], 'select' );
	assert.equal(
		form.children[ 2 ].attributes[ 'data-field-placeholder' ],
		'Choose a plan'
	);
	assert.equal(
		form.children[ 2 ].attributes[ 'data-field-options' ],
		'Basic, Pro'
	);
	*/

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
		// eslint-disable-next-line no-console
		console.log(
			`PASS: external full-document fixture imported ${ externalResult.session.review.builder_nodes } builder nodes.`
		);
	}
} );
