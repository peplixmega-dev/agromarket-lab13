import { renderWithProviders as render } from '../test/utils';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductCard from './ProductCart';
import { products } from '../test/helpers';

const product = products[0];
describe('Карточка товара', () => {
  test('показывает название, цену, категорию и описание изображения', () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole('heading', { name: product.name })).toBeInTheDocument();
    expect(screen.getByText('3500 тенге')).toBeInTheDocument();
    expect(screen.getByText('Мёд')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: product.name })).toHaveAttribute('src', '/honey.png');
  });
  test('передаёт выбранный товар обработчику ровно один раз', async () => {
    const onAdd = vi.fn();
    render(<ProductCard product={product} onAdd={onAdd} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'В корзину' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(product);
  });
  test('отмечает только избранный товар', () => {
    const { rerender } = render(<ProductCard product={product} featured />);
    expect(screen.getByText('мега товары')).toBeInTheDocument();
    rerender(<ProductCard product={product} />);
    expect(screen.queryByText('мега товары')).not.toBeInTheDocument();
  });
});

test('название ведёт на страницу товара, показана единица измерения', () => {
  render(<ProductCard product={product} />);
  expect(screen.getByRole('link', { name: product.name })).toHaveAttribute('href', '/products/1');
  expect(screen.getByText('Единица: кг')).toBeInTheDocument();
});
test('удаление требует подтверждения', async () => {
  const onDelete = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<ProductCard product={product} onDelete={onDelete} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Удалить товар' }));
  expect(onDelete).not.toHaveBeenCalled();
});
test('ошибка удаления остаётся видимой', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onDelete = vi.fn().mockRejectedValue(new Error('Нет доступа'));
  render(<ProductCard product={product} onDelete={onDelete} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Удалить товар' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет доступа');
  expect(onDelete).toHaveBeenCalledWith(product);
});
