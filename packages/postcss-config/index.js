module.exports = ( ctx ) => {
	const config = {
		plugins: [
			require( 'postcss-import' ),
			require( 'postcss-mixins' ),
			require( 'postcss-nested' ),
			require( 'postcss-preset-env' )( {
				stage: 0,
				preserve: false, // Omit pre-polyfilled CSS.
				features: {
					'nesting-rules': false, // Uses postcss-nesting which doesn't behave like Sass.
					'prefers-color-scheme-query': false, // Requires a browser script.
					'has-pseudo-class': false, // Disable :has()-polyfill.
				},
				autoprefixer: {
					grid: true,
				},
			} ),
			require( 'postcss-sort-media-queries' )( {
				sort: 'mobile-first',
			} ),
		],
	};

	if ( 'production' === ctx.env ) {
		config.map = false;
		config.plugins.push(
			require( 'cssnano' )( {
				preset: [
					'default',
					{
						discardComments: { removeAll: true },
					},
				],
			} )
		);
	} else if ( 'undefined' !== typeof ctx.options ) {
		config.map = false !== ctx.options.map;
	} else {
		config.map = true;
	}

	return config;
};
