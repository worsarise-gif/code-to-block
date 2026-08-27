/**
 * Maps source elements to editor behavior without discarding their HTML tag.
 *
 * @param {Element} element Source DOM element.
 * @return {'container'|'text'|'image'|'button'} Block type.
 */
export function blockTypeFor( element ) {
	if ( element.tagName === 'IMG' ) {
		return 'image';
	}
	if ( element.tagName === 'BUTTON' ) {
		return 'button';
	}
	if ( element.tagName === 'A' ) {
		const role = element.getAttribute( 'role' );
		const className = element.getAttribute( 'class' ) || '';
		if (
			role === 'button' ||
			/(?:^|[\s_-])(?:btn|button|cta)(?:$|[\s_-])/i.test( className )
		) {
			return 'button';
		}
	}
	if ( element.children.length === 0 ) {
		return 'text';
	}

	return 'container';
}
