'use strict';

const program = require( 'commander' );
const plugin = require( './commands/plugin' );
const theme = require( './commands/theme' );
const project = require( './commands/project' );
program.version( require( '../package.json' ).version );

program
	.command( 'wordpress-plugin' )
	.option( '--skip-intro', 'skip intro' )
	.description( 'create a new plugin with GitHub repo and local checkout' )
	.action( plugin );

program
	.command( 'wordpress-theme' )
	.option( '--skip-intro', 'skip intro' )
	.description( 'create a new theme with GitHub repo and local checkout' )
	.action( theme );

program
	.command( 'wordpress-project' )
	.option( '--skip-intro', 'skip intro' )
	.description( 'create a new project with GitHub repo and local checkout' )
	.action( project );

module.exports = program;
