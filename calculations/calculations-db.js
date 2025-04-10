/**
 * Database initialization and utilities for the Advanced Calculations System
 */

// Global DB variable
let db;

// Database name and version
const DB_NAME = "AdvancedCalculationsDB";
const DB_VERSION = 1;

// Object store names
const STORES = {
  CALCULATIONS: "calculations",
  FUNCTIONS: "functions",
  SETTINGS: "settings",
  HISTORY: "calculationHistory"
};

/**
 * Initialize the database
 * @returns {Promise} Promise that resolves when the database is ready
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // Create or upgrade database
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.CALCULATIONS)) {
        // Calculations store with auto-incrementing ID
        const calcStore = db.createObjectStore(STORES.CALCULATIONS, { keyPath: "id", autoIncrement: true });
        calcStore.createIndex("title", "title", { unique: false });
        calcStore.createIndex("type", "type", { unique: false });
        calcStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
        calcStore.createIndex("isPublic", "isPublic", { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.FUNCTIONS)) {
        // Functions store with name as key
        const funcStore = db.createObjectStore(STORES.FUNCTIONS, { keyPath: "name" });
        funcStore.createIndex("isGlobal", "isGlobal", { unique: false });
        funcStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        // Settings store
        db.createObjectStore(STORES.SETTINGS, { keyPath: "id" });
      }
      
      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        // Calculation history
        const historyStore = db.createObjectStore(STORES.HISTORY, { keyPath: "id", autoIncrement: true });
        historyStore.createIndex("calculationId", "calculationId", { unique: false });
        historyStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    
    // Handle database errors
    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
      showNotification("Database error: " + event.target.error.message, "danger");
      reject(event.target.error);
    };
    
    // Handle successful database opening
    request.onsuccess = (event) => {
      db = event.target.result;
      console.log("Database opened successfully");
      
      // Handle database connection errors
      db.onerror = (event) => {
        console.error("Database error:", event.target.error);
        showNotification("Database error: " + event.target.error.message, "danger");
      };
      
      // Initialize default settings if needed
      initializeDefaultSettings().then(() => {
        resolve(db);
      });
    };
  });
}

/**
 * Initialize default settings if they don't exist
 * @returns {Promise} Promise that resolves when settings are initialized
 */
function initializeDefaultSettings() {
  return new Promise((resolve) => {
    const defaultSettings = {
      id: "generalSettings",
      defaultDecimalPlaces: 2,
      defaultNumberFormat: "decimal",
      autoCalculate: true,
      storeResultsHistory: true,
      showFunctionTooltips: true
    };
    
    const openAISettings = {
      id: "openAISettings",
      apiKey: "",
      model: "gpt-3.5-turbo",
      aiSuggestParams: true,
      aiCodeHelp: true,
      aiErrorHelp: true
    };
    
    const brythonSettings = {
      id: "brythonSettings",
      enabled: false,
      modules: "math",
      pythonVersion: "3.11"
    };
    
    const transaction = db.transaction(STORES.SETTINGS, "readwrite");
    const store = transaction.objectStore(STORES.SETTINGS);
    
    // Check if general settings exist
    const generalRequest = store.get("generalSettings");
    generalRequest.onsuccess = (event) => {
      if (!event.target.result) {
        store.add(defaultSettings);
      }
    };
    
    // Check if OpenAI settings exist
    const openAIRequest = store.get("openAISettings");
    openAIRequest.onsuccess = (event) => {
      if (!event.target.result) {
        store.add(openAISettings);
      }
    };
    
    // Check if Brython settings exist
    const brythonRequest = store.get("brythonSettings");
    brythonRequest.onsuccess = (event) => {
      if (!event.target.result) {
        store.add(brythonSettings);
      }
    };
    
    transaction.oncomplete = () => {
      resolve();
    };
  });
}

/**
 * Get a setting by ID
 * @param {string} settingId - The ID of the setting to get
 * @returns {Promise} Promise that resolves with the setting
 */
function getSetting(settingId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SETTINGS, "readonly");
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.get(settingId);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Save a setting
 * @param {Object} setting - The setting to save
 * @returns {Promise} Promise that resolves when the setting is saved
 */
function saveSetting(setting) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SETTINGS, "readwrite");
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.put(setting);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Save a calculation
 * @param {Object} calculation - The calculation to save
 * @returns {Promise} Promise that resolves with the saved calculation
 */
function saveCalculation(calculation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CALCULATIONS, "readwrite");
    const store = transaction.objectStore(STORES.CALCULATIONS);
    
    // Add timestamp
    calculation.updated = new Date();
    if (!calculation.created) {
      calculation.created = new Date();
    }
    
    // Save the calculation
    const request = store.put(calculation);
    
    request.onsuccess = (event) => {
      // Get the ID of the saved calculation
      const savedCalculationId = event.target.result;
      
      // Get the saved calculation
      const getRequest = store.get(savedCalculationId);
      getRequest.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      getRequest.onerror = (event) => {
        reject(event.target.error);
      };
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get a calculation by ID
 * @param {number} id - The ID of the calculation to get
 * @returns {Promise} Promise that resolves with the calculation
 */
function getCalculation(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CALCULATIONS, "readonly");
    const store = transaction.objectStore(STORES.CALCULATIONS);
    const request = store.get(id);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get all calculations
 * @param {Object} options - Search options
 * @param {string} options.searchTerm - Optional search term to filter calculations
 * @param {Array<string>} options.tags - Optional array of tags to filter by
 * @param {string} options.type - Optional calculation type to filter by
 * @returns {Promise} Promise that resolves with an array of calculations
 */
function getCalculations(options = {}) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CALCULATIONS, "readonly");
    const store = transaction.objectStore(STORES.CALCULATIONS);
    const request = store.openCursor();
    const calculations = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const calculation = cursor.value;
        
        // Apply filters
        let includeCalculation = true;
        
        // Filter by search term
        if (options.searchTerm && options.searchTerm !== "") {
          const searchableTerm = options.searchTerm.toLowerCase();
          const searchableText = (
            (calculation.title || "") + " " +
            (calculation.description || "") + " " +
            (calculation.tags ? calculation.tags.join(" ") : "")
          ).toLowerCase();
          
          if (searchableText.indexOf(searchableTerm) === -1) {
            includeCalculation = false;
          }
        }
        
        // Filter by tags
        if (includeCalculation && options.tags && options.tags.length > 0) {
          if (!calculation.tags || !options.tags.some(tag => calculation.tags.includes(tag))) {
            includeCalculation = false;
          }
        }
        
        // Filter by type
        if (includeCalculation && options.type) {
          if (calculation.type !== options.type) {
            includeCalculation = false;
          }
        }
        
        if (includeCalculation) {
          calculations.push(calculation);
        }
        
        cursor.continue();
      } else {
        // Sort by updated timestamp (newest first)
        calculations.sort((a, b) => {
          return new Date(b.updated) - new Date(a.updated);
        });
        
        resolve(calculations);
      }
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Delete a calculation by ID
 * @param {number} id - The ID of the calculation to delete
 * @returns {Promise} Promise that resolves when the calculation is deleted
 */
function deleteCalculation(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.CALCULATIONS, STORES.HISTORY], "readwrite");
    const store = transaction.objectStore(STORES.CALCULATIONS);
    const historyStore = transaction.objectStore(STORES.HISTORY);
    
    // Delete the calculation
    const deleteRequest = store.delete(id);
    
    // Delete all history entries for this calculation
    const historyIndex = historyStore.index("calculationId");
    const historyRequest = historyIndex.getAllKeys(id);
    
    historyRequest.onsuccess = (event) => {
      const historyKeys = event.target.result;
      historyKeys.forEach(key => {
        historyStore.delete(key);
      });
    };
    
    transaction.oncomplete = () => {
      resolve();
    };
    
    transaction.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Save a function
 * @param {Object} func - The function to save
 * @returns {Promise} Promise that resolves when the function is saved
 */
function saveFunction(func) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FUNCTIONS, "readwrite");
    const store = transaction.objectStore(STORES.FUNCTIONS);
    
    // Add timestamp
    func.updated = new Date();
    if (!func.created) {
      func.created = new Date();
    }
    
    // Save the function
    const request = store.put(func);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get a function by name
 * @param {string} name - The name of the function to get
 * @returns {Promise} Promise that resolves with the function
 */
function getFunction(name) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FUNCTIONS, "readonly");
    const store = transaction.objectStore(STORES.FUNCTIONS);
    const request = store.get(name);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get all functions
 * @param {Object} options - Search options
 * @param {string} options.searchTerm - Optional search term to filter functions
 * @param {Array<string>} options.tags - Optional array of tags to filter by
 * @param {boolean} options.globalOnly - If true, only get global functions
 * @returns {Promise} Promise that resolves with an array of functions
 */
function getFunctions(options = {}) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FUNCTIONS, "readonly");
    const store = transaction.objectStore(STORES.FUNCTIONS);
    const request = store.openCursor();
    const functions = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const func = cursor.value;
        
        // Apply filters
        let includeFunction = true;
        
        // Filter global functions
        if (options.globalOnly && !func.isGlobal) {
          includeFunction = false;
        }
        
        // Filter by search term
        if (includeFunction && options.searchTerm && options.searchTerm !== "") {
          const searchableTerm = options.searchTerm.toLowerCase();
          const searchableText = (
            func.name + " " +
            (func.description || "") + " " +
            (func.params ? func.params.join(" ") : "") + " " +
            (func.tags ? func.tags.join(" ") : "")
          ).toLowerCase();
          
          if (searchableText.indexOf(searchableTerm) === -1) {
            includeFunction = false;
          }
        }
        
        // Filter by tags
        if (includeFunction && options.tags && options.tags.length > 0) {
          if (!func.tags || !options.tags.some(tag => func.tags.includes(tag))) {
            includeFunction = false;
          }
        }
        
        if (includeFunction) {
          functions.push(func);
        }
        
        cursor.continue();
      } else {
        // Sort alphabetically by name
        functions.sort((a, b) => a.name.localeCompare(b.name));
        resolve(functions);
      }
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Delete a function by name
 * @param {string} name - The name of the function to delete
 * @returns {Promise} Promise that resolves when the function is deleted
 */
function deleteFunction(name) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.FUNCTIONS, "readwrite");
    const store = transaction.objectStore(STORES.FUNCTIONS);
    const request = store.delete(name);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Save a calculation history entry
 * @param {Object} historyEntry - The history entry to save
 * @param {number} historyEntry.calculationId - The ID of the calculation
 * @param {*} historyEntry.result - The result of the calculation
 * @param {Object} historyEntry.params - The parameters used for the calculation
 * @returns {Promise} Promise that resolves when the history entry is saved
 */
function saveCalculationHistory(historyEntry) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.HISTORY, "readwrite");
    const store = transaction.objectStore(STORES.HISTORY);
    
    // Add timestamp if not provided
    if (!historyEntry.timestamp) {
      historyEntry.timestamp = new Date();
    }
    
    const request = store.add(historyEntry);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get calculation history for a specific calculation
 * @param {number} calculationId - The ID of the calculation
 * @param {Object} options - Options for fetching history
 * @param {number} options.limit - Maximum number of entries to return
 * @param {Date} options.startDate - Start date for filtering
 * @param {Date} options.endDate - End date for filtering
 * @returns {Promise} Promise that resolves with an array of history entries
 */
function getCalculationHistory(calculationId, options = {}) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.HISTORY, "readonly");
    const store = transaction.objectStore(STORES.HISTORY);
    const index = store.index("calculationId");
    const request = index.openCursor(calculationId);
    const history = [];
    let count = 0;
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const entry = cursor.value;
        
        // Filter by date range if provided
        let includeEntry = true;
        if (options.startDate && new Date(entry.timestamp) < options.startDate) {
          includeEntry = false;
        }
        
        if (includeEntry && options.endDate && new Date(entry.timestamp) > options.endDate) {
          includeEntry = false;
        }
        
        if (includeEntry) {
          history.push(entry);
          count++;
        }
        
        // Check if we've reached the limit
        if (options.limit && count >= options.limit) {
          // Sort by timestamp (newest first)
          history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          resolve(history);
        } else {
          cursor.continue();
        }
      } else {
        // Sort by timestamp (newest first) and resolve
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        resolve(history);
      }
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Clear all calculation history for a specific calculation
 * @param {number} calculationId - The ID of the calculation
 * @returns {Promise} Promise that resolves when the history is cleared
 */
function clearCalculationHistory(calculationId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.HISTORY, "readwrite");
    const store = transaction.objectStore(STORES.HISTORY);
    const index = store.index("calculationId");
    const request = index.getAllKeys(calculationId);
    
    request.onsuccess = (event) => {
      const keys = event.target.result;
      keys.forEach(key => {
        store.delete(key);
      });
      
      transaction.oncomplete = () => {
        resolve();
      };
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Export database data
 * @param {Object} options - Export options
 * @param {boolean} options.includeCalculations - Whether to include calculations
 * @param {boolean} options.includeFunctions - Whether to include functions
 * @param {boolean} options.includeSettings - Whether to include settings
 * @param {boolean} options.includeHistory - Whether to include calculation history
 * @returns {Promise} Promise that resolves with the exported data
 */
function exportData(options = {
  includeCalculations: true,
  includeFunctions: true,
  includeSettings: true,
  includeHistory: false
}) {
  return new Promise((resolve, reject) => {
    const exportData = {
      metadata: {
        version: DB_VERSION,
        exportDate: new Date(),
        type: "AdvancedCalculationsExport"
      }
    };
    
    const promises = [];
    
    // Export calculations
    if (options.includeCalculations) {
      promises.push(
        getCalculations().then(calculations => {
          exportData.calculations = calculations;
        })
      );
    }
    
    // Export functions
    if (options.includeFunctions) {
      promises.push(
        getFunctions().then(functions => {
          exportData.functions = functions;
        })
      );
    }
    
    // Export settings
    if (options.includeSettings) {
      promises.push(
        new Promise((resolve) => {
          const transaction = db.transaction(STORES.SETTINGS, "readonly");
          const store = transaction.objectStore(STORES.SETTINGS);
          const request = store.getAll();
          
          request.onsuccess = (event) => {
            exportData.settings = event.target.result;
            resolve();
          };
          
          request.onerror = (event) => {
            console.error("Error exporting settings:", event.target.error);
            resolve(); // Still resolve to continue with other exports
          };
        })
      );
    }
    
    // Export history
    if (options.includeHistory) {
      promises.push(
        new Promise((resolve) => {
          const transaction = db.transaction(STORES.HISTORY, "readonly");
          const store = transaction.objectStore(STORES.HISTORY);
          const request = store.getAll();
          
          request.onsuccess = (event) => {
            exportData.history = event.target.result;
            resolve();
          };
          
          request.onerror = (event) => {
            console.error("Error exporting history:", event.target.error);
            resolve(); // Still resolve to continue with other exports
          };
        })
      );
    }
    
    // Wait for all promises to resolve
    Promise.all(promises)
      .then(() => {
        resolve(exportData);
      })
      .catch(reject);
  });
}

/**
 * Import data from an export file
 * @param {Object} importData - The data to import
 * @param {Object} options - Import options
 * @param {boolean} options.overwrite - Whether to overwrite existing data
 * @returns {Promise} Promise that resolves with import results
 */
function importData(importData, options = { overwrite: false }) {
  return new Promise((resolve, reject) => {
    if (!importData || !importData.metadata || importData.metadata.type !== "AdvancedCalculationsExport") {
      reject(new Error("Invalid import data format"));
      return;
    }
    
    const results = {
      calculations: { added: 0, updated: 0, skipped: 0, errors: 0 },
      functions: { added: 0, updated: 0, skipped: 0, errors: 0 },
      settings: { added: 0, updated: 0, skipped: 0, errors: 0 },
      history: { added: 0, updated: 0, skipped: 0, errors: 0 }
    };
    
    const promises = [];
    
    // Import calculations
    if (importData.calculations && importData.calculations.length > 0) {
      importData.calculations.forEach(calculation => {
        promises.push(
          new Promise((resolve) => {
            // Check if calculation already exists
            getCalculation(calculation.id)
              .then(existingCalculation => {
                if (existingCalculation && !options.overwrite) {
                  // Skip if exists and not overwriting
                  results.calculations.skipped++;
                  resolve();
                } else {
                  // Add or update calculation
                  saveCalculation(calculation)
                    .then(() => {
                      if (existingCalculation) {
                        results.calculations.updated++;
                      } else {
                        results.calculations.added++;
                      }
                      resolve();
                    })
                    .catch(error => {
                      console.error("Error importing calculation:", error);
                      results.calculations.errors++;
                      resolve(); // Still resolve to continue with other imports
                    });
                }
              })
              .catch(error => {
                console.error("Error checking existing calculation:", error);
                results.calculations.errors++;
                resolve(); // Still resolve to continue with other imports
              });
          })
        );
      });
    }
    
    // Import functions
    if (importData.functions && importData.functions.length > 0) {
      importData.functions.forEach(func => {
        promises.push(
          new Promise((resolve) => {
            // Check if function already exists
            getFunction(func.name)
              .then(existingFunction => {
                if (existingFunction && !options.overwrite) {
                  // Skip if exists and not overwriting
                  results.functions.skipped++;
                  resolve();
                } else {
                  // Add or update function
                  saveFunction(func)
                    .then(() => {
                      if (existingFunction) {
                        results.functions.updated++;
                      } else {
                        results.functions.added++;
                      }
                      resolve();
                    })
                    .catch(error => {
                      console.error("Error importing function:", error);
                      results.functions.errors++;
                      resolve(); // Still resolve to continue with other imports
                    });
                }
              })
              .catch(error => {
                console.error("Error checking existing function:", error);
                results.functions.errors++;
                resolve(); // Still resolve to continue with other imports
              });
          })
        );
      });
    }
    
    // Import settings
    if (importData.settings && importData.settings.length > 0) {
      const transaction = db.transaction(STORES.SETTINGS, "readwrite");
      const store = transaction.objectStore(STORES.SETTINGS);
      
      importData.settings.forEach(setting => {
        if (options.overwrite) {
          const request = store.put(setting);
          
          request.onsuccess = () => {
            results.settings.updated++;
          };
          
          request.onerror = (event) => {
            console.error("Error importing setting:", event.target.error);
            results.settings.errors++;
          };
        } else {
          // Check if setting exists
          const getRequest = store.get(setting.id);
          
          getRequest.onsuccess = (event) => {
            if (!event.target.result) {
              // Add if doesn't exist
              const addRequest = store.add(setting);
              
              addRequest.onsuccess = () => {
                results.settings.added++;
              };
              
              addRequest.onerror = (event) => {
                console.error("Error importing setting:", event.target.error);
                results.settings.errors++;
              };
            } else {
              results.settings.skipped++;
            }
          };
          
          getRequest.onerror = (event) => {
            console.error("Error checking existing setting:", event.target.error);
            results.settings.errors++;
          };
        }
      });
    }
    
    // Import history
    if (importData.history && importData.history.length > 0) {
      const transaction = db.transaction(STORES.HISTORY, "readwrite");
      const store = transaction.objectStore(STORES.HISTORY);
      
      importData.history.forEach(historyEntry => {
        if (options.overwrite) {
          // For history, we always add rather than update
          const request = store.add(historyEntry);
          
          request.onsuccess = () => {
            results.history.added++;
          };
          
          request.onerror = (event) => {
            console.error("Error importing history entry:", event.target.error);
            results.history.errors++;
          };
        } else {
          // Always add history entries even if not overwriting
          const request = store.add(historyEntry);
          
          request.onsuccess = () => {
            results.history.added++;
          };
          
          request.onerror = (event) => {
            console.error("Error importing history entry:", event.target.error);
            results.history.errors++;
          };
        }
      });
    }
    
    // Wait for all promises to resolve
    Promise.all(promises)
      .then(() => {
        resolve(results);
      })
      .catch(reject);
  });
}

/**
 * Clear all data from the database
 * @returns {Promise} Promise that resolves when all data is cleared
 */
function clearAllData() {
  return new Promise((resolve, reject) => {
    const stores = [STORES.CALCULATIONS, STORES.FUNCTIONS, STORES.HISTORY];
    const transaction = db.transaction(stores, "readwrite");
    
    stores.forEach(storeName => {
      const store = transaction.objectStore(storeName);
      store.clear();
    });
    
    transaction.oncomplete = () => {
      // Re-initialize default settings
      initializeDefaultSettings()
        .then(resolve)
        .catch(reject);
    };
    
    transaction.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Export the database functions
window.calculationsDB = {
  init: initDatabase,
  settings: {
    get: getSetting,
    save: saveSetting
  },
  calculations: {
    save: saveCalculation,
    get: getCalculation,
    getAll: getCalculations,
    delete: deleteCalculation
  },
  functions: {
    save: saveFunction,
    get: getFunction,
    getAll: getFunctions,
    delete: deleteFunction
  },
  history: {
    save: saveCalculationHistory,
    get: getCalculationHistory,
    clear: clearCalculationHistory
  },
  export: exportData,
  import: importData,
  clearAll: clearAllData
};