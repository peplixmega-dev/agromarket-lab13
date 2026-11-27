import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductCard from '../components/ProductCart';
import { products } from '../test/handlers';
import { renderWithProviders as render } from '../test/utils';

const honey = products[0];
const saved = () => JSON.parse(localStorage.getItem('cart'));

test('два добавления сохраняют одну строку с количеством два', async () => {
  const user = userEvent.setup();
  render(<ProductCard product={honey} />);
  const button = screen.getByRole('button', { name: 'В корзину' });
  await user.dblClick(button);
  expect(screen.getByText('В корзине: 2')).toBeInTheDocument();
  expect(saved()).toEqual([{ productId: honey.id, name: honey.name, price: honey.price, stock: 2, quantity: 2 }]);
});

test('больше остатка добавить нельзя', async () => {
  const user = userEvent.setup();
  render(<ProductCard product={{ ...honey, stock: 1 }} />);
  const button = screen.getByRole('button', { name: 'В корзину' });
  await user.click(button);
  expect(button).toBeDisabled();
  await user.click(button);
  expect(saved()[0].quantity).toBe(1);
});

test('у отсутствующего товара неактивная кнопка', () => {
  render(<ProductCard product={{ ...honey, stock: 0 }} />);
  expect(screen.getByRole('button', { name: 'Нет в наличии' })).toBeDisabled();
});

test('повторное открытие восстанавливает количество из localStorage', async () => {
  const first = render(<ProductCard product={honey} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'В корзину' }));
  first.unmount();
  render(<ProductCard product={honey} />);
  expect(screen.getByText('В корзине: 1')).toBeInTheDocument();
});
