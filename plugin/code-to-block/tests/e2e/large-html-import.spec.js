const { readFile } = require( 'node:fs/promises' );
const path = require( 'node:path' );
const {
	test: base,
	expect,
} = require( '@wordpress/e2e-test-utils-playwright' );

const getEmptyDocument = async () => {
	const { EMPTY_DOCUMENT } = await import(
		'../../src/store/editor-store.mjs'
	);
	return structuredClone( EMPTY_DOCUMENT );
};

const test = base.extend( {
	ctbPage: async ( { requestUtils }, use ) => {
		const page = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/ctb-pages',
			data: {
				title: 'Code to Block Large Import E2E ' + Date.now(),
				status: 'draft',
			},
		} );

		try {
			await requestUtils.rest( {
				method: 'POST',
				path: '/code-to-block/v1/pages/' + page.id + '/block-tree',
				data: { document: await getEmptyDocument() },
			} );
			// Playwright fixtures use this callback; it is not a React hook.
			// eslint-disable-next-line react-hooks/rules-of-hooks
			await use( page );
		} finally {
			await requestUtils.rest( {
				method: 'DELETE',
				path: '/wp/v2/ctb-pages/' + page.id + '?force=true',
			} );
		}
	},
} );

test( 'imports large html file through save and preview', async ( {
	page,
	ctbPage,
} ) => {
	const htmlContent = await readFile(
		path.join( __dirname, '../../../../test-input.html' ),
		'utf8'
	);

	await page.goto(
		'/wp-admin/admin.php?page=code-to-block-dedicated&post=' + ctbPage.id
	);
	await expect( page.locator( 'span[title="Loaded."]' ) ).toHaveCount( 1 );

	await page
		.locator( 'header[data-purpose="top-nav"] > div:first-child > button' )
		.click();
	await page.getByRole( 'button', { name: 'Import code' } ).click();
	const textarea = page.getByRole( 'textbox', { name: 'Code to import' } );
	await textarea.waitFor( { state: 'visible' } );
	await textarea.evaluate( ( element, text ) => {
		const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
			window.HTMLTextAreaElement.prototype,
			'value'
		).set;
		nativeInputValueSetter.call( element, text );
		element.dispatchEvent( new Event( 'input', { bubbles: true } ) );
	}, htmlContent );
	await page
		.getByRole( 'button', { name: 'Apply HTML & Display Full Screen' } )
		.click();

	const canvas = page
		.locator( 'iframe[title="Isolated builder canvas"]' )
		.contentFrame();
	await expect( canvas.locator( 'body' ) ).toContainText( 'Alex Morgan' );
	await expect( canvas.locator( '.project-card' ) ).toHaveCount( 6 );
	await expect( canvas.locator( 'body' ) ).toContainText(
		'Creative Agency Website'
	);

	const saveResponsePromise = page.waitForResponse(
		( response ) =>
			response.request().method() === 'POST' &&
			response.url().includes( `/pages/${ ctbPage.id }/block-tree` )
	);
	await page.getByRole( 'button', { name: 'Publish options' } ).click();
	await page.getByRole( 'button', { name: 'Save Draft' } ).click();
	const saveResponse = await saveResponsePromise;
	expect( saveResponse.ok() ).toBe( true );

	await page.reload();
	await expect( page.locator( 'span[title="Loaded."]' ) ).toHaveCount( 1 );
	const reloadedCanvas = page
		.locator( 'iframe[title="Isolated builder canvas"]' )
		.contentFrame();
	await expect( reloadedCanvas.locator( 'body' ) ).toContainText(
		'Alex Morgan'
	);
	await expect( reloadedCanvas.locator( '.project-card' ) ).toHaveCount( 6 );

	const previewPromise = page.waitForEvent( 'popup' );
	await page.getByRole( 'button', { name: /Preview Changes:/ } ).click();
	const preview = await previewPromise;
	await preview.waitForURL( /[?&]ctb-preview=/, {
		waitUntil: 'domcontentloaded',
	} );
	await expect( preview.locator( 'body' ) ).toContainText( 'Alex Morgan' );
	await expect( preview.locator( '.project-card' ) ).toHaveCount( 6 );
	await expect( preview.locator( 'body' ) ).toContainText(
		'Creative Agency Website'
	);
	await preview.close();
} );
