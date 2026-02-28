interface WinMessengerEvents {
    [key: string]: {
        request: any;
        response: any;
    };
}

type Callback<T = any> = (payload: T) => void | Promise<void>;

export class WinMessenger<
    TParentEvents extends WinMessengerEvents,
    TChildEvents extends WinMessengerEvents,
    TWindowType extends 'parent' | 'child',
> {
    private windowLocation: string;
    private window: Window;
    private channelKey: string;
    private payloadKey: string;
    private timeout: number;

    constructor(options: {
        location: string;
        window: Window;
        channelKey?: string;
        payloadKey?: string;
        timeout?: number;
    }) {
        this.windowLocation = options.location || '*';
        this.window = options.window || window;
        this.channelKey = options.channelKey || 'channel';
        this.payloadKey = options.payloadKey || 'payload';
        this.timeout = options.timeout ?? 1000;
    }

    listenTo<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `on${T}`
                    : T extends keyof TChildEvents
                      ? `send${T}`
                      : never
                : T extends keyof TParentEvents
                  ? `send${T}`
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
        const listener = (me: MessageEvent) =>
            this.callbackInvoker(event, me, callback);

        this.window.addEventListener('message', listener);

        return {
            unsubscribe: () => {
                this.window.removeEventListener('message', listener);
            },
        };
    }

    listenToOnce<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `on${T}`
                    : T extends keyof TChildEvents
                      ? `send${T}`
                      : never
                : T extends keyof TParentEvents
                  ? `send${T}`
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
        const listener = (me: MessageEvent) => {
            if (me.data[this.channelKey] === event) {
                this.callbackInvoker(event, me, callback);
                this.window.removeEventListener('message', listener);
            }
        };

        this.window.addEventListener('message', listener);

        return {
            unsubscribe: () => {
                this.window.removeEventListener('message', listener);
            },
        };
    }

    call<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `send${T}`
                    : T extends keyof TChildEvents
                      ? `on${T}`
                      : never
                : T extends keyof TParentEvents
                  ? `on${T}`
                  : T extends keyof TChildEvents
                    ? `send${T}`
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
        this.window.postMessage(
            {
                [this.channelKey]: event,
                [this.payloadKey]: payload,
            },
            this.windowLocation,
        );
    }

    callAsync<T extends keyof TParentEvents | keyof TChildEvents>(
        event: T extends string
            ? TWindowType extends 'parent'
                ? T extends keyof TParentEvents
                    ? `send${T}`
                    : never
                : T extends keyof TParentEvents
                  ? never
                  : T extends keyof TChildEvents
                    ? `send${T}`
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
        let timeoutId: number | undefined;

        return Promise.race([
            new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error('Timeout')),
                    timeout,
                );
            }),
            new Promise<any>(resolve => {
                this.window.postMessage(
                    {
                        [this.channelKey]: event,
                        [this.payloadKey]: payload,
                    },
                    this.windowLocation,
                );

                clearTimeout(timeoutId);
                this.listenToOnce(this.getReverseEvent(event) as any, resolve);
            }),
        ]);
    }

    private callbackInvoker(
        channel: string,
        event: MessageEvent,
        callback: Callback,
    ) {
        if (event.data[this.channelKey] !== channel) return;

        if (
            this.windowLocation !== '*' &&
            event.origin !== this.windowLocation
        ) {
            return;
        }

        callback(event.data[this.payloadKey]);
    }

    private getReverseEvent(event: string): string {
        const onRegex = /^on(.+)$/;
        const sendRegex = /^send(.+)$/;

        if (onRegex.test(event)) {
            const group = onRegex.exec(event)?.[1];
            if (!group) throw Error('Invalid event');

            return `send${group}`;
        }

        if (sendRegex.test(event)) {
            const group = sendRegex.exec(event)?.[1];
            if (!group) throw Error('Invalid event');

            return `on${group}`;
        }

        throw Error('Invalid event');
    }
}
