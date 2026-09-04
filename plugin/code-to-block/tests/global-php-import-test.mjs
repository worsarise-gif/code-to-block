import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { detectImportedSource } from '../src/importer/detection/detect-imported-source.mjs';
import { extractPhpSnippets } from '../src/php-snippets.mjs';
import { extractWordPressTemplateMetadata } from '../src/importer/normalization/normalize-imported-source.mjs';
import { parseBlockDocument } from '../src/parser.js';

// Setup DOM runtime for headless Node testing
const dom = new JSDOM( '<!doctype html><html><body></body></html>' );
globalThis.window = dom.window;
globalThis.window.CSSStyleDeclaration.prototype[ Symbol.iterator ] =
	function* () {
		for ( let index = 0; index < this.length; index++ ) {
			yield this.item( index );
		}
	};

let assertions = 0;
function check( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

// 1. User Exact Format: Line-comment terminated by ?>
const userExactSource = '<?php //codes include html, css, js ?>';
const userExactExtracted = extractPhpSnippets( userExactSource, 'ctb_test' );
check(
	userExactExtracted.phpDetections.length,
	1,
	'Line comment terminated by ?> must produce 1 PHP detection.'
);
check(
	userExactExtracted.phpDetections[ 0 ].code,
	userExactSource,
	'User exact snippet code must be preserved intact.'
);
const userExactParsed = parseBlockDocument( userExactSource, '' );
check(
	userExactParsed.phpDetections.length,
	1,
	'User exact format must parse successfully through parseBlockDocument.'
);
assert.ok(
	userExactParsed.document?.root,
	'User exact format must produce a valid document root.'
);
assertions += 1;

// 2. Unclosed PHP block at EOF (PSR-12 standard) in tolerant mode
const unclosedSource = '<?php\necho "Hello from PSR-12";';
const unclosedExtracted = extractPhpSnippets(
	unclosedSource,
	'ctb_test',
	undefined,
	{ tolerant: true }
);
check(
	unclosedExtracted.phpDetections.length,
	1,
	'Unclosed PHP at EOF must be accepted in tolerant mode.'
);
check(
	unclosedExtracted.phpDetections[ 0 ].code,
	unclosedSource,
	'Unclosed code up to EOF must be preserved.'
);

// 3. PHP in HTML Attributes
const attrSource =
	'<div class="<?php echo $custom_class; ?>" id="<?php the_ID(); ?>">Content</div>';
const attrParsed = parseBlockDocument( attrSource, '' );
check(
	attrParsed.phpDetections.length,
	2,
	'Two attribute-level PHP expressions must produce 2 detections.'
);
check(
	attrParsed.phpDetections[ 0 ].context,
	'attribute',
	'Attribute PHP must be flagged with attribute context.'
);
assert.ok(
	attrParsed.document?.root,
	'Attribute PHP must not crash DOM parsing.'
);
assertions += 1;

// 4. PHP Template with Mixed HTML, Style, and Script
const templateSource = `<?php
// PHP template setup
$theme_accent = '#4f46e5';
?>
<style>
.landing-hero { background: #0f172a; color: #ffffff; padding: 40px; }
.landing-hero h1 { font-size: 32px; font-weight: bold; }
</style>
<div class="landing-hero">
  <h1>Welcome to the Page</h1>
  <p>Live interactive builder content</p>
</div>
<script>
console.log("Interactive script ready");
</script>
<?php
// Trailing PHP footer without closing tag
`;

const templateDetection = detectImportedSource( templateSource );
check(
	templateDetection.containsPhp,
	true,
	'Template must be detected as containing PHP.'
);
check(
	templateDetection.containsHtml,
	true,
	'Template must be detected as containing HTML.'
);
check(
	templateDetection.containsCss,
	true,
	'Template must be detected as containing CSS.'
);
check(
	templateDetection.containsJavaScript,
	true,
	'Template must be detected as containing JS.'
);
check(
	templateDetection.source_type,
	'php-template',
	'Source type must be classified as php-template.'
);

const templateParsed = parseBlockDocument( templateSource, '' );
assert.ok(
	templateParsed.document?.root,
	'Template must produce a valid document root.'
);
check(
	templateParsed.session.stylesheets.length >= 1,
	true,
	'Embedded style must be extracted as a stylesheet.'
);
check(
	templateParsed.session.scripts.length >= 1,
	true,
	'Embedded script must be extracted into scripts.'
);
assertions += 2;

// 5. Pure PHP with Echo / Heredoc Markup
const echoSource = `<?php
// Pure PHP generating layout
echo '<style>.box { color: #ff0000; }</style>';
echo '<div class="box"><h2>Dynamic Heading</h2><p>Dynamic description</p></div>';
echo '<script>console.log("script");</script>';
?>`;

const echoParsed = parseBlockDocument( echoSource, '' );
check(
	echoParsed.phpDetections.length,
	1,
	'Echo PHP file must have 1 server detection for the PHP script.'
);
assert.ok(
	echoParsed.session.review.builder_nodes >= 1,
	'Echoed markup must be extracted into visual builder nodes.'
);
check(
	echoParsed.session.stylesheets.length >= 1,
	true,
	'Echoed style must be converted to a stylesheet.'
);
check(
	echoParsed.session.scripts.length >= 1,
	true,
	'Echoed script must be converted to a script.'
);
assertions += 2;

// 6. WordPress Template Header & Chrome
const wpThemeTemplate = `<?php
/**
 * Template Name: Full Width Landing
 */
get_header();
?>
<section class="site-content">
  <h2>Main Section</h2>
  <p>Section paragraph</p>
</section>
<?php
get_footer();
`;

const wpMeta = extractWordPressTemplateMetadata( wpThemeTemplate );
check(
	wpMeta.templateName,
	'Full Width Landing',
	'Template Name must be extracted from WordPress docblock.'
);
check( wpMeta.hasHeader, true, 'get_header() must be recognized.' );
check( wpMeta.hasFooter, true, 'get_footer() must be recognized.' );

const wpParsed = parseBlockDocument( wpThemeTemplate, '' );
check(
	wpParsed.document.name,
	'Full Width Landing',
	'Document name must be auto-assigned from Template Name.'
);
check(
	wpParsed.session.pageMeta.template_name,
	'Full Width Landing',
	'pageMeta must store template_name.'
);
check(
	wpParsed.session.pageMeta.is_wordpress_template,
	true,
	'pageMeta must flag is_wordpress_template.'
);

// 7. Literal PHP template data must become real builder content, not tokens.
const projectedTemplateSource = `<?php
$owner = [ 'first_name' => 'Alex' ];
$projects = [
	[ 'id' => 1, 'title' => 'Lumina Studio' ],
	[ 'id' => 2, 'title' => 'Aether' ],
];
?>
<!doctype html>
<html>
<body>
	<header><?= htmlspecialchars($owner['first_name']) ?></header>
	<main>
	<?php foreach ($projects as $project): ?>
		<article data-project="<?= $project['id'] ?>">
			<?= htmlspecialchars($project['title']) ?>
		</article>
	<?php endforeach; ?>
	</main>
</body>
</html>`;
const projectedTemplate = parseBlockDocument(
	projectedTemplateSource,
	'',
	'ctb_php_31'
);
const projectedTree = JSON.stringify( projectedTemplate.document.root );
check(
	projectedTree.includes( '[ctb_php_' ),
	false,
	'Projected PHP template data must not expose internal shortcode tokens in the block tree.'
);
check(
	projectedTree.includes( 'Alex' ) &&
		projectedTree.includes( 'Lumina Studio' ) &&
		projectedTree.includes( 'Aether' ),
	true,
	'Literal PHP values and foreach items must reach the integrated block parser.'
);
check(
	projectedTemplate.session.security.restricted_server_code,
	0,
	'Statically projected PHP must not be mislabeled as executable server code.'
);

console.log( `PASS: ${ assertions } global code and PHP import assertions.` );
