// Инициализация примеров шаблонов
(function() {
    'use strict';

    function initializeDefaultTemplates() {
        // Ждем инициализации TemplateDB
        var maxAttempts = 20;
        var attempts = 0;

        function tryInit() {
            if (!window.TemplateDB) {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(tryInit, 200);
                }
                return;
            }

            // Проверяем, есть ли уже шаблоны
            window.TemplateDB.getAllTemplates()
                .then(function(templates) {
                    if (templates && templates.length === 0) {
                        console.log('💡 Локальное хранилище пусто, добавляем примеры...');
                        // Добавляем примеры
                        var examples = [
                            {
                                name: 'Приветствие',
                                category: 'Примеры',
                                content: 'Привет! Как дела? 👋'
                            },
                            {
                                name: 'Спасибо',
                                category: 'Примеры',
                                content: 'Спасибо за внимание! 🙏'
                            },
                            {
                                name: 'До свидания',
                                category: 'Примеры',
                                content: 'До свидания! До встречи! 👋'
                            }
                        ];

                        var promises = examples.map(function(ex) {
                            return window.TemplateDB.addTemplate(ex).catch(function(err) {
                                console.warn('Не удалось добавить пример:', ex.name, err);
                            });
                        });

                        Promise.all(promises)
                            .then(function() {
                                console.log('✓ Примеры шаблонов добавлены');
                            })
                            .catch(function(err) {
                                console.error('Ошибка при добавлении примеров:', err);
                            });
                    } else {
                        console.log('✓ Шаблоны найдены, примеры не требуются');
                    }
                })
                .catch(function(err) {
                    console.error('Ошибка при проверке шаблонов:', err);
                });
        }

        // Запускаем инициализацию после загрузки страницы
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryInit);
        } else {
            setTimeout(tryInit, 100);
        }
    }

    initializeDefaultTemplates();
})();
