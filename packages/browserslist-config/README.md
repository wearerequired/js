# @wearerequired/browserslist-config

Shareable Browserslist config used by @wearerequired.

## Installation

Install the package:

```bash
npm i -D @wearerequired/browserslist-config
```

## Usage

To use this config, simply reference `@wearerequired/browserslist-config` in your Browserslist configuration.

For example, using `.browserslistrc`:

```
extends @wearerequired/browserslist-config
```

The package also comes with a config to only support modern browsers. The only difference to the default config is that it doesn't include IE 11.

If you don't need IE 11 support, you can use the following syntax:

```
extends @wearerequired/browserslist-config/modern
```
