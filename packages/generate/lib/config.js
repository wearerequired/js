const Conf = require( 'conf' );

const schema = {
	pluginTemplateRepo: {
		type: 'string',
		pattern: '^[a-zA-Z0-9-]+/[a-zA-Z0-9.-]+$',
		default: 'wearerequired/wordpress-plugin-boilerplate',
	},
	themeTemplateRepo: {
		type: 'string',
		pattern: '^[a-zA-Z0-9-]+/[a-zA-Z0-9.-]+$',
		default: 'wearerequired/wordpress-theme-boilerplate',
	},
	githubOrganization: {
		type: 'string',
		pattern: '^[a-zA-Z0-9-]+$',
		default: 'wearerequired',
	},
};

const config = new Conf( { schema } );

module.exports = config;
