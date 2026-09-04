const path = require( 'node:path' );
const { defineConfig, devices } = require( '@playwright/test' );

process.env.WP_BASE_URL ??= 'http://localhost:8888';
process.env.WP_USERNAME ??= 'admin';
process.env.WP_PASSWORD ??= 'password';
process.env.WP_ARTIFACTS_PATH ??= path.join(
	__dirname,
	'tests',
	'e2e',
	'.artifacts'
);
process.env.STORAGE_STATE_PATH ??= path.join(
	process.env.WP_ARTIFACTS_PATH,
	'storage-states',
	'admin.json'
);

module.exports = defineConfig( {
	testDir: path.join( __dirname, 'tests', 'e2e' ),
	outputDir: path.join( process.env.WP_ARTIFACTS_PATH, 'test-results' ),
	globalSetup: require.resolve(
		'@wordpress/scripts/config/playwright/global-setup.js'
	),
	reporter: process.env.CI ? [ [ 'github' ] ] : [ [ 'list' ] ],
	forbidOnly: Boolean( process.env.CI ),
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	timeout:
		Number.parseInt( process.env.CTB_E2E_TIMEOUT || '', 10 ) || 120_000,
	use: {
		baseURL: process.env.WP_BASE_URL,
		storageState: process.env.STORAGE_STATE_PATH,
		channel: process.env.CTB_E2E_BROWSER_CHANNEL || 'chrome',
		headless: process.env.CTB_E2E_HEADLESS !== '0',
		viewport: { width: 1440, height: 1000 },
		locale: 'en-US',
		ignoreHTTPSErrors: true,
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: process.env.CI ? 'retain-on-failure' : 'off',
		contextOptions: {
			reducedMotion: 'reduce',
			strictSelectors: true,
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices[ 'Desktop Chrome' ] },
		},
	],
} );
