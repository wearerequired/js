const fs = require( 'fs' ).promises;

const validateFile = async ( input ) => {
	try {
		const stats = await fs.stat( input );
		if ( ! stats.isFile() ) {
			return 'Path is not a file.';
		}
		return true;
	} catch {
		return 'File does not exist.';
	}
};

const validateNotEmpty = async ( input ) => input && input.length > 0;

module.exports = {
	validateFile,
	validateNotEmpty,
};
