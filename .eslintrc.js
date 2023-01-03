module.exports = {
	root: true,
	extends: [ '@wearerequired/eslint-config' ],
	overrides: [
		{
			files: [ '**/?(*.)test.js' ],
			extends: [ 'plugin:@wordpress/eslint-plugin/test-unit' ],
		},
	],
	settings: {
		jest: {
			version: 28,
		},
	},
};
