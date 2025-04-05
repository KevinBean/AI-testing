/**
 * Database management functions
 */

// Initialize the database
$(document).ready(function() {
  console.log("Initializing database...");
  initializeDatabase();
});

// Initialize the indexedDB database
function initializeDatabase() {
  if (!window.indexedDB) {
    console.error("Your browser doesn't support IndexedDB");
    window.appState.dbInitializationError = "Your browser doesn't support IndexedDB";
    showDatabaseError("Your browser doesn't support IndexedDB. Please use a modern browser.");
    return;
  }

  const request = window.indexedDB.open("markdownNoteSystem", 1);
  
  request.onerror = function(event) {
    console.error("Database error:", event.target.error);
    window.appState.dbInitializationError = event.target.error.message || "Failed to open database";
    showDatabaseError("Failed to initialize the database. Please try refreshing the page.");
  };

  request.onupgradeneeded = function(event) {
    console.log("Creating or upgrading database...");
    const db = event.target.result;
    
    // Create object stores if they don't exist
    if (!db.objectStoreNames.contains('blocks')) {
      db.createObjectStore('blocks', { keyPath: 'id', autoIncrement: true });
    }
    
    if (!db.objectStoreNames.contains('standards')) {
      const standardsStore = db.createObjectStore('standards', { keyPath: 'id', autoIncrement: true });
      standardsStore.createIndex('number', 'number', { unique: true });
    }
    
    if (!db.objectStoreNames.contains('documents')) {
      db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
    }
    
    if (!db.objectStoreNames.contains('collections')) {
      db.createObjectStore('collections', { keyPath: 'id', autoIncrement: true });
    }
    
    if (!db.objectStoreNames.contains('documentCollections')) {
      const mappingStore = db.createObjectStore('documentCollections', { keyPath: 'id', autoIncrement: true });
      mappingStore.createIndex('documentId', 'documentId', { unique: false });
      mappingStore.createIndex('collectionId', 'collectionId', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('tags')) {
      db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
    }
    
    if (!db.objectStoreNames.contains('contentTags')) {
      const contentTagsStore = db.createObjectStore('contentTags', { keyPath: 'id', autoIncrement: true });
      contentTagsStore.createIndex('contentId', 'contentId', { unique: false });
      contentTagsStore.createIndex('tagId', 'tagId', { unique: false });
      contentTagsStore.createIndex('contentType', 'contentType', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('actions')) {
      db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
    }
    
    if (!db.objectStoreNames.contains('workflows')) {
      db.createObjectStore('workflows', { keyPath: 'id', autoIncrement: true });
    }
    
    console.log("Database schema created successfully");
  };

  request.onsuccess = function(event) {
    console.log("Database initialized successfully");
    window.appState.db = event.target.result;
    window.appState.dbInitialized = true;
    window.db = event.target.result; // For backward compatibility
    
    // Handle database connection closures
    window.appState.db.onversionchange = function() {
      window.appState.db.close();
      alert("Database was updated in another tab. Please refresh this page.");
    };
    
    // Dispatch an event to notify that database is ready
    document.dispatchEvent(new Event('databaseReady'));
  };
}

// Helper function to ensure database is ready before proceeding
function ensureDatabaseReady() {
  return new Promise((resolve, reject) => {
    if (window.appState.dbInitialized && window.appState.db) {
      resolve(window.appState.db);
    } else if (window.appState.dbInitializationError) {
      reject(new Error(window.appState.dbInitializationError));
    } else {
      // Wait for database to be initialized
      const checkDb = function(attempts = 0) {
        if (window.appState.dbInitialized && window.appState.db) {
          resolve(window.appState.db);
        } else if (window.appState.dbInitializationError) {
          reject(new Error(window.appState.dbInitializationError));
        } else if (attempts > 50) { // Try for about 5 seconds (50 * 100ms)
          reject(new Error("Database initialization timed out"));
        } else {
          setTimeout(() => checkDb(attempts + 1), 100);
        }
      };
      
      // Start checking
      checkDb();
    }
  });
}

// Display database error messages
function showDatabaseError(message) {
  // Create an error notification at the top of the page
  const $errorAlert = $(`
    <div class="alert alert-danger alert-dismissible fade show database-error" role="alert">
      <strong>Database Error:</strong> ${message}
      <button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  `);
  
  // Remove any existing database error alerts
  $('.database-error').remove();
  
  // Add the new error alert at the top of the container
  $('.container').prepend($errorAlert);
}

// Add this utility function at the end of the file
function ensureSafeDbObject(obj, defaultProperties = {}) {
  if (!obj) return defaultProperties;
  
  // Create a safe copy with default values
  const safeObj = {...defaultProperties};
  
  // Copy over existing properties
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      safeObj[key] = obj[key];
    }
  }
  
  // Ensure tags is always an array
  if (!Array.isArray(safeObj.tags)) {
    safeObj.tags = [];
  }
  
  return safeObj;
}

// Usage example:
// const block = ensureSafeDbObject(rawBlock, {
//   title: "Untitled",
//   text: "",
//   tags: [],
//   standard: "",
//   stdLevels: []
// });
