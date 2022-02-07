const { readFileSync } = require( 'fs' );
const postcss = require( 'postcss' );
const postcssrc = require( 'postcss-load-config' );

describe( 'postcss-config', () => {
	const originalEnv = process.env;

	beforeEach( () => {
		jest.resetModules();
		process.env = {
			...originalEnv,
		};
	} );

	afterEach( () => {
		process.env = originalEnv;
	} );

	test( 'integration', () => {
		const config = postcssrc.sync( {}, './' );

		const input = readFileSync( './test/integration/fixtures/index.css', 'utf8' );
		const output = readFileSync( './test/integration/expected/index.css', 'utf8' );

		return postcss( config.plugins )
			.process( input, {
				...config.options,
				from: './test/integration/fixtures/index.css',
				map: false, // Disable source maps for easier expectation.
			} )
			.then( ( result ) => {
				expect( result.css ).toEqual( output );
				expect( result.warnings() ).toHaveLength( 0 );
			} );
	} );

	test( 'integration modern browsers', () => {
		process.env.BROWSERSLIST = 'extends @wearerequired/browserslist-config/modern';
		const config = postcssrc.sync( {}, './' );

		const input = readFileSync( './test/integration/fixtures/index.css', 'utf8' );
		const output = readFileSync( './test/integration/expected/index.modern.css', 'utf8' );

		return postcss( config.plugins )
			.process( input, {
				...config.options,
				from: './test/integration/fixtures/index.css',
				map: false, // Disable source maps for easier expectation.
			} )
			.then( ( result ) => {
				expect( result.css ).toEqual( output );
				expect( result.warnings() ).toHaveLength( 0 );
			} );
	} );

	test( 'integration for production', () => {
		const config = postcssrc.sync( { env: 'production' }, './' );

		const input = readFileSync( './test/integration/fixtures/index.css', 'utf8' );
		const output = readFileSync( './test/integration/expected/index.minified.css', 'utf8' );

		return postcss( config.plugins )
			.process( input, {
				...config.options,
				from: './test/integration/fixtures/index.css',
				map: false, // Disable source maps for easier expectation.
			} )
			.then( ( result ) => {
				expect( result.css ).toEqual( output );
				expect( result.warnings() ).toHaveLength( 0 );
			} );
	} );

	test( 'integration for production modern browsers', () => {
		process.env.BROWSERSLIST = 'extends @wearerequired/browserslist-config/modern';
		const config = postcssrc.sync( { env: 'production' }, './' );

		const input = readFileSync( './test/integration/fixtures/index.css', 'utf8' );
		const output = readFileSync( './test/integration/expected/index.modern.minified.css', 'utf8' );

		return postcss( config.plugins )
			.process( input, {
				...config.options,
				from: './test/integration/fixtures/index.css',
				map: false, // Disable source maps for easier expectation.
			} )
			.then( ( result ) => {
				expect( result.css ).toEqual( output );
				expect( result.warnings() ).toHaveLength( 0 );
			} );
	} );
} );
