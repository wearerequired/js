'use strict';

const program = require( 'commander' );
const replace = require( './commands/replace' );
const checkout = require( './commands/checkout' );

program.version( require( '../package.json' ).version );

program
	.command( 'checkout' )
	.alias( 'co' )
	.description( 'clone the repository to your local folder' )
	.action( checkout );

program
	.command( 'replace' )
	.option( '-n, --dry-run', 'run without actually making replacements' )
	.description( 'rename plugin name and other variables' )
	.action( replace );

program.command( 'create' ).description( 'create a new plugin' );

module.exports = program;
