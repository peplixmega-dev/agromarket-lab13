import { render } from '@testing-library/react';

// В проекте нет Router/AuthContext: App читает URL и сессию из браузера.
export function renderWithProviders(ui, { route = '/' } = {}) {
  window.history.replaceState({}, '', route);
  return render(ui);
}
