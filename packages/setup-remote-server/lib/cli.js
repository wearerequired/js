'use strict';

const program = require( 'commander' );
const server = require( './commands/server' );
program.version( require( '../package.json' ).version );

program
	.option( '--skip-intro', 'skip intro' )
	.description( 'setup a new envoirnment on a remote server.' )
	.action( server );

module.exports = program;
