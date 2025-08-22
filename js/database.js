/**
 * База данных для хранения шаблонов чатов
 * Использует IndexedDB для хранения данных
 */

class TemplateDatabase {
    constructor() {
        this.dbName = 'chatTemplatesDB';
        this.dbVersion = 1;
        this.storeName = 'templates';
        this.db = null;
        this.remoteUrl = (window && window.REMOTE_API_URL) ? String(window.REMOTE_API_URL).trim() : '';
        this.initDB();
    }

    /**
     * Инициализация базы данных
     * @returns {Promise} Promise объект, который разрешается, когда база данных готова к использованию
     */
    initDB() {
        return new Promise((resolve, reject) => {
            // Если настроен удаленный API, локальную БД не инициализируем
            if (this.remoteUrl) {
                console.log('Используется удалённый API для хранения шаблонов:', this.remoteUrl);
                this.useLocalStorage = false;
                resolve();
                return;
            }
            if (!window.indexedDB) {
                console.error('Ваш браузер не поддерживает IndexedDB. Будет использоваться localStorage.');
                this.useLocalStorage = true;
                resolve();
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('Ошибка открытия базы данных:', event.target.error);
                this.useLocalStorage = true;
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('База данных успешно открыта');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('name', 'name', { unique: false });
                    objectStore.createIndex('category', 'category', { unique: false });
                    objectStore.createIndex('dateCreated', 'dateCreated', { unique: false });
                    
                    // Добавляем несколько шаблонов по умолчанию
                    this.addDefaultTemplates(objectStore);
                }
            };
        });
    }

    /**
     * Добавление шаблонов по умолчанию
     * @param {IDBObjectStore} objectStore - Хранилище объектов IndexedDB
     */
    addDefaultTemplates(objectStore) {
        const defaultTemplates = [
            {
                name: 'Приветствие',
                category: 'Общее',
                content: 'Здравствуйте! Рад приветствовать вас. Чем я могу помочь сегодня?',
                dateCreated: new Date(),
                dateModified: new Date()
            },
            {
                name: 'Прощание',
                category: 'Общее',
                content: 'Спасибо за обращение! Если у вас возникнут дополнительные вопросы, не стесняйтесь обращаться. Хорошего дня!',
                dateCreated: new Date(),
                dateModified: new Date()
            },
            {
                name: 'Запрос информации',
                category: 'Бизнес',
                content: 'Для обработки вашего запроса мне потребуется дополнительная информация. Пожалуйста, укажите: 1) Ваше полное имя, 2) Контактный email, 3) Подробное описание вопроса.',
                dateCreated: new Date(),
                dateModified: new Date()
            }
        ];

        defaultTemplates.forEach(template => {
            objectStore.add(template);
        });
    }

    /**
     * Получение всех шаблонов из базы данных
     * @returns {Promise<Array>} Promise с массивом шаблонов
     */
    getAllTemplates() {
        return new Promise((resolve, reject) => {
            if (this.remoteUrl) {
                fetch(this.remoteUrl.replace(/\/$/, '') + '/templates')
                    .then(r => {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.json();
                    })
                    .then(list => resolve(list))
                    .catch(err => reject(err));
                return;
            }
            if (this.useLocalStorage) {
                const templates = JSON.parse(localStorage.getItem('chatTemplates') || '[]');
                // Преобразуем строки дат обратно в объекты Date
                templates.forEach(template => {
                    if (template.dateCreated) template.dateCreated = new Date(template.dateCreated);
                    if (template.dateModified) template.dateModified = new Date(template.dateModified);
                });
                resolve(templates);
                return;
            }

            if (!this.db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Добавление нового шаблона
     * @param {Object} template - Объект шаблона
     * @returns {Promise<number>} Promise с ID добавленного шаблона
     */
    addTemplate(template) {
        return new Promise((resolve, reject) => {
            // Добавляем дату создания и модификации
            template.dateCreated = new Date();
            template.dateModified = new Date();
            if (this.remoteUrl) {
                fetch(this.remoteUrl.replace(/\/$/, '') + '/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: template.name,
                        category: template.category,
                        content: template.content,
                        favorite: Boolean(template.favorite)
                    })
                }).then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                }).then(item => resolve(item.id)).catch(err => reject(err));
                return;
            }

            if (this.useLocalStorage) {
                const templates = JSON.parse(localStorage.getItem('chatTemplates') || '[]');
                template.id = Date.now(); // Используем timestamp как ID
                templates.push(template);
                localStorage.setItem('chatTemplates', JSON.stringify(templates));
                resolve(template.id);
                return;
            }

            if (!this.db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.add(template);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Обновление существующего шаблона
     * @param {Object} template - Объект шаблона с ID
     * @returns {Promise<boolean>} Promise с результатом операции
     */
    updateTemplate(template) {
        return new Promise((resolve, reject) => {
            // Обновляем дату модификации
            template.dateModified = new Date();
            if (this.remoteUrl) {
                const id = template.id;
                const payload = { ...template };
                // Приводим даты к ISO для сервера
                if (payload.dateCreated instanceof Date) payload.dateCreated = payload.dateCreated.toISOString();
                if (payload.dateModified instanceof Date) payload.dateModified = payload.dateModified.toISOString();
                fetch(this.remoteUrl.replace(/\/$/, '') + '/templates/' + encodeURIComponent(id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                }).then(() => resolve(true)).catch(err => reject(err));
                return;
            }

            if (this.useLocalStorage) {
                const templates = JSON.parse(localStorage.getItem('chatTemplates') || '[]');
                const index = templates.findIndex(t => t.id === template.id);
                if (index !== -1) {
                    templates[index] = template;
                    localStorage.setItem('chatTemplates', JSON.stringify(templates));
                    resolve(true);
                } else {
                    reject(new Error('Шаблон не найден'));
                }
                return;
            }

            if (!this.db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(template);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Удаление шаблона по ID
     * @param {number} id - ID шаблона
     * @returns {Promise<boolean>} Promise с результатом операции
     */
    deleteTemplate(id) {
        return new Promise((resolve, reject) => {
            if (this.remoteUrl) {
                fetch(this.remoteUrl.replace(/\/$/, '') + '/templates/' + encodeURIComponent(id), {
                    method: 'DELETE'
                }).then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                }).then(() => resolve(true)).catch(err => reject(err));
                return;
            }
            if (this.useLocalStorage) {
                const templates = JSON.parse(localStorage.getItem('chatTemplates') || '[]');
                const filteredTemplates = templates.filter(t => t.id !== id);
                localStorage.setItem('chatTemplates', JSON.stringify(filteredTemplates));
                resolve(true);
                return;
            }

            if (!this.db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Поиск шаблонов по запросу
     * @param {string} query - Поисковый запрос
     * @param {string} category - Категория для фильтрации (опционально)
     * @returns {Promise<Array>} Promise с массивом найденных шаблонов
     */
    searchTemplates(query, category) {
        return new Promise((resolve, reject) => {
            this.getAllTemplates().then(templates => {
                let filteredTemplates = templates;
                
                // Фильтрация по категории, если указана
                if (category && category !== 'Все категории' && category !== 'all') {
                    filteredTemplates = filteredTemplates.filter(template => 
                        template.category === category
                    );
                }
                
                // Фильтрация по поисковому запросу, если указан
                if (query && query.trim() !== '') {
                    query = query.toLowerCase().trim();
                    filteredTemplates = filteredTemplates.filter(template => {
                        return (
                            template.name.toLowerCase().includes(query) ||
                            (template.category ? template.category.toLowerCase().includes(query) : false) ||
                            template.content.toLowerCase().includes(query)
                        );
                    });
                }

                resolve(filteredTemplates);
            }).catch(error => {
                reject(error);
            });
        });
    }

    /**
     * Экспорт всех шаблонов в JSON
     * @returns {Promise<string>} Promise с JSON строкой
     */
    exportTemplates() {
        return new Promise((resolve, reject) => {
            this.getAllTemplates().then(templates => {
                try {
                    const exportData = JSON.stringify(templates, null, 2);
                    resolve(exportData);
                } catch (error) {
                    reject(error);
                }
            }).catch(error => {
                reject(error);
            });
        });
    }

    /**
     * Импорт шаблонов из JSON
     * @param {string} jsonData - JSON строка с шаблонами
     * @returns {Promise<number>} Promise с количеством импортированных шаблонов
     */
    importTemplates(jsonData) {
        return new Promise((resolve, reject) => {
            try {
                const templates = JSON.parse(jsonData);
                if (!Array.isArray(templates)) {
                    reject(new Error('Неверный формат данных для импорта'));
                    return;
                }

                // Проверяем структуру каждого шаблона
                const validTemplates = templates.filter(template => {
                    return (
                        template && 
                        template.name && 
                        typeof template.name === 'string' &&
                        template.content && 
                        typeof template.content === 'string'
                    );
                });

                if (validTemplates.length === 0) {
                    reject(new Error('Нет действительных шаблонов для импорта'));
                    return;
                }

                if (this.useLocalStorage) {
                    const existingTemplates = JSON.parse(localStorage.getItem('chatTemplates') || '[]');
                    // Добавляем новые ID для импортируемых шаблонов
                    validTemplates.forEach(template => {
                        template.id = Date.now() + Math.floor(Math.random() * 1000);
                        template.dateCreated = new Date();
                        template.dateModified = new Date();
                        existingTemplates.push(template);
                    });
                    localStorage.setItem('chatTemplates', JSON.stringify(existingTemplates));
                    resolve(validTemplates.length);
                    return;
                }

                if (!this.db) {
                    reject(new Error('База данных не инициализирована'));
                    return;
                }

                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const objectStore = transaction.objectStore(this.storeName);
                let importCount = 0;

                validTemplates.forEach(template => {
                    // Удаляем ID, чтобы база данных сгенерировала новый
                    if (template.id) delete template.id;
                    template.dateCreated = new Date();
                    template.dateModified = new Date();
                    
                    const request = objectStore.add(template);
                    request.onsuccess = () => {
                        importCount++;
                        if (importCount === validTemplates.length) {
                            resolve(importCount);
                        }
                    };
                    request.onerror = (event) => {
                        console.error('Ошибка импорта шаблона:', event.target.error);
                    };
                });

                transaction.oncomplete = () => {
                    resolve(importCount);
                };

                transaction.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(new Error('Ошибка при разборе JSON: ' + error.message));
            }
        });
    }

    /**
     * Импорт шаблонов из TXT файла
     * @param {string} txtData - Содержимое TXT файла
     * @param {string} defaultCategory - Категория по умолчанию для всех шаблонов
     * @returns {Promise<number>} Promise с количеством импортированных шаблонов
     */
    importTemplatesFromTxt(txtData, defaultCategory = 'Импортировано из TXT') {
        return new Promise((resolve, reject) => {
            if (this.remoteUrl) {
                fetch(this.remoteUrl.replace(/\/$/, '') + '/templates/import-txt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ txt: txtData, defaultCategory })
                }).then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                }).then(res => resolve(res.imported || 0)).catch(err => reject(err));
                return;
            }
            try {
                // Проверяем, что txtData не пустая
                if (!txtData || txtData.trim() === '') {
                    reject(new Error('Текст для импорта пуст'));
                    return;
                }
                
                // Разделяем текст на шаблоны по двойному переносу строки
                const templateBlocks = txtData.split(/\n\s*\n/);
                
                if (templateBlocks.length === 0) {
                    reject(new Error('Файл не содержит шаблонов для импорта'));
                    return;
                }
                
                // Создаем массив шаблонов
                const templates = templateBlocks.map((block, index) => {
                    // Удаляем лишние пробелы и переносы строк
                    const trimmedBlock = block.trim();
                    if (!trimmedBlock) return null;
                    
                    // Первая строка - название шаблона (если она короткая)
                    // Иначе используем "Шаблон N"
                    let name, content;
                    const lines = trimmedBlock.split('\n');
                    
                    if (lines[0] && lines[0].length <= 50) {
                        name = lines[0].trim();
                        content = lines.slice(1).join('\n').trim();
                        // Если контент пустой, используем всё как контент
                        if (!content) {
                            content = name;
                            name = `Шаблон ${index + 1}`;
                        }
                    } else {
                        name = `Шаблон ${index + 1}`;
                        content = trimmedBlock;
                    }
                    
                    return {
                        name: name,
                        category: defaultCategory,
                        content: content,
                        dateCreated: new Date(),
                        dateModified: new Date()
                    };
                }).filter(template => template !== null);
                
                if (templates.length === 0) {
                    reject(new Error('Не найдено корректных шаблонов для импорта в тексте'));
                    return;
                }
                
                // Добавление шаблонов в базу данных
                if (this.db) {
                    // Используем транзакцию для IndexedDB
                    const transaction = this.db.transaction(['templates'], 'readwrite');
                    const objectStore = transaction.objectStore('templates');
                    let importCount = 0;
                    
                    templates.forEach(template => {
                        const request = objectStore.add(template);
                        request.onsuccess = () => {
                            importCount++;
                            if (importCount === templates.length) {
                                resolve(importCount);
                            }
                        };
                        request.onerror = (event) => {
                            console.error('Ошибка импорта шаблона из TXT:', event.target.error);
                        };
                    });
                    
                    transaction.oncomplete = () => {
                        if (importCount === 0) {
                            reject(new Error('Не удалось импортировать ни одного шаблона'));
                        } else {
                            resolve(importCount);
                        }
                    };
                    
                    transaction.onerror = (event) => {
                        reject(new Error('Ошибка при импорте шаблонов: ' + event.target.error.message));
                    };
                } else {
                    // Используем Promise.all для localStorage
                    const addPromises = templates.map(template => {
                        return this.addTemplate(template);
                    });
                    
                    Promise.all(addPromises)
                        .then(() => resolve(templates.length))
                        .catch(error => reject(new Error('Ошибка при импорте шаблонов в localStorage: ' + error.message)));
                }
            } catch (error) {
                reject(new Error('Непредвиденная ошибка при импорте: ' + error.message));
            }
        });
    }

    /**
     * Очистка всех шаблонов
     * @returns {Promise<boolean>} Promise с результатом операции
     */
    clearAllTemplates() {
        return new Promise((resolve, reject) => {
            if (this.useLocalStorage) {
                localStorage.setItem('chatTemplates', '[]');
                resolve(true);
                return;
            }

            if (!this.db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Получение всех уникальных категорий шаблонов
     * @returns {Promise<Array>} Promise с массивом уникальных категорий
     */
    getCategories() {
        return new Promise((resolve, reject) => {
            this.getAllTemplates().then(templates => {
                // Получаем все уникальные категории
                const categories = new Set();
                templates.forEach(template => {
                    if (template.category) {
                        categories.add(template.category);
                    }
                });
                
                // Преобразуем Set в массив и сортируем по алфавиту
                const categoriesArray = Array.from(categories).sort();
                
                // Добавляем опцию "Все категории" в начало списка
                categoriesArray.unshift('Все категории');
                
                resolve(categoriesArray);
            }).catch(error => {
                reject(error);
            });
        });
    }
}

// Экспортируем экземпляр базы данных для использования в других модулях
const templateDB = new TemplateDatabase();

// Обработка ошибок при инициализации
window.addEventListener('DOMContentLoaded', () => {
    // Проверяем доступность IndexedDB
    if (!window.indexedDB) {
        console.warn('Ваш браузер не поддерживает IndexedDB. Будет использоваться localStorage.');
        templateDB.useLocalStorage = true;
        
        // Создаем шаблоны по умолчанию в localStorage, если их еще нет
        const templates = JSON.parse(localStorage.getItem('chatTemplates') || '[]');
        if (templates.length === 0) {
            const defaultTemplates = [
                {
                    id: Date.now(),
                    name: 'Приветствие',
                    category: 'Общее',
                    content: 'Здравствуйте! Рад приветствовать вас. Чем я могу помочь сегодня?',
                    dateCreated: new Date(),
                    dateModified: new Date()
                },
                {
                    id: Date.now() + 1,
                    name: 'Прощание',
                    category: 'Общее',
                    content: 'Спасибо за обращение! Если у вас возникнут дополнительные вопросы, не стесняйтесь обращаться. Хорошего дня!',
                    dateCreated: new Date(),
                    dateModified: new Date()
                },
                {
                    id: Date.now() + 2,
                    name: 'Запрос информации',
                    category: 'Бизнес',
                    content: 'Для обработки вашего запроса мне потребуется дополнительная информация. Пожалуйста, укажите: 1) Ваше полное имя, 2) Контактный email, 3) Подробное описание вопроса.',
                    dateCreated: new Date(),
                    dateModified: new Date()
                }
            ];
            localStorage.setItem('chatTemplates', JSON.stringify(defaultTemplates));
        }
    }
});