# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[Unreleased]: https://github.com/wearerequired/js/compare/@wearerequired/postcss-config@0.1.1...HEAD
[0.1.1]: https://github.com/wearerequired/js/compare/@wearerequired/postcss-config@0.1.0...@wearerequired/postcss-config@0.1.1
[0.1.0]: https://github.com/wearerequired/js/releases/tag/@wearerequired/postcss-config@0.1.0
