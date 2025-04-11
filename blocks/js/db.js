/**
 * Database setup and management
 */

// Database instance
let db;

/**
 * Initialize the database
 * @returns {Promise} Promise that resolves when database is ready
 */
function initializeDB() {
  return new Promise((resolve, reject) => {
    let retryCount = 0;
    const maxRetries = 3;
    
    function attemptConnection() {
      const request = indexedDB.open("EnhancedNoteDB", 7);
      
      // Keep your existing onupgradeneeded handler
      request.onupgradeneeded = function(e) {
        db = e.target.result;
      
      // Only create stores if they don't already exist
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id", autoIncrement: true });
      }
      
      // Rename clauses store to blocks if needed
      if (db.objectStoreNames.contains("clauses") && !db.objectStoreNames.contains("blocks")) {
        // Get all clauses
        const tempStore = e.target.transaction.objectStore("clauses");
        const clauses = [];
        tempStore.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if(cursor) {
            clauses.push(cursor.value);
            cursor.continue();
          } else {
            // Delete old store and create new one
            db.deleteObjectStore("clauses");
            const blockStore = db.createObjectStore("blocks", { keyPath: "id", autoIncrement: true });
            blockStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
            
            // Add clauses data to new store in next transaction
            const tx = db.transaction("blocks", "readwrite");
            const store = tx.objectStore("blocks");
            clauses.forEach(clause => {
              // Add title field to existing clauses
              clause.title = "Block " + clause.id; // Default title
              store.add(clause);
            });
          }
        };
      } else if (!db.objectStoreNames.contains("blocks")) {
        // Create blocks store if it doesn't exist
        const blockStore = db.createObjectStore("blocks", { keyPath: "id", autoIncrement: true });
        blockStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
      }
      
      if (!db.objectStoreNames.contains("references")) {
        // Create or update references store with additional fields
        const refStore = db.createObjectStore("references", { keyPath: "id" });
        // No need to create indexes for simple lookup table
      }
      
      // Create actions store if it doesn't exist
      if (!db.objectStoreNames.contains("actions")) {
        const actionsStore = db.createObjectStore("actions", { keyPath: "id", autoIncrement: true });
        actionsStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
      }

      // Create workflows store if it doesn't exist
      if (!db.objectStoreNames.contains("workflows")) {
        const workflowsStore = db.createObjectStore("workflows", { keyPath: "id", autoIncrement: true });
        workflowsStore.createIndex("name", "name", { unique: false });
      }

      // Create collections store if it doesn't exist
      if (!db.objectStoreNames.contains("collections")) {
        const collectionsStore = db.createObjectStore("collections", { keyPath: "id", autoIncrement: true });
        collectionsStore.createIndex("name", "name", { unique: false });
      }
    };
    
    request.onsuccess = function(e) {
      db = e.target.result;
      window.db = db; // Make db accessible globally
      console.log("Database initialized successfully");
      window.dbInitialized = true; // Add this flag
      resolve(db);
    };
    
    request.onerror = function(e) {
      const error = e.target.error;
      console.error("DB error:", error);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retry attempt ${retryCount}/${maxRetries}...`);
        setTimeout(attemptConnection, 1000); // Wait before retrying
      } else {
        // Show user-friendly error
        showNotification(`Database error: ${error.message}. Try reloading the page or reset the database in Settings.`, "danger", 8000);
        reject(error);
      }
    };
  }
  
  attemptConnection();
  });
}

/**
 * Helper function to fetch a block by ID
 * @param {number} id - The block ID
 * @returns {Promise} Promise that resolves with the block object
 */
function fetchBlockById(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
      const request = store.get(parseInt(id));
      request.onsuccess = function(e) {
        resolve(e.target.result);
      };
      request.onerror = function(e) {
        reject(e.target.error);
      };
    } catch(err) {
      reject(err);
    }
  });
}

/**
 * Helper function to fetch a document by ID
 * @param {number} id - The document ID
 * @returns {Promise} Promise that resolves with the document object
 */
function fetchDocumentById(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const transaction = db.transaction("documents", "readonly");
      const store = transaction.objectStore("documents");
      
      const request = store.get(parseInt(id));
      request.onsuccess = function(e) {
        resolve(e.target.result);
      };
      request.onerror = function(e) {
        reject(e.target.error);
      };
    } catch(err) {
      reject(err);
    }
  });
}

/**
 * Helper function to export all data from the database
 * @returns {Promise} Promise that resolves with the exported data
 */
function exportAllData() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const exportData = {};
      const tx = db.transaction(["documents", "blocks", "references", "actions", "collections", "workflows"], "readonly");
      
      Promise.all([
        getStoreData(tx, "documents"),
        getStoreData(tx, "blocks"),
        getStoreData(tx, "references"),
        getStoreData(tx, "actions"),
        getStoreData(tx, "collections"),
        getStoreData(tx, "workflows")
      ]).then(results => {
        exportData.documents = results[0];
        exportData.blocks = results[1];
        exportData.references = results[2];
        exportData.actions = results[3];
        exportData.collections = results[4];
        exportData.workflows = results[5];
        resolve(exportData);
      }).catch(error => {
        reject(error);
      });
    } catch(err) {
      reject(err);
    }
  });
}

/**
 * Helper function to get all data from a store
 * @param {IDBTransaction} tx - The transaction
 * @param {string} storeName - Name of the store
 * @returns {Promise} Promise that resolves with all data from the store
 */
function getStoreData(tx, storeName) {
  return new Promise((resolve, reject) => {
    if (!tx.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    
    const items = [];
    const store = tx.objectStore(storeName);
    
    const request = store.openCursor();
    request.onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    
    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

/**
 * Import data into the database
 * @param {Object} data - The data to import
 * @param {string} option - Import option: 'replace' or 'merge'
 * @returns {Promise} Promise that resolves when import is complete
 */
function importData(data, option) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      // Process each store in a separate transaction to avoid timeout issues
      Promise.all([
        importStoreData("documents", data.documents || [], option),
        importStoreData("blocks", data.blocks || [], option),
        importStoreData("references", data.references || [], option),
        importStoreData("actions", data.actions || [], option),
        importStoreData("collections", data.collections || [], option),
        importStoreData("workflows", data.workflows || [], option)
      ]).then(() => {
        resolve();
      }).catch(error => {
        reject(error);
      });
    } catch(err) {
      reject(err);
    }
  });
}

/**
 * Helper function to import data into a store
 * @param {string} storeName - Name of the store
 * @param {Array} items - Items to import
 * @param {string} option - Import option: 'replace' or 'merge'
 * @returns {Promise} Promise that resolves when import is complete
 */
function importStoreData(storeName, items, option) {
  return new Promise((resolve, reject) => {
    if (!items || items.length === 0 || !db.objectStoreNames.contains(storeName)) {
      resolve();
      return;
    }
    
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      
      let completed = 0;
      
      items.forEach(item => {
        if (option === "merge") {
          // In merge mode, only add if item doesn't exist
          const getRequest = store.get(item.id || 0);
          getRequest.onsuccess = function(e) {
            if (!e.target.result) {
              const addRequest = store.put(item);
              addRequest.onsuccess = function() {
                completed++;
                if (completed === items.length) {
                  resolve();
                }
              };
              addRequest.onerror = function(e) {
                reject(e.target.error);
              };
            } else {
              completed++;
              if (completed === items.length) {
                resolve();
              }
            }
          };
          getRequest.onerror = function(e) {
            reject(e.target.error);
          };
        } else {
          // In replace mode, add or overwrite
          const putRequest = store.put(item);
          putRequest.onsuccess = function() {
            completed++;
            if (completed === items.length) {
              resolve();
            }
          };
          putRequest.onerror = function(e) {
            reject(e.target.error);
          };
        }
      });
      
      tx.oncomplete = function() {
        // This may not be reached if all items were processed individually
        if (completed === items.length) {
          resolve();
        }
      };
      
      tx.onerror = function(e) {
        reject(e.target.error);
      };
    } catch(err) {
      reject(err);
    }
  });
}

/**
 * Reset the database (for troubleshooting)
 * @returns {Promise} Promise that resolves when the database is reset
 */
function resetDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close();
    }
    
    const deleteRequest = indexedDB.deleteDatabase("EnhancedNoteDB");
    
    deleteRequest.onsuccess = function() {
      resolve();
    };
    
    deleteRequest.onerror = function(e) {
      reject(e.target.error);
    };
    
    deleteRequest.onblocked = function() {
      reject(new Error("Database deletion was blocked. Please close all other tabs with this application and try again."));
    };
  });
}
