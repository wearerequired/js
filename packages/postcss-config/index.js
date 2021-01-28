module.exports = ( ctx ) => {
	const config = {
		plugins: {
			'postcss-import': {},
			'postcss-mixins': {},
			'postcss-nested': {},
			'postcss-preset-env': {
				stage: 0,
				preserve: false, // Omit pre-polyfilled CSS.
				features: {
					'nesting-rules': false, // Uses postcss-nesting which doesn't behave like Sass.
					'prefers-color-scheme-query': false, // Requires a browser script.
				},
				autoprefixer: {
					grid: true,
				},
			},
			'postcss-hexrgba': {},
			'css-mqpacker': {
				sort: true,
			},
		},
	};

	if ( 'production' === ctx.env ) {
		config.map = false;
		config.plugins.cssnano = {
			preset: [ 'default', { discardComments: { removeAll: true } } ],
		};
	} else {
		config.map = true;
	}

	return config;
};
