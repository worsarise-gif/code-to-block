import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registryManifest, validateElementRegistry } from '../src/elements/registry.mjs';

const scriptDirectory = dirname( fileURLToPath( import.meta.url ) );
const outputPath = resolve( scriptDirectory, '../includes/generated/control-registry.json' );
const errors = validateElementRegistry();
if ( errors.length ) {
	throw new Error( errors.join( '\n' ) );
}
await mkdir( dirname( outputPath ), { recursive: true } );
await writeFile( outputPath, `${ JSON.stringify( registryManifest(), null, 2 ) }\n`, 'utf8' );
console.log( `Generated ${ outputPath }.` );
