import { assertSafeParams } from './security';
import type { AnyScreenDefinition, AppDefinition, Component, FlowNavigator, RnnAdapter, RnnLayout, RnnNavigation, ScreenDefinition, ScreenOptions } from './types';

export type { AnyScreenDefinition, AppDefinition, Component, FlowNavigator, ParamsOf, Presentation, RnnAdapter, RnnLayout, RnnNavigation, ScreenDefinition, ScreenOptions } from './types';

/** Convert RNN's singleton to Flow Nav's lightweight adapter. */
export function rnnAdapter(navigation: RnnNavigation): RnnAdapter {
  return {
    registerComponent: navigation.registerComponent.bind(navigation),
    setRoot: navigation.setRoot.bind(navigation),
    setStackRoot: navigation.setStackRoot.bind(navigation),
    push: navigation.push.bind(navigation),
    showModal: navigation.showModal.bind(navigation),
    showOverlay: navigation.showOverlay.bind(navigation),
    dismissModal: navigation.dismissModal.bind(navigation),
    dismissOverlay: navigation.dismissOverlay.bind(navigation),
    pop: navigation.pop.bind(navigation),
    onComponentDidAppear(listener) {
      const subscription = navigation.events().registerComponentDidAppearListener(listener);
      return () => subscription.remove();
    }
  };
}

/** Define a screen once; its prop type becomes the type of nav.to(...). */
export function screen<P = undefined>(component: Component<P>, options: ScreenOptions = {}): ScreenDefinition<P> {
  return Object.freeze({ component, options: Object.freeze({ ...options }) });
}

export function defineApp<const S extends Record<string, AnyScreenDefinition>>(app: AppDefinition<S>): AppDefinition<S> {
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(app.id ?? 'app')) throw new TypeError('app.id may contain only letters, numbers, ., _, and -.');
  if (!(app.start in app.screens)) throw new TypeError(`Unknown start screen: ${app.start}`);
  for (const tab of app.tabs ?? []) if (!(tab in app.screens)) throw new TypeError(`Unknown tab screen: ${tab}`);
  if (app.auth) {
    if (!(app.auth.login in app.screens)) throw new TypeError(`Unknown login screen: ${app.auth.login}`);
    if (app.screens[app.auth.login].options.requiresAuth) throw new TypeError('The login screen must not require authentication.');
  }
  return Object.freeze({ ...app, screens: Object.freeze({ ...app.screens }), tabs: app.tabs ? Object.freeze([...app.tabs]) : undefined });
}

/**
 * Creates a type-safe, deliberately small API over RNN. The adapter is injected
 * so this package has no runtime dependency on a native module and stays testable.
 */
export function createFlow<const S extends Record<string, AnyScreenDefinition>>(app: AppDefinition<S>, adapter: RnnAdapter): FlowNavigator<S> {
  const prefix = app.id ?? 'app';
  let activeComponentId: string | undefined;
  const registered = new Set<string>();

  const screenName = (name: string) => `${prefix}.${name}`;
  const getScreen = (name: string): AnyScreenDefinition => {
    const definition = app.screens[name];
    if (!definition) throw new TypeError(`Unknown screen: ${name}`);
    return definition;
  };
  const layout = (name: string, params: unknown = undefined): RnnLayout => {
    assertSafeParams(params);
    const definition = getScreen(name);
    return { component: { name: screenName(name), passProps: params, options: definition.options.options ?? {} } };
  };
  const requireActive = (): string => {
    if (!activeComponentId) throw new Error('Navigation is not ready. Call nav.start() before navigating.');
    return activeComponentId;
  };
  const register = () => {
    if (registered.size) return;
    for (const [name, definition] of Object.entries(app.screens)) {
      adapter.registerComponent(screenName(name), () => definition.component);
      registered.add(name);
    }
    adapter.onComponentDidAppear?.(({ componentId }) => { activeComponentId = componentId; });
  };
  const firstArg = (args: unknown[]) => args[0];
  const resolveRoute = async (name: string, params: unknown): Promise<{ name: string; params: unknown }> => {
    const screen = getScreen(name);
    if (!screen.options.requiresAuth) return { name, params };
    if (!app.auth) throw new Error(`Screen ${name} requires auth, but no auth configuration was provided.`);
    if (await app.auth.isAuthenticated()) return { name, params };
    app.auth.onBlocked?.({ route: name as keyof S & string, params });
    return { name: app.auth.login, params: undefined };
  };
  const open = async (requestedName: string, requestedParams: unknown, forced?: 'modal' | 'overlay') => {
    const { name, params } = await resolveRoute(requestedName, requestedParams);
    const mode = forced ?? getScreen(name).options.presentation ?? 'push';
    if (mode === 'modal') return adapter.showModal(layout(name, params));
    if (mode === 'overlay') return adapter.showOverlay(layout(name, params));
    return adapter.push(requireActive(), layout(name, params));
  };

  register();
  return Object.freeze({
    async start() {
      const initial = await resolveRoute(app.start, undefined);
      const root = app.tabs?.length
        ? { root: { bottomTabs: { children: app.tabs.map((name) => ({ stack: { children: [layout(name)] } })) } } }
        : { root: { stack: { children: [layout(initial.name, initial.params)] } } };
      await adapter.setRoot(root);
    },
    async to(name, ...args) { await open(name, firstArg(args)); },
    async replace(name, ...args) { await adapter.setStackRoot(requireActive(), layout(name, firstArg(args))); },
    async modal(name, ...args) { await adapter.showModal(layout(name, firstArg(args))); },
    async overlay(name, ...args) { await adapter.showOverlay(layout(name, firstArg(args))); },
    async back() { await adapter.pop(requireActive()); },
    async dismiss() { await adapter.dismissModal(requireActive()); },
    raw(operation) { return operation(adapter, activeComponentId); }
  }) as FlowNavigator<S>;
}
