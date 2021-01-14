'use strict';

const { Octokit } = require( '@octokit/rest' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const fs = require( 'fs' ).promises;
const untildify = require( 'untildify' );
const { log, format } = require( '../logger' );
const Conf = require( 'conf' );
const { validateNotEmpty, validateFile } = require( '../validation' );

const config = new Conf();
const OWNER = 'wearerequired';

async function updateFile() {
	// Get token from the keychain.
	const storedGithubToken = await keytar.getPassword( 'repo-management', 'github' );
	const lastInput = config.get( 'lastInput' );

	const { githubToken, path, branch, commitMessage, file, query } = await inquirer.prompt( [
		{
			type: 'password',
			mask: '*',
			name: 'githubToken',
			default: storedGithubToken || undefined,
			message: 'GitHub API token:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'path',
			message: 'Path:',
			default: lastInput?.path || undefined,
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'branch',
			message: 'Branch:',
			default: lastInput?.branch || 'master',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'query',
			message: 'Search query:',
			default: lastInput?.query || `user:${ OWNER }`,
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'commitMessage',
			message: 'Commit Message:',
			default: ( answers ) => `Update ${ answers.path }.`,
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'file',
			message: 'File:',
			default: lastInput?.file || undefined,
			validate: validateFile,
			filter: async ( input ) => {
				return await untildify( input );
			},
		},
	] );

	// Add token to the keychain.
	if ( storedGithubToken !== githubToken ) {
		await keytar.setPassword( 'repo-management', 'github', githubToken );
	}

	config.set( 'lastInput', {
		path,
		branch,
		file,
		query,
	} );

	const octokit = new Octokit( {
		auth: githubToken,
		previews: [ 'mercy-preview' ],
	} );

	let searchResults;
	try {
		const { data } = await octokit.search.repos( {
			q: query,
		} );
		searchResults = data;
	} catch ( e ) {
		log( format.error( 'Repo search failed: ' + e.message ) );
		return;
	}

	if ( ! searchResults?.items?.length ) {
		log( format.warning( 'No repositories found.' ) );
		return;
	}

	const repositories = searchResults.items.map( ( repo ) => {
		return {
			name: repo.name,
			value: repo.name,
		};
	} );

	repositories.sort( ( a, b ) => a.name.localeCompare( b.name ) );

	const { selectedRepositories } = await inquirer.prompt( [
		{
			type: 'checkbox',
			name: 'selectedRepositories',
			choices: repositories,
			message: 'Select repositories',
			pageSize: 15,
		},
	] );
	if ( ! selectedRepositories?.length ) {
		log( format.error( '\n\nAborting.' ) );
		process.exit();
	}

	log(
		`\nUpdating '${ path }' for the following ${ selectedRepositories.length } repositories:`
	);
	log( selectedRepositories.join( ', ' ) );
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
			message: 'Are you ready to proceed?',
		},
	] );

	if ( ! isReady ) {
		log( format.error( '\nAborted.' ) );
		process.exit();
	}

	const content = await fs.readFile( file, { encoding: 'base64' } );

	await selectedRepositories.forEach( async ( repo ) => {
		// Check if file exists and get SHA/content.
		let githubFileSha = null;
		let githubFileContent = null;
		try {
			const { data: githubFile } = await octokit.repos.getContent( {
				owner: OWNER,
				repo,
				path,
				ref: branch,
			} );

			githubFileSha = githubFile.sha;
			githubFileContent = githubFile.content.replace( /\n/g, '' );
		} catch {}

		// Check if content is unchanged.
		if ( githubFileContent === content ) {
			log( format.warning( `[${ repo }] Content is unchanged.` ) );
			return;
		}

		// Update file with commit.
		try {
			const { data: updatedFile } = await octokit.repos.createOrUpdateFileContents( {
				owner: OWNER,
				repo,
				path,
				message: commitMessage,
				content,
				branch,
				sha: githubFileSha,
			} );
			log( format.success( `[${ repo }] File updated. ${ updatedFile.commit.html_url }` ) );
		} catch ( e ) {
			log( format.error( `[${ repo }] File not updated: ${ e.message }` ) );
		}
	} );
}

module.exports = updateFile;
