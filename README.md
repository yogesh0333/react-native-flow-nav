# react-native-flow-nav

The easiest typed API for **React Native Navigation**. It keeps RNN as the native engine and removes component registration, layout JSON, and component IDs from everyday app code.

> Status: early v0.1. It is intentionally small and suitable for experimentation; do not use it in production yet.

## Install

```sh
npm install react-native-flow-nav react-native-navigation
```

Complete React Native Navigation's native installation first. This package does not replace that native setup.

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
