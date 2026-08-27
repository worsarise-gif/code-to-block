import { runAccessibilityChecks } from '../src/accessibility.mjs';

function assert(condition, message) {
	if (!condition) {
		console.error(`❌ FAIL: ${message}`);
		process.exit(1);
	}
}

// 1. Missing Alt Text
const docAlt = {
	root: {
		id: 'r1',
		type: 'container',
		children: [
			{ id: 'img1', type: 'image', attributes: {} },
			{ id: 'img2', type: 'image', attributes: { alt: '' } },
			{ id: 'img3', type: 'image', attributes: { alt: '', 'aria-hidden': 'true' } },
			{ id: 'img4', type: 'image', attributes: { alt: 'A valid alt' } }
		]
	}
};
const altIssues = runAccessibilityChecks(docAlt).filter(i => i.type === 'alt');
assert(altIssues.length === 2, `Expected 2 alt issues, got ${altIssues.length}`);
assert(altIssues.some(i => i.block_id === 'img1'), 'img1 should flag');
assert(altIssues.some(i => i.block_id === 'img2'), 'img2 should flag');

// 2. Icon Label
const docIcon = {
	root: {
		id: 'r1',
		type: 'container',
		children: [
			// Button with text
			{ id: 'btn1', type: 'button', tag: 'button', children: [{ kind: 'text', value: 'Submit' }] },
			// Button with icon and text
			{ id: 'btn2', type: 'button', tag: 'button', children: [{ type: 'image', tag: 'svg' }, { kind: 'text', value: 'Submit' }] },
			// Button with icon, no text, no label
			{ id: 'btn3', type: 'button', tag: 'button', children: [{ type: 'image', tag: 'svg' }] },
			// Button with icon, no text, has label
			{ id: 'btn4', type: 'button', tag: 'button', attributes: { 'aria-label': 'Close' }, children: [{ type: 'image', tag: 'svg' }] },
			// Link with icon, no text, no label
			{ id: 'lnk1', type: 'button', tag: 'a', children: [{ type: 'image', tag: 'svg' }] }
		]
	}
};
const iconIssues = runAccessibilityChecks(docIcon).filter(i => i.type === 'label');
assert(iconIssues.length === 2, `Expected 2 icon label issues, got ${iconIssues.length}`);
assert(iconIssues.some(i => i.block_id === 'btn3'), 'btn3 should flag');
assert(iconIssues.some(i => i.block_id === 'lnk1'), 'lnk1 should flag');

console.log('✅ Accessibility check tests passed!');
