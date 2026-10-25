# react-native-flow-nav

The easiest typed navigation API for React Native. Its route core has no runtime dependency on an older navigation engine, and adapters can target native navigation implementations.

> Status: early v0.1. It is intentionally small and suitable for experimentation; do not use it in production yet.

## Install

```sh
npm install react-native-flow-nav
```

### Install from GitHub

Until the npm registry release is available, install the checked-in source directly from GitHub:

```sh
npm install github:yogesh0333/react-native-flow-nav#main react-native-navigation
```

The repository's `prepare` script builds the package during installation.

The current `rnnAdapter` is a compatibility adapter: install `react-native-navigation` only when using it. The Flow Nav core supports current React Native releases independently; its own latest-RN Swift/Kotlin driver is the next package in development.

## Quick start

```ts
import { createFlow, defineApp, rnnAdapter, screen } from 'react-native-flow-nav';
import { Navigation } from 'react-native-navigation';

const app = defineApp({
  id: 'myApp',
  start: 'Home',
  screens: {
    Home: screen(HomeScreen),
    Profile: screen<{ userId: string }>(ProfileScreen),
    EditProfile: screen<{ userId: string }>(EditProfileScreen, {
      presentation: 'modal',
      options: { modalPresentationStyle: 'pageSheet' },
    }),
  },
});

const nav = createFlow(app, rnnAdapter(Navigation));

Navigation.events().registerAppLaunchedListener(() => nav.start());

// Anywhere after a screen appears:
nav.to('Profile', { userId: '42' });
nav.modal('EditProfile', { userId: '42' });
nav.back();
```

`nav.raw((Navigation, componentId) => ...)` preserves access to RNN for an advanced platform-only feature.

## Security

- Route definitions are frozen after creation.
- Every `passProps` value is checked for prototype-pollution keys and circular objects before it reaches the native bridge.
- The package never evaluates routes, URLs, or user-provided JavaScript.
- Keep secrets out of navigation params: Android task snapshots, logs, analytics, crash reports, and restoration systems may expose them.

## Development

```sh
npm install
npm run check
npm pack --dry-run
```

The CI workflow runs linting, TypeScript checks, tests with coverage, a production build, and npm's dry-run packaging check.
