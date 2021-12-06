# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2021-12-06

### Changed

* Update `postcss-sort-media-queries` from [v3 to v4](https://github.com/solversgroup/postcss-sort-media-queries/blob/v4.2.1/CHANGELOG.md).
* Update `postcss-cli` from [v8 to v9](https://github.com/postcss/postcss-cli/blob/9.0.2/CHANGELOG.md).
* Update `postcss-mixins` from [v8 to v9](https://github.com/postcss/postcss-mixins/blob/9.0.1/CHANGELOG.md).

## [0.2.0] - 2021-11-16

### Changed

* Require PostCSS 8.
* Replace deprecated `css-mqpacker` with `postcss-sort-media-queries` for sorting and merging media queries.
* Update `cssnano` from [v4 to v5](https://github.com/cssnano/cssnano/releases).
* Update `postcss-import` from [v12 to v14](https://github.com/postcss/postcss-import/blob/14.0.2/CHANGELOG.md).
* Update `postcss-mixins` from [v6 tp v8](https://github.com/postcss/postcss-mixins/blob/8.1.0/CHANGELOG.md).
* Update `postcss-nested` from [v4 to v5](https://github.com/postcss/postcss-nested/blob/5.0.6/CHANGELOG.md).

### Removed

* Remove support for shorthand hex values for `rgba()` function.

## [0.1.3] - 2021-08-29

### Added

* Add tests. [#59]

## [0.1.2] - 2021-01-28

### Bug fixes

* Disable `prefers-color-scheme-query` to not transform `prefers-color-scheme` media queries as it requires an additional browser script.
* Replace deprecated 'safe' option for `cssnano` with the default preset.

## [0.1.1] - 2020-06-11

### Bug Fixes

* The bundled `postcss-hexrgba` dependency has been updated from requiring `^2.0.0` to requiring `^2.0.1`0 ([#2](https://github.com/wearerequired/js/issues/2)).

## [0.1.0] - 2020-06-07

### New Features

* Initial release.

[Unreleased]: https://github.com/wearerequired/js/compare/@wearerequired/postcss-config@0.1.2...HEAD
[0.1.2]: https://github.com/wearerequired/js/compare/@wearerequired/postcss-config@0.1.1...@wearerequired/postcss-config@0.1.2
[0.1.1]: https://github.com/wearerequired/js/compare/@wearerequired/postcss-config@0.1.0...@wearerequired/postcss-config@0.1.1
[0.1.0]: https://github.com/wearerequired/js/releases/tag/@wearerequired/postcss-config@0.1.0

[#59]: https://github.com/wearerequired/js/issues/59
