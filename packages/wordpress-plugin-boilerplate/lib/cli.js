'use strict';

const program = require( 'commander' );
const replace = require( './commands/replace' );

program.version( require( '../package.json' ).version );

program
	.command( 'replace' )
	.option( '-n, --dry-run', 'run without actually making replacements' )
	.description( 'rename plugin name and other variables' )
	.action( replace );

module.exports = program;
