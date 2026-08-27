const ALLOWED_TAGS = new Set( [
	'A',
	'B',
	'BR',
	'CODE',
	'EM',
	'I',
	'S',
	'STRONG',
	'U',
] );

function safeHref( value ) {
	const compact = value.trim().replace( /[\u0000-\u0020\u007f]+/g, '' );
	const scheme = compact.match( /^([a-z][a-z0-9+.-]*):/i );
	return (
		! scheme ||
		[ 'http', 'https', 'mailto', 'tel' ].includes(
			scheme[ 1 ].toLowerCase()
		)
	);
}

export function sanitizeRichTextHtml( value ) {
	if ( typeof window === 'undefined' || ! window.document ) {
		return '';
	}
	const template = window.document.createElement( 'template' );
	template.innerHTML = String( value || '' );

	for ( const node of [
		...template.content.querySelectorAll( '*' ),
	].reverse() ) {
		if ( ! ALLOWED_TAGS.has( node.tagName ) ) {
			node.replaceWith( ...node.childNodes );
			continue;
		}
		for ( const attribute of [ ...node.attributes ] ) {
			const allowed =
				node.tagName === 'A' &&
				[ 'href', 'rel', 'target' ].includes(
					attribute.name.toLowerCase()
				);
			if ( ! allowed ) {
				node.removeAttribute( attribute.name );
			}
		}
		if ( node.tagName === 'A' ) {
			if (
				node.hasAttribute( 'href' ) &&
				! safeHref( node.getAttribute( 'href' ) )
			) {
				node.removeAttribute( 'href' );
			}
			if (
				node.hasAttribute( 'target' ) &&
				! [ '_blank', '_self' ].includes(
					node.getAttribute( 'target' )
				)
			) {
				node.removeAttribute( 'target' );
			}
			if ( node.getAttribute( 'target' ) === '_blank' ) {
				node.setAttribute( 'rel', 'noopener noreferrer' );
			}
		}
	}

	return template.innerHTML;
}
