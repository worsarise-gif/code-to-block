const path = require( 'node:path' );
const vm = require( 'node:vm' );
const fs = require( 'node:fs' );

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
	if ( error ) throw error;
	if ( stats.hasErrors() ) throw new Error( stats.toString( { errors: true } ) );

	const source = memoryFs.readFileSync( '/dist/parser.cjs', 'utf8' );
	const bundled = { exports: {} };
	vm.runInThisContext(
		`(function(module, exports, require, __filename, __dirname) {${ source }\n})`
	)( bundled, bundled.exports, require, '/dist/parser.cjs', '/dist' );

	global.window = new JSDOM(
		'<!doctype html><html><body></body></html>'
	).window;
	global.window.CSSStyleDeclaration.prototype[ Symbol.iterator ] = function* () {
		for ( let index = 0; index < this.length; index++ ) {
			yield this.item( index );
		}
	};
    
	const html = fs.readFileSync( path.resolve( __dirname, '../../../test-input.html' ), 'utf-8' );
	const result = bundled.exports.parseBlockDocument( html, '' );
	
	console.log('Warnings:', JSON.stringify(result.warnings, null, 2));
} );
