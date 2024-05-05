type WindowMessagerEvents = {
    [key: string]: {
        request: any;
        response: any;
    };
};

type Callback<T = any> = (payload: T) => void | Promise<void>;

export class WindowMessager<
    TParentEvents extends WindowMessagerEvents,
    TChildEvents extends WindowMessagerEvents,
    TWindowType extends 'parent' | 'child',
> {
    #listeners = new Map<string, Callback[]>();

    constructor(
        private options: {
            location: string;
            channelKey?: string;
            payloadKey?: string;
            timeout?: number;
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

    private get timeout(): number {
        return this.options.timeout ?? 1000;
    }

    listenTo<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `on${T}`
                    : T extends keyof TChildEvents
                      ? `request${T}`
                      : never
                : T extends keyof TParentEvents
                  ? `request${T}`
                  : T extends keyof TChildEvents
                    ? `on${T}`
                    : never
            : never,
        callback: Callback<
            TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? TParentEvents[T]['response']
                    : T extends keyof TChildEvents
                      ? TChildEvents[T]['request']
                      : never
                : T extends keyof TParentEvents
                  ? TParentEvents[T]['request']
                  : T extends keyof TChildEvents
                    ? TChildEvents[T]['response']
                    : never
        >,
    ) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, []);
        }

        this.#listeners.get(event)?.push(callback);

        return {
            unsubscribe: () => {
                this.#listeners.set(
                    event,
                    this.#listeners.get(event)?.filter(cb => cb !== callback) ??
                        [],
                );
            },
        };
    }

    listenToOnce<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `on${T}`
                    : T extends keyof TChildEvents
                      ? `request${T}`
                      : never
                : T extends keyof TParentEvents
                  ? `request${T}`
                  : T extends keyof TChildEvents
                    ? `on${T}`
                    : never
            : never,
        callback: Callback<
            TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? TParentEvents[T]['response']
                    : T extends keyof TChildEvents
                      ? TChildEvents[T]['request']
                      : never
                : T extends keyof TParentEvents
                  ? TParentEvents[T]['request']
                  : T extends keyof TChildEvents
                    ? TChildEvents[T]['response']
                    : never
        >,
    ) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, []);
        }

        this.#listeners.get(event)?.push(payload => {
            callback(payload);

            this.#listeners.set(
                event,
                this.#listeners.get(event)?.filter(cb => cb !== callback) ?? [],
            );
        });
    }

    call<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `request${T}`
                    : T extends keyof TChildEvents
                      ? `on${T}`
                      : never
                : T extends keyof TParentEvents
                  ? `on${T}`
                  : T extends keyof TChildEvents
                    ? `request${T}`
                    : never
            : never,
        payload: TWindowType extends 'parent'
            ? T extends keyof TParentEvents
                ? TParentEvents[T]['request']
                : T extends keyof TChildEvents
                  ? TChildEvents[T]['response']
                  : never
            : T extends keyof TParentEvents
              ? TParentEvents[T]['response']
              : T extends keyof TChildEvents
                ? TChildEvents[T]['request']
                : never,
    ) {
        window.postMessage(
            {
                [this.channelKey]: event,
                [this.payloadKey]: payload,
            },
            this.windowLocation,
        );
    }

    callSync<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `request${T}`
                    : never
                : T extends keyof TParentEvents
                  ? never
                  : T extends keyof TChildEvents
                    ? `request${T}`
                    : never
            : never,
        payload: TWindowType extends 'parent'
            ? T extends keyof TParentEvents
                ? TParentEvents[T]['request']
                : T extends keyof TChildEvents
                  ? TChildEvents[T]['response']
                  : never
            : T extends keyof TParentEvents
              ? TParentEvents[T]['response']
              : T extends keyof TChildEvents
                ? TChildEvents[T]['request']
                : never,
        timeout: number = this.timeout,
    ): Promise<
        TWindowType extends 'parent'
            ? T extends keyof TParentEvents
                ? TParentEvents[T]['response']
                : T extends keyof TChildEvents
                  ? TChildEvents[T]['request']
                  : never
            : T extends keyof TParentEvents
              ? TParentEvents[T]['request']
              : T extends keyof TChildEvents
                ? TChildEvents[T]['response']
                : never
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
            new Promise<any>(resolve => {
                this.listenToOnce(this.#getReverseEvent(event) as any, resolve);
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
