const formatter = new Intl.NumberFormat('ru-RU');
export const money = (value) => `${formatter.format(value)} ₸`;
