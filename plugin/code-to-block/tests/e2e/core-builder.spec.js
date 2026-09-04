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

const getFormFieldDocument = async () => {
	const { migrateDocumentToV3 } = await import(
		'../../src/migrations/adapter.mjs'
	);
	const { document } = migrateDocumentToV3( await getEmptyDocument() );
	const { createElementBlock } = await import(
		'../../src/elements/registry.mjs'
	);
	const form = createElementBlock( 'form', 'e2e-form' );
	const field = createElementBlock( 'form-field', 'e2e-field' );

	field.props = {
		...field.props,
		fieldType: 'email',
		label: 'Email address',
		name: 'email',
		placeholder: 'you@example.com',
		help: 'We will only use this for replies.',
		required: true,
	};
	form.children = [ field ];
	document.root.children = [ form ];
	return document;
};

const test = base.extend( {
	ctbPage: async ( { requestUtils }, use ) => {
		const page = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/ctb-pages',
			data: {
				title: 'Code to Block E2E ' + Date.now(),
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

const PHP_PORTFOLIO_SOURCE = `<?php
$owner = [ 'first_name' => 'Alex', 'last_name' => 'Morgan' ];
$projects = [
	[ 'id' => 1, 'title' => 'Lumina Studio' ],
	[ 'id' => 2, 'title' => 'Aether' ],
	[ 'id' => 3, 'title' => 'Northstar' ],
	[ 'id' => 4, 'title' => 'Field Notes' ],
	[ 'id' => 5, 'title' => 'Common Ground' ],
	[ 'id' => 6, 'title' => 'Afterlight' ],
];
?>
<!doctype html>
<html>
<head><title><?= htmlspecialchars($owner['first_name'] . ' ' . $owner['last_name']) ?> - Creative Developer</title></head>
<body>
	<header class="portfolio-brand"><?= htmlspecialchars($owner['first_name']) ?></header>
	<main>
	<?php foreach ($projects as $project): ?>
		<article class="project-card" data-project-id="<?= $project['id'] ?>">
			<h2><?= htmlspecialchars($project['title']) ?></h2>
		</article>
	<?php endforeach; ?>
	</main>
</body>
</html>`;

test( 'opens the real editor and adds the core element set', async ( {
	page,
	ctbPage,
} ) => {
	await page.goto(
		'/wp-admin/admin.php?page=code-to-block-dedicated&post=' + ctbPage.id
	);

	await expect(
		page.getByRole( 'region', { name: 'Code to Block visual editor' } )
	).toBeVisible();
	await expect(
		page.getByRole( 'complementary', { name: 'Add elements' } )
	).toBeVisible();
	await expect( page.locator( 'span[title="Loaded."]' ) ).toHaveCount( 1 );

	const canvas = page
		.locator( 'iframe[title="Isolated builder canvas"]' )
		.contentFrame();
	await expect( canvas.locator( '[data-block-id]' ) ).toHaveCount( 1 );

	for ( const elementName of [
		'Container',
		'Heading',
		'Paragraph / Text',
		'Image',
		'Button',
	] ) {
		await page
			.getByRole( 'button', { name: elementName, exact: true } )
			.click();
	}

	await expect( canvas.locator( '[data-block-id]' ) ).toHaveCount( 6 );
	await expect(
		page.getByRole( 'button', { name: 'Undo', exact: true } )
	).toBeEnabled();
} );

test( 'imports projected PHP portfolio content through save and preview', async ( {
	page,
	ctbPage,
} ) => {
	await page.goto(
		'/wp-admin/admin.php?page=code-to-block-dedicated&post=' + ctbPage.id
	);
	await expect( page.locator( 'span[title="Loaded."]' ) ).toHaveCount( 1 );

	await page
		.locator( 'header[data-purpose="top-nav"] > div:first-child > button' )
		.click();
	await page.getByRole( 'button', { name: 'Import code' } ).click();
	await page
		.getByRole( 'textbox', { name: 'Code to import' } )
		.fill( PHP_PORTFOLIO_SOURCE );
	await page
		.getByRole( 'button', { name: 'Apply HTML & Display Full Screen' } )
		.click();

	const canvas = page
		.locator( 'iframe[title="Isolated builder canvas"]' )
		.contentFrame();
	await expect( canvas.locator( 'body' ) ).toContainText( 'Alex' );
	await expect( canvas.locator( 'body' ) ).toContainText( 'Lumina Studio' );
	await expect( canvas.locator( '.project-card' ) ).toHaveCount( 6 );
	await expect( canvas.locator( 'body' ) ).not.toContainText( '[ctb_php_' );

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
	await expect( reloadedCanvas.locator( '.project-card' ) ).toHaveCount( 6 );
	await expect( reloadedCanvas.locator( 'body' ) ).not.toContainText(
		'[ctb_php_'
	);

	const previewPromise = page.waitForEvent( 'popup' );
	await page.getByRole( 'button', { name: /Preview Changes:/ } ).click();
	const preview = await previewPromise;
	await preview.waitForLoadState( 'domcontentloaded' );
	await expect( preview.locator( '.project-card' ) ).toHaveCount( 6 );
	await expect( preview.locator( 'body' ) ).toContainText( 'Afterlight' );
	await expect( preview.locator( 'body' ) ).not.toContainText( '[ctb_php_' );
	await preview.close();
} );

test( 'styles a Form Field placeholder focus state through the inspector', async ( {
	page,
	requestUtils,
	ctbPage,
} ) => {
	await requestUtils.rest( {
		method: 'POST',
		path: '/code-to-block/v1/pages/' + ctbPage.id + '/block-tree',
		data: { document: await getFormFieldDocument() },
	} );
	await page.goto(
		'/wp-admin/admin.php?page=code-to-block-dedicated&post=' + ctbPage.id
	);
	await expect( page.locator( 'span[title="Loaded."]' ) ).toHaveCount( 1 );

	const canvas = page
		.locator( 'iframe[title="Isolated builder canvas"]' )
		.contentFrame();
	const field = canvas.locator( '[data-block-id="form-field-e2e-field"]' );
	await expect( field.locator( '[data-ctb-part="row"]' ) ).toHaveCount( 1 );
	await expect( field.locator( '[data-ctb-part="label"]' ) ).toContainText(
		'Email address'
	);
	await expect(
		field.locator( '[data-ctb-part="requiredMark"]' )
	).toHaveText( '*' );
	await expect(
		field.locator( '[data-ctb-part="control"]' )
	).toHaveAttribute( 'placeholder', 'you@example.com' );
	await field.click();

	await page.getByRole( 'tab', { name: 'Style', exact: true } ).click();
	await page.locator( '#ctb-style-target' ).selectOption( 'placeholder' );
	await page.locator( '#ctb-style-state' ).selectOption( 'focusVisible' );
	await page.locator( '#ctb-desktop-color' ).fill( '#445566' );
	await page
		.getByRole( 'button', { name: 'Apply desktop styles', exact: true } )
		.click();

	const previewStyles = canvas.locator(
		'style[data-ctb-preview-styles="1"]'
	);
	await expect( previewStyles ).toContainText(
		'[data-ctb-part="control"]:focus-visible::placeholder{color:#445566;}'
	);
	await expect( previewStyles ).not.toContainText(
		'::placeholder:focus-visible'
	);

	const saveResponsePromise = page.waitForResponse(
		( response ) =>
			response.request().method() === 'POST' &&
			response.url().includes( `/pages/${ ctbPage.id }/block-tree` )
	);
	await page.getByRole( 'button', { name: 'Publish options' } ).click();
	await page.getByRole( 'button', { name: 'Save Draft' } ).click();
	expect( ( await saveResponsePromise ).ok() ).toBe( true );

	await page.reload();
	await expect( page.locator( 'span[title="Loaded."]' ) ).toHaveCount( 1 );
	const reloadedCanvas = page
		.locator( 'iframe[title="Isolated builder canvas"]' )
		.contentFrame();
	await expect(
		reloadedCanvas.locator( 'style[data-ctb-preview-styles="1"]' )
	).toContainText(
		'[data-ctb-part="control"]:focus-visible::placeholder{color:#445566;}'
	);
} );
