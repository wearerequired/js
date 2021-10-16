const isValidHostname = require( 'is-valid-hostname' );

const validateSlug = async ( input ) => {
	if ( ! input || /[^a-z0-9_\-]/.test( input ) ) {
		return 'Only lowercase alphanumeric characters, dashes and underscores are allowed.';
	}

	return true;
};

const validatePath = async ( input ) => {
	// @link https://stackoverflow.com/a/42036026/850651
	const regex = new RegExp( '^\/$|(^(?=\/)|^\.|^\.\.)(\/(?=[^/\0])[^/\0]+)*\/?$' );
	if ( ! input || ! regex.test( input ) ) {
		return 'Invalid unix path.';
	}

	return true;
};

const validateNotEmpty = async ( input ) => input && input.length > 0;

const validateHostname = async ( input ) => {
	if ( ! input || ! isValidHostname( input ) ) {
		return 'Invalid hostname.';
	}

	return true;
};

module.exports = {
	validateSlug,
	validatePath,
	validateNotEmpty,
	validateHostname,
};
