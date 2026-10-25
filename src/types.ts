export type Component<P> = (props: P) => unknown;

export type Presentation = 'push' | 'modal' | 'overlay';

export type ScreenOptions = Readonly<{
  presentation?: Presentation;
  /** A protected route redirects to the app's login route when unauthenticated. */
  requiresAuth?: boolean;
  /** Passed unchanged to the selected native adapter. */
  options?: Record<string, unknown>;
}>;

export type ScreenDefinition<P = undefined> = Readonly<{
  component: Component<P>;
  options: ScreenOptions;
}>;

/** Internal constraint that accepts a screen with any parameter shape. */
export type AnyScreenDefinition = ScreenDefinition<never>;

export type ParamsOf<T> = T extends ScreenDefinition<infer P>
  ? [P] extends [undefined]
    ? undefined
    : P
  : never;

export type AppDefinition<S extends Record<string, AnyScreenDefinition>> = Readonly<{
  id?: string;
  start: keyof S & string;
  screens: S;
  /** Each tab owns a native stack. Defaults to a single root stack. */
  tabs?: readonly (keyof S & string)[];
  /** Opt-in route protection. The login route must not itself require auth. */
  auth?: Readonly<{
    isAuthenticated: () => boolean | Promise<boolean>;
    login: keyof S & string;
    onBlocked?: (attempt: Readonly<{ route: keyof S & string; params: unknown }>) => void;
  }>;
}>;

export type RnnLayout = Record<string, unknown>;

export interface RnnAdapter {
  registerComponent(name: string, provider: () => unknown): void;
  setRoot(layout: RnnLayout): Promise<void>;
  setStackRoot(componentId: string, layout: RnnLayout): Promise<void>;
  push(componentId: string, layout: RnnLayout): Promise<void>;
  showModal(layout: RnnLayout): Promise<void>;
  showOverlay(layout: RnnLayout): Promise<void>;
  dismissModal(componentId: string): Promise<void>;
  dismissOverlay(componentId: string): Promise<void>;
  pop(componentId: string): Promise<void>;
  setDefaultOptions?(options: Record<string, unknown>): void;
  onComponentDidAppear?(listener: (event: { componentId: string }) => void): () => void;
}

/** The small subset of RNN that Flow Nav needs. */
export interface RnnNavigation {
  registerComponent(name: string, provider: () => unknown): void;
  setRoot(layout: RnnLayout): Promise<void>;
  setStackRoot(componentId: string, layout: RnnLayout): Promise<void>;
  push(componentId: string, layout: RnnLayout): Promise<void>;
  showModal(layout: RnnLayout): Promise<void>;
  showOverlay(layout: RnnLayout): Promise<void>;
  dismissModal(componentId: string): Promise<void>;
  dismissOverlay(componentId: string): Promise<void>;
  pop(componentId: string): Promise<void>;
  events(): { registerComponentDidAppearListener(listener: (event: { componentId: string }) => void): { remove(): void } };
}

export type FlowNavigator<S extends Record<string, AnyScreenDefinition>> = Readonly<{
  start(): Promise<void>;
  to<K extends keyof S & string>(name: K, ...args: ParamsOf<S[K]> extends undefined ? [] | [undefined] : [ParamsOf<S[K]>]): Promise<void>;
  replace<K extends keyof S & string>(name: K, ...args: ParamsOf<S[K]> extends undefined ? [] | [undefined] : [ParamsOf<S[K]>]): Promise<void>;
  modal<K extends keyof S & string>(name: K, ...args: ParamsOf<S[K]> extends undefined ? [] | [undefined] : [ParamsOf<S[K]>]): Promise<void>;
  overlay<K extends keyof S & string>(name: K, ...args: ParamsOf<S[K]> extends undefined ? [] | [undefined] : [ParamsOf<S[K]>]): Promise<void>;
  back(): Promise<void>;
  dismiss(): Promise<void>;
  /** Full RNN access for rare platform-specific requirements. */
  raw<T>(operation: (adapter: RnnAdapter, componentId: string | undefined) => T): T;
}>;
