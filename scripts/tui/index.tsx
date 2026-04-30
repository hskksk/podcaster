#!/usr/bin/env tsx
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

const isMock = process.argv.includes('--mock');

render(<App isMock={isMock} />);
