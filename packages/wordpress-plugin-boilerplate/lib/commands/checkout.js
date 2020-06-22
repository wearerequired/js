'use strict';

const simpleGit = require( 'simple-git/promise' );
const inquirer = require( 'inquirer' );
const ora = require( 'ora' );
const { log, format } = require( '../logger' );

const REPO_URL = 'git@github.com:wearerequired/wordpress-plugin-boilerplate.git';
const WORKING_DIR = process.cwd();

async function checkout() {
	const { directoryName } = await inquirer.prompt( [
		{
			type: 'input',
			name: 'directoryName',
			default: 'wordpress-plugin-boilerplate',
			message: 'Enter a directory name for the checkout (leave empty for current directory)',
		},
	] );

	const spinner = ora( 'Cloning' ).start();

	const git = simpleGit();
	const destination = ( WORKING_DIR + '/' + directoryName ).replace( /\/$/, '' );

	try {
		await git.clone( REPO_URL, destination );
	} catch ( e ) {
		spinner.fail();
		log( format.error( 'Checkout failed: ' + e.message ) );
		process.exit();
	}

	spinner.succeed();

	log( format.success( '\n✅  Checkout done in ' + destination ) );
}

module.exports = checkout;
