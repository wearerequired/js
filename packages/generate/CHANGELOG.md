# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2024-05-07

### Added

* Added option to decide to generate a new theme based on the block theme boilerplate or the theme boilerplate.

## [0.4.0] - 2023-08-01

### Added

* Store last plugin/theme input to reuse them on second run in case of errors.

## [0.3.3] - 2023-06-13

### Fixed

* Update replacement paths for new plugin structure.

## [0.3.2] - 2023-01-04

### Fixed
* Add missing `@octokit/request-error` dependency.

## [0.3.1] - 2022-09-07

### Fixed

* Replace deprecated imports for 'simple-git'.

## [0.3.0] - 2022-06-03

### Fixed

* Replace plugin slug used as text domain in `block.json` files.
* Add `webpack.config.js` to the list of theme files for renaming.
* Only makes changes to example block if not removed.

## [0.2.0] - 2021-11-16

### Added

* New `wordpress-project` command to generate a WordPress project.

## [0.1.0] - 2021-08-29

### Added

* Merge of `@wearerequired/wordpress-plugin-boilerplate create` and `@wearerequired/wordpress-theme-boilerplate create`.

[Unreleased]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.5.0...HEAD
[0.5.0]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.4.0...@wearerequired/generate@0.5.0
[0.4.0]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.3.3...@wearerequired/generate@0.4.0
[0.3.3]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.3.2...@wearerequired/generate@0.3.3
[0.3.2]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.3.1...@wearerequired/generate@0.3.2
[0.3.1]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.3.0...@wearerequired/generate@0.3.1
[0.3.0]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.2.0...@wearerequired/generate@0.3.0
[0.2.0]: https://github.com/wearerequired/js/compare/@wearerequired/generate@0.1.0...@wearerequired/generate@0.2.0
[0.1.0]: https://github.com/wearerequired/js/releases/tag/@wearerequired/generate@0.1.0
