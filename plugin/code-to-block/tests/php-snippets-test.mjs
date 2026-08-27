import assert from 'node:assert/strict';

import { extractPhpSnippets } from '../src/php-snippets.mjs';

const orderedSuffix = ( index ) => String( index );

let assertions = 0;
function check( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

const none = extractPhpSnippets(
	'<p>No PHP</p>',
	'ctb_php_20',
	orderedSuffix
);
check( none.html, '<p>No PHP</p>', 'HTML without PHP must remain unchanged.' );
check( none.phpDetections, [], 'HTML without PHP must produce no detections.' );

const safeSource = '<?php return esc_html( $atts["message"] ); ?>';
const one = extractPhpSnippets(
	`<div>Before ${ safeSource } after</div>`,
	'ctb_php_20',
	orderedSuffix
);
check(
	one.html,
	'<div>Before [ctb_php_20_1] after</div>',
	'PHP content must become an inert shortcode placeholder.'
);
check( one.phpDetections.length, 1, 'One PHP block must produce one review.' );
check( one.phpDetections[ 0 ].code, safeSource, 'The complete source must remain visible.' );
check( one.phpDetections[ 0 ].tag, 'ctb_php_20_1', 'The proposed tag must be deterministic for the page.' );
check( one.phpDetections[ 0 ].status, 'pending', 'Extracted source must begin unreviewed.' );

const multiple = extractPhpSnippets(
	'<main><?php echo "one"; ?><p>Middle</p><?php return "two"; ?></main>',
	'ctb_php_9',
	orderedSuffix
);
check( multiple.phpDetections.length, 2, 'Every PHP block must be reviewed separately.' );
check(
	multiple.html,
	'<main>[ctb_php_9_1]<p>Middle</p>[ctb_php_9_2]</main>',
	'Multiple placeholders must retain source order.'
);

const quotedClose = extractPhpSnippets(
	'<p><?php return "literal ?> text"; ?></p>',
	'ctb_php_5',
	orderedSuffix
);
check(
	quotedClose.phpDetections[ 0 ].code,
	'<?php return "literal ?> text"; ?>',
	'A closing-tag sequence inside a quoted string must not truncate the source.'
);

const xml = extractPhpSnippets(
	'<?xml version="1.0"?><article>Content</article>',
	'ctb_php_1',
	orderedSuffix
);
check( xml.phpDetections.length, 0, 'XML declarations are not PHP blocks.' );
check( xml.html, '<?xml version="1.0"?><article>Content</article>', 'XML source must remain unchanged.' );

assert.throws(
	() =>
		extractPhpSnippets(
			'<p><?php return "open";</p>',
			'ctb_php_2',
			orderedSuffix
		),
	/closing \?>/,
	'Unclosed PHP must fail before DOM parsing.'
);
assertions += 1;
assert.throws(
	() =>
		extractPhpSnippets(
			'<div class="<?php echo $class; ?>">Unsafe context</div>',
			'ctb_php_2',
			orderedSuffix
		),
	/inside an HTML tag or attribute/,
	'PHP in an attribute context must never become a shortcode.'
);
assertions += 1;

assert.throws(
	() =>
		extractPhpSnippets(
			'<div title="prefix > <?php echo $title; ?>">Unsafe context</div>',
			'ctb_php_2',
			orderedSuffix
		),
	/inside an HTML tag or attribute/,
	'A greater-than sign inside a quoted attribute must not bypass context checks.'
);
assertions += 1;

const firstRandom = extractPhpSnippets(
	'<p><?php return "one"; ?></p>',
	'ctb_php_20'
);
const secondRandom = extractPhpSnippets(
	'<p><?php return "two"; ?></p>',
	'ctb_php_20'
);
assert.notEqual(
	firstRandom.phpDetections[ 0 ].tag,
	secondRandom.phpDetections[ 0 ].tag,
	'A reimported snippet must not inherit a stale confirmed tag.'
);
assertions += 1;

console.log( `PASS: ${ assertions } PHP extraction assertions.` );
