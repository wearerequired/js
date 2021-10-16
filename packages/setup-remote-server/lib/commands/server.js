'use strict';

const fs = require( 'fs' );
const untildify = require('untildify');
const path = require('path');
const simpleGit = require( 'simple-git/promise' );
const inquirer = require( 'inquirer' );
const keytar = require( 'keytar' );
const replace = require( 'replace-in-file' );
const { paramCase } = require( 'change-case' );
const terminalLink = require( 'terminal-link' );
const { Resolver } = require('dns').promises;
const { NodeSSH } = require('node-ssh');
const YAML = require('yaml');
const { log, format } = require( '../logger' );
const {
	validateSlug,
	validatePath,
	validateAlphanumericDash,
	validateAlphanumericUnderscore,
	validateNotEmpty,
	validateHostname,
} = require( '../validation' );
const { runStep, recursiveConfirm, lookupPromise } = require( '../utils' );
const github = require( '../github' );
const config = require( '../config' );
const { name: packageName } = require( '../../package.json' );

const WORKING_DIR = process.cwd();

async function server( command ) {

	if ( ! command.skipIntro && ! config.get( 'skipIntros' ) ) {
		const intro = `${ format.title( `👋  Welcome to ${ packageName }` ) }

This tool will guide you through the setup process of a new ${ format.comment(
			'remote server'
		) }.
`;

		const { isReady } = await inquirer.prompt( [
			{
				type: 'expand',
				name: 'isReady',
				default: 2, // default to help in order to avoid clicking straight through
				choices: [
					{ key: 'y', name: 'Yes', value: true },
					{ key: 'n', name: 'No', value: false },
				],
				message: 'Are you ready to proceed?',
			},
		] );

		if ( ! isReady ) {
			log( format.error( '\nAborted.' ) );
			process.exit();
		}

		log();
	}

	// Check if project directory.
	const dotLocalServer = `${ WORKING_DIR }/.local-server`;
	let dotLocalServerExists;
	try {
		await fs.stat( dotLocalServer );
		dotLocalServerExists = true;
	} catch ( e ) {
		dotLocalServerExists = false;
	}

	if ( dotLocalServerExists ) {
		log( format.error( 'This direcotry does not seem to be a project. Please run the command within a project directory.' ) );
		process.exit();
	}

	const deployYML = `${ WORKING_DIR }/deploy.yml`;
	let deployYMLExists;
	try {
		await fs.existsSync( deployYML );
		deployYMLExists = true;
	} catch( err ) {
		deployYMLExists = false;
	}

	if ( ! deployYMLExists ) {
		log( format.error( 'This project does not seem to be setup for deployment.' ) );
		process.exit();
	}

	let deployYMLData;
	try {
		const deployYMLContents = await fs.readFileSync( deployYML, 'utf8' );
		deployYMLData = YAML.parse( deployYMLContents );
	} catch (error) {
		console.log( error );
	}

	if ( ! deployYMLData ) {
		log( format.error( 'Parsing deploy.yml failed.' ) );
		process.exit();
	}

	const {
		hostName,
		hostUser,
		privateKey,
	} = await inquirer.prompt( [
		{
			type: 'input',
			name: 'hostName',
			default: deployYMLData['.base'].hostname,
			message: 'Enter the hostname for the remote server:',
			validate: validateHostname,
		},
		{
			type: 'input',
			name: 'hostUser',
			default: deployYMLData['.base'].user,
			message: 'Enter the host username:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'privateKey',
			default: '~/.ssh/id_rsa',
			message: 'Enter the path for SSH Key:',
			validate: validatePath,
		},
	] );

	let envoirnment = deployYMLData[ 'stage' ].stage;
	const remoteDir = `/home/${hostUser}/${deployYMLData['.base'].application}/${envoirnment}`

	const ssh = new NodeSSH();

	await ssh.connect({
		host: hostName,
		username: hostUser,
		privateKey: untildify( privateKey ),
	}).then(() => {
		log( format.success( 'Successful connection to remote server!' ) );
	});

	// process.exit();

	log( format.warning( 'Create a new database on the hosting provider.' ) );

	await recursiveConfirm( {
		type: 'confirm',
		name: 'createdDB',
		message: 'Have you created the database?',
		default: false,
	} );

	const {
		dbHost,
		dbNmae,
		dbUser,
		dbPassword,
	} = await inquirer.prompt( [
		{
			type: 'input',
			name: 'dbHost',
			default: 'localhost',
			message: 'Enter the database host:',
		},
		{
			type: 'input',
			name: 'dbNmae',
			message: 'Enter the database name:',
		},
		{
			type: 'input',
			name: 'dbUser',
			message: 'Enter the db username:',
		},
		{
			type: 'password',
			name: 'dbPassword',
			message: 'Enter the database password:',
		},
	] );

	const tempEnvFile = `.local-server/.env.${envoirnment}`;
	fs.copyFile('.local-server/.env', tempEnvFile, (err) => {
		if (err) throw err;
		console.log(`local-server/.env was copied to ${tempEnvFile}`);
	});

	// process.exit();

	log();

	// Rename files in local checkout.
	await runStep( 'Renaming project files', 'Could not rename files.', async () => {
		const envReplacementOptions = {
			files: [
				`${WORKING_DIR}/${tempEnvFile}`,
			],
			from: [
				/WP_ENV=development/g,
				/_HTTP_HOST=/g,
				/DB_HOST=\${MYSQL_HOST}/g,
				/DB_NAME=\${MYSQL_DATABASE}/g,
				/DB_USER=\${MYSQL_USER}/g,
				/DB_PASSWORD=\${MYSQL_PASSWORD}/g,
				/WP_DEBUG_DISPLAY=true/g,
				/SCRIPT_DEBUG=true/g,
			],
			to: [
				`WP_ENV=${envoirnment}`,
				`_HTTP_HOST=`,
				`DB_HOST=${dbHost}`,
				`DB_NAME=${dbNmae}`,
				`DB_USER=${dbUser}`,
				`DB_PASSWORD=${dbPassword}`,
				'WP_DEBUG_DISPLAY=false',
				'SCRIPT_DEBUG=false',
			],
		};
		await replace( envReplacementOptions );

		if ( envoirnment === 'staging' ) {
			const stagingEnvReplacementOptions = {
				files: [
					`${WORKING_DIR}/${tempEnvFile}`,
				],
				from: [
					/JETPACK_DEV_DEBUG=true/g,
				],
				to: [
					'JETPACK_STAGING_MODE=true',
				],
			};
			await replace( stagingEnvReplacementOptions );
		}

		if ( envoirnment === 'production' ) {
			const prodEnvReplacementOptions = {
				files: [
					`${WORKING_DIR}/${tempEnvFile}`,
				],
				from: [
					/WP_DEBUG=true/g,
					/WP_DEBUG_LOG=true/g,
					/SAVEQUERIES=true/g,
					/QM_DISABLED=false/g,
					/JETPACK_DEV_DEBUG=true/g,
				],
				to: [
					'WP_DEBUG=false',
					'WP_DEBUG_LOG=false',
					'SAVEQUERIES=false',
					'QM_DISABLED=true',
					'',
				],
			};
			await replace( prodEnvReplacementOptions );
		}
	} );

	// Create .htpasswd file.
	// Create .htaccess file from assets/.htaccess.prod.
	// Create .htaccess file from assets/.htaccess.staging.

	const xRobotsTag = 'Header add X-Robots-Tag "nofollow, noindex, noarchive, nosnippet"';

	let allowFrom = "# Localhost\nAllow from 127.0.0.1";
	const resolver = new Resolver();
	await resolver.resolve4(hostName)
		.then(addresses => {
			allowFrom += '\n# Hosting IPv4';
			addresses.forEach(element => {
				allowFrom += `\nAllow from ${element}`;
			});
		})
		.catch(err => console.log(err));

	await resolver.resolve6(hostName)
		.then(addresses => {
			allowFrom += '\n# Hosting IPv6';
			addresses.forEach(element => {
				allowFrom += `\nAllow from ${element}`;
			});
		})
		.catch(err => console.log(err));

	const authName = 'Pro Senectute Kanton Zürich Staging';
	const authUserFile = `${ remoteDir }/shared/.htpasswd`;

	const basicAuth = `
AuthType Basic
AuthName "${authName}"
AuthUserFile "${authUserFile}"
Require Valid-user
${allowFrom}
Order allow,deny
Satisfy Any
`;

	console.log(basicAuth);

	const mediaRedirect = `
  # Load media files from production server if they don't exist on staging.
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^(content/uploads/.*) https://pszh.ch/wp-$1 [L]
`;

	process.exit();

	await ssh.connect({
		host: hostName,
		username: hostUser,
		privateKey: untildify( privateKey ),
	}).then( async () => {
		await ssh.execCommand( `mkdir -p ${remoteDir}/shared/wordpress/content/uploads`, { cwd: 'public_html' }).then((result) => {
			console.log('STDOUT: ' + result.stdout);
			console.log('STDERR: ' + result.stderr);
		});
		await ssh.putFile( `${WORKING_DIR}/${envStaging}`, `${remoteDir}/shared/wordpress/.env`).then(function() {
			console.log("The File thing is done")
		}, function(error) {
			console.log("Something's wrong")
			console.log(error)
		});
		// .htaccess
	});

	try {
		fs.unlinkSync(envStaging)
	} catch(err) {
		console.error(err)
	}

	log( format.success( '\n✅  Done!' ) );
	// log( 'Directory: ' + projectDir );
	// log( 'GitHub Repo: ' + githubRepo.html_url );
}

module.exports = server;
