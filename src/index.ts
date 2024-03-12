export type TWindowMessager = {
    events: Record<
        string,
        {
            request: any;
            response: any;
        }
    >;
};

type Callback<T = any> = (payload: T) => void | Promise<void>;

export class WindowMessager<
    WM extends TWindowMessager,
    TSide extends 'parent' | 'child',
> {
    #listeners = new Map<string, Callback[]>();

    constructor(
        private options: {
            location: string;
            channelKey?: string;
            payloadKey?: string;
        },
    ) {
        this._registerListener();
    }

    private get windowLocation(): string {
        return this.options.location ?? '*';
    }

    private get channelKey(): string {
        return this.options.channelKey ?? 'channel';
    }

    private get payloadKey(): string {
        return this.options.payloadKey ?? 'payload';
    }

    on<T extends keyof WM['events']>(
        event: TSide extends 'parent'
            ? T extends string
                ? `on${T}`
                : 'onReady'
            : T extends string
            ? `request${T}`
            : 'requestReady',
        callback: Callback<
            TSide extends 'parent'
                ? WM['events'][T]['response']
                : WM['events'][T]['request']
        >,
    ) {
        if (!this.#listeners.has(event as string)) {
            this.#listeners.set(event as string, []);
        }

        this.#listeners.get(event as string)?.push(callback);

        return {
            unsubscribe: () => {
                this.#listeners.set(
                    event as string,
                    this.#listeners
                        .get(event as string)
                        ?.filter(cb => cb !== callback) ?? [],
                );
            },
        };
    }

    call<T extends keyof WM['events']>(
        event: TSide extends 'parent'
            ? T extends string
                ? `request${T}`
                : 'requestReady'
            : T extends string
            ? `on${T}`
            : 'onReady',
        payload: TSide extends 'parent'
            ? WM['events'][T]['request']
            : WM['events'][T]['response'],
    ) {
        window.postMessage(
            {
                [this.channelKey]: event,
                [this.payloadKey]: payload,
            },
            this.windowLocation,
        );
    }

    callSync<T extends keyof WM['events']>(
        event: TSide extends 'parent'
            ? T extends string
                ? `request${T}`
                : 'requestReady'
            : T extends string
            ? `on${T}`
            : 'onReady',
        payload: TSide extends 'parent'
            ? WM['events'][T]['request']
            : WM['events'][T]['response'],
        timeout: number = 1000,
    ): Promise<
        TSide extends 'parent'
            ? WM['events'][T]['response']
            : WM['events'][T]['request']
    > {
        window.postMessage(
            {
                [this.channelKey]: event,
                [this.payloadKey]: payload,
            },
            this.windowLocation,
        );

        return Promise.race([
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeout),
            ),
            new Promise(resolve => {
                this.on(this.#getReverseEvent(event) as any, resolve);
            }),
        ]);
    }

    #listener(event: MessageEvent) {
        if (event.origin !== this.windowLocation) return;

        if (!this.#listeners.has(event.data[this.channelKey])) return;

        this.#listeners
            .get(event.data[this.channelKey])
            ?.forEach(cb => cb(event.data[this.payloadKey]));
    }

    #getReverseEvent(event: string): string {
        const onRegex = /^on(.+)$/;
        const requestRegex = /^request(.+)$/;

        if (onRegex.test(event)) {
            const group = onRegex.exec(event)?.[1];
            if (!group) throw Error('Invalid event');

            return group;
        }

        if (requestRegex.test(event)) {
            const group = requestRegex.exec(event)?.[1];
            if (!group) throw Error('Invalid event');

            return group;
        }

        throw Error('Invalid event');
    }

    _registerListener() {
        window.addEventListener('message', this.#listener);
    }

    _unregisterListener() {
        window.removeEventListener('message', this.#listener);
    }
}
