const Conf = require( 'conf' );

const schema = {
	skipIntros: {
		type: 'boolean',
		default: false,
	},
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
	projectTemplateRepo: {
		type: 'string',
		pattern: '^[a-zA-Z0-9-]+/[a-zA-Z0-9.-]+$',
		default: 'wearerequired/wordpress-project-boilerplate',
	},
	githubOrganization: {
		type: 'string',
		pattern: '^[a-zA-Z0-9-]+$',
		default: 'wearerequired',
	},
};

// https://github.com/sindresorhus/conf#migrations
const migrations = {};

const config = new Conf( { schema, migrations } );

module.exports = config;
