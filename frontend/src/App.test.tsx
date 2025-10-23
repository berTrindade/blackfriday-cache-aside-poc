import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders app header', () => {
    render(<App />);

    expect(
      screen.getByText(/Black Friday Cache-Aside POC/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Demonstrating cache-aside pattern/i)
    ).toBeInTheDocument();
  });
});
