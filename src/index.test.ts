import { describe, expect, it } from '@rstest/core';

import { WinMessenger } from './index.js';

type ParentEvents = {
    Ping: {
        request: string;
        response: number;
    };
};

type ChildEvents = {
    Notify: {
        request: boolean;
        response: string;
    };
};

class MockWindow {
    public sentMessages: Array<{ message: unknown; targetOrigin: string }> = [];
    public onPostMessage?: (message: unknown, targetOrigin: string) => void;

    private listeners = new Set<(event: MessageEvent) => void>();

    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
    ) {
        if (type !== 'message') return;

        const safeListener = listener as (event: MessageEvent) => void;
        this.listeners.add(safeListener);
    }

    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
    ) {
        if (type !== 'message') return;

        const safeListener = listener as (event: MessageEvent) => void;
        this.listeners.delete(safeListener);
    }

    postMessage(message: unknown, targetOrigin: string) {
        this.sentMessages.push({ message, targetOrigin });
        this.onPostMessage?.(message, targetOrigin);
    }

    emitMessage(data: unknown, origin: string) {
        const event = new MessageEvent('message', { data, origin });

        for (const listener of this.listeners) {
            listener(event);
        }
    }
}

describe('WinMessenger', () => {
    it('call should post a message using configured channel and payload keys', () => {
        const mockWindow = new MockWindow();

        const messenger = new WinMessenger<ParentEvents, ChildEvents, 'parent'>(
            {
                location: 'https://child.app',
                window: mockWindow as unknown as Window,
                channelKey: 'messageType',
                payloadKey: 'body',
            },
        );

        messenger.call('sendPing', 'hello');

        expect(mockWindow.sentMessages).toHaveLength(1);
        expect(mockWindow.sentMessages[0]).toEqual({
            message: {
                messageType: 'sendPing',
                body: 'hello',
            },
            targetOrigin: 'https://child.app',
        });
    });

    it('listenTo should invoke callback only for matching event and origin', () => {
        const mockWindow = new MockWindow();
        const payloads: number[] = [];

        const messenger = new WinMessenger<ParentEvents, ChildEvents, 'parent'>(
            {
                location: 'https://trusted.app',
                window: mockWindow as unknown as Window,
            },
        );

        const subscription = messenger.listenTo('onPing', payload => {
            payloads.push(payload);
        });

        mockWindow.emitMessage(
            { channel: 'onPing', payload: 7 },
            'https://trusted.app',
        );
        mockWindow.emitMessage(
            { channel: 'onPing', payload: 8 },
            'https://untrusted.app',
        );
        mockWindow.emitMessage(
            { channel: 'sendPing', payload: 9 },
            'https://trusted.app',
        );

        subscription.unsubscribe();

        mockWindow.emitMessage(
            { channel: 'onPing', payload: 10 },
            'https://trusted.app',
        );

        expect(payloads).toEqual([7]);
    });

    it('listenToOnce should invoke callback a single time', () => {
        const mockWindow = new MockWindow();
        const payloads: number[] = [];

        const messenger = new WinMessenger<ParentEvents, ChildEvents, 'parent'>(
            {
                location: '*',
                window: mockWindow as unknown as Window,
            },
        );

        messenger.listenToOnce('onPing', payload => {
            payloads.push(payload);
        });

        mockWindow.emitMessage(
            { channel: 'onPing', payload: 1 },
            'https://a.app',
        );
        mockWindow.emitMessage(
            { channel: 'onPing', payload: 2 },
            'https://a.app',
        );

        expect(payloads).toEqual([1]);
    });

    it('callAsync should resolve with response payload when reverse event arrives', async () => {
        const mockWindow = new MockWindow();

        const messenger = new WinMessenger<ParentEvents, ChildEvents, 'parent'>(
            {
                location: 'https://child.app',
                window: mockWindow as unknown as Window,
                timeout: 250,
            },
        );

        mockWindow.onPostMessage = message => {
            const messageData = message as { channel?: string };

            if (messageData.channel === 'sendPing') {
                setTimeout(() => {
                    mockWindow.emitMessage(
                        { channel: 'onPing', payload: 42 },
                        'https://child.app',
                    );
                }, 0);
            }
        };

        const result = await messenger.callAsync('sendPing', 'request');

        expect(result).toBe(42);
    });
});
