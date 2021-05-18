'use strict';

const { promisify } = require( 'util' );
const fs = require( 'fs' ).promises;
const inquirer = require( 'inquirer' );
const replace = require( 'replace-in-file' );
const { pascalCase, camelCase, paramCase, snakeCase } = require( 'change-case' );
const rimraf = promisify( require( 'rimraf' ) );
const { log, format } = require( '../logger' );
const { validateSlug, validatePHPNamespace, validateNotEmpty } = require( '../validation' );
const { runStep } = require( '../utils' );

const WORKING_DIR = process.cwd();

async function replaceFiles() {
	try {
		await fs.access( WORKING_DIR + '/plugin-name.php' );
	} catch ( e ) {
		log( format.error( WORKING_DIR + '/plugin-name.php not found' ) );
		process.exit();
	}

	const {
		pluginName,
		pluginDescription,
		pluginSlug,
		phpNamespace,
		deleteExampleBlock,
		githubSlug,
	} = await inquirer.prompt( [
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
			message:
				'Start rewriting the files for ' + pluginName + ' with slug ' + pluginSlug + '?',
		},
	] );

	if ( ! isReady ) {
		log( format.error( '\n\nAborting.' ) );
		process.exit();
	}

	log();

	await runStep( 'Updating README.md file', 'Could not update README.md.', async () => {
		await fs.writeFile( WORKING_DIR + '/README.md', '# ' + pluginName + '\n' );
	} );

	if ( deleteExampleBlock ) {
		await runStep( 'Removing example block', 'Could not remove example block.', async () => {
			await rimraf( WORKING_DIR + '/assets/js/src/blocks/example' );

			await replace( {
				files: WORKING_DIR + '/inc/Blocks/namespace.php',
				from: /\tregister_block_type\(.*\);\n/s,
				to: '',
			} );
		} );
	}

	await runStep( 'Renaming plugin files', 'Could not rename files.', async () => {
		const replacementOptions = {
			allowEmptyPaths: true,
			files: [
				WORKING_DIR + '/composer.json',
				WORKING_DIR + '/package.json',
				WORKING_DIR + '/phpcs.xml.dist',
				WORKING_DIR + '/webpack.config.js',
				WORKING_DIR + '/plugin.php',
				WORKING_DIR + '/inc/**/*.php',
				WORKING_DIR + '/assets/js/src/**/*.js',
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

	log( format.success( '\n✅  Done!' ) );
}

module.exports = replaceFiles;
