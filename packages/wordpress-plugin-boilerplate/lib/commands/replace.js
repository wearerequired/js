'use strict';

const fs = require( 'fs' ).promises;
const inquirer = require( 'inquirer' );
const replace = require( 'replace-in-file' );
const { pascalCase, paramCase, snakeCase } = require( 'change-case' );
const { log, format } = require( '../logger' );

const WORKING_DIR = process.cwd();

async function replaceFiles( command ) {
	if ( command.dryRun ) {
		log( format.warning( 'Dry run enabled.' ) );
	}

	try {
		await fs.access( WORKING_DIR + '/plugin-name.php' );
	} catch ( e ) {
		log( format.error( WORKING_DIR + '/plugin-name.php not found' ) );
		process.exit();
	}

	const validateSlug = async ( input ) => {
		if ( /[^a-z0-9_\-]/.test( input ) ) {
			return 'Only lowercase alphanumeric characters, dashes and underscores are allowed.';
		}

		return true;
	};

	const { pluginName, pluginSlug, githubSlug } = await inquirer.prompt( [
		{
			type: 'input',
			name: 'pluginName',
			default: 'My Plugin',
			message: 'Enter the name of the plugin:',
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
			name: 'githubSlug',
			default: ( answers ) => answers.pluginSlug,
			message: 'Enter the slug of the GitHub repo:',
			validate: validateSlug,
		},
	] );

	log( '\n' );

	const { isReady } = await inquirer.prompt( [
		{
			type: 'confirm',
			name: 'isReady',
			default: true,
			message:
				'Start rewriting the files for ' + pluginName + ' with slug ' + pluginSlug + '?',
		},
	] );

	if ( ! isReady ) {
		log( format.error( '\n\nAborting.' ) );
		process.exit();
	}

	log( '\n' );

	if ( ! command.dryRun ) {
		try {
			fs.rename( WORKING_DIR + '/plugin-name.php', WORKING_DIR + '/' + pluginSlug + '.php' );
		} catch ( e ) {
			log( format.error( 'Could not rename file: ' + e.message ) );
			process.exit();
		}
	}
	log( 'ℹ️  Renamed main plugin file' );

	if ( ! command.dryRun ) {
		try {
			fs.writeFile( WORKING_DIR + '/README.md', '# ' + pluginName + '\n' );
		} catch ( e ) {
			log( format.error( 'Could not update README.md file: ' + e.message ) );
			process.exit();
		}
	}
	log( 'ℹ️  Updated README.md' );

	const replacementOptions = {
		allowEmptyPaths: true,
		files: [
			WORKING_DIR + '/composer.json',
			WORKING_DIR + '/package.json',
			WORKING_DIR + '/phpcs.xml.dist',
			WORKING_DIR + '/.eslintrc.js',
			WORKING_DIR + '/' + pluginSlug + '.php',
			WORKING_DIR + '/inc/**/*.php',
			WORKING_DIR + '/assets/js/src/**/*.js',
		],
		from: [
			/Plugin Name/g,
			/Plugin name/g,
			/PluginName/g,
			/plugin-name/g,
			/plugin_name/g,
			/wordpress-plugin-boilerplate/g,
		],
		to: [
			pluginName,
			pluginName,
			pascalCase( pluginSlug ),
			pluginSlug,
			snakeCase( pluginSlug ),
			githubSlug,
		],
		dry: command.dryRun,
	};

	let results;
	try {
		results = await replace( replacementOptions );
	} catch ( e ) {
		log( format.error( 'Could not replace files: ' + e.message ) );
		process.exit();
	}

	results
		.filter( ( { hasChanged } ) => hasChanged )
		.forEach( ( { file } ) => {
			log( 'ℹ️  Updated ' + file.replace( WORKING_DIR + '/', '' ) );
		} );

	log( format.success( '\n✅  Done' ) );
}

module.exports = replaceFiles;
