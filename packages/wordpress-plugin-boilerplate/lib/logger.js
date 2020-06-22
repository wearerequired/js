'use strict';

const chalk = require( 'chalk' );

const log = console.log; // eslint-disable-line no-console
const format = {
	error: chalk.bold.red,
	warning: chalk.keyword( 'orange' ),
	success: chalk.bold.green,
};

module.exports = {
	log,
	format,
};
