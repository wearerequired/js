'use strict';

const program = require( 'commander' );
const updateFile = require( './commands/update-file' );
const mergePr = require( './commands/merge-pr' );
const closePr = require( './commands/close-pr' );

program.version( require( '../package.json' ).version );

program.command( 'update-file' ).description( 'update and commit file' ).action( updateFile );
program.command( 'merge-pr' ).description( 'merge a pr' ).action( mergePr );
program.command( 'close-pr' ).description( 'merge a pr' ).action( closePr );

module.exports = program;
