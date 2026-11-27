import { render } from '@testing-library/react';

import CartProvider from '../context/CartProvider';
export function renderWithProviders(ui, { route = '/' } = {}) {
  window.history.replaceState({}, '', route);
  return render(ui, { wrapper: CartProvider });
}
