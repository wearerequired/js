const { promisify } = require( 'util' );
const exec = promisify( require( 'child_process' ).exec );
const ora = require( 'ora' );
const { log, format } = require( './logger' );

const sleep = ( time ) => new Promise( ( resolve ) => setTimeout( resolve, time ) );

async function runStep( name, abortMessage, handler ) {
	const spinner = ora( name ).start();

	try {
		await handler( spinner );
	} catch ( exception ) {
		spinner.fail();
		log( exception, format.error( '\n\n' + abortMessage ) );
		process.exit( 1 );
	}

	spinner.succeed();
}

async function runShellCommand( command, cwd ) {
	return await exec( command, {
		cwd,
		env: {
			PATH: process.env.PATH,
			HOME: process.env.HOME,
		},
	} );
}

module.exports = {
	sleep,
	runStep,
	runShellCommand,
};
