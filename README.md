# Win Messenger

`Win Messenger` is a lightweight utility class that facilitates communication between different windows or iframes within a web application. It allows you to send and receive messages across windows using the `window.postMessage` API.

## Installation

You can install `Win Messenger` via npm, yarn or pnpm:

```bash
npm install win-messenger
# or
yarn add win-messenger
# or
pnpm i win-messenger
```

## Usage

1. Import `WinMessenger` into your project:

```typescript
import { WinMessenger } from 'win-messenger';
```

2. Define your custom event types for both parent and child windows:

```typescript
type ParentEvents = {
  ParentEvent: {
    request: number;
    response: boolean;
  };
};

type ChildEvents = {
  ChildEvent: {
    request: string;
    response: {
      id: string;
    }
  }
};
```

3. Create instances of `WinMessenger` for the parent and child windows:

```typescript
// Parent window
export const parentMessenger = new WinMessenger<ParentEvents, ChildEvents, 'parent'>({
  location: 'https://example.com', // Specify the target window's origin
  window: window, // Reference to the current window
  channelKey: 'channel', // Customize the message channel key (optional)
  payloadKey: 'payload', // Customize the payload key (optional)
  timeout: 1000, // Set a timeout for synchronous calls (optional)
});

// Child window (iframe)
export const childMessenger = new WinMessenger<ParentEvents, ChildEvents, 'child'>({
  location: 'https://example.com', // Specify the target window's origin
  window: window.parent, // Reference to the parent window
  channelKey: 'channel', // Customize the message channel key (optional)
  payloadKey: 'payload', // Customize the payload key (optional)
  timeout: 1000, // Set a timeout for synchronous calls (optional)
});
```

4. Listen for messages:

```typescript
// Listen to an event in the parent window
parentMessenger.listenTo('sendChildEvent', (payload) => {
  // Handle the request
  // ...
});

parentMessenger.listenToOnce('onParentEvent', (payload) => {
  // Handle the request
  // ...
});

// Listen to an event once in the child window
childMessenger.listenTo('sendParentEvent', (payload) => {
  // Handle the request
  // ...
});

childMessenger.listenToOnce('onChildEvent', (payload) => {
  // Handle the request
  // ...
});
```

5. Send messages:

```typescript
// Send a request from the parent window
parentMessenger.call('sendParentEvent', 0);

// Send a synchronous message (returns a Promise)
try {
    const response = await parentMessenger.callSync('sendParentEvent', 0);
    if (response === true) {
      console.log('Received synchronous response with success');
    } else {
      console.log('Received synchronous response with failure');
    }
} catch (error) {
    console.error('Error:', error.message);
}

// Send a request from the child window
childMessenger.call('sendChildEvent', 'payload');

// Send a synchronous message (returns a Promise)
try {
    const response = await childMessenger.callSync('sendChildEvent', 'payload');
    console.log('Received synchronous response:', response.id);
} catch (error) {
    console.error('Error:', error.message);
}
```

6. Clean up:

```typescript
// Unsubscribe from an event
const subscription = parentMessenger.listenTo('sendChildEvent', payload => {
    // ...
});
subscription.unsubscribe();
```

## License

This library is released under the MIT License. See the [LICENSE](LICENSE) file for details.

