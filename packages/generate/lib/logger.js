'use strict';

const { red, yellow, green, bold, italic } = require( 'colorette' );

const log = console.log; // eslint-disable-line no-console
const format = {
	title: ( message ) => bold( message ),
	comment: ( message ) => italic( yellow( message ) ),
	error: ( message ) => bold( red( message ) ),
	warning: ( message ) => yellow( message ),
	success: ( message ) => bold( green( message ) ),
};

module.exports = {
	log,
	format,
};
