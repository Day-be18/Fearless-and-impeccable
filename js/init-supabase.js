// Инициализация Supabase
(async function() {
    'use strict';

    // Проверяем, готовы ли параметры
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        console.error('Отсутствуют необходимые параметры для инициализации Supabase');
        return;
    }

    try {
        // Импортируем Supabase
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
        
        console.log('Инициализируем Supabase клиент...');
        window.supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        console.log('✓ Supabase клиент создан успешно');

        // Проверяем подключение
        try {
            const { data, error } = await window.supabase
                .from('templates')
                .select('id', { count: 'exact', head: true })
                .limit(1);

            if (error) {
                console.warn('⚠ Таблица templates может быть недоступна:', error.message);
            } else {
                console.log('✓ Подключение к Supabase установлено');
            }
        } catch (err) {
            console.warn('⚠ Ошибка при проверке таблицы:', err.message);
        }

        console.log('✓ Supabase инициализирован и готов к работе');
    } catch (err) {
        console.error('✗ Критическая ошибка при инициализации Supabase:', err);
        window.supabase = null;
    }
})();
