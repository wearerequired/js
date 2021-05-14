'use strict';

const { Octokit } = require( '@octokit/rest' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const { log, format } = require( '../logger' );
const Conf = require( 'conf' );
const { run } = require( '../utils' );
const { validateNotEmpty } = require( '../validation' );

const config = new Conf();
const OWNER = 'wearerequired';

async function closePr() {
	// Get token from the keychain.
	const storedGithubToken = await keytar.getPassword( 'repo-management', 'github' );
	const lastInput = config.get( 'mergePRLastInput' );

	const { githubToken, query } = await inquirer.prompt( [
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
			name: 'query',
			message: 'Search query:',
			default: lastInput?.query || `user:${ OWNER }`,
			validate: validateNotEmpty,
		},
	] );

	// Add token to the keychain.
	if ( storedGithubToken !== githubToken ) {
		await keytar.setPassword( 'repo-management', 'github', githubToken );
	}

	config.set( 'mergePRLastInput', {
		query,
	} );

	const octokit = new Octokit( {
		auth: githubToken,
		previews: [ 'mercy-preview' ],
	} );

	let searchResults;
	try {
		const { data } = await octokit.search.issuesAndPullRequests( {
			q: `is:pr ${ query }`,
		} );
		searchResults = data;
	} catch ( e ) {
		log( format.error( 'PR search failed: ' + e.message ) );
		return;
	}

	if ( ! searchResults?.items?.length ) {
		log( format.warning( 'No pull requests found.' ) );
		return;
	}

	const pullRequests = searchResults.items.map( ( pullRequest ) => {
		const repoName = pullRequest.repository_url.replace( 'https://api.github.com/repos/', '' );
		return {
			name: `${ repoName }#${ pullRequest.number } ${ pullRequest.title }`,
			value: `${ repoName }|${ pullRequest.number }`,
		};
	} );

	const { selectedPullRequests } = await inquirer.prompt( [
		{
			type: 'checkbox',
			name: 'selectedPullRequests',
			choices: pullRequests,
			message: 'Select pull requests',
			pageSize: 15,
		},
	] );
	if ( ! selectedPullRequests?.length ) {
		log( format.error( '\n\nAborting.' ) );
		process.exit();
	}

	log( `\nClosing the following ${ selectedPullRequests.length } pull requests:` );
	log( selectedPullRequests.join( ', ' ) );
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

	await Promise.all(
		selectedPullRequests.map( async ( pullRequestData ) => {
			const [ repoName, number ] = pullRequestData.split( '|' );

			try {
				await run(
					`gh pr close https://github.com/${ repoName }/pull/${ number } --delete-branch`
				);
			} catch ( err ) {
				console.error( err ); // eslint-disable-line no-console
			}
		} )
	);
}

module.exports = closePr;
