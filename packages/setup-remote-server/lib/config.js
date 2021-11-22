const Conf = require( 'conf' );

const schema = {
	skipIntros: {
		type: 'boolean',
		default: false,
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
