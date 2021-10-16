'use strict';

const program = require( 'commander' );
const server = require( './commands/server' );
program.version( require( '../package.json' ).version );

program
	.command( 'create' )
	.option( '--skip-intro', 'skip intro' )
	.description( 'create a new project with GitHub repo and local checkout' )
	.action( server );

module.exports = program;
