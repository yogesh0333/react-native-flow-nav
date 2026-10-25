import { describe, expect, it, vi } from 'vitest';
import { createFlow, defineApp, screen, type RnnAdapter } from '../src';

function adapter(): RnnAdapter & { appear(id: string): void } {
  let listener: ((event: { componentId: string }) => void) | undefined;
  return {
    registerComponent: vi.fn(), setRoot: vi.fn().mockResolvedValue(undefined), setStackRoot: vi.fn().mockResolvedValue(undefined), push: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined), showOverlay: vi.fn().mockResolvedValue(undefined),
    dismissModal: vi.fn().mockResolvedValue(undefined), dismissOverlay: vi.fn().mockResolvedValue(undefined), pop: vi.fn().mockResolvedValue(undefined),
    onComponentDidAppear(next) { listener = next; return () => { listener = undefined; }; },
    appear(id) { listener?.({ componentId: id }); }
  };
}

const Home = () => null;
const Profile = (_props: { userId: string }) => null;

describe('react-native-flow-nav', () => {
  it('registers each screen and creates a native stack root', async () => {
    const native = adapter();
    const app = defineApp({ id: 'demo', start: 'Home', screens: { Home: screen(Home), Profile: screen(Profile) } });
    const nav = createFlow(app, native);
    await nav.start();
    expect(native.registerComponent).toHaveBeenCalledTimes(2);
    expect(native.setRoot).toHaveBeenCalledWith({ root: { stack: { children: [{ component: { name: 'demo.Home', passProps: undefined, options: {} } }] } } });
  });

  it('uses the current native component id without exposing it to callers', async () => {
    const native = adapter();
    const nav = createFlow(defineApp({ start: 'Home', screens: { Home: screen(Home), Profile: screen(Profile) } }), native);
    native.appear('native-home-id');
    await nav.to('Profile', { userId: '42' });
    expect(native.push).toHaveBeenCalledWith('native-home-id', { component: { name: 'app.Profile', passProps: { userId: '42' }, options: {} } });
  });

  it('keeps native tabs as separate stacks', async () => {
    const native = adapter();
    const nav = createFlow(defineApp({ start: 'Home', tabs: ['Home', 'Search'], screens: { Home: screen(Home), Search: screen(Home) } }), native);
    await nav.start();
    expect(native.setRoot).toHaveBeenCalledWith({ root: { bottomTabs: { children: [
      { stack: { children: [{ component: { name: 'app.Home', passProps: undefined, options: {} } }] } },
      { stack: { children: [{ component: { name: 'app.Search', passProps: undefined, options: {} } }] } }
    ] } } });
  });

  it('honours a screen presentation and can replace a stack root', async () => {
    const native = adapter();
    const nav = createFlow(defineApp({ start: 'Home', screens: {
      Home: screen(Home), Profile: screen(Profile, { presentation: 'modal' })
    } }), native);
    native.appear('native-home-id');
    await nav.to('Profile', { userId: '42' });
    expect(native.showModal).toHaveBeenCalledOnce();
    await nav.replace('Profile', { userId: '43' });
    expect(native.setStackRoot).toHaveBeenCalledWith('native-home-id', expect.any(Object));
  });

  it('redirects unauthenticated attempts and preserves nested native tab stacks', async () => {
    const native = adapter();
    const blocked = vi.fn();
    const nav = createFlow(defineApp({
      start: 'Home',
      tabs: ['Home', 'Orders'],
      auth: { isAuthenticated: () => false, login: 'Login', onBlocked: blocked },
      screens: {
        Login: screen(Home),
        Home: screen(Home),
        Orders: screen(Home, { requiresAuth: true }),
        OrderDetails: screen(Profile, { requiresAuth: true }),
      },
    }), native);
    native.appear('home-stack');
    await nav.to('OrderDetails', { userId: 'order-42' });
    expect(blocked).toHaveBeenCalledWith({ route: 'OrderDetails', params: { userId: 'order-42' } });
    expect(native.push).toHaveBeenCalledWith('home-stack', { component: { name: 'app.Login', passProps: undefined, options: {} } });
  });

  it('rejects invalid auth declarations', () => {
    expect(() => defineApp({
      start: 'Home', auth: { isAuthenticated: () => false, login: 'Missing' }, screens: { Home: screen(Home) }
    } as never)).toThrow('Unknown login screen');
    expect(() => defineApp({
      start: 'Home', auth: { isAuthenticated: () => false, login: 'Login' }, screens: { Home: screen(Home), Login: screen(Home, { requiresAuth: true }) }
    })).toThrow('must not require');
  });

  it('rejects unsafe and circular params before they reach native code', async () => {
    const native = adapter();
    const nav = createFlow(defineApp({ start: 'Home', screens: { Home: screen(Home), Profile: screen(Profile) } }), native);
    native.appear('native-home-id');
    await expect(nav.to('Profile', JSON.parse('{"__proto__":{"polluted":true}}'))).rejects.toThrow('Unsafe navigation param key');
    const circular: { self?: unknown } = {}; circular.self = circular;
    await expect(nav.to('Profile', circular as { userId: string })).rejects.toThrow('circular');
    expect(native.push).not.toHaveBeenCalled();
  });

  it('fails early for invalid route declarations', () => {
    expect(() => defineApp({ start: 'Missing', screens: { Home: screen(Home) } } as never)).toThrow('Unknown start screen');
    expect(() => defineApp({ id: 'bad name!', start: 'Home', screens: { Home: screen(Home) } })).toThrow('app.id');
  });
});
