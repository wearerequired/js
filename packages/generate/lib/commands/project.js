'use strict';

const fs = require( 'fs' ).promises;
const simpleGit = require( 'simple-git/promise' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const replace = require( 'replace-in-file' );
const { paramCase } = require( 'change-case' );
const terminalLink = require( 'terminal-link' );
const isValidHostname = require( 'is-valid-hostname' );
const cryptoRandomString = require( 'crypto-random-string' );
const { log, format } = require( '../logger' );
const {
	validateSlug,
	validatePath,
	validateAlphanumericDash,
	validateAlphanumericUnderscore,
	validateNotEmpty,
} = require( '../validation' );
const { runStep } = require( '../utils' );
const github = require( '../github' );
const config = require( '../config' );
const { name: packageName } = require( '../../package.json' );

const WORKING_DIR = process.cwd();
// @link https://developer.wordpress.org/reference/functions/wp_generate_password/#more-information
const CHARACTERS =
	'!@#$%^&*()-_ []{}<>~`+=,.;:/?|abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

async function project( command ) {
	// Get token from the keychain.
	const storedGithubToken = await keytar.getPassword( 'required-generate', 'github' );

	if ( ! command.skipIntro && ! config.get( 'skipIntros' ) ) {
		const intro = `${ format.title( `👋  Welcome to ${ packageName }` ) }

This tool will guide you through the setup process of a new ${ format.comment(
			'WordPress project'
		) }.
`;

		if ( ! storedGithubToken ) {
			log( `${ intro }
Before you can start please make sure you have created a ${ terminalLink(
				'personal access token for GitHub',
				'https://github.com/settings/tokens'
			) } with the 'repo' scope selected.
After the first run the token gets stored in your system's keychain and will be pre-filled on next runs.
` );
		} else {
			log( intro );
		}

		const { isReady } = await inquirer.prompt( [
			{
				type: 'expand',
				name: 'isReady',
				default: 2, // default to help in order to avoid clicking straight through
				choices: [
					{ key: 'y', name: 'Yes', value: true },
					{ key: 'n', name: 'No', value: false },
				],
				message: 'Are you ready to proceed?',
			},
		] );

		if ( ! isReady ) {
			log( format.error( '\nAborted.' ) );
			process.exit();
		}

		log();
	}

	const {
		githubToken,
		projectName,
		projectDescription,
		projectSlug,
		githubSlug,
		projectHost,
		stagingHost,
		developmentSubdomain,
		hostingHostname,
		hostingUsername,
		hostingPath,
		tablePrefix,
	} = await inquirer.prompt( [
		{
			type: 'password',
			mask: '*',
			name: 'githubToken',
			default: storedGithubToken,
			message: 'GitHub API token:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'projectName',
			default: 'My Project',
			message: 'Enter the name of the project:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'projectDescription',
			default: '',
			message: 'Enter the description of the project:',
		},
		{
			type: 'input',
			name: 'projectSlug',
			default: ( answers ) => paramCase( answers.projectName ),
			message: 'Enter the slug of the project:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'githubSlug',
			default: ( answers ) => answers.projectSlug,
			message: 'Enter the slug of the GitHub repo:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'projectHost',
			default: '',
			message: 'Enter the hostname of production (example.com):',
			validate: isValidHostname,
		},
		{
			type: 'input',
			name: 'stagingHost',
			default: ( answers ) => 'staging.' + answers.projectHost,
			message: 'Enter the hostname of staging (staging.example.com):',
			validate: isValidHostname,
		},
		{
			type: 'input',
			name: 'developmentSubdomain',
			default: ( answers ) => answers.projectHost.split( '.' )[ 0 ],
			message: 'Enter the subdomain for development:',
			validate: validateAlphanumericDash,
		},
		{
			type: 'input',
			name: 'hostingHostname',
			default: '',
			message: 'Enter the hostname for the hosting server (s059.cyon.net):',
			validate: isValidHostname,
		},
		{
			type: 'input',
			name: 'hostingUsername',
			default: '',
			message: 'Enter the username for the hosting server (required):',
			validate: validateAlphanumericDash,
		},
		{
			type: 'input',
			name: 'hostingPath',
			default: '',
			message: 'Enter the path on the hosting server (/home/required/www/):',
			validate: validatePath,
		},
		{
			type: 'input',
			name: 'tablePrefix',
			default: '',
			message: 'Enter the WordPress database table prefix (project_):',
			validate: validateAlphanumericUnderscore,
		},
		// TODO: Add option to create a multisite network. PROJECT_SERVER_ALIAS and PROJECT_IS_MULTISITE in .env.lokal. WP_ALLOW_MULTISITE etc in .env
	] );

	log();

	// Add token to the keychain.
	if ( storedGithubToken !== githubToken ) {
		await keytar.setPassword( 'required-generate', 'github', githubToken );
	}

	const githubOrganization = config.get( 'githubOrganization' );

	github.initialize( githubToken );

	// Check if repository doesn't already exist.
	try {
		const repoExists = await github.hasRepository( githubOrganization, githubSlug );
		if ( repoExists ) {
			log(
				format.error( `Repository ${ githubOrganization }/${ githubSlug } already exists.` )
			);
			process.exit();
		}
	} catch ( error ) {
		log(
			error,
			format.error( '\n\nCould not verify that the repository does not already exist.' )
		);
		process.exit();
	}

	const projectDir = WORKING_DIR + '/' + projectSlug;

	// Check if project slug doesn't already exist in working directory.
	let projectDirExists;
	try {
		await fs.stat( projectDir );
		projectDirExists = true;
	} catch ( e ) {
		projectDirExists = false;
	}

	if ( projectDirExists ) {
		log( format.error( projectDir + ' already exists, please delete first.' ) );
		process.exit();
	}

	// Create the repository.
	let githubRepo;
	await runStep( 'Creating repository using template', 'Could not create repo.', async () => {
		const [ templateOwner, templateName ] = config.get( 'projectTemplateRepo' ).split( '/' );
		githubRepo = await github.createRepositoryUsingTemplate( {
			templateOwner,
			templateName,
			owner: githubOrganization,
			name: githubSlug,
			private: true,
			description: projectDescription,
		} );
	} );

	// Wait until the repository is ready to be cloned.
	await runStep( 'Waiting until repository is ready', 'Could not create repo.', async () => {
		await github.waitUntilRepositoryIsReady( githubRepo.owner.login, githubRepo.name );
	} );

	const git = simpleGit();

	// Clone the repository.
	await runStep( 'Cloning repository into a new directory', 'Git checkout failed.', async () => {
		await git.clone( githubRepo.ssh_url, projectDir );
	} );

	// Rename files in local checkout.
	await runStep( 'Renaming project files', 'Could not rename files.', async () => {
		const generateRandomKeySalt = () =>
			cryptoRandomString( { length: 64, characters: CHARACTERS } );

		const replacementOptions = {
			files: [
				projectDir + '/.env.lokal',
				projectDir + '/README.md',
				projectDir + '/composer.json',
				projectDir + '/phpcs.xml.dist',
				projectDir + '/deploy.yml',
				projectDir + '/wp-cli.yml',
				projectDir + '/.local-server/.env',
				projectDir + '/.local-server/.htaccess',
			],
			from: [
				/Project Name/g,
				/Project description\./g,
				/wordpress-project-boilerplate/g,
				/project-name\.required\.test/g,
				/staging.project-name\.ch/g,
				/project-name\.ch/g,
				/\${COMPOSE_PROJECT_NAME}\.ch/g,
				/hosting-username/g,
				/hostname\.ch/g,
				/\/home\/required\/www\//g,
				/wp_table_prefix_/g,
				/project-name/g,
				/\[\[AUTH_KEY\]\]/g,
				/\[\[SECURE_AUTH_KEY\]\]/g,
				/\[\[LOGGED_IN_KEY\]\]/g,
				/\[\[NONCE_KEY\]\]/g,
				/\[\[AUTH_SALT\]\]/g,
				/\[\[SECURE_AUTH_SALT\]\]/g,
				/\[\[LOGGED_IN_SALT\]\]/g,
				/\[\[NONCE_SALT\]\]/g,
			],
			to: [
				projectName,
				projectDescription,
				githubSlug,
				developmentSubdomain + '.required.test',
				stagingHost,
				projectHost,
				'${COMPOSE_PROJECT_NAME}.' + projectHost.split( '.' ).pop(),
				hostingUsername,
				hostingHostname,
				hostingPath,
				tablePrefix,
				projectSlug,
				generateRandomKeySalt(),
				generateRandomKeySalt(),
				generateRandomKeySalt(),
				generateRandomKeySalt(),
				generateRandomKeySalt(),
				generateRandomKeySalt(),
				generateRandomKeySalt(),
				generateRandomKeySalt(),
			],
		};

		await replace( replacementOptions );
	} );

	// Commit and push local changes after rename.
	await runStep( 'Committing updated files', 'Could not push updated files.', async () => {
		await git.cwd( projectDir );
		await git.add( './*' );
		await git.commit( 'Update project name' );
		await git.push();
	} );

	log( format.success( '\n✅  Done!' ) );
	log( 'Directory: ' + projectDir );
	log( 'GitHub Repo: ' + githubRepo.html_url );
}

module.exports = project;
