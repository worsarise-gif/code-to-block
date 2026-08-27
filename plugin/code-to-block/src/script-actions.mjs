const ID_ACCESSORS = [
	'document\\.getElementById\\(\\s*(["\'])([^"\']+)\\1\\s*\\)',
	'document\\.querySelector\\(\\s*(["\'])#([^"\']+)\\1\\s*\\)',
];

function uniqueMatches( code, suffix, valueFromMatch ) {
	const matches = [];
	for ( const accessor of ID_ACCESSORS ) {
		const pattern = new RegExp( `${ accessor }${ suffix }`, 'g' );
		for ( const match of code.matchAll( pattern ) ) {
			matches.push( valueFromMatch( match ) );
		}
	}

	return [
		...new Map(
			matches.map( ( match ) => [ JSON.stringify( match ), match ] )
		).values(),
	];
}

export function detectScriptAction( code ) {
	const clickSources = uniqueMatches(
		code,
		'\\.addEventListener\\(\\s*(["\'])click\\3',
		( match ) => match[ 2 ]
	);
	const operations = [
		...uniqueMatches(
			code,
			'\\.classList\\.(toggle|add|remove)\\(\\s*(["\'])([a-z_][a-z0-9_-]*)\\4\\s*\\)',
			( match ) => ( {
				targetHtmlId: match[ 2 ],
				behavior: `${ match[ 3 ] }-class`,
				className: match[ 5 ],
			} )
		),
		...uniqueMatches(
			code,
			'\\.toggleAttribute\\(\\s*(["\'])hidden\\3\\s*\\)',
			( match ) => ( {
				targetHtmlId: match[ 2 ],
				behavior: 'toggle-visibility',
			} )
		),
		...uniqueMatches(
			code,
			'\\.hidden\\s*=\\s*(true|false)',
			( match ) => ( {
				targetHtmlId: match[ 2 ],
				behavior: match[ 3 ] === 'true' ? 'hide' : 'show',
			} )
		),
	];

	if ( clickSources.length !== 1 || operations.length !== 1 ) {
		return null;
	}

	const operation = operations[ 0 ];
	const description = operation.className
		? `On click, ${ operation.behavior.replace( '-', ' ' ) } "${
				operation.className
		  }" on #${ operation.targetHtmlId }.`
		: `On click, ${ operation.behavior.replace( '-', ' ' ) } for #${
				operation.targetHtmlId
		  }.`;

	return {
		sourceHtmlId: clickSources[ 0 ],
		targetHtmlId: operation.targetHtmlId,
		behavior: operation.behavior,
		className: operation.className,
		description,
	};
}

export function createStructuredAction( detection, targetBlockId ) {
	const params = { target_block_id: targetBlockId };
	if ( detection.className ) {
		params.class_name = detection.className;
	}

	return {
		trigger: 'click',
		behavior: detection.behavior,
		params,
	};
}

export function createUnverifiedAction( code ) {
	return {
		trigger: 'manual-review',
		behavior: 'unverified-script',
		params: {
			code,
			description:
				'Unverified script preserved for manual review. It is never executed by Code to Block.',
		},
	};
}
