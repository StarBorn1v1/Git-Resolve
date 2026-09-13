#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app';

// Industry standard: Enter alternate screen buffer to keep scrollback clean
process.stdout.write('\x1b[?1049h');

const { unmount } = render(<App />);

// Leave alternate screen buffer on exit
process.on('exit', () => {
    process.stdout.write('\x1b[?1049l');
});
