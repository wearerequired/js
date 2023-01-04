# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2023-01-04

### Fixed
* Fix code style issues.

## [0.1.0] - 2022-06-03

### Fixed
* Only try and delete the generated `.htpasswd` if environment is not production.
* Always use merge when parsing yaml.
* Trim branch name from git.

### Update
* Dependency updates; yaml & dotenv

## [0.1.0-beta.1] - 2021-12-96

### Fixed
* Only delete .htpasswd if not production environment, as .htpasswd is not created for production

### Added
* Include testing environment to list of environments.
* Check if the current branch matches environment branch and use correct branch for deployment.
* Add log message that next step is deployment.

### Update
* Dependency colorette update to 2.0.16

## [0.1.0-beta.0] - 2021-11-22

### Added

* New `setup-remote-server` command to setup remote server for deployment.

[Unreleased]:https://github.com/wearerequired/js/compare/@wearerequired/setup-remote-server@0.1.1...HEAD
[0.1.1]:https://github.com/wearerequired/js/compare/@wearerequired/setup-remote-server@0.1.0...@wearerequired/setup-remote-server@0.1.1
[0.1.0]:https://github.com/wearerequired/js/compare/@wearerequired/setup-remote-server@0.1.0-beta.1...@wearerequired/setup-remote-server@0.1.0
[0.1.0-beta.1]: https://github.com/wearerequired/js/releases/tag/@wearerequired/setup-remote-server@0.1.0-beta.0...@wearerequired/setup-remote-server@0.1.0-beta.1
[0.1.0-beta.0]: https://github.com/wearerequired/js/releases/tag/@wearerequired/setup-remote-server@0.1.0-beta.0
