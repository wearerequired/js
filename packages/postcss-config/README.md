# @wearerequired/postcss-config

Shareable PostCSS config used by @wearerequired.

## Installation

Install the package:

```bash
npm i -D postcss @wearerequired/postcss-config
```

## Usage

To use this config, simply reference `@wearerequired/postcss-config` in your PostCSS configuration.

For example, using `postcss.config.js`:

```js
module.exports = require( '@wearerequired/postcss-config' );
```

## Included Plugins

* [postcss-import](https://github.com/postcss/postcss-import)  
  Plugin to transform `@import` rules by inlining content.
* [postcss-mixins](https://github.com/postcss/postcss-mixins)  
  Plugin for mixins.
* [postcss-nested](https://github.com/postcss/postcss-nested)  
  Plugin to unwrap nested rules like how Sass does it.
* [postcss-preset-env](https://github.com/csstools/postcss-preset-env)  
  Convert modern CSS into something most browsers can understand, determining the polyfills based on targeted browsers.
* [postcss-sort-media-queries](https://github.com/solversgroup/postcss-sort-media-queries)  
  Plugin to combine and sort CSS media queries with mobile first or desktop first methods.
* [cssnano](https://github.com/cssnano/cssnano)  
  A modern, modular compression tool. Only used for production builds.
