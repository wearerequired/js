const { promisify } = require( 'util' );
const exec = promisify( require( 'child_process' ).exec );
const ora = require( 'ora' );
const inquirer = require( 'inquirer' );
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

async function recursiveInquirer( question, output = [] ) {
	const questions = [
		question,
		{
			type: 'confirm',
			name: 'askAgain',
			message: 'Do you want to enter another?',
			default: true,
		},
	];
	await inquirer.prompt( questions ).then( async ( answers ) => {
		output.push( answers[ question.name ] );
		if ( answers.askAgain ) {
			await recursiveInquirer( question, output );
		}
	} );
	return output.join(',');
}

module.exports = {
	sleep,
	runStep,
	runShellCommand,
	recursiveInquirer,
};
