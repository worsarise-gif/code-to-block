export function composeStyleControlGroups(
	groups,
	controlFields,
	allowedProperties
) {
	const allowed = allowedProperties ? new Set( allowedProperties ) : null;
	const fieldsByProperty = new Map(
		( controlFields || [] ).map( ( field ) => [ field.property, field ] )
	);
	const claimed = new Set();
	return ( groups || [] )
		.map( ( group ) => {
			const fields = [];
			for ( const property of group.properties || [] ) {
				if (
					claimed.has( property ) ||
					( allowed && ! allowed.has( property ) )
				) {
					continue;
				}
				const field = fieldsByProperty.get( property );
				if ( field ) {
					claimed.add( property );
					fields.push( field );
				}
			}
			return {
				...group,
				fieldObjs: fields,
			};
		} )
		.filter( ( group ) => group.fieldObjs.length );
}
