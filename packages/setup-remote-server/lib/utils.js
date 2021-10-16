const { promisify } = require( 'util' );
const exec = promisify( require( 'child_process' ).exec );
const ora = require( 'ora' );
const dns = require('dns');
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

async function recursiveConfirm( question ) {
	const questions = [
		question,
	];
	await inquirer.prompt( questions ).then( async ( answers ) => {
		if ( ! answers[Object.keys(answers)[0]] ) {
			await recursiveConfirm( question );
		}
	} );
}

async function lookupPromise( host ){
    return new Promise((resolve, reject) => {

        dns.resolve4( host, (err, addresses) => {
            if(err) reject(err);
			console.log('addresses: %j', addresses);
            // console.log('address: %j family: IPv%s', address, family);
        });
		dns.resolve6( host, (err, addresses) => {
            if(err) reject(err);
			console.log('addresses: %j', addresses);
            // console.log('address: %j family: IPv%s', address, family);
        });
   });
};

module.exports = {
	sleep,
	runStep,
	runShellCommand,
	recursiveConfirm,
	lookupPromise,
};
