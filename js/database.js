// Модуль для работы с базой данных
(function() {
    'use strict';

    // Конфигурация базы данных
    var DB_CONFIG = {
        name: 'TemplatesDB',
        version: 1,
        storeName: 'templates',
        keyPath: 'id'
    };

    // Подписчики на события изменений
    var subscribers = [];

    // Уведомление подписчиков об изменениях
    function notifySubscribers(action, data) {
        subscribers.forEach(function(callback) {
            try {
                callback(action, data);
            } catch (e) {
                console.error('Ошибка в обработчике события:', e);
            }
        });
    }

    // Подписка на изменения
    function subscribe(callback) {
        if (typeof callback === 'function' && !subscribers.includes(callback)) {
            subscribers.push(callback);
        }
    }

    // Отписка от изменений
    function unsubscribe(callback) {
        const index = subscribers.indexOf(callback);
        if (index !== -1) {
            subscribers.splice(index, 1);
        }
    }

    // Генерация уникального ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // Обновление индикатора синхронизации
    function updateSyncIndicator(state, message) {
        var indicator = document.getElementById('syncIndicator');
        if (!indicator) return;
        
        // Сбрасываем классы
        indicator.classList.remove('syncing', 'error', 'synced');
        
        var icon = indicator.querySelector('i');
        var status = indicator.querySelector('.sync-status');
        
        // Обновляем состояние
        switch (state) {
            case 'syncing':
                indicator.classList.add('syncing');
                icon.className = 'fas fa-sync';
                status.textContent = 'Синхронизация...';
                break;
            case 'error':
                indicator.classList.add('error');
                icon.className = 'fas fa-exclamation-circle';
                status.textContent = message || 'Ошибка синхронизации';
                break;
            case 'synced':
                indicator.classList.add('synced');
                icon.className = 'fas fa-cloud-upload-alt';
                status.textContent = 'Синхронизировано';
                setTimeout(function() {
                    if (indicator && icon && status) {
                        indicator.classList.remove('synced');
                        icon.className = 'fas fa-cloud';
                        status.textContent = 'Локально';
                    }
                }, 3000);
                break;
            default:
                icon.className = 'fas fa-cloud';
                status.textContent = 'Локально';
        }
    }

    // Конструктор базы данных
    function TemplateDatabase() {
        var self = this;
        
        this.db = null;
        this.isInitialized = false;
        this.useIndexedDB = true;
        this.supabase = null;
        this.syncEnabled = true;
        this.syncInterval = null;
        this.lastSyncTime = null;
        this.offlineQueue = [];

        // Привязываем методы к контексту
        ['init', 'handleOnline', 'handleOffline', 'addTemplate', 
         'syncWithSupabase', 'checkSupabaseConnection', 'initIndexedDB',
         'initLocalStorage', 'addToIndexedDB', 'addToLocalStorage',
         'getAllTemplates', 'getAllFromIndexedDB', 'getAllFromLocalStorage']
        .forEach(function(method) {
            self[method] = self[method].bind(self);
        });

        // Инициализация слушателей состояния сети
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleOnline);
            window.addEventListener('offline', this.handleOffline);
        }

        // Инициализация Supabase
        this.initSupabase();
    }

    // Методы прототипа
    TemplateDatabase.prototype = {
        constructor: TemplateDatabase,

        // Инициализация
        init: function() {
            var self = this;
            
            if (this.isInitialized) {
                return Promise.resolve();
            }

            return new Promise(function(resolve, reject) {
                try {
                    if (self.useIndexedDB && 'indexedDB' in window) {
                        self.initIndexedDB()
                            .then(function() {
                                self.isInitialized = true;
                                console.log('База данных инициализирована (IndexedDB)');
                                resolve();
                            })
                            .catch(function(err) {
                                console.error('Ошибка IndexedDB:', err);
                                self.useIndexedDB = false;
                                self.initLocalStorage();
                                self.isInitialized = true;
                                console.log('База данных инициализирована (localStorage)');
                                resolve();
                            });
                    } else {
                        self.useIndexedDB = false;
                        self.initLocalStorage();
                        self.isInitialized = true;
                        console.log('База данных инициализирована (localStorage)');
                        resolve();
                    }
                } catch (err) {
                    reject(err);
                }
            });
        },

        // Инициализация Supabase
        initSupabase: function() {
            var self = this;
            var checkInterval = setInterval(function() {
                if (window.supabase && !self.supabase) {
                    console.log('Обнаружен клиент Supabase');
                    self.supabase = window.supabase;
                    clearInterval(checkInterval);
                    self.onSupabaseInit();
                }
            }, 100);

            setTimeout(function() {
                if (checkInterval) {
                    clearInterval(checkInterval);
                    if (!self.supabase) {
                        console.warn('Supabase не был инициализирован за 10 секунд');
                    }
                }
            }, 10000);
        },

        // Обработка инициализации Supabase
        onSupabaseInit: function() {
            var self = this;
            this.checkSupabaseConnection()
                .then(function(isConnected) {
                    if (isConnected) {
                        console.log('Подключение к Supabase установлено');
                        return self.startAutoSync();
                    }
                })
                .catch(function(err) {
                    console.error('Ошибка при инициализации Supabase:', err);
                });
        },

        // Инициализация IndexedDB
        initIndexedDB: function() {
            var self = this;
            return new Promise(function(resolve, reject) {
                var request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
                
                request.onerror = function() {
                    reject(request.error);
                };
                
                request.onsuccess = function() {
                    self.db = request.result;
                    resolve();
                };
                
                request.onupgradeneeded = function(event) {
                    var db = event.target.result;
                    if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
                        var store = db.createObjectStore(DB_CONFIG.storeName, { keyPath: DB_CONFIG.keyPath });
                        store.createIndex('name', 'name', { unique: false });
                        store.createIndex('category', 'category', { unique: false });
                        store.createIndex('dateModified', 'dateModified', { unique: false });
                    }
                };
            });
        },

        // Инициализация localStorage
        initLocalStorage: function() {
            if (!localStorage.getItem('templates')) {
                localStorage.setItem('templates', JSON.stringify([]));
            }
        },

        // Проверка подключения к Supabase
        checkSupabaseConnection: function() {
            var self = this;
            
            if (!this.supabase) {
                console.warn('Supabase не инициализирован');
                return Promise.resolve(false);
            }

            return this.supabase
                .from('templates')
                .select('id')
                .limit(1)
                .then(function(response) {
                    if (response.error) {
                        if (response.error.code === '404' || response.error.code === 'PGRST116') {
                            return self.createSupabaseTable();
                        }
                        throw response.error;
                    }
                    return true;
                })
                .catch(function(err) {
                    console.error('Ошибка проверки Supabase:', err);
                    return false;
                });
        },

        // Создание таблицы в Supabase
        createSupabaseTable: function() {
            return this.supabase.rpc('init_templates_table')
                .then(function() {
                    console.log('Таблица templates создана');
                    return true;
                })
                .catch(function(err) {
                    console.error('Ошибка создания таблицы:', err);
                    return false;
                });
        },

        // Обработчик восстановления соединения
        handleOnline: function() {
            var self = this;
            console.log('Соединение восстановлено');
            
            this.checkSupabaseConnection()
                .then(function(isConnected) {
                    if (!isConnected) {
                        updateSyncIndicator('error', 'Нет доступа к облаку');
                        return;
                    }
                    
                    updateSyncIndicator('syncing');
                    return self.syncWithSupabase();
                })
                .catch(function(err) {
                    console.error('Ошибка синхронизации после восстановления:', err);
                    updateSyncIndicator('error', err.message);
                });
        },

        // Обработчик потери соединения
        handleOffline: function() {
            console.log('Соединение потеряно');
            updateSyncIndicator('error', 'Нет подключения');
            
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
        },

        // Добавление операции в офлайн-очередь
        addToOfflineQueue: function(type, data) {
            this.offlineQueue.push({
                type: type,
                data: data,
                timestamp: Date.now()
            });
        },

        // Синхронизация с Supabase
        syncWithSupabase: function(force) {
            var self = this;
            
            if ((!this.syncEnabled || !this.supabase) && !force) {
                return Promise.resolve();
            }

            return new Promise(function(resolve, reject) {
                var now = Date.now();
                if (!force && self.lastSyncTime && (now - self.lastSyncTime < 30000)) {
                    return resolve();
                }

                updateSyncIndicator('syncing');

                self.getAllTemplates()
                    .then(function(localTemplates) {
                        return self.supabase
                            .from('templates')
                            .select('*')
                            .then(function(response) {
                                if (response.error) throw response.error;

                                var remoteTemplates = response.data || [];
                                var promises = [];

                                // Создаём Map для быстрого поиска
                                var localMap = {};
                                localTemplates.forEach(function(t) {
                                    localMap[t.id] = t;
                                });

                                var remoteMap = {};
                                remoteTemplates.forEach(function(t) {
                                    remoteMap[t.id] = t;
                                });

                                // Синхронизируем данные
                                localTemplates.forEach(function(local) {
                                    var remote = remoteMap[local.id];
                                    if (!remote || new Date(local.dateModified) > new Date(remote.dateModified)) {
                                        promises.push(
                                            self.supabase
                                                .from('templates')
                                                .upsert([local])
                                                .then(function(response) {
                                                    if (response.error) throw response.error;
                                                })
                                        );
                                    }
                                });

                                remoteTemplates.forEach(function(remote) {
                                    var local = localMap[remote.id];
                                    if (!local || new Date(remote.dateModified) > new Date(local.dateModified)) {
                                        promises.push(self.addTemplate(remote));
                                    }
                                });

                                return Promise.all(promises);
                            });
                    })
                    .then(function() {
                        self.lastSyncTime = now;
                        updateSyncIndicator('synced');
                        resolve();
                    })
                    .catch(function(error) {
                        console.error('Ошибка синхронизации:', error);
                        updateSyncIndicator('error', error.message);
                        reject(error);
                    });
            });
        },

        // Запуск автоматической синхронизации
        startAutoSync: function(interval) {
            var self = this;
            interval = interval || 300000; // 5 минут
            
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
            }

            function sync() {
                if (!navigator.onLine) {
                    updateSyncIndicator('error', 'Нет подключения');
                    return;
                }

                self.checkSupabaseConnection()
                    .then(function(isConnected) {
                        if (!isConnected) {
                            updateSyncIndicator('error', 'Нет доступа к облаку');
                            return;
                        }
                        return self.syncWithSupabase();
                    })
                    .catch(function(err) {
                        console.error('Ошибка синхронизации:', err);
                        updateSyncIndicator('error', err.message);
                    });
            }

            sync();
            this.syncInterval = setInterval(sync, interval);
        },

        // Остановка автоматической синхронизации
        stopAutoSync: function() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
                console.log('Автоматическая синхронизация остановлена');
            }
        },

        // Добавление шаблона
        addTemplate: function(template) {
            var self = this;
            
            try {
                // Проверяем обязательные поля
                if (!template) {
                    throw new Error('Шаблон не может быть пустым');
                }
                if (!template.name || template.name.trim().length === 0) {
                    throw new Error('Необходимо указать название шаблона');
                }
                if (!template.content || template.content.trim().length === 0) {
                    throw new Error('Необходимо указать содержимое шаблона');
                }

                return this.ensureInitialized()
                    .then(function() {
                        var newTemplate = {
                            id: template.id || generateId(),
                            name: template.name.trim(),
                            category: (template.category || '').trim(),
                            content: template.content.trim(),
                            dateCreated: template.dateCreated || new Date().toISOString(),
                            dateModified: new Date().toISOString(),
                            favorite: template.favorite || false
                        };

                        // Prepare payload for cloud without 'favorite' (kept locally)
                        var cloudPayload = {
                            id: newTemplate.id,
                            name: newTemplate.name,
                            category: newTemplate.category,
                            content: newTemplate.content,
                            dateCreated: newTemplate.dateCreated,
                            dateModified: newTemplate.dateModified
                        };

                        // Сначала сохраняем в Supabase (omitting favorite)
                        if (self.supabase && navigator.onLine) {
                            updateSyncIndicator('syncing');
                            return self.supabase
                                .from('templates')
                                .upsert([cloudPayload])
                                .then(function(response) {
                                    if (response.error) throw response.error;

                                    // После успешного сохранения в Supabase, сохраняем локально (with favorite)
                                    return (self.useIndexedDB ? 
                                        self.addToIndexedDB(newTemplate) : 
                                        Promise.resolve(self.addToLocalStorage(newTemplate)))
                                        .then(function() {
                                            updateSyncIndicator('synced');
                                            notifySubscribers('add', newTemplate);
                                            return newTemplate;
                                        });
                                })
                                .catch(function(err) {
                                    console.error('Ошибка при сохранении в Supabase:', err);
                                    updateSyncIndicator('error', 'Ошибка сохранения в облаке');
                                    throw new Error('Не удалось сохранить шаблон в облаке');
                                });
                        } else {
                            // If no cloud, still save locally
                            if (self.useIndexedDB) {
                                return self.addToIndexedDB(newTemplate).then(function() {
                                    updateSyncIndicator('synced');
                                    return newTemplate;
                                });
                            } else {
                                return Promise.resolve(self.addToLocalStorage(newTemplate));
                            }
                        }
                    });
            } catch (error) {
                updateSyncIndicator('error', error.message);
                return Promise.reject(error);
            }
        },

        // Добавление в IndexedDB
        addToIndexedDB: function(template) {
            var self = this;
            return new Promise(function(resolve, reject) {
                var transaction = self.db.transaction([DB_CONFIG.storeName], 'readwrite');
                var store = transaction.objectStore(DB_CONFIG.storeName);
                var request = store.add(template);
                
                request.onerror = function() {
                    reject(request.error);
                };
                
                request.onsuccess = function() {
                    resolve(template);
                };
            });
        },

        // Добавление в localStorage
        addToLocalStorage: function(template) {
            var templates = this.getAllFromLocalStorage();
            templates.push(template);
            localStorage.setItem('templates', JSON.stringify(templates));
            return template;
        },

        // Получение всех шаблонов
        getAllTemplates: function() {
            var self = this;
            return this.ensureInitialized()
                .then(function() {
                    if (self.supabase && navigator.onLine) {
                        // Получаем данные из Supabase
                        updateSyncIndicator('syncing');
                        return self.supabase
                            .from('templates')
                            .select('*')
                            .then(function(response) {
                                if (response.error) throw response.error;
                                updateSyncIndicator('synced');
                                
                                // Обновляем локальное хранилище
                                if (self.useIndexedDB) {
                                    return self.updateLocalStorage(response.data)
                                        .then(function() {
                                            return response.data;
                                        });
                                } else {
                                    localStorage.setItem('templates', JSON.stringify(response.data));
                                    return response.data;
                                }
                            })
                            .catch(function(error) {
                                console.error('Ошибка при получении данных из Supabase:', error);
                                updateSyncIndicator('error', 'Ошибка получения данных');
                                // В случае ошибки, возвращаем локальные данные
                                return self.useIndexedDB ? 
                                    self.getAllFromIndexedDB() : 
                                    Promise.resolve(self.getAllFromLocalStorage());
                            });
                    } else {
                        // Если нет подключения, используем локальные данные
                        updateSyncIndicator('error', 'Нет подключения к облаку');
                        return self.useIndexedDB ? 
                            self.getAllFromIndexedDB() : 
                            Promise.resolve(self.getAllFromLocalStorage());
                    }
                });
        },

        // Получение из IndexedDB
        getAllFromIndexedDB: function() {
            var self = this;
            return new Promise(function(resolve, reject) {
                var transaction = self.db.transaction([DB_CONFIG.storeName], 'readonly');
                var store = transaction.objectStore(DB_CONFIG.storeName);
                var request = store.getAll();
                
                request.onerror = function() {
                    reject(request.error);
                };
                
                request.onsuccess = function() {
                    resolve(request.result || []);
                };
            });
        },

        // Получение из localStorage
        getAllFromLocalStorage: function() {
            var templates = localStorage.getItem('templates');
            return templates ? JSON.parse(templates) : [];
        },

        // Обновление шаблона
        updateTemplate: function(template) {
            var self = this;
            
            // Проверяем обязательные поля
            if (!template || !template.id) {
                return Promise.reject(new Error('Необходимо указать ID шаблона'));
            }
            if (!template.name || !template.content) {
                return Promise.reject(new Error('Необходимо указать название и содержимое шаблона'));
            }

            return this.ensureInitialized()
                .then(function() {
                    if (!self.supabase || !navigator.onLine) {
                        updateSyncIndicator('error', 'Нет подключения к облаку');
                        throw new Error('Отсутствует подключение к облачному хранилищу');
                    }

                    // Сначала проверяем существование шаблона в Supabase
                    updateSyncIndicator('syncing');
                    return self.supabase
                        .from('templates')
                        .select()
                        .eq('id', template.id)
                        .single()
                        .then(function(response) {
                            if (response.error) throw response.error;
                            
                            var existingTemplate = response.data;
                            if (!existingTemplate) {
                                throw new Error('Шаблон не найден в облачном хранилище');
                            }

                            // preserve favorite state from localStorage favorites list
                            var favs = [];
                            try { favs = JSON.parse(localStorage.getItem('favorites') || '[]'); } catch (e) { favs = []; }
                            var isFav = favs.includes(String(template.id));

                            var updatedTemplate = {
                                id: template.id,
                                name: template.name.trim(),
                                category: (template.category || '').trim(),
                                content: template.content.trim(),
                                dateCreated: existingTemplate.dateCreated,
                                dateModified: new Date().toISOString(),
                                favorite: isFav
                            };

                            // Prepare cloud payload without 'favorite'
                            var cloudPayload = {
                                id: updatedTemplate.id,
                                name: updatedTemplate.name,
                                category: updatedTemplate.category,
                                content: updatedTemplate.content,
                                dateCreated: updatedTemplate.dateCreated,
                                dateModified: updatedTemplate.dateModified
                            };

                            // Обновляем в Supabase (without favorite)
                            return self.supabase
                                .from('templates')
                                .update(cloudPayload)
                                .eq('id', template.id)
                                .then(function(response) {
                                    if (response.error) throw response.error;

                                    // После успешного обновления в Supabase, обновляем локально (including favorite)
                                    return (self.useIndexedDB ?
                                        self.updateInIndexedDB(updatedTemplate) :
                                        Promise.resolve(self.updateInLocalStorage(updatedTemplate)))
                                        .then(function() {
                                            updateSyncIndicator('synced');
                                            notifySubscribers('update', updatedTemplate);
                                            return updatedTemplate;
                                        });
                                });
                        })
                        .catch(function(error) {
                            console.error('Ошибка при обновлении шаблона:', error);
                            updateSyncIndicator('error', 'Ошибка обновления в облаке');
                            throw new Error('Не удалось обновить шаблон: ' + error.message);
                        });
                });
        },

        // Обновление в IndexedDB
        updateInIndexedDB: function(template) {
            var self = this;
            return new Promise(function(resolve, reject) {
                var transaction = self.db.transaction([DB_CONFIG.storeName], 'readwrite');
                var store = transaction.objectStore(DB_CONFIG.storeName);
                var request = store.put(template);
                
                request.onerror = function() {
                    reject(request.error);
                };
                
                request.onsuccess = function() {
                    resolve(template);
                };
            });
        },

        // Обновление в localStorage
        updateInLocalStorage: function(template) {
            var templates = this.getAllFromLocalStorage();
            var index = templates.findIndex(function(t) { return t.id === template.id; });
            
            if (index !== -1) {
                templates[index] = template;
                localStorage.setItem('templates', JSON.stringify(templates));
                return template;
            }
            
            throw new Error('Шаблон не найден');
        },

        // Удаление шаблона
        deleteTemplate: function(id) {
            var self = this;
            if (!id) {
                return Promise.reject(new Error('Необходимо указать ID шаблона для удаления'));
            }

            return this.ensureInitialized()
                .then(function() {
                    if (!self.supabase || !navigator.onLine) {
                        updateSyncIndicator('error', 'Нет подключения к облаку');
                        throw new Error('Отсутствует подключение к облачному хранилищу');
                    }

                    updateSyncIndicator('syncing');
                    // Сначала удаляем из Supabase
                    return self.supabase
                        .from('templates')
                        .delete()
                        .eq('id', id)
                        .then(function(response) {
                            if (response.error) throw response.error;

                            // После успешного удаления из Supabase, удаляем локально
                            return (self.useIndexedDB ?
                                self.deleteFromIndexedDB(id) :
                                Promise.resolve(self.deleteFromLocalStorage(id)))
                                .then(function() {
                                    updateSyncIndicator('synced');
                                    notifySubscribers('delete', id);
                                    return true;
                                });
                        })
                        .catch(function(error) {
                            console.error('Ошибка при удалении шаблона:', error);
                            updateSyncIndicator('error', 'Ошибка удаления из облака');
                            throw new Error('Не удалось удалить шаблон: ' + error.message);
                        });
                });
        },

        // Удаление из IndexedDB
        deleteFromIndexedDB: function(id) {
            var self = this;
            return new Promise(function(resolve, reject) {
                var transaction = self.db.transaction([DB_CONFIG.storeName], 'readwrite');
                var store = transaction.objectStore(DB_CONFIG.storeName);
                var request = store.delete(id);
                
                request.onerror = function() {
                    reject(request.error);
                };
                
                request.onsuccess = function() {
                    resolve(true);
                };
            });
        },

        // Удаление из localStorage
        deleteFromLocalStorage: function(id) {
            var templates = this.getAllFromLocalStorage();
            var filteredTemplates = templates.filter(function(t) { return t.id !== id; });
            localStorage.setItem('templates', JSON.stringify(filteredTemplates));
            return true;
        },

        // Поиск шаблонов
        searchTemplates: function(query, category, favoritesOnly) {
            var self = this;
            return this.ensureInitialized()
                .then(function() {
                    return self.getAllTemplates()
                        .then(function(templates) {
                            return templates.filter(function(template) {
                                // Фильтр по категории
                                if (category && category !== 'all' && template.category !== category) {
                                    return false;
                                }
                                
                                // Фильтр по избранному — используем локальное хранилище favorites (localStorage)
                                if (favoritesOnly) {
                                    try {
                                        var favs = JSON.parse(localStorage.getItem('favorites') || '[]');
                                        if (!favs.includes(String(template.id))) return false;
                                    } catch (err) {
                                        // Если не удалось прочитать favorites — считаем как не избранное
                                        return false;
                                    }
                                }
                                
                                // Поиск по запросу
                                if (query) {
                                    query = query.toLowerCase();
                                    return template.name.toLowerCase().includes(query) || 
                                           template.content.toLowerCase().includes(query) ||
                                           (template.category && template.category.toLowerCase().includes(query));
                                }
                                
                                return true;
                            });
                        });
                });
        },

        // Получение списка категорий
        getCategories: function() {
            var self = this;
            return this.ensureInitialized()
                .then(function() {
                    if (self.supabase && navigator.onLine) {
                        // Получаем категории из Supabase
                        return self.supabase
                            .from('templates')
                            .select('category')
                            .then(function(response) {
                                if (response.error) throw response.error;
                                
                                // Получаем уникальные категории
                                var categories = response.data.reduce(function(acc, template) {
                                    if (template.category && !acc.includes(template.category)) {
                                        acc.push(template.category);
                                    }
                                    return acc;
                                }, []);
                                
                                // Сортируем категории
                                return categories.sort(function(a, b) {
                                    return a.localeCompare(b, 'ru');
                                });
                            });
                    } else {
                        // Если нет подключения, используем локальные данные
                        return self.getAllTemplates()
                            .then(function(templates) {
                                var categories = templates.reduce(function(acc, template) {
                                    if (template.category && !acc.includes(template.category)) {
                                        acc.push(template.category);
                                    }
                                    return acc;
                                }, []);
                                
                                return categories.sort(function(a, b) {
                                    return a.localeCompare(b, 'ru');
                                });
                            });
                    }
                });
        },

        // Принудительная синхронизация с Supabase
        forceSyncWithSupabase: function() {
            var self = this;
            
            if (!this.supabase || !navigator.onLine) {
                updateSyncIndicator('error', 'Нет подключения к облаку');
                return Promise.reject(new Error('Отсутствует подключение к облачному хранилищу'));
            }

            updateSyncIndicator('syncing');
            
            // Получаем все данные из Supabase
            return this.supabase
                .from('templates')
                .select('*')
                .then(function(response) {
                    if (response.error) throw response.error;
                    
                    var cloudTemplates = response.data;
                    
                    // Очищаем локальное хранилище
                    return (self.useIndexedDB ?
                        new Promise(function(resolve, reject) {
                            var transaction = self.db.transaction([DB_CONFIG.storeName], 'readwrite');
                            var store = transaction.objectStore(DB_CONFIG.storeName);
                            var request = store.clear();
                            
                            request.onerror = reject;
                            request.onsuccess = function() {
                                resolve(cloudTemplates);
                            };
                        }) :
                        Promise.resolve(localStorage.setItem('templates', '[]'))
                            .then(function() {
                                return cloudTemplates;
                            }))
                        .then(function(templates) {
                            // Добавляем все шаблоны из облака в локальное хранилище
                            var promises = templates.map(function(template) {
                                return self.useIndexedDB ?
                                    self.addToIndexedDB(template) :
                                    Promise.resolve(self.addToLocalStorage(template));
                            });
                            
                            return Promise.all(promises);
                        })
                        .then(function() {
                            updateSyncIndicator('synced');
                            return true;
                        });
                })
                .catch(function(error) {
                    console.error('Ошибка при синхронизации с Supabase:', error);
                    updateSyncIndicator('error', 'Ошибка синхронизации');
                    throw error;
                });
        },

        // Обновление локального хранилища
        updateLocalStorage: function(templates) {
            var self = this;
            if (this.useIndexedDB) {
                return new Promise(function(resolve, reject) {
                    var transaction = self.db.transaction([DB_CONFIG.storeName], 'readwrite');
                    var store = transaction.objectStore(DB_CONFIG.storeName);
                    
                    // Очищаем хранилище
                    store.clear().onsuccess = function() {
                        // Добавляем все шаблоны
                        var promises = templates.map(function(template) {
                            return new Promise(function(resolve, reject) {
                                var request = store.add(template);
                                request.onsuccess = resolve;
                                request.onerror = reject;
                            });
                        });
                        
                        Promise.all(promises)
                            .then(resolve)
                            .catch(reject);
                    };
                });
            } else {
                localStorage.setItem('templates', JSON.stringify(templates));
                return Promise.resolve();
            }
        },

        // Проверка инициализации
        ensureInitialized: function() {
            var self = this;
            if (!this.isInitialized) {
                return this.init();
            }
            return Promise.resolve();
        },

        // Экспорт шаблонов в JSON
        exportTemplates: function() {
            var self = this;
            return this.ensureInitialized()
                .then(function() {
                    return self.getAllTemplates()
                        .then(function(templates) {
                            return JSON.stringify(templates, null, 2);
                        });
                });
        },

        // Импорт шаблонов из JSON
        importTemplates: function(jsonContent) {
            var self = this;
            
            if (!jsonContent || typeof jsonContent !== 'string') {
                return Promise.reject(new Error('Некорректный формат JSON'));
            }

            return this.ensureInitialized()
                .then(function() {
                    try {
                        var templates = JSON.parse(jsonContent);
                        
                        if (!Array.isArray(templates)) {
                            return Promise.reject(new Error('JSON должен содержать массив шаблонов'));
                        }

                        if (templates.length === 0) {
                            return Promise.resolve(0);
                        }

                        // Добавляем каждый шаблон
                        var promises = templates.map(function(template) {
                            // Проверяем обязательные поля
                            if (!template.name || !template.content) {
                                console.warn('Пропущен шаблон без названия или содержимого:', template);
                                return Promise.resolve(null);
                            }
                            
                            // Генерируем новый ID, если его нет, или сохраняем существующий
                            if (!template.id) {
                                template.id = generateId();
                            }
                            
                            // Устанавливаем даты, если их нет
                            if (!template.dateCreated) {
                                template.dateCreated = new Date().toISOString();
                            }
                            template.dateModified = new Date().toISOString();
                            
                            return self.addTemplate(template);
                        });

                        return Promise.all(promises)
                            .then(function(results) {
                                var count = results.filter(function(r) { return r !== null; }).length;
                                return count;
                            });
                    } catch (error) {
                        return Promise.reject(new Error('Ошибка парсинга JSON: ' + error.message));
                    }
                });
        },

        // Импорт шаблонов из TXT
        importTemplatesFromTxt: function(txtContent, defaultCategory) {
            var self = this;
            
            if (!txtContent || typeof txtContent !== 'string') {
                return Promise.reject(new Error('Некорректный формат TXT'));
            }

            return this.ensureInitialized()
                .then(function() {
                    try {
                        // Парсим TXT формат: название на первой строке, пустая строка, затем содержимое
                        var blocks = txtContent.split(/\r?\n\r?\n/);
                        var templates = [];
                        var currentTitle = '';
                        var currentContent = [];

                        // Обрабатываем каждый блок
                        blocks.forEach(function(block, index) {
                            var lines = block.split(/\r?\n/);
                            
                            if (lines.length === 0) return;
                            
                            // Первая строка - название, остальное - содержимое
                            if (lines.length === 1 && index === 0) {
                                // Может быть только название без содержимого
                                currentTitle = lines[0].trim();
                            } else {
                                if (currentTitle === '' && lines.length > 0) {
                                    currentTitle = lines[0].trim();
                                    currentContent = lines.slice(1);
                                } else {
                                    // Продолжаем накапливать содержимое
                                    currentContent = currentContent.concat(lines);
                                }
                            }
                            
                            // Если встретили пустую строку или следующий блок начинается с нового названия
                            if (currentTitle && currentContent.length > 0) {
                                var content = currentContent.join('\n').trim();
                                if (content) {
                                    templates.push({
                                        name: currentTitle,
                                        category: defaultCategory || 'Импортировано из TXT',
                                        content: content
                                    });
                                }
                                currentTitle = '';
                                currentContent = [];
                            }
                        });

                        // Обрабатываем последний блок
                        if (currentTitle) {
                            var lastContent = currentContent.join('\n').trim();
                            if (!lastContent && blocks.length > 0) {
                                // Возможно, весь блок - это название, а содержимое в следующем блоке
                                // Пропускаем, если нет содержимого
                            } else if (lastContent) {
                                templates.push({
                                    name: currentTitle,
                                    category: defaultCategory || 'Импортировано из TXT',
                                    content: lastContent
                                });
                            }
                        }

                        // Альтернативный парсинг: если формат простой (название - первая строка, содержимое - остальное)
                        if (templates.length === 0 && txtContent.trim()) {
                            var allLines = txtContent.split(/\r?\n/).filter(function(line) { return line.trim(); });
                            if (allLines.length >= 2) {
                                templates.push({
                                    name: allLines[0],
                                    category: defaultCategory || 'Импортировано из TXT',
                                    content: allLines.slice(1).join('\n')
                                });
                            } else if (allLines.length === 1) {
                                templates.push({
                                    name: allLines[0],
                                    category: defaultCategory || 'Импортировано из TXT',
                                    content: ''
                                });
                            }
                        }

                        if (templates.length === 0) {
                            return Promise.reject(new Error('Не удалось распарсить шаблоны из TXT файла'));
                        }

                        // Добавляем каждый шаблон
                        var promises = templates.map(function(template) {
                            return self.addTemplate(template);
                        });

                        return Promise.all(promises)
                            .then(function() {
                                return templates.length;
                            });
                    } catch (error) {
                        return Promise.reject(new Error('Ошибка парсинга TXT: ' + error.message));
                    }
                });
        }
    };

    // Создаём и инициализируем экземпляр базы данных при загрузке страницы
    function createAndInitDatabase() {
        var db = new TemplateDatabase();
        window.TemplateDB = db;
        // Добавляем методы подписки в публичный API
        window.TemplateDB.subscribe = subscribe;
        window.TemplateDB.unsubscribe = unsubscribe;
        return db.init().then(function() {
            console.log('База данных успешно инициализирована');
        }).catch(function(err) {
            console.error('Ошибка при инициализации базы данных:', err);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createAndInitDatabase);
    } else {
        createAndInitDatabase();
    }
})();