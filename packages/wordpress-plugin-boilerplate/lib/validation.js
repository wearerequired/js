const validateSlug = async ( input ) => {
	if ( /[^a-z0-9_\-]/.test( input ) ) {
		return 'Only lowercase alphanumeric characters, dashes and underscores are allowed.';
	}

	return true;
};

const validatePHPNamespace = async ( input ) => {
	if ( /[^A-Za-z0-9_\\]/.test( input ) ) {
		return 'Only alphanumeric characters, backslashes and underscores are allowed.';
	}

	return true;
};

const validateNotEmpty = async ( input ) => input && input.length > 0;

module.exports = {
	validateSlug,
	validatePHPNamespace,
	validateNotEmpty,
};
