'use strict';

const { promisify } = require( 'util' );
const fs = require( 'fs' ).promises;
const simpleGit = require( 'simple-git' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const replace = require( 'replace-in-file' );
const { pascalCase, camelCase, paramCase, snakeCase } = require( 'change-case' );
const terminalLink = require( 'terminal-link' );
const rimraf = promisify( require( 'rimraf' ) );
const { log, format } = require( '../logger' );
const { validateSlug, validatePHPNamespace, validateNotEmpty } = require( '../validation' );
const { runShellCommand, runStep } = require( '../utils' );
const github = require( '../github' );
const config = require( '../config' );
const { name: packageName } = require( '../../package.json' );

const WORKING_DIR = process.cwd();

async function plugin( command ) {
	// Get token from the keychain.
	const storedGithubToken = await keytar.getPassword( 'required-generate', 'github' );

	if ( ! command.skipIntro && ! config.get( 'skipIntros' ) ) {
		const intro = `${ format.title( `👋  Welcome to ${ packageName }` ) }

This tool will guide you through the setup process of a new ${ format.comment(
			'WordPress plugin'
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

	let defaultInput = {
		pluginName: 'My Plugin',
		pluginDescription: '',
		pluginSlug: '',
		githubSlug: '',
		phpNamespace: '',
		deleteExampleBlock: false,
		privateRepo: true,
	};

	const lastInput = config.get( 'pluginLastInput' );
	if ( lastInput ) {
		const { useLastInput } = await inquirer.prompt( [
			{
				type: 'expand',
				name: 'useLastInput',
				default: 0,
				choices: [
					{ key: 'y', name: 'Yes', value: true },
					{ key: 'n', name: 'No', value: false },
				],
				message: 'Use last input as default?',
			},
		] );

		log();

		if ( useLastInput ) {
			defaultInput = {
				...defaultInput,
				...lastInput,
			};
		}
	}

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
			default: defaultInput.pluginName,
			message: 'Enter the name of the plugin:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'pluginDescription',
			default: defaultInput.pluginDescription,
			message: 'Enter the description of the plugin:',
		},
		{
			type: 'input',
			name: 'pluginSlug',
			default: ( answers ) => defaultInput.pluginSlug || paramCase( answers.pluginName ),
			message: 'Enter the slug of the plugin:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'githubSlug',
			default: ( answers ) => defaultInput.githubSlug || answers.pluginSlug,
			message: 'Enter the slug of the GitHub repo:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'phpNamespace',
			default: ( answers ) =>
				defaultInput.phpNamespace || 'Required\\' + pascalCase( answers.pluginSlug ),
			message: 'Enter the PHP namespace of the plugin:',
			validate: validatePHPNamespace,
		},
		{
			type: 'confirm',
			name: 'deleteExampleBlock',
			default: defaultInput.deleteExampleBlock,
			message: 'Delete the example block?',
		},
		{
			type: 'confirm',
			name: 'privateRepo',
			default: defaultInput.privateRepo,
			message: 'Private GitHub repo?',
		},
	] );

	log();

	// Add token to the keychain.
	if ( storedGithubToken !== githubToken ) {
		await keytar.setPassword( 'required-generate', 'github', githubToken );
	}

	// Store last input in config.
	config.set( 'pluginLastInput', {
		pluginName,
		pluginDescription,
		pluginSlug,
		phpNamespace,
		deleteExampleBlock,
		githubSlug,
		privateRepo,
	} );

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

	// Create the repository.
	let githubRepo;
	await runStep( 'Creating repository using template', 'Could not create repo.', async () => {
		const [ templateOwner, templateName ] = config.get( 'pluginTemplateRepo' ).split( '/' );
		githubRepo = await github.createRepositoryUsingTemplate( {
			templateOwner,
			templateName,
			owner: githubOrganization,
			name: githubSlug,
			isPrivate: privateRepo,
			description: pluginDescription,
		} );
	} );

	// Wait until the repository is ready to be cloned.
	await runStep( 'Waiting until repository is ready', 'Could not create repo.', async () => {
		await github.waitUntilRepositoryIsReady( githubRepo.owner.login, githubRepo.name );
	} );

	// Add "wordpress-plugin" topic to repo.
	await runStep( 'Adding topic to repo', 'Could not add topic to repo.', async () => {
		await github.replaceAllTopics( githubRepo.owner.login, githubRepo.name, [
			'wordpress-plugin',
		] );
	} );

	const git = simpleGit();

	// Clone the repository.
	await runStep( 'Cloning repository into a new directory', 'Git checkout failed.', async () => {
		await git.clone( githubRepo.ssh_url, pluginDir );
	} );

	// Optional: Remove the example block.
	if ( deleteExampleBlock ) {
		await runStep( 'Removing example block', 'Could not remove example block.', async () => {
			await rimraf( pluginDir + '/assets/src/blocks/example' );

			await replace( {
				files: pluginDir + '/inc/Blocks/namespace.php',
				from: /\tregister_block_type\(.*\);\n/s,
				to: '',
			} );

			await replace( {
				files: pluginDir + '/webpack.config.js',
				from: /\n\t\t'example-block-view': '\.\/blocks\/example\/view\.js',/s,
				to: '',
			} );
		} );
	}

	// Rename files in local checkout.
	await runStep( 'Renaming plugin files', 'Could not rename files.', async () => {
		const replacementOptions = {
			files: [
				pluginDir + '/README.md',
				pluginDir + '/composer.json',
				pluginDir + '/package.json',
				pluginDir + '/phpcs.xml.dist',
				pluginDir + '/webpack.config.js',
				pluginDir + '/plugin.php',
				pluginDir + '/inc/**/*.php',
				pluginDir + '/assets/src/**/*.{ts,tsx,js,json,css}',
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

	// Only run build if example block is not deleted.
	if ( ! deleteExampleBlock ) {
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
	}

	log( format.success( '\n✅  Done!' ) );
	log( 'Directory: ' + pluginDir );
	log( 'GitHub Repo: ' + githubRepo.html_url );
}

module.exports = plugin;
