const ora = require( 'ora' );
const inquirer = require( 'inquirer' );
const { log, format } = require( './logger' );

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

async function recursiveConfirm( question ) {
	const questions = [ question ];
	const answers = await inquirer.prompt( questions );
	if ( ! answers[ Object.keys( answers )[ 0 ] ] ) {
		await recursiveConfirm( question );
	}
}

module.exports = {
	runStep,
	recursiveConfirm,
};
