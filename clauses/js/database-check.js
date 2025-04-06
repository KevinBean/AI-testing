/**
 * Database Check and Diagnostics Utility
 * 
 * This file provides functions to diagnose and fix common database issues
 */

// Check if database is properly initialized
function checkDatabaseStatus() {
  console.log("Checking database status...");
  
  // Record check results
  const status = {
    dbExists: false,
    appStateExists: false,
    appStateDbExists: false,
    windowDbExists: false,
    canOpenTransaction: false,
    stores: [],
    version: 0,
    errors: []
  };
  
  // Check if basic objects exist
  status.appStateExists = typeof window.appState !== 'undefined';
  status.appStateDbExists = status.appStateExists && window.appState.db !== null;
  status.windowDbExists = typeof window.db !== 'undefined' && window.db !== null;
  status.dbExists = status.appStateDbExists || status.windowDbExists;
  
  try {
    // Determine which db reference to use
    const db = status.appStateDbExists ? window.appState.db : (status.windowDbExists ? window.db : null);
    if (db) {
      status.version = db.version;
      status.stores = Array.from(db.objectStoreNames);
      
      // Try to open a transaction
      try {
        const transaction = db.transaction(['blocks'], 'readonly');
        status.canOpenTransaction = true;
        transaction.abort();
      } catch (err) {
        status.canOpenTransaction = false;
        status.errors.push("Cannot open transaction: " + err.message);
      }
    } else {
      status.errors.push("No database reference available");
    }
  } catch (err) {
    status.errors.push("Error checking database: " + err.message);
  }
  
  console.log("Database status check results:", status);
  return status;
}

// Check if database schema meets current requirements
function checkDatabaseSchema() {
  return new Promise((resolve, reject) => {
    // Define expected object stores and indexes
    const expectedStores = [
      { name: "blocks", indexes: ["standard", "notes"] },  // Added notes index
      { name: "standards", indexes: [] },
      { name: "documents", indexes: [] },
      { name: "collections", indexes: [] },
      { name: "documentCollections", indexes: ["documentId", "collectionId"] },
      { name: "actions", indexes: [] },
      { name: "workflows", indexes: [] }
    ];
    
    const CURRENT_DB_VERSION = 1;
    
    try {
      // Get database reference
      const db = (window.appState && window.appState.db) || window.db;
      
      if (!db) {
        reject(new Error("No database instance available"));
        return;
      }
      
      // Check if all expected stores exist
      const existingStores = Array.from(db.objectStoreNames);
      const missingStores = expectedStores
        .filter(store => !existingStores.includes(store.name))
        .map(store => store.name);
      
      // Check schema is complete
      const schemaComplete = missingStores.length === 0;
      
      resolve({
        complete: schemaComplete,
        currentVersion: db.version,
        expectedVersion: CURRENT_DB_VERSION,
        missingStores: missingStores
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Force schema upgrade to add missing stores
function forceSchemaUpgrade() {
  return new Promise((resolve, reject) => {
    try {
      const db = (window.appState && window.appState.db) || window.db;
      
      if (!db) {
        reject(new Error("No database instance available"));
        return;
      }
      
      // Close existing connection
      db.close();
      
      // Open with version upgrade
      const openRequest = indexedDB.open("EnhancedNoteDB", CURRENT_DB_VERSION + 1);
      
      openRequest.onupgradeneeded = function(event) {
        const db = event.target.result;
        console.log("Forcing schema upgrade to version:", db.version);
        
        // Ensure blocks store exists and has notes index
        if (!db.objectStoreNames.contains('blocks')) {
          const blockStore = db.createObjectStore('blocks', { keyPath: 'id', autoIncrement: true });
          blockStore.createIndex('standard', 'standard', { unique: false });
          blockStore.createIndex('notes', 'notes', { unique: false });
        } else {
          // Store exists, check for notes index
          const tx = event.target.transaction;
          const blockStore = tx.objectStore('blocks');
          
          // Create notes index if it doesn't exist
          if (!blockStore.indexNames.contains('notes')) {
            blockStore.createIndex('notes', 'notes', { unique: false });
          }
        }
        
        // Ensure other stores exist
        const existingStores = Array.from(db.objectStoreNames);
        
        if (!existingStores.includes('standards')) {
          db.createObjectStore('standards', { keyPath: 'id' });
        }
        
        if (!existingStores.includes('documents')) {
          db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
        }
        
        if (!existingStores.includes('actions')) {
          db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
        }
        
        if (!existingStores.includes('workflows')) {
          db.createObjectStore('workflows', { keyPath: 'id', autoIncrement: true });
        }
        
        if (!existingStores.includes('collections')) {
          const collectionsStore = db.createObjectStore('collections', { keyPath: 'id', autoIncrement: true });
          collectionsStore.createIndex('name', 'name', { unique: false });
          collectionsStore.createIndex('created', 'created', { unique: false });
        }
        
        if (!existingStores.includes('documentCollections')) {
          const mappingStore = db.createObjectStore('documentCollections', { keyPath: 'id', autoIncrement: true });
          mappingStore.createIndex('documentId', 'documentId', { unique: false });
          mappingStore.createIndex('collectionId', 'collectionId', { unique: false });
        }
      };
      
      openRequest.onsuccess = function(event) {
        // Update global references
        const newDb = event.target.result;
        window.appState.db = newDb;
        window.db = newDb;
        resolve(true);
      };
      
      openRequest.onerror = function(event) {
        reject(new Error("Failed to upgrade schema: " + event.target.error));
      };
    } catch (err) {
      reject(err);
    }
  });
}

// Attempt to reinitialize database
function attemptDatabaseRepair() {
  const status = checkDatabaseStatus();
  console.log("Attempting database repair based on status:", status);
  
  // Close any existing connections
  if (status.appStateDbExists) {
    try {
      window.appState.db.close();
      window.appState.db = null;
    } catch (err) {
      console.error("Error closing appState.db:", err);
    }
  }
  
  if (status.windowDbExists) {
    try {
      window.db.close();
      window.db = null;
    } catch (err) {
      console.error("Error closing window.db:", err);
    }
  }
  
  // Attempt to reopen the database
  const openRequest = indexedDB.open("EnhancedNoteDB", CURRENT_DB_VERSION);
  
  openRequest.onupgradeneeded = function(event) {
    const db = event.target.result;
    console.log("Repair: Creating/upgrading database schema");
    
    // Redefine all stores if needed
    createStandardSchema(db);
  };
  
  openRequest.onsuccess = function(event) {
    const db = event.target.result;
    console.log("Database repair successful");
    
    if (!window.appState) window.appState = {};
    window.appState.db = db;
    window.db = db;
    
    // Signal database is ready
    window.dispatchEvent(new CustomEvent('database-ready'));
    
    // Show success notification
    if (typeof showNotification === 'function') {
      showNotification("Database connection restored", "success");
    }
  };
  
  openRequest.onerror = function(event) {
    console.error("Database repair failed:", event.target.error);
    
    // Show failure notification
    if (typeof showNotification === 'function') {
      showNotification("Could not repair database. Try refreshing the page.", "danger");
    }
  };
  
  return openRequest;
}

// Create standard schema for the database
function createStandardSchema(db) {
  // Check if stores exist first
  const existingStores = Array.from(db.objectStoreNames);
  
  // Create blocks store if needed
  if (!existingStores.includes('blocks')) {
    const blockStore = db.createObjectStore('blocks', { keyPath: 'id', autoIncrement: true });
    blockStore.createIndex('standard', 'standard', { unique: false });
    blockStore.createIndex('notes', 'notes', { unique: false }); // Added notes index
  }
  
  // Create other stores if needed
  if (!existingStores.includes('standards')) {
    db.createObjectStore('standards', { keyPath: 'id' });
  }
  
  if (!existingStores.includes('documents')) {
    db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
  }
  
  if (!existingStores.includes('actions')) {
    db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
  }
  
  if (!existingStores.includes('workflows')) {
    db.createObjectStore('workflows', { keyPath: 'id', autoIncrement: true });
  }
  
  if (!existingStores.includes('collections')) {
    const collectionsStore = db.createObjectStore('collections', { keyPath: 'id', autoIncrement: true });
    collectionsStore.createIndex('name', 'name', { unique: false });
    collectionsStore.createIndex('created', 'created', { unique: false });
  }
  
  if (!existingStores.includes('documentCollections')) {
    const mappingStore = db.createObjectStore('documentCollections', { keyPath: 'id', autoIncrement: true });
    mappingStore.createIndex('documentId', 'documentId', { unique: false });
    mappingStore.createIndex('collectionId', 'collectionId', { unique: false });
  }
}

// Function to diagnose and display database issues
function diagnoseDatabaseIssues() {
  const status = checkDatabaseStatus();
  
  // Create report HTML
  let html = '<div class="database-diagnosis card mt-3 p-3">';
  html += '<h5>Database Diagnosis Results</h5>';
  
  if (status.dbExists) {
    html += `<div class="alert alert-info">
      <p><strong>Database Info:</strong></p>
      <ul>
        <li>Version: ${status.version}</li>
        <li>Object stores: ${status.stores.join(', ')}</li>
        <li>Can open transaction: ${status.canOpenTransaction ? 'Yes' : 'No'}</li>
      </ul>
    </div>`;
  } else {
    html += `<div class="alert alert-danger">
      <p><strong>No database connection available</strong></p>
      <p>This could be due to initialization failures or browser storage issues.</p>
    </div>`;
  }
  
  if (status.errors.length > 0) {
    html += '<div class="alert alert-warning"><p><strong>Errors detected:</strong></p><ul>';
    status.errors.forEach(error => {
      html += `<li>${error}</li>`;
    });
    html += '</ul></div>';
  }
  
  html += '<button id="repairDbConnection" class="btn btn-primary mr-2">Attempt Repair</button>';
  html += '<button id="reloadPage" class="btn btn-secondary">Reload Page</button>';
  html += '</div>';
  
  // Add to page if in settings view
  if ($("#settingsView").length) {
    $("#settingsView").prepend(html);
    
    // Add event handlers
    $("#repairDbConnection").on("click", function() {
      attemptDatabaseRepair();
    });
    
    $("#reloadPage").on("click", function() {
      location.reload();
    });
  } else {
    // If not in settings, create a modal
    html = `<div class="modal fade" id="dbDiagnosisModal" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Database Diagnosis</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            ${html}
          </div>
        </div>
      </div>
    </div>`;
    
    $("body").append(html);
    $("#dbDiagnosisModal").modal('show');
    
    // Add event handlers
    $("#repairDbConnection").on("click", function() {
      attemptDatabaseRepair();
      $("#dbDiagnosisModal").modal('hide');
    });
    
    $("#reloadPage").on("click", function() {
      location.reload();
    });
  }
}

// Make functions available globally
window.checkDatabaseStatus = checkDatabaseStatus;
window.checkDatabaseSchema = checkDatabaseSchema;
window.forceSchemaUpgrade = forceSchemaUpgrade;
window.attemptDatabaseRepair = attemptDatabaseRepair;
window.diagnoseDatabaseIssues = diagnoseDatabaseIssues;
