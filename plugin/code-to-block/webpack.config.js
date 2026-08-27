const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,
	entry: {
		index: path.resolve( process.cwd(), 'src', 'index.js' ),
		'content-mode': path.resolve( process.cwd(), 'src', 'content-mode.js' ),
		'frontend-gsap': path.resolve( process.cwd(), 'src', 'frontend-gsap.js' ),
	},
};
