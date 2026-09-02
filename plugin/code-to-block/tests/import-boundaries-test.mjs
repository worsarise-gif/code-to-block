import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
	path.dirname( fileURLToPath( import.meta.url ) ),
	'..'
);
const elementsRoot = path.join( projectRoot, 'src', 'elements' );

function sourceFiles( directory ) {
	return readdirSync( directory, { withFileTypes: true } ).flatMap( ( entry ) => {
		const entryPath = path.join( directory, entry.name );
		if ( entry.isDirectory() ) {
			return sourceFiles( entryPath );
		}
		return /\.(?:js|mjs)$/.test( entry.name ) ? [ entryPath ] : [];
	} );
}

function importedModules( source ) {
	const modules = [];
	const pattern =
		/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
	let match;
	while ( ( match = pattern.exec( source ) ) ) {
		modules.push( match[ 1 ] || match[ 2 ] );
	}
	return modules;
}

function isForbiddenElementDependency( moduleId ) {
	if (
		moduleId === 'react' ||
		moduleId.startsWith( 'react/' ) ||
		moduleId === '@wordpress/element' ||
		moduleId === 'zustand' ||
		moduleId.startsWith( 'zustand/' )
	) {
		return true;
	}

	const normalized = moduleId.replaceAll( '\\', '/' );
	return (
		normalized.startsWith( '.' ) &&
		/(?:^|\/)(?:store(?:\/|\.|$)|index\.js$)/.test( normalized )
	);
}

const files = sourceFiles( elementsRoot );
assert.ok( files.length > 0, 'element boundary scan finds source files' );

let assertions = 1;
for ( const file of files ) {
	const relativePath = path.relative( projectRoot, file ).replaceAll( '\\', '/' );
	for ( const moduleId of importedModules( readFileSync( file, 'utf8' ) ) ) {
		assert.equal(
			isForbiddenElementDependency( moduleId ),
			false,
			`${ relativePath } cannot import ${ moduleId }`
		);
		assertions += 1;
	}
}

console.log( `PASS: ${ assertions } element import-boundary assertions.` );
