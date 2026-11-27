const labels = { name: 'Имя / название', email: 'Email', password: 'Пароль', price: 'Цена', stock: 'Остаток', category: 'Категория', unit: 'Единица измерения', image: 'Изображение' };
export default function ValidationErrors({ details = [] }) {
  if (!details.length) return null;
  return <ul aria-label="Ошибки полей" role="alert">
    {details.map(({ field, message }, index) => <li key={`${field}-${index}`}>
      {labels[field] || field || 'Форма'}: {message}
    </li>)}
  </ul>;
}
