'use strict';

const fs = require( 'fs' );
const md5 = require( 'apache-md5' );
const untildify = require( 'untildify' );
const { promisify } = require( 'util' );
const exec = promisify( require( 'child_process' ).exec );
const which = require( 'which' );
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
				'This directory does not seem to be a project. Please run the command within a project directory.'
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
			choices: [ 'Staging', 'Testing', 'Production' ],
			filter( value ) {
				switch ( value ) {
					case 'Production':
						value = 'prod';
						break;
					case 'Testing':
						value = 'test';
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

	let currentBranch;
	await runStep( 'Fetch current branch', 'Failed to fetch current branch', async () => {
		const { stdout } = await exec( 'git branch --show-current', {
			WORKING_DIR,
			env: {
				PATH: process.env.PATH,
				HOME: process.env.HOME,
			},
		} );
		currentBranch = stdout;
	} );

	if ( currentBranch !== deployYMLData[ remoteEnvironment ].branch ) {
		log(
			format.error(
				'The current branch does not match the branch for the environment in deploy.yml.'
			)
		);
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
	await runStep(
		'Connecting to the remote server',
		'Could not connect to remote server.',
		async () => {
			await ssh.connect( {
				host: hostName,
				username: hostUser,
				privateKey,
			} );
		}
	);

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

	log(
		format.warning(
			`Point the domain to directory "${ remotePath }/current/wordpress" on hosting provider.`
		)
	);

	await recursiveConfirm( {
		type: 'confirm',
		name: 'domainPath',
		message: 'Have you set up the domain?',
		default: false,
	} );

	log( format.warning( 'Create a new database on the hosting provider.' ) );

	await recursiveConfirm( {
		type: 'confirm',
		name: 'createdDB',
		message: 'Have you created the database?',
		default: false,
	} );

	const { dbHost, dbName, dbUser, dbPassword } = await inquirer.prompt( [
		{
			type: 'input',
			name: 'dbHost',
			default: 'localhost',
			message: 'Enter the database host:',
			validate: validateNotEmpty,
		},
		{
			type: 'input',
			name: 'dbName',
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
	await runStep(
		`Copying .local-server/.env to ${ tempEnvFile }.`,
		`Could not copy .local-server/.env to ${ tempEnvFile }.`,
		async () => {
			fs.copyFileSync( '.local-server/.env', tempEnvFile );
		}
	);

	const dotenvConfig = dotenv.parse( fs.readFileSync( `${ dotLocalServer }/.env` ) );

	let httpHost = dotenvConfig.URL_STAGING;
	if ( environment === 'production' ) {
		httpHost = dotenvConfig.URL_PRODUCTION;
	}

	// Search-replace values in .env for remote server.
	await runStep(
		`Search-replace values for ${ tempEnvFile }.`,
		`Could not search-replace values for ${ tempEnvFile }`,
		async () => {
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
					`DB_NAME=${ dbName }`,
					`DB_USER=${ dbUser }`,
					`DB_PASSWORD=${ dbPassword }`,
					'WP_DEBUG_DISPLAY=false',
					'SCRIPT_DEBUG=false',
				],
			};
			await replace( envReplacementOptions );

			if ( environment === 'production' ) {
				const prodEnvReplacementOptions = {
					files: [ `${ WORKING_DIR }/${ tempEnvFile }` ],
					from: [
						/WP_DEBUG=true/g,
						/WP_DEBUG_LOG=true/g,
						/SAVEQUERIES=true/g,
						/QM_DISABLED=false/g,
					],
					to: [
						'WP_DEBUG=false',
						'WP_DEBUG_LOG=false',
						'SAVEQUERIES=false',
						'QM_DISABLED=true',
					],
				};
				await replace( prodEnvReplacementOptions );
			}
		}
	);

	let htaccessContents;
	await runStep(
		'Reading .htaccess template.',
		'Could not read .htaccess template.',
		async () => {
			htaccessContents = fs.readFileSync(
				path.resolve( __dirname, '../../assets/.htaccess' ),
				'utf8'
			);
		}
	);

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
		await runStep(
			'Saving .htpasswd to /.local-server.',
			'Could not save .htpasswd to /.local-server.',
			async () => {
				fs.writeFileSync( `${ dotLocalServer }/.htpasswd`, htpasswd );
			}
		);

		const xRobotsTag = 'Header add X-Robots-Tag "nofollow, noindex, noarchive, nosnippet"';

		let allowFrom = '# Localhost\nAllow from 127.0.0.1';
		const resolver = new Resolver();
		await runStep(
			`Resolving IPv4 for ${ hostName }.`,
			`Could not resolve IPv4 for ${ hostName }.`,
			async () => {
				allowFrom += '\n# Hosting IPv4';
				const addresses = await resolver.resolve4( hostName );
				addresses.forEach( ( element ) => {
					allowFrom += `\nAllow from ${ element }`;
				} );
			}
		);

		await runStep(
			`Resolving IPv6 for ${ hostName }.`,
			`Could not resolve IPv6 for ${ hostName }.`,
			async () => {
				allowFrom += '\n# Hosting IPv6';
				const addresses = await resolver.resolve6( hostName );
				addresses.forEach( ( element ) => {
					allowFrom += `\nAllow from ${ element }`;
				} );
			}
		);

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
  RewriteRule ^(content/uploads/.*) ${ dotenvConfig.URL_PRODUCTION }/$1 [L]

  RewriteRule ^index\.php$ - [L]`;

		htaccessContents = xRobotsTag + '\n' + basicAuth + '\n' + htaccessContents;
		htaccessContents = htaccessContents.replace(
			'  RewriteRule ^index\\.php$ - [L]',
			mediaRedirect
		);

		// Search-replace basic auth in .env.lokal & .local-server/.htaccess.
		await runStep(
			'Search-replace basic auth for .env.lokal & .local-server/.htaccess.',
			'Could not search-replace basic auth for .env.lokal & .local-server/.htaccess',
			async () => {
				const envReplacementOptions = {
					files: [ `${ WORKING_DIR }/.env.lokal`, `${ dotLocalServer }/.htaccess` ],
					from: [ /username:password/g ],
					to: [ `${ basicAuthUser }:${ basicAuthPassword }` ],
				};

				await replace( envReplacementOptions );
			}
		);
	}

	await runStep(
		'Saving .htaccess to /.local-server.',
		'Could not save .htaccess to /.local-server.',
		async () => {
			fs.writeFileSync( `${ dotLocalServer }/.htaccess.${ environment }`, htaccessContents );
		}
	);

	// Sync files to remote server.
	// Make directories.
	await runStep(
		'Creating directories on remote server.',
		'Could not create directories on remote server.',
		async () => {
			await ssh.execCommand( `mkdir -p ${ remotePath }/shared/wordpress/content/uploads`, {
				cwd: 'public_html',
			} );
		}
	);

	// Delete "current" directory in preparation for symlink.
	await runStep(
		'Delete "current" directory.',
		'Could not delete "current" directory on remote server.',
		async () => {
			await ssh.execCommand( `rm -rf ${ remotePath }/current`, {
				cwd: 'public_html',
			} );
		}
	);

	// .env file.
	await runStep(
		'Copying .env to remote server.',
		'Could not copy .env to remote server.',
		async () => {
			await ssh.putFile(
				`${ dotLocalServer }/.env.${ environment }`,
				`${ remotePath }/shared/wordpress/.env`
			);
		}
	);

	// .htaccess.
	await runStep(
		'Copying .htaccess to remote server.',
		'Could not copy .htaccess to remote server.',
		async () => {
			await ssh.putFile(
				`${ dotLocalServer }/.htaccess.${ environment }`,
				`${ remotePath }/shared/wordpress/.htaccess`
			);
		}
	);

	// .htpasswd.
	if ( environment !== 'production' ) {
		await runStep(
			'Copying .htpasswd to remote server.',
			'Could not copy .htpasswd to remote server.',
			async () => {
				await ssh.putFile(
					`${ dotLocalServer }/.htpasswd`,
					`${ remotePath }/shared/.htpasswd`
				);
			}
		);
	}

	// Cleanup local files.
	await runStep(
		'Cleaning up files from /.local-server.',
		'Could not delete files from /.local-server.',
		async () => {
			fs.unlinkSync( `${ dotLocalServer }/.env.${ environment }` );
			fs.unlinkSync( `${ dotLocalServer }/.htaccess.${ environment }` );
			if ( environment === 'production' ) {
				fs.unlinkSync( `${ dotLocalServer }/.htpasswd` );
			}
		}
	);

	log(
		`${ deployYMLData[ '.base' ].application } ${ environment } is now installed under ${ remotePath }`
	);

	await recursiveConfirm( {
		type: 'confirm',
		name: 'repoActions',
		message: 'Are Actions enabled & secrets set on the repository?',
		default: false,
	} );

	// Version 1.9.0 needed.
	const ghCommandExists = which.sync( 'gh' );
	if ( ! ghCommandExists ) {
		log( 'The GitHub CLI is not installed. On macOS install via: brew install gh' );
		await recursiveConfirm( {
			type: 'confirm',
			name: 'repoActions',
			message: 'Have you installed GitHub CLI?',
			default: false,
		} );
	}

	await runStep(
		'Trigger deployment',
		`Automatic deployment failed. Try running: gh workflow run deploy.yml --ref ${ currentBranch }`,
		async () => {
			await exec( `gh workflow run deploy.yml --ref ${ currentBranch }`, {
				WORKING_DIR,
				env: {
					PATH: process.env.PATH,
					HOME: process.env.HOME,
				},
			} );
		}
	);

	log( format.success( '\n✅  Done!' ) );
	process.exit();
}

module.exports = server;
