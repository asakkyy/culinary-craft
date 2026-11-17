-- Demonstration content is inserted once by Flyway, never on each application start.
INSERT INTO demo_users (id, name, role, initials, subtitle) VALUES
(1, 'Анна Петрова', 'USER', 'АП', 'Любитель домашней кухни'),
(2, 'Максим Еремин', 'USER', 'МЕ', 'Автор рецептов'),
(3, 'Марина Волкова', 'ADMIN', 'МВ', 'Модератор сообщества');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(1, 'Панкейки с ягодами и мёдом', 'Воздушные, золотистые панкейки с сезонными ягодами — идеальное начало неспешного утра.', 'Завтраки', '🥞', 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=900&q=85', 25, 2, 'Легко', 1, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '10 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(1, 0, 'Мука — 180 г'),
(1, 1, 'Молоко — 200 мл'),
(1, 2, 'Яйцо — 1 шт.'),
(1, 3, 'Разрыхлитель — 1 ч. л.'),
(1, 4, 'Мёд и ягоды — по вкусу');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(1, 0, 'Смешайте сухие ингредиенты.'),
(1, 1, 'Добавьте молоко и яйцо, перемешайте до однородности.'),
(1, 2, 'Жарьте небольшими порциями на сухой сковороде по 2 минуты с каждой стороны.'),
(1, 3, 'Подавайте с ягодами и мёдом.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(1, 0, 'Быстро'),
(1, 1, 'Для семьи'),
(1, 2, 'Сладкое');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(2, 'Паста с томатами и базиликом', 'Итальянская классика: сочные томаты, ароматный базилик и нежный пармезан.', 'Основные блюда', '🍝', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=900&q=85', 35, 3, 'Легко', 2, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '9 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(2, 0, 'Паста — 300 г'),
(2, 1, 'Томаты черри — 250 г'),
(2, 2, 'Чеснок — 2 зубчика'),
(2, 3, 'Базилик — 1 пучок'),
(2, 4, 'Пармезан — 40 г');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(2, 0, 'Отварите пасту до al dente.'),
(2, 1, 'Обжарьте чеснок и томаты на оливковом масле.'),
(2, 2, 'Добавьте пасту и немного воды от варки.'),
(2, 3, 'Перемешайте с базиликом и посыпьте пармезаном.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(2, 0, 'Италия'),
(2, 1, 'Вегетарианское'),
(2, 2, 'На ужин');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(3, 'Шоколадный брауни', 'Насыщенный шоколадный десерт с тонкой хрустящей корочкой и влажной серединкой.', 'Десерты', '🍫', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=900&q=85', 45, 6, 'Средне', 1, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '8 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(3, 0, 'Тёмный шоколад — 180 г'),
(3, 1, 'Сливочное масло — 120 г'),
(3, 2, 'Сахар — 140 г'),
(3, 3, 'Яйца — 3 шт.'),
(3, 4, 'Мука — 90 г');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(3, 0, 'Растопите шоколад с маслом.'),
(3, 1, 'Вмешайте сахар и яйца.'),
(3, 2, 'Добавьте муку и перемешайте.'),
(3, 3, 'Выпекайте 25 минут при 175 °C, затем остудите.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(3, 0, 'Шоколад'),
(3, 1, 'Выпечка'),
(3, 2, 'К чаю');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(4, 'Греческий салат', 'Хрустящие овощи, фета, оливки и оливковое масло — вкус Средиземноморья.', 'Салаты', '🥗', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=85', 15, 2, 'Легко', 2, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '7 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(4, 0, 'Огурцы — 2 шт.'),
(4, 1, 'Помидоры — 3 шт.'),
(4, 2, 'Сладкий перец — 1 шт.'),
(4, 3, 'Фета — 120 г'),
(4, 4, 'Оливки — 70 г');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(4, 0, 'Крупно нарежьте овощи.'),
(4, 1, 'Добавьте сыр фета и оливки.'),
(4, 2, 'Полейте оливковым маслом и посыпьте орегано.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(4, 0, 'Свежие овощи'),
(4, 1, 'Без духовки'),
(4, 2, 'Быстро');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(5, 'Тыквенный крем-суп', 'Бархатистый согревающий суп с нотками имбиря и хрустящими семечками.', 'Супы', '🥣', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900&q=85', 40, 4, 'Легко', 1, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '6 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(5, 0, 'Тыква — 700 г'),
(5, 1, 'Морковь — 1 шт.'),
(5, 2, 'Лук — 1 шт.'),
(5, 3, 'Сливки — 100 мл'),
(5, 4, 'Имбирь — 10 г');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(5, 0, 'Обжарьте лук и морковь.'),
(5, 1, 'Добавьте тыкву и воду, варите 25 минут.'),
(5, 2, 'Пюрируйте блендером, влейте сливки и прогрейте.'),
(5, 3, 'Подавайте с семечками.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(5, 0, 'Осень'),
(5, 1, 'Согревающее'),
(5, 2, 'Овощи');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(6, 'Смузи с клубникой и бананом', 'Освежающий ягодный напиток без лишнего сахара, готовится за пять минут.', 'Напитки', '🍓', 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=900&q=85', 5, 2, 'Легко', 2, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '5 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(6, 0, 'Клубника — 200 г'),
(6, 1, 'Банан — 1 шт.'),
(6, 2, 'Йогурт — 200 мл'),
(6, 3, 'Молоко — 100 мл');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(6, 0, 'Очистите банан и промойте ягоды.'),
(6, 1, 'Сложите ингредиенты в блендер.'),
(6, 2, 'Взбейте до однородности и сразу подавайте.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(6, 0, 'Без сахара'),
(6, 1, 'Быстро'),
(6, 2, 'Полезное');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(7, 'Домашняя пицца Маргарита', 'Тонкое тесто, спелые томаты и тягучая моцарелла — ничего лишнего.', 'Основные блюда', '🍕', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=900&q=85', 70, 4, 'Средне', 1, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '4 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(7, 0, 'Тесто для пиццы — 350 г'),
(7, 1, 'Томатный соус — 100 г'),
(7, 2, 'Моцарелла — 180 г'),
(7, 3, 'Базилик — 1 пучок');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(7, 0, 'Разогрейте духовку до 240 °C.'),
(7, 1, 'Растяните тесто и распределите соус.'),
(7, 2, 'Выложите сыр и выпекайте 10–12 минут.'),
(7, 3, 'Украсьте базиликом.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(7, 0, 'Италия'),
(7, 1, 'Для семьи'),
(7, 2, 'В духовке');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(8, 'Овсянка с яблоками и корицей', 'Нежная каша с карамелизированными яблоками, орехами и тёплой корицей.', 'Завтраки', '🍎', 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=900&q=85', 20, 2, 'Легко', 2, 'APPROVED', CURRENT_TIMESTAMP - INTERVAL '3 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(8, 0, 'Овсяные хлопья — 100 г'),
(8, 1, 'Молоко — 250 мл'),
(8, 2, 'Яблоко — 1 шт.'),
(8, 3, 'Корица — 1/2 ч. л.'),
(8, 4, 'Грецкие орехи — 30 г');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(8, 0, 'Сварите овсянку на молоке.'),
(8, 1, 'Нарежьте яблоко и прогрейте на сковороде с корицей.'),
(8, 2, 'Украсьте кашу яблоками и орехами.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(8, 0, 'Без мяса'),
(8, 1, 'Завтрак'),
(8, 2, 'Уютно');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(9, 'Лимонные сырники', 'Румяные сырники с цедрой лимона и нежным творожным вкусом.', 'Завтраки', '🍋', 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=900&q=85', 30, 3, 'Легко', 1, 'PENDING', CURRENT_TIMESTAMP - INTERVAL '2 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(9, 0, 'Творог — 400 г'),
(9, 1, 'Яйцо — 1 шт.'),
(9, 2, 'Мука — 4 ст. л.'),
(9, 3, 'Лимонная цедра — 1 ч. л.');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(9, 0, 'Смешайте все ингредиенты.'),
(9, 1, 'Сформируйте сырники и обваляйте в муке.'),
(9, 2, 'Обжарьте до золотистой корочки.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(9, 0, 'Творог'),
(9, 1, 'Завтрак');

INSERT INTO recipes (id, title, description, category, emoji, image_url, prep_minutes, servings, difficulty, owner_id, status, created_at) VALUES
(10, 'Домашний лимонад', 'Лёгкий цитрусовый напиток с мятой и льдом для жаркого дня.', 'Напитки', '🍋', 'https://images.unsplash.com/photo-1513558161293-cdaf765edfd4?w=900&q=85', 10, 4, 'Легко', 2, 'PENDING', CURRENT_TIMESTAMP - INTERVAL '1 days');
INSERT INTO recipe_ingredients (recipe_id, position, value) VALUES
(10, 0, 'Лимон — 2 шт.'),
(10, 1, 'Вода — 800 мл'),
(10, 2, 'Мята — 4 веточки'),
(10, 3, 'Мёд — по вкусу');
INSERT INTO recipe_steps (recipe_id, position, value) VALUES
(10, 0, 'Выжмите сок лимонов.'),
(10, 1, 'Смешайте с водой и мёдом.'),
(10, 2, 'Добавьте мяту и лёд.');
INSERT INTO recipe_tags (recipe_id, position, value) VALUES
(10, 0, 'Лето'),
(10, 1, 'Напитки');

INSERT INTO reviews (recipe_id, author_id, rating, comment, created_at) VALUES (1, 2, 5, 'Получились невероятно воздушными, спасибо!', CURRENT_TIMESTAMP - INTERVAL '1 day');
INSERT INTO reviews (recipe_id, author_id, rating, comment, created_at) VALUES (2, 1, 5, 'Очень вкусно и действительно просто готовить.', CURRENT_TIMESTAMP - INTERVAL '1 day');
INSERT INTO reviews (recipe_id, author_id, rating, comment, created_at) VALUES (3, 2, 4, 'Всем понравилось, в следующий раз добавлю орехи.', CURRENT_TIMESTAMP - INTERVAL '1 day');
INSERT INTO reviews (recipe_id, author_id, rating, comment, created_at) VALUES (4, 1, 5, 'Классика, всегда получается вкусно.', CURRENT_TIMESTAMP - INTERVAL '1 day');
INSERT INTO reviews (recipe_id, author_id, rating, comment, created_at) VALUES (5, 2, 4, 'Нежный и ароматный суп.', CURRENT_TIMESTAMP - INTERVAL '1 day');

INSERT INTO favorites (user_id, recipe_id) VALUES (1, 2), (1, 4), (1, 6), (2, 1), (2, 3);
