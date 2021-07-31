'use strict';

const fs = require( 'fs' ).promises;
const simpleGit = require( 'simple-git/promise' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const replace = require( 'replace-in-file' );
const { pascalCase, camelCase, paramCase, snakeCase } = require( 'change-case' );
const terminalLink = require( 'terminal-link' );
const { log, format } = require( '../logger' );
const { validateSlug, validatePHPNamespace, validateNotEmpty } = require( '../validation' );
const { runShellCommand, runStep } = require( '../utils' );
const github = require( '../github' );

const TEMPLATE_OWNER = 'wearerequired';
const TEMPLATE_REPO = 'wordpress-theme-boilerplate';
const WORKING_DIR = process.cwd();

async function theme( command ) {
	if ( ! command.skipIntro ) {
		log(
			format.title( '👋  Welcome to the Generate CLI Tool\n\n' ) +
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
	const storedGithubToken = await keytar.getPassword( 'required-generate', 'github' );

	const {
		githubToken,
		themeName,
		themeDescription,
		themeSlug,
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
			name: 'themeName',
			default: 'My Theme',
			message: 'Enter the name of the theme:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'themeDescription',
			default: '',
			message: 'Enter the description of the theme:',
		},
		{
			type: 'input',
			name: 'themeSlug',
			default: ( answers ) => paramCase( answers.themeName ),
			message: 'Enter the slug of the theme:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'phpNamespace',
			default: ( answers ) =>
				'Required\\' + pascalCase( answers.themeSlug.replace( '-theme', '' ) ) + '\\Theme',
			message: 'Enter the PHP namespace of the theme:',
			validate: validatePHPNamespace,
		},
		{
			type: 'input',
			name: 'githubSlug',
			default: ( answers ) => answers.themeSlug,
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

	// Add token to the keychain.
	if ( storedGithubToken !== githubToken ) {
		await keytar.setPassword( 'required-generate', 'github', githubToken );
	}

	github.initialize( githubToken );

	// Check if repository doesn't already exist.
	try {
		const repoExists = await github.hasRepository( TEMPLATE_OWNER, githubSlug );
		if ( repoExists ) {
			log( format.error( `Repository ${ TEMPLATE_OWNER }/${ githubSlug } already exists.` ) );
			process.exit();
		}
	} catch ( error ) {
		log(
			error,
			format.error( '\n\nCould not verify that the repository does not already exist.' )
		);
		process.exit();
	}

	const themeDir = WORKING_DIR + '/' + themeSlug;

	// Check if theme slug doesn't already exist in working directory.
	let themeDirExists;
	try {
		await fs.stat( themeDir );
		themeDirExists = true;
	} catch ( e ) {
		themeDirExists = false;
	}

	if ( themeDirExists ) {
		log( format.error( themeDir + ' already exists, please delete first.' ) );
		process.exit();
	}

	// Create the repository.
	let githubRepo;
	await runStep( 'Creating repository using template', 'Could not create repo.', async () => {
		githubRepo = await github.createRepositoryUsingTemplate( {
			templateOwner: TEMPLATE_OWNER,
			templateName: TEMPLATE_REPO,
			owner: TEMPLATE_OWNER,
			name: githubSlug,
			isPrivate: privateRepo,
			description: themeDescription,
		} );
	} );

	// Wait until the repository is ready to be cloned.
	await runStep( 'Waiting until repository is ready', 'Could not create repo.', async () => {
		await github.waitUntilRepositoryIsReady( githubRepo.owner.login, githubRepo.name );
	} );

	const git = simpleGit();

	// Clone the repository.
	await runStep( 'Cloning repository into a new directory', 'Git checkout failed.', async () => {
		await git.clone( githubRepo.ssh_url, themeDir );
	} );

	// Rename files in local checkout.
	await runStep( 'Renaming theme files', 'Could not rename files.', async () => {
		const replacementOptions = {
			files: [
				themeDir + '/README.md',
				themeDir + '/composer.json',
				themeDir + '/package.json',
				themeDir + '/phpcs.xml.dist',
				themeDir + '/style.css',
				themeDir + '/**/*.php',
			],
			from: [
				/Theme Name([^:])/g, // Ignore the colon so that in "Theme Name: Theme Name" only the second is replaced.
				/Required\\ThemeName/g,
				/Required\\\\ThemeName/g,
				/theme-name/g,
				/theme_name/g,
				/ThemeName/g,
				/Theme description\./g,
				/wordpress-theme-boilerplate/g,
			],
			to: [
				themeName + '$1',
				phpNamespace,
				phpNamespace.replace( /\\/g, '\\\\' ),
				themeSlug,
				snakeCase( themeSlug ),
				camelCase( themeSlug ),
				themeDescription,
				githubSlug,
			],
		};

		await replace( replacementOptions );
	} );

	// Commit and push local changes after rename.
	await runStep( 'Committing updated files', 'Could not push updated files.', async () => {
		await git.cwd( themeDir );
		await git.add( './*' );
		await git.commit( 'Update theme name' );
		await git.push();
	} );

	// Install dependencies.
	await runStep( 'Installing dependencies', 'Could not install dependencies.', async () => {
		await runShellCommand( 'npm install', themeDir );
	} );

	// Build files.
	await runStep( 'Building theme', 'Could not build theme.', async () => {
		await runShellCommand( 'npm run build', themeDir );
	} );

	// Commit and push local changes after build.
	await runStep( 'Committing updated files', 'Could not push updated files.', async () => {
		await git.cwd( themeDir );
		await git.add( './*' );
		await git.commit( 'Build' );
		await git.push();
	} );

	log( format.success( '\n✅  Done!' ) );
	log( 'Directory: ' + themeDir );
	log( 'GitHub Repo: ' + githubRepo.html_url );
}

module.exports = theme;
