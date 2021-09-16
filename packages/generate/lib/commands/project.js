'use strict';

const fs = require( 'fs' ).promises;
const simpleGit = require( 'simple-git/promise' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const replace = require( 'replace-in-file' );
const { paramCase } = require( 'change-case' );
const terminalLink = require( 'terminal-link' );
const cryptoRandomString = require( 'crypto-random-string' );
const { log, format } = require( '../logger' );
const {
	validateSlug,
	validatePath,
	validateAlphanumericDash,
	validateAlphanumericUnderscore,
	validateNotEmpty,
	validateHostname,
} = require( '../validation' );
const { runStep, recursiveInquirer } = require( '../utils' );
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
			message: 'Enter the project slug:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'githubSlug',
			default: ( answers ) => answers.projectSlug,
			message: 'Enter the slug for the GitHub repo:',
			validate: validateSlug,
		},
	] );

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

	const {
		isMultisite,
		projectHost,
		stagingHost,
		developmentHost,
	} = await inquirer.prompt( [
		{
			type: 'confirm',
			name: 'isMultisite',
			message: 'Is the project a multisite?',
			default: false,
		},
		{
			type: 'input',
			name: 'projectHost',
			default: `${ projectSlug }.ch`,
			message: 'Enter the hostname of production (example.com):',
			validate: validateHostname,
		},
		{
			type: 'input',
			name: 'stagingHost',
			default: ( answers ) => 'staging.' + answers.projectHost,
			message: 'Enter the hostname of staging (staging.example.com):',
			validate: validateHostname,
		},
		{
			type: 'input',
			name: 'developmentHost',
			default: ( answers ) => answers.projectHost.split( '.' )[ 0 ],
			message: 'Enter the hostname for development (example.required.test):',
			validate: validateHostname,
			filter: ( value ) => value.replace( '.required.test', '' ).concat( '.required.test' ),
		},
	] );

	const productionHostAliases = await recursiveInquirer( {
		type: 'input',
		name: 'productionHostAliases',
		message: 'Enter the production hostname alias (example.ch):',
		validate: validateHostname,
		when: isMultisite,
	} );

	let stagingHostAliasesCount = 0;
	const productionHostAliasesArray = productionHostAliases.split( ',' );
	const stagingHostAliases = await recursiveInquirer( {
		type: 'input',
		name: 'stagingHostAliases',
		default: () => 'staging.' + productionHostAliasesArray[ stagingHostAliasesCount++ ],
		message: 'Enter the staging hostname alias (staging.example.ch):',
		validate: validateHostname,
		when: isMultisite,
	} );

	let developmentHostAliasesCount = 0;
	const developmentHostAliases = await recursiveInquirer( {
		type: 'input',
		name: 'developmentHostAliases',
		default: () => productionHostAliasesArray[ developmentHostAliasesCount++ ].split( '.' )[ 0 ] + '.required.test',
		message: 'Enter the development hostname alias (example-ch.required.test):',
		validate: validateHostname,
		filter: ( value ) => value.replace( '.required.test', '' ).concat( '.required.test' ),
		when: isMultisite,
	} );

	const {
		hostingHostname,
		hostingUsername,
		hostingPath,
		tablePrefix,
	} = await inquirer.prompt( [
		{
			type: 'input',
			name: 'hostingHostname',
			default: '',
			message: 'Enter the hostname for the hosting server (s059.cyon.net):',
			validate: validateHostname,
		},
		{
			type: 'input',
			name: 'hostingUsername',
			default: '',
			message: 'Enter the SSH username for the hosting server (required):',
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
			default: `${ projectSlug.replace( /-/g, '_' ) }_`,
			message: 'Enter the WordPress database table prefix (project_):',
			validate: validateAlphanumericUnderscore,
		},
	] );

	log();

	// Create the repository.
	let githubRepo;
	await runStep( 'Creating repository using template', 'Could not create repo.', async () => {
		const [ templateOwner, templateName ] = config.get( 'projectTemplateRepo' ).split( '/' );
		githubRepo = await github.createRepositoryUsingTemplate( {
			templateOwner,
			templateName,
			owner: githubOrganization,
			name: githubSlug,
			isPrivate: true,
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

		if ( isMultisite ) {
			const multisiteConfig = `
## MULTISITE
WP_ALLOW_MULTISITE=true
MULTISITE=true
SUBDOMAIN_INSTALL=true
DOMAIN_CURRENT_SITE=project-name.required.test
PATH_CURRENT_SITE="/"
SITE_ID_CURRENT_SITE=1
BLOG_ID_CURRENT_SITE=1
NOBLOGREDIRECT=https://project-name.required.test

## COOKIE
COOKIE_DOMAIN=""
COOKIEPATH="/"
SITECOOKIEPATH="/"
ADMIN_COOKIE_PATH="/wp-admin"
`;
			fs.appendFile( projectDir + '/.local-server/.env', multisiteConfig );

			const multisiteReplacementOptions = {
				files: [
					projectDir + '/.env.lokal',
				],
				from: [
					/#PROJECT_SERVER_ALIAS=/,
					/#PROJECT_IS_MULTISITE=true/,
					/#MIGRATE_PRODUCTION_FIND=/,
					/#MIGRATE_PRODUCTION_REPLACE=/,
					/#MIGRATE_STAGING_FIND=/,
					/#MIGRATE_STAGING_REPLACE=/,
				],
				to: [
					'PROJECT_SERVER_ALIAS=' + developmentHostAliases,
					'PROJECT_IS_MULTISITE=true',
					'MIGRATE_PRODUCTION_FIND=' + `${projectHost},${productionHostAliases}`,
					'MIGRATE_PRODUCTION_REPLACE=' + `${developmentHost},${developmentHostAliases}`,
					'MIGRATE_STAGING_FIND=' + `${stagingHost},${stagingHostAliases}`,
					'MIGRATE_STAGING_REPLACE=' + `${developmentHost},${developmentHostAliases}`,
				],
			};
			await replace( multisiteReplacementOptions );
		}

		const envReplacementOptions = {
			files: [
				projectDir + '/.local-server/.env',
			],
			from: [
				/wp_table_prefix_/g,
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
				tablePrefix,
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
		await replace( envReplacementOptions );

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
				projectDir + '/.local-server/.env',
			],
			from: [
				/Project Name/g, // phpcs.xml.dist & Readme.md
				/Project description\./g, // composer.json
				/project-name\.required\.test/g, // .local-server/.env, Readme.md
				/staging\.project-name\.ch/g, // .local-server/.env, .local-server/.htaccess, Readme.md
				/project-name\.ch/g, // .local-server/.env, .local-server/.htaccess, Readme.md
				/\${COMPOSE_PROJECT_NAME}\.ch/g, //.env.lokal
				/hosting-username/g, // deploy.yml & Readme.md
				/hostname\.ch/g, // .local-server/.env, .local-server/.htaccess, Readme.md, wp-cli.yml
				/\/home\/required\/www\//g, // wp-cli.yml
				/project-name/g, // .local-server/.env, .local-server/.htaccess, Readme.md, wp-cli.yml, deploy.yml, composer.json, .env.lokal
			],
			to: [
				projectName,
				projectDescription,
				developmentHost,
				stagingHost,
				projectHost,
				'${COMPOSE_PROJECT_NAME}.' + projectHost.split( '.' ).pop(),
				hostingUsername,
				hostingHostname,
				hostingPath,
				projectSlug,
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
