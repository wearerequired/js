'use strict';

const { Octokit } = require( '@octokit/rest' );
const { RequestError } = require( '@octokit/request-error' );
const { name: packageName, version: packageVersion } = require( '../package.json' );
const { sleep } = require( './utils' );

const github = {};

let octokit;

github.initialize = ( token ) => {
	octokit = new Octokit( {
		auth: token,
		userAgent: `${ packageName }/${ packageVersion }`,
		previews: [ 'baptiste' ],
	} );
};

github.createRepositoryUsingTemplate = async ( {
	templateOwner,
	templateName,
	owner,
	name,
	isPrivate,
	description,
} ) => {
	const response = await octokit.repos.createUsingTemplate( {
		template_owner: templateOwner,
		template_repo: templateName,
		owner,
		name,
		private: isPrivate,
		description,
		include_all_branches: false,
	} );

	return response.data;
};

github.getRepository = async ( owner, name ) => {
	const response = await octokit.repos.get( { owner, repo: name } );
	return response.data;
};

github.hasRepository = async ( owner, name ) => {
	try {
		await github.getRepository( owner, name );
		return true;
	} catch ( error ) {
		if ( error instanceof RequestError && 404 === error.status ) {
			return false;
		}

		throw error;
	}
};

github.waitUntilRepositoryIsReady = async ( owner, name ) => {
	const retryDelays = [ 0.5, 1, 1, 2, 3, 4, 5 ].map( ( a ) => a * 1000 );

	for ( let i = 0; ; i++ ) {
		const delay = retryDelays[ Math.min( retryDelays.length - 1, i ) ];

		try {
			const { data: commits } = await octokit.repos.listCommits( {
				owner,
				repo: name,
				per_page: 1,
			} );

			if ( commits.length > 0 ) {
				break;
			}

			await sleep( delay );
		} catch ( error ) {
			if (
				error instanceof RequestError &&
				( 404 === error.status || 409 === error.status )
			) {
				await sleep( delay );
				continue;
			}

			// Throw error for unknown errors
			throw error;
		}
	}

	return true;
};

github.replaceAllTopics = async ( owner, name, topics ) => {
	const response = await octokit.rest.repos.replaceAllTopics( {
		owner,
		repo: name,
		names: topics,
	} );
	return response.data;
};

module.exports = github;
