import assert from 'node:assert/strict';

import {
	createStructuredAction,
	createUnverifiedAction,
	detectScriptAction,
} from '../src/script-actions.mjs';

const hiddenToggle = detectScriptAction( `
document.getElementById('toggle').addEventListener('click', () => {
  document.getElementById('panel').toggleAttribute('hidden');
});` );
assert.equal( hiddenToggle.sourceHtmlId, 'toggle' );
assert.equal( hiddenToggle.targetHtmlId, 'panel' );
assert.equal( hiddenToggle.behavior, 'toggle-visibility' );

const classToggle = detectScriptAction( `
document.querySelector("#menu-button").addEventListener("click", () =>
  document.querySelector("#menu").classList.toggle("is-open")
);` );
assert.equal( classToggle.behavior, 'toggle-class' );
assert.equal( classToggle.className, 'is-open' );

const animate = detectScriptAction( `
document.getElementById('play').addEventListener('click', () => {
  document.getElementById('card').classList.add('animate-in');
});` );
assert.equal( animate.behavior, 'add-class' );

const hide = detectScriptAction( `
document.getElementById('close').addEventListener('click', () => {
  document.getElementById('notice').hidden = true;
});` );
assert.equal( hide.behavior, 'hide' );

assert.equal(
	detectScriptAction( 'fetch("/api").then(runEverything);' ),
	null
);
assert.equal(
	detectScriptAction( `
document.getElementById('one').addEventListener('click', run);
document.getElementById('two').addEventListener('click', run);` ),
	null
);

assert.deepEqual( createStructuredAction( classToggle, 'nav-4' ), {
	trigger: 'click',
	behavior: 'toggle-class',
	params: { target_block_id: 'nav-4', class_name: 'is-open' },
} );
const unverified = createUnverifiedAction( '<\/script><script>alert(1)<\/script>' );
assert.equal( unverified.behavior, 'unverified-script' );
assert.match( unverified.params.description, /never executed/i );

console.log( 'PASS: 12 script action assertions.' );
