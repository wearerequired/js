'use strict';

const { promisify } = require( 'util' );
const fs = require( 'fs' ).promises;
const simpleGit = require( 'simple-git/promise' );
const { Octokit } = require( '@octokit/rest' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const replace = require( 'replace-in-file' );
const { pascalCase, camelCase, paramCase, snakeCase } = require( 'change-case' );
const terminalLink = require( 'terminal-link' );
const rimraf = promisify( require( 'rimraf' ) );
const { log, format } = require( '../logger' );
const { validateSlug, validatePHPNamespace, validateNotEmpty } = require( '../validation' );
const { sleep, runShellCommand, runStep } = require( '../utils' );

const TEMPLATE_OWNER = 'wearerequired';
const TEMPLATE_REPO = 'wordpress-plugin-boilerplate';
const WORKING_DIR = process.cwd();

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
				" with the 'repo' scope selected.\nAfter the first run the token gets stored in your system's keychain and will be pre-filled on next runs.\n"
		);

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

	// Get token from the keychain.
	const storedGithubToken = await keytar.getPassword( 'wordpress-plugin-boilerplate', 'github' );

	const {
		githubToken,
		pluginName,
		pluginDescription,
		pluginSlug,
		phpNamespace,
		deleteExampleBlock,
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
			type: 'confirm',
			name: 'deleteExampleBlock',
			default: false,
			message: 'Delete the example block?',
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
	if ( storedGithubToken !== githubToken ) {
		await keytar.setPassword( 'wordpress-plugin-boilerplate', 'github', githubToken );
	}

	const octokit = new Octokit( {
		auth: githubToken,
		previews: [ 'baptiste' ],
	} );

	// Create the repository.
	let response;
	await runStep( 'Creating repository using template', 'Could not create repo.', async () => {
		response = await octokit.repos.createUsingTemplate( {
			template_owner: TEMPLATE_OWNER,
			template_repo: TEMPLATE_REPO,
			owner: TEMPLATE_OWNER,
			name: githubSlug,
			private: privateRepo,
			description: pluginDescription,
		} );
	} );

	const { data: repo } = response;
	const git = simpleGit();

	// Clone the repository.
	await runStep( 'Cloning repository into a new directory', 'Git checkout failed.', async () => {
		// Give GitHub some time to create the repository
		// to prevent cloning an empty repository.
		await sleep( 3000 );
		await git.clone( repo.ssh_url, pluginDir );
	} );

	// Optional: Remove the example block.
	if ( deleteExampleBlock ) {
		await runStep( 'Removing example block', 'Could not remove example block.', async () => {
			await rimraf( pluginDir + '/assets/js/src/blocks/example' );

			await replace( {
				files: pluginDir + '/inc/Blocks/namespace.php',
				from: /\tregister_block_type\(.*\);\n/s,
				to: '',
			} );
		} );
	}

	// Rename files in local checkout.
	await runStep( 'Renaming plugin files', 'Could not rename files.', async () => {
		await fs.writeFile( pluginDir + '/README.md', '# ' + pluginName + '\n' );

		const replacementOptions = {
			files: [
				pluginDir + '/composer.json',
				pluginDir + '/package.json',
				pluginDir + '/phpcs.xml.dist',
				pluginDir + '/webpack.config.js',
				pluginDir + '/plugin.php',
				pluginDir + '/inc/**/*.php',
				pluginDir + '/assets/js/src/**/*.js',
			],
			from: [
				/Plugin Name([^:])/g, // Ignore the colon so that in "Plugin Name: Plugin Name" only the second is replaced.
				/Required\\PluginName/g,
				/Required\\\\PluginName/g,
				/plugin-name/g,
				/plugin_name/g,
				/pluginName/g,
				/Plugin description\./g,
				/wordpress-plugin-boilerplate/g,
			],
			to: [
				pluginName + '$1',
				phpNamespace,
				phpNamespace.replace( /\\/g, '\\\\' ),
				pluginSlug,
				snakeCase( pluginSlug ),
				camelCase( pluginSlug ),
				pluginDescription,
				githubSlug,
			],
		};

		await replace( replacementOptions );
	} );

	// Commit and push local changes after rename.
	await runStep( 'Committing updated files', 'Could not push updated files.', async () => {
		await git.cwd( pluginDir );
		await git.add( './*' );
		await git.commit( 'Update plugin name' );
		await git.push();
	} );

	// Install dependencies.
	await runStep( 'Installing dependencies', 'Could not install dependencies.', async () => {
		await runShellCommand( 'npm install', pluginDir );
	} );

	// Lint and fix files.
	await runStep(
		'Linting and fixing JavaScript files',
		'Could not lint/fix JavaScript files.',
		async () => {
			await runShellCommand( 'npm run lint-js:fix', pluginDir );
		}
	);

	// Build files.
	await runStep( 'Building plugin', 'Could not build plugin.', async () => {
		await runShellCommand( 'npm run build', pluginDir );
	} );

	// Commit and push local changes after build.
	await runStep( 'Committing updated files', 'Could not push updated files.', async () => {
		await git.cwd( pluginDir );
		await git.add( './*' );
		await git.commit( 'Build' );
		await git.push();
	} );

	log( format.success( '\n✅  Done!' ) );
	log( 'Directory: ' + pluginDir );
	log( 'GitHub Repo: ' + repo.html_url );
}

module.exports = create;
