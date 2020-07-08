'use strict';

const program = require( 'commander' );
const replace = require( './commands/replace' );
const create = require( './commands/create' );

program.version( require( '../package.json' ).version );

program
	.command( 'replace' )
	.description( 'rename plugin name and other variables' )
	.action( replace );

program
	.command( 'create' )
	.option( '--skip-intro', 'skip intro' )
	.description( 'create a new plugin with GitHub repo and local checkout' )
	.action( create );

module.exports = program;
