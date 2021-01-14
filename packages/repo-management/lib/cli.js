'use strict';

const program = require( 'commander' );
const updateFile = require( './commands/update-file' );
const mergePR = require( './commands/merge-pr' );

program.version( require( '../package.json' ).version );

program.command( 'update-file' ).description( 'update and commit file' ).action( updateFile );
program.command( 'merge-pr' ).description( 'merge a pr' ).action( mergePR );

module.exports = program;
