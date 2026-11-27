BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0
  CONSTRAINT products_stock_check CHECK (stock >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS farmer_id integer REFERENCES users(id);

-- В orders уже лежат оптовые заявки ЛР7. Покупки имеют собственный жизненный цикл.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id serial PRIMARY KEY,
  buyer_id integer NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'shipped', 'cancelled')),
  total bigint NOT NULL CHECK (total > 0),
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id integer NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price integer NOT NULL CHECK (price > 0),
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS purchase_orders_buyer_idx ON purchase_orders(buyer_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items(product_id);
CREATE INDEX IF NOT EXISTS products_farmer_idx ON products(farmer_id);
COMMIT;
