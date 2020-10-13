const ora = require( 'ora' );
const { promisify } = require( 'util' );
const exec = promisify( require( 'child_process' ).exec );

async function run( command, options ) {
	const spinner = ora( command ).start();
	try {
		const { stdout } = await exec( command, options );
		spinner.succeed();
		return stdout;
	} catch ( err ) {
		spinner.fail();
		throw err;
	}
}

const sleep = ( time ) => new Promise( ( resolve ) => setTimeout( resolve, time ) );

module.exports = {
	run,
	sleep,
};
