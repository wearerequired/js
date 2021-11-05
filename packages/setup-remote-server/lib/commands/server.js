'use strict';

const fs = require( 'fs' );
const md5 = require( 'apache-md5' );
const untildify = require( 'untildify' );
const path = require( 'path' );
const dotenv = require( 'dotenv' );
const inquirer = require( 'inquirer' );
const replace = require( 'replace-in-file' );
const { Resolver } = require( 'dns' ).promises;
const { NodeSSH } = require( 'node-ssh' );
const YAML = require( 'yaml' );
const { log, format } = require( '../logger' );
const {
	validateSlug,
	validatePath,
	validateNotEmpty,
	validateHostname,
} = require( '../validation' );
const { runStep, recursiveConfirm } = require( '../utils' );
const config = require( '../config' );
const { name: packageName } = require( '../../package.json' );

const WORKING_DIR = process.cwd();

async function server( command ) {
	if ( ! command.skipIntro && ! config.get( 'skipIntros' ) ) {
		const intro = `${ format.title( `👋  Welcome to ${ packageName }` ) }

This tool will guide you through the setup process of a new ${ format.comment( 'remote server' ) }.
`;
		log( intro );

		const { isReady } = await inquirer.prompt( [
			{
				type: 'expand',
				name: 'isReady',
				default: 2, // default to help in order to avoid clicking straight through
				choices: [
					{ key: 'y', name: 'Yes', value: true },
					{ key: 'n', name: 'No', value: false },
				],
				message: 'Has the server and project repo been setup for Deployer?',
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
		log(
			format.error(
				'This direcotry does not seem to be a project. Please run the command within a project directory.'
			)
		);
		process.exit();
	}

	const deployYML = `${ WORKING_DIR }/deploy.yml`;
	let deployYMLExists;
	try {
		fs.existsSync( deployYML );
		deployYMLExists = true;
	} catch ( err ) {
		deployYMLExists = false;
	}

	if ( ! deployYMLExists ) {
		log( format.error( 'This project does not seem to be setup for Deployer.' ) );
		process.exit();
	}

	let deployYMLData;
	try {
		const deployYMLContents = await fs.readFileSync( deployYML, 'utf8' );
		deployYMLData = YAML.parse( deployYMLContents );
	} catch ( error ) {
		log( error );
	}

	if ( ! deployYMLData ) {
		log( format.error( 'Parsing deploy.yml failed.' ) );
		process.exit();
	}

	const { remoteEnvironment } = await inquirer.prompt( [
		{
			type: 'list',
			name: 'remoteEnvironment',
			message: 'Choose the remote environment',
			choices: [ 'Staging', 'Production' ],
			filter( value ) {
				switch ( value ) {
					case 'Production':
						value = 'prod';
						break;
					case 'Staging':
					default:
						value = 'stage';
						break;
				}
				return value;
			},
		},
	] );

	if ( deployYMLData[ remoteEnvironment ] === undefined ) {
		log( format.error( 'The remote environment does not exist in deploy.yml.' ) );
		process.exit();
	}

	const environment = deployYMLData[ remoteEnvironment ].stage;

	const { hostName, hostUser, privateKey } = await inquirer.prompt( [
		{
			type: 'input',
			name: 'hostName',
			default: deployYMLData[ '.base' ].hostname,
			message: 'Enter the hostname for the remote server:',
			validate: validateHostname,
		},
		{
			type: 'input',
			name: 'hostUser',
			default: deployYMLData[ '.base' ].user,
			message: 'Enter the SSH username for the remote server:',
			validate: validateSlug,
		},
		{
			type: 'input',
			name: 'privateKey',
			default: '~/.ssh/id_rsa',
			message: 'Enter the local path to your private SSH key:',
			filter: untildify,
			validate: validatePath,
		},
	] );

	const ssh = new NodeSSH();

	try {
		await ssh.connect( {
			host: hostName,
			username: hostUser,
			privateKey,
		} );
		log( format.success( 'Successful connection to remote server!' ) );
	} catch ( error ) {
		log( error );
		process.exit();
	}

	log( format.warning( 'Point the domain to directory on hosting provider.' ) );

	await recursiveConfirm( {
		type: 'confirm',
		name: 'domainPath',
		message: 'Have you set up the domain?',
		default: false,
	} );

	const { remotePath } = await inquirer.prompt( [
		{
			type: 'input',
			name: 'remotePath',
			// default: `/home/${ hostUser }/www/${ deployYMLData[ '.base' ].application }/${ environment }`,
			default: deployYMLData[ '.base' ].deploy_path
				.replace( '~/', `/home/${ hostUser }/` )
				.replace( '{{application}}', deployYMLData[ '.base' ].application )
				.replace( '{{stage}}', environment ),
			message: 'Enter the path for the site directory:',
			validate: validatePath,
		},
	] );

	log( format.warning( 'Create a new database on the hosting provider.' ) );

	await recursiveConfirm( {
		type: 'confirm',
		name: 'createdDB',
		message: 'Have you created the database?',
		default: false,
	} );

	const { dbHost, dbNmae, dbUser, dbPassword } = await inquirer.prompt( [
		{
			type: 'input',
			name: 'dbHost',
			default: 'localhost',
			message: 'Enter the database host:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'dbNmae',
			message: 'Enter the database name:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'dbUser',
			message: 'Enter the database username:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'dbPassword',
			message: 'Enter the database password:',
			validate: validateNotEmpty,
		},
	] );

	const tempEnvFile = `.local-server/.env.${ environment }`;
	try {
		fs.copyFileSync( '.local-server/.env', tempEnvFile );
		log( format.success( `local-server/.env copied to ${ tempEnvFile }` ) );
	} catch ( error ) {
		log( error );
	}

	const dotenvConfig = dotenv.parse( fs.readFileSync( `${ dotLocalServer }/.env` ) );

	let httpHost = dotenvConfig.URL_STAGING;
	if ( environment === 'production' ) {
		httpHost = dotenvConfig.URL_PRODUCTION;
	}

	// Rename files in local checkout.
	await runStep( 'Renaming project files', 'Could not rename files.', async () => {
		const envReplacementOptions = {
			files: [ `${ WORKING_DIR }/${ tempEnvFile }` ],
			from: [
				/WP_ENV=development/g,
				new RegExp( `_HTTP_HOST="${ dotenvConfig._HTTP_HOST }"`, 'g' ),
				/DB_HOST=\${MYSQL_HOST}/g,
				/DB_NAME=\${MYSQL_DATABASE}/g,
				/DB_USER=\${MYSQL_USER}/g,
				/DB_PASSWORD=\${MYSQL_PASSWORD}/g,
				/WP_DEBUG_DISPLAY=true/g,
				/SCRIPT_DEBUG=true/g,
			],
			to: [
				`WP_ENV=${ environment }`,
				`_HTTP_HOST="${ httpHost.replace( 'https://', '' ) }"`,
				`DB_HOST=${ dbHost }`,
				`DB_NAME=${ dbNmae }`,
				`DB_USER=${ dbUser }`,
				`DB_PASSWORD=${ dbPassword }`,
				'WP_DEBUG_DISPLAY=false',
				'SCRIPT_DEBUG=false',
			],
		};
		await replace( envReplacementOptions );

		if ( environment === 'staging' ) {
			const stagingEnvReplacementOptions = {
				files: [ `${ WORKING_DIR }/${ tempEnvFile }` ],
				from: [ /JETPACK_DEV_DEBUG=true/g ],
				to: [ 'JETPACK_STAGING_MODE=true' ],
			};
			await replace( stagingEnvReplacementOptions );
		}

		if ( environment === 'production' ) {
			const prodEnvReplacementOptions = {
				files: [ `${ WORKING_DIR }/${ tempEnvFile }` ],
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

	let htaccessContents;
	try {
		htaccessContents = fs.readFileSync(
			path.resolve( __dirname, '../../assets/.htaccess' ),
			'utf8'
		);
	} catch ( error ) {
		log( error );
	}

	if ( environment !== 'production' ) {
		const { basicAuthUser, basicAuthPassword } = await inquirer.prompt( [
			{
				type: 'input',
				name: 'basicAuthUser',
				message: 'Enter the BasicAuth username:',
				validate: validateNotEmpty,
			},
			{
				type: 'input',
				name: 'basicAuthPassword',
				message: 'Enter the BasicAuth password:',
				validate: validateNotEmpty,
			},
		] );

		const htpasswd = `${ basicAuthUser }:${ md5( basicAuthPassword ) }`;

		try {
			fs.writeFileSync( `${ dotLocalServer }/.htpasswd`, htpasswd );
			log( format.success( `.htpasswd saved to /.local-server` ) );
		} catch ( err ) {
			log( err );
		}

		const xRobotsTag = 'Header add X-Robots-Tag "nofollow, noindex, noarchive, nosnippet"';

		let allowFrom = '# Localhost\nAllow from 127.0.0.1';
		const resolver = new Resolver();
		try {
			allowFrom += '\n# Hosting IPv4';
			const addresses = await resolver.resolve4( hostName );
			addresses.forEach( ( element ) => {
				allowFrom += `\nAllow from ${ element }`;
			} );
		} catch ( err ) {
			log( err );
		}

		try {
			allowFrom += '\n# Hosting IPv6';
			const addresses = await resolver.resolve6( hostName )
			addresses.forEach( ( element ) => {
				allowFrom += `\nAllow from ${ element }`;
			} );
		} catch ( err ) {
			log( err );
		}

		const basicAuth = `
AuthType Basic
AuthName "${ deployYMLData[ '.base' ].application } ${ environment }"
AuthUserFile "${ remotePath }/shared/.htpasswd"
Require Valid-user
${ allowFrom }
Order allow,deny
Satisfy Any
`;

		const mediaRedirect = `  # Load media files from production server if they don't exist on staging.
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^(content/uploads/.*) ${ dotenvConfig.URL_STAGING }/$1 [L]

  RewriteRule ^index\.php$ - [L]`;

		htaccessContents = xRobotsTag + '\n' + basicAuth + '\n' + htaccessContents;
		htaccessContents = htaccessContents.replace(
			'  RewriteRule ^index\\.php$ - [L]',
			mediaRedirect
		);
	}

	try {
		fs.writeFileSync( `${ dotLocalServer }/.htaccess.${ environment }`, htaccessContents );
		log( format.success( `.htaccess.${ environment } saved to /.local-server` ) );
	} catch ( err ) {
		log( err );
	}

	// Sync files to remote server.
	// Make diretorires.
	try {
		await ssh.execCommand( `mkdir -p ${ remotePath }/shared/wordpress/content/uploads`, {
			cwd: 'public_html',
		} );
		log( format.success( 'Directories create on remote server sucessfully' ) );
	} catch ( error ) {
		log( error );
	}

	// .env file.
	try {
		await ssh.putFile(
			`${ dotLocalServer }/.env.${ environment }`,
			`${ remotePath }/shared/wordpress/.env`
		);
		log( format.success( '.env copied to remote server sucessfully' ) );
	} catch ( error ) {
		log( error );
	}

	// .htaccess.
	try {
		await ssh.putFile(
			`${ dotLocalServer }/.htaccess.${ environment }`,
			`${ remotePath }/shared/wordpress/.htaccess`
		);
		log( format.success( '.htaccess copied to remote server sucessfully' ) );
	} catch ( error ) {
		log( error );
	}

	// .htpasswd.
	if ( environment !== 'production' ) {
		try {
			await ssh.putFile(
				`${ dotLocalServer }/.htpasswd`,
				`${ remotePath }/shared/.htpasswd`
			);
			log( format.success( '.htpasswd copied to remote server sucessfully' ) );
		} catch ( error ) {
			log( error );
		}
	}

	// Cleanup local files.
	try {
		fs.unlinkSync( `${ dotLocalServer }/.env.${ environment }` );
		fs.unlinkSync( `${ dotLocalServer }/.htaccess.${ environment }` );
		fs.unlinkSync( `${ dotLocalServer }/.htpasswd` );
	} catch ( err ) {
		log( err );
	}

	// Add comment to run deployment.

	log( format.success( '\n✅  Done!' ) );
	log(
		`${ deployYMLData[ '.base' ].application } ${ environment } is now installed under ${ remotePath }`
	);
	const repoWorkflowURl = deployYMLData[ '.base' ].repository
		.replace( 'git@github.com:', 'https://github.com/' )
		.replace( '.git', '/actions/workflows/deploy.yml' );
	log( `Push a commit to GitHub or manually trigger a deployment: ${ repoWorkflowURl }` );
	process.exit();
}

module.exports = server;
