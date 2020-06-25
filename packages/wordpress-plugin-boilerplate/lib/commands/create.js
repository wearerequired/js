'use strict';

const fs = require( 'fs' ).promises;
const simpleGit = require( 'simple-git/promise' );
const { Octokit } = require( '@octokit/rest' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const ora = require( 'ora' );
const replace = require( 'replace-in-file' );
const { pascalCase, paramCase, snakeCase } = require( 'change-case' );
const terminalLink = require( 'terminal-link' );
const { log, format } = require( '../logger' );
const { validateSlug, validatePHPNamespace, validateNotEmpty } = require( '../validation' );

const TEMPLATE_OWNER = 'wearerequired';
const TEMPLATE_REPO = 'wordpress-plugin-boilerplate';
const WORKING_DIR = process.cwd();

const sleep = ( time ) => new Promise( ( resolve ) => setTimeout( resolve, time ) );

async function create( command ) {
	if ( ! command.skipIntro ) {
		log(
			format.title( '👋  Welcome to the WordPress Plugin Boilerplate CLI Tool\n\n' ) +
				'This tool will guide you through the setup process.\n' +
				'Before you can start please make sure you have created a ' +
				terminalLink(
					'personal access token for GitHub',
					'https://github.com/settings/tokens'
				) +
				".\nAfter the first run the token gets stored in your system's keychain and will be pre-filled on next runs\n\n"
		);

		const { isReady } = await inquirer.prompt( [
			{
				type: 'confirm',
				name: 'isReady',
				default: true,
				message: 'Are you ready to proceed?',
			},
		] );

		if ( ! isReady ) {
			log( format.error( '\nAborted.' ) );
			process.exit();
		}

		log();
	}

	// Get token from the keychain.
	const storedGithubToken = await keytar.getPassword( 'wordpress-plugin-boilerplate', 'github' );

	const {
		githubToken,
		pluginName,
		pluginDescription,
		pluginSlug,
		phpNamespace,
		githubSlug,
		privateRepo,
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
			name: 'pluginName',
			default: 'My Plugin',
			message: 'Enter the name of the plugin:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'pluginDescription',
			default: '',
			message: 'Enter the description of the plugin:',
		},
		{
			type: 'input',
			name: 'pluginSlug',
			default: ( answers ) => paramCase( answers.pluginName ),
			message: 'Enter the slug of the plugin:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'phpNamespace',
			default: ( answers ) => 'Required\\' + pascalCase( answers.pluginSlug ),
			message: 'Enter the PHP namespace of the plugin:',
			validate: validatePHPNamespace,
		},
		{
			type: 'input',
			name: 'githubSlug',
			default: ( answers ) => answers.pluginSlug,
			message: 'Enter the slug of the GitHub repo:',
			validate: validateSlug,
		},
		{
			type: 'confirm',
			name: 'privateRepo',
			default: true,
			message: 'Private GitHub repo?',
		},
	] );

	log();

	const pluginDir = WORKING_DIR + '/' + pluginSlug;

	// Check if plugin slug doesn't already exist in working directory.
	let pluginDirExists;
	try {
		await fs.stat( pluginDir );
		pluginDirExists = true;
	} catch ( e ) {
		pluginDirExists = false;
	}

	if ( pluginDirExists ) {
		log( format.error( pluginDir + ' already exists, please delete first.' ) );
		process.exit();
	}

	// Add token to the keychain.
	await keytar.setPassword( 'wordpress-plugin-boilerplate', 'github', githubToken );

	const creatingSpinner = ora( 'Creating repository using template' ).start();

	const octokit = new Octokit( {
		auth: githubToken,
		previews: [ 'baptiste' ],
	} );

	// Create the repository.
	let response;
	try {
		response = await octokit.repos.createUsingTemplate( {
			template_owner: TEMPLATE_OWNER,
			template_repo: TEMPLATE_REPO,
			owner: TEMPLATE_OWNER,
			name: githubSlug,
			private: privateRepo,
			description: pluginDescription,
		} );
	} catch ( e ) {
		creatingSpinner.fail();
		log( format.error( 'Could not create repo: ' + e.message ) );
		process.exit();
	}

	creatingSpinner.succeed();

	// Clone the repository.
	const { data: repo } = response;

	const cloningSpinner = ora( 'Cloning repository into a new directory' ).start();
	const git = simpleGit();

	// Give GitHub some time to create the repository
	// to prevent cloning an empty repository.
	await sleep( 1000 );

	try {
		await git.clone( repo.ssh_url, pluginDir );
	} catch ( e ) {
		cloningSpinner.fail();
		log( format.error( 'Checkout failed: ' + e.message ) );
		process.exit();
	}

	cloningSpinner.succeed();

	// Rename files in local checkout.
	const renamingSpinner = ora( 'Renaming plugin files' ).start();
	try {
		await fs.rename( pluginDir + '/plugin-name.php', pluginDir + '/' + pluginSlug + '.php' );
	} catch ( e ) {
		renamingSpinner.fail();
		log( format.error( 'Could not rename file: ' + e.message ) );
		process.exit();
	}

	try {
		await fs.writeFile( pluginDir + '/README.md', '# ' + pluginName + '\n' );
	} catch ( e ) {
		renamingSpinner.fail();
		log( format.error( 'Could not update README.md file: ' + e.message ) );
		process.exit();
	}

	const replacementOptions = {
		files: [
			pluginDir + '/composer.json',
			pluginDir + '/package.json',
			pluginDir + '/phpcs.xml.dist',
			pluginDir + '/.eslintrc.js',
			pluginDir + '/' + pluginSlug + '.php',
			pluginDir + '/inc/**/*.php',
			pluginDir + '/assets/js/src/**/*.js',
		],
		from: [
			/Plugin Name([^:])/g, // Ignore the colon so that in "Plugin Name: Plugin Name" only the second is replaced.
			/Required\\PluginName/g,
			/Required\\\\PluginName\\\\/g,
			/plugin-name/g,
			/plugin_name/g,
			/wordpress-plugin-boilerplate/g,
		],
		to: [
			pluginName + '$1',
			phpNamespace,
			phpNamespace.replace( /\\/g, '\\\\' ),
			pluginSlug,
			snakeCase( pluginSlug ),
			githubSlug,
		],
	};

	try {
		await replace( replacementOptions );
	} catch ( e ) {
		renamingSpinner.fail();
		log( format.error( 'Could not replace files: ' + e.message ) );
		process.exit();
	}

	// Commit and push local changes after rename.
	await git.cwd( pluginDir );
	await git.add( './*' );
	await git.commit( 'Update plugin name' );

	try {
		await git.push();
	} catch ( e ) {
		renamingSpinner.fail();
		log( format.error( 'Could not push updated files: ' + e.message ) );
		process.exit();
	}

	renamingSpinner.succeed();

	log( format.success( '\n✅  Done!' ) );
	log( 'Directory: ' + pluginDir );
}

module.exports = create;
