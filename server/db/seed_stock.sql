-- Только для новой локальной демобазы, где нет действующих заказов.
UPDATE products SET stock = 20 WHERE stock = 0;
