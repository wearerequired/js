'use strict';

const fs = require( 'fs' ).promises;
const inquirer = require( 'inquirer' );
const replace = require( 'replace-in-file' );
const { pascalCase, camelCase, paramCase, snakeCase } = require( 'change-case' );
const { log, format } = require( '../logger' );
const { validateSlug, validatePHPNamespace, validateNotEmpty } = require( '../validation' );
const { runStep } = require( '../utils' );

const WORKING_DIR = process.cwd();

async function replaceFiles() {
	try {
		await fs.access( WORKING_DIR + '/style.css' );
	} catch ( e ) {
		log( format.error( WORKING_DIR + '/style.css not found' ) );
		process.exit();
	}

	const {
		ThemeName,
		themeDescription,
		themeSlug,
		phpNamespace,
		githubSlug,
	} = await inquirer.prompt( [
		{
			type: 'input',
			name: 'ThemeName',
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
			default: ( answers ) => paramCase( answers.ThemeName ),
			message: 'Enter the slug of the theme:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'phpNamespace',
			default: ( answers ) => 'Required\\' + pascalCase( answers.themeSlug ),
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
	] );

	log();

	const { isReady } = await inquirer.prompt( [
		{
			type: 'expand',
			name: 'isReady',
			default: 2, // default to help in order to avoid clicking straight through
			choices: [
				{ key: 'y', name: 'Yes', value: true },
				{ key: 'n', name: 'No', value: false },
			],
			message: 'Start rewriting the files for ' + ThemeName + ' with slug ' + themeSlug + '?',
		},
	] );

	if ( ! isReady ) {
		log( format.error( '\n\nAborting.' ) );
		process.exit();
	}

	log();

	await runStep( 'Renaming main theme file', 'Could not rename file.', async () => {
		await fs.rename( WORKING_DIR + '/style.css', WORKING_DIR + '/' + themeSlug + '.php' );
	} );

	await runStep( 'Renaming theme files', 'Could not rename files.', async () => {
		const replacementOptions = {
			allowEmptyPaths: true,
			files: [
				WORKING_DIR + '/README.md',
				WORKING_DIR + '/composer.json',
				WORKING_DIR + '/package.json',
				WORKING_DIR + '/phpcs.xml.dist',
				WORKING_DIR + '/style.css',
				WORKING_DIR + '/*.php',
				WORKING_DIR + '/inc/*.php',
				WORKING_DIR + '/template-parts/*.php',
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
				ThemeName + '$1',
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

	log( format.success( '\n✅  Done!' ) );
}

module.exports = replaceFiles;
