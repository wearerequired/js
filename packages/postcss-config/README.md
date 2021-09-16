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
* [postcss-hexrgba](https://github.com/seaneking/postcss-hexrgba)  
  Plugin that adds shorthand hex methods to `rgba()` values.
* [css-mqpacker](https://github.com/hail2u/node-css-mqpacker)  
  Plugin for packing same CSS media query rules into one.
* [cssnano](https://github.com/cssnano/cssnano)  
  A modern, modular compression tool. Only used for production builds.
