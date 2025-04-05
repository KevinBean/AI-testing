// Settings page functionality

$(document).ready(function() {
  console.log("Settings page initialized");
  
  // Toggle API Key visibility
  $("#toggleApiKey").on("click", function() {
    const apiKeyField = $("#apiKey");
    const toggleBtn = $(this).find("i");
    
    if (apiKeyField.attr("type") === "password") {
      apiKeyField.attr("type", "text");
      toggleBtn.removeClass("fa-eye").addClass("fa-eye-slash");
    } else {
      apiKeyField.attr("type", "password");
      toggleBtn.removeClass("fa-eye-slash").addClass("fa-eye");
    }
  });
  
  // API Key form submission
  $("#apiSettingsForm").on("submit", function(e) {
    e.preventDefault();
    saveApiKey();
  });
  
  // Clear API Key
  $("#clearApiKey").on("click", function() {
    if (confirm("Are you sure you want to clear your API key?")) {
      localStorage.removeItem("openai_api_key");
      window.appState.openaiApiKey = null;
      $("#apiKey").val("");
      loadApiKeyStatus();
      showNotification("API key has been cleared", "info");
    }
  });
  
  // Export data functionality
  $("#exportBtn").on("click", function() {
    exportData();
  });
  
  // Import file change handler
  $("#importFile").on("change", function(e) {
    const file = e.target.files[0];
    if (file) {
      handleFileImport(file);
    }
  });
  
  // Import confirmation button
  $("#confirmImport").on("click", function() {
    const importOption = $('input[name="importOption"]:checked').val();
    performImport(importOption);
  });
  
  // Database management
  $("#checkSchemaBtn").on("click", function() {
    checkSchema();
  });
  
  $("#repairSchemaBtn").on("click", function() {
    repairSchema();
  });
  
  $("#forceVersionUpgradeBtn").on("click", function() {
    confirmForceUpgrade();
  });
  
  // Reset database button
  $("#resetDbBtn").on("click", function() {
    // Show confirmation modal
    $("#resetDbConfirmModal").modal("show");
  });
  
  // Confirmation for database reset
  $("#confirmResetDb").on("click", function() {
    resetDatabase();
    $("#resetDbConfirmModal").modal("hide");
  });
  
  // Initially load API key status
  loadApiKeyStatus();
});

// Save API Key to localStorage
function saveApiKey() {
  const apiKey = $("#apiKey").val().trim();
  
  if (apiKey) {
    localStorage.setItem("openai_api_key", apiKey);
    window.appState.openaiApiKey = apiKey;
    showNotification("API key saved successfully", "success");
    loadApiKeyStatus();
  } else {
    showNotification("Please enter a valid API key", "warning");
  }
}

// Load and display API key status
function loadApiKeyStatus() {
  const apiKey = localStorage.getItem("openai_api_key");
  
  if (apiKey) {
    $("#apiKey").val(apiKey);
    $("#apiKeyStatus").html(`
      <div class="alert alert-success">
        <i class="fas fa-check-circle"></i> API key is set
      </div>
    `);
  } else {
    $("#apiKeyStatus").html(`
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle"></i> No API key is set
      </div>
    `);
  }
}

// Export all data to a JSON file
function exportData() {
  if (!window.appState.db) {
    showNotification("Database is not available", "danger");
    return;
  }
  
  const exportData = {
    blocks: [],
    standards: [],
    documents: [],
    collections: [],
    documentCollections: [],
    actions: [],
    workflows: [],
    version: window.appState.db.version,
    exportDate: new Date().toISOString()
  };
  
  const promises = [];
  
  // Export blocks
  promises.push(new Promise((resolve) => {
    const tx = window.appState.db.transaction("blocks", "readonly");
    const store = tx.objectStore("blocks");
    const request = store.getAll();
    
    request.onsuccess = function() {
      exportData.blocks = request.result;
      resolve();
    };
    
    request.onerror = function() {
      console.error("Error exporting blocks", request.error);
      resolve();
    };
  }));
  
  // Export standards
  promises.push(new Promise((resolve) => {
    const tx = window.appState.db.transaction("standards", "readonly");
    const store = tx.objectStore("standards");
    const request = store.getAll();
    
    request.onsuccess = function() {
      exportData.standards = request.result;
      resolve();
    };
    
    request.onerror = function() {
      console.error("Error exporting standards", request.error);
      resolve();
    };
  }));
  
  // Export documents
  promises.push(new Promise((resolve) => {
    const tx = window.appState.db.transaction("documents", "readonly");
    const store = tx.objectStore("documents");
    const request = store.getAll();
    
    request.onsuccess = function() {
      exportData.documents = request.result;
      resolve();
    };
    
    request.onerror = function() {
      console.error("Error exporting documents", request.error);
      resolve();
    };
  }));
  
  // Try to export collections if the object store exists
  try {
    promises.push(new Promise((resolve) => {
      try {
        const tx = window.appState.db.transaction("collections", "readonly");
        const store = tx.objectStore("collections");
        const request = store.getAll();
        
        request.onsuccess = function() {
          exportData.collections = request.result;
          resolve();
        };
        
        request.onerror = function() {
          console.error("Error exporting collections", request.error);
          resolve();
        };
      } catch (err) {
        console.warn("Collections store not available for export");
        resolve();
      }
    }));
    
    // Try to export document-collection mappings
    promises.push(new Promise((resolve) => {
      try {
        const tx = window.appState.db.transaction("documentCollections", "readonly");
        const store = tx.objectStore("documentCollections");
        const request = store.getAll();
        
        request.onsuccess = function() {
          exportData.documentCollections = request.result;
          resolve();
        };
        
        request.onerror = function() {
          console.error("Error exporting document collections", request.error);
          resolve();
        };
      } catch (err) {
        console.warn("DocumentCollections store not available for export");
        resolve();
      }
    }));
  } catch (err) {
    console.warn("Collections stores not available:", err.message);
  }
  
  // Export actions
  promises.push(new Promise((resolve) => {
    const tx = window.appState.db.transaction("actions", "readonly");
    const store = tx.objectStore("actions");
    const request = store.getAll();
    
    request.onsuccess = function() {
      exportData.actions = request.result;
      resolve();
    };
    
    request.onerror = function() {
      console.error("Error exporting actions", request.error);
      resolve();
    };
  }));
  
  // Export workflows
  promises.push(new Promise((resolve) => {
    const tx = window.appState.db.transaction("workflows", "readonly");
    const store = tx.objectStore("workflows");
    const request = store.getAll();
    
    request.onsuccess = function() {
      exportData.workflows = request.result;
      resolve();
    };
    
    request.onerror = function() {
      console.error("Error exporting workflows", request.error);
      resolve();
    };
  }));
  
  // When all data is exported
  Promise.all(promises).then(() => {
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `enhanced-note-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification("Data exported successfully", "success");
  });
}

// Handle file import
function handleFileImport(file) {
  if (!file || file.type !== "application/json") {
    showNotification("Please select a valid JSON file", "warning");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      // Store for later use
      window.appState.importedData = importedData;
      
      // Calculate total items
      const totalItems = 
        (importedData.blocks?.length || 0) +
        (importedData.standards?.length || 0) +
        (importedData.documents?.length || 0) +
        (importedData.collections?.length || 0) +
        (importedData.actions?.length || 0) +
        (importedData.workflows?.length || 0);
      
      if (totalItems > 0) {
        $("#importItemCount").text(totalItems);
        $("#importOptionsModal").modal("show");
      } else {
        showNotification("No data found in import file", "warning");
      }
    } catch (err) {
      console.error("Import parse error:", err);
      showNotification("Invalid JSON file format", "danger");
    }
  };
  
  reader.readAsText(file);
}

// Perform data import based on selected option
function performImport(importOption) {
  if (!window.appState.importedData) {
    showNotification("No data to import", "warning");
    return;
  }
  
  const data = window.appState.importedData;
  const isReplace = importOption === "replace";
  const promises = [];
  
  // Helper for import
  function importObjectStore(storeName, items) {
    if (!items || items.length === 0) return Promise.resolve();
    
    return new Promise((resolve) => {
      try {
        const tx = window.appState.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        
        // If replacing, clear store first
        if (isReplace) {
          const clearReq = store.clear();
          clearReq.onerror = () => console.error(`Error clearing ${storeName}`, clearReq.error);
        }
        
        let completed = 0;
        
        items.forEach(item => {
          const request = store.put(item);
          
          request.onsuccess = function() {
            completed++;
            if (completed === items.length) {
              resolve();
            }
          };
          
          request.onerror = function() {
            console.error(`Error importing ${storeName}`, request.error);
            completed++;
            if (completed === items.length) {
              resolve();
            }
          };
        });
        
        // If no items to process
        if (items.length === 0) {
          resolve();
        }
      } catch (err) {
        console.warn(`Error importing to ${storeName}:`, err.message);
        resolve(); // Continue with other stores
      }
    });
  }
  
  // Import each object store
  if (data.blocks) promises.push(importObjectStore("blocks", data.blocks));
  if (data.standards) promises.push(importObjectStore("standards", data.standards));
  if (data.documents) promises.push(importObjectStore("documents", data.documents));
  if (data.actions) promises.push(importObjectStore("actions", data.actions));
  if (data.workflows) promises.push(importObjectStore("workflows", data.workflows));
  
  // Try to import collections if they exist
  try {
    if (data.collections) promises.push(importObjectStore("collections", data.collections));
    if (data.documentCollections) promises.push(importObjectStore("documentCollections", data.documentCollections));
  } catch (err) {
    console.warn("Collections stores not available for import");
  }
  
  Promise.all(promises).then(() => {
    $("#importOptionsModal").modal("hide");
    window.appState.importedData = null; // Clear imported data
    $("#importFile").val(""); // Clear file input
    showNotification("Data imported successfully", "success");
    
    // Refresh active view if applicable
    const activeTab = $("#viewTabs .nav-link.active").attr("id");
    if (activeTab === "blocks-tab" && typeof loadBlocks === "function") {
      loadBlocks();
    } else if (activeTab === "standards-tab" && typeof loadStandardsMetadata === "function") {
      loadStandardsMetadata();
    } else if (activeTab === "documents-tab" && typeof loadDocuments === "function") {
      loadDocuments();
    } else if (activeTab === "collections-tab" && typeof loadCollections === "function") {
      loadCollections();
    }
  });
}

// Check database schema
function checkSchema() {
  if (typeof checkDatabaseSchema !== 'function') {
    showNotification("Schema check function not available", "danger");
    return;
  }
  
  // Clear any existing status first
  $("#checkSchemaBtn").siblings(".schema-status").remove();
  
  // Add "in progress" status
  $("#checkSchemaBtn").after(`
    <div class="mt-2 schema-status alert alert-info">
      <i class="fas fa-spinner fa-spin"></i> Checking database schema...
    </div>
  `);
  
  // First verify we have a database connection
  const db = (window.appState && window.appState.db) || window.db;
  
  if (!db) {
    $(".schema-status").replaceWith(`
      <div class="mt-2 schema-status alert alert-danger">
        <i class="fas fa-times-circle"></i> Error checking schema: Database not available.
        <p>Please make sure the database is properly initialized or try refreshing the page.</p>
        <button class="btn btn-sm btn-outline-primary mt-2" onclick="location.reload()">Refresh Page</button>
      </div>
    `);
    return;
  }
  
  // Proceed with schema check
  checkDatabaseSchema()
    .then(result => {
      // Remove any existing status
      $(".schema-status").replaceWith(`
        <div class="mt-2 schema-status alert alert-${result.complete ? 'success' : 'warning'}">
          ${result.complete 
            ? `<i class="fas fa-check-circle"></i> Database schema is complete. All required object stores exist.` 
            : `<i class="fas fa-exclamation-triangle"></i> Database schema is incomplete. <p>Missing object stores: ${result.missingStores.join(", ")}</p>`
          }
          <ul class="mb-0 ${!result.complete ? 'mt-1' : ''}">
            <li>Current version: ${result.currentVersion}</li>
            <li>Expected version: ${result.expectedVersion}</li>
          </ul>
          ${!result.complete ? '<p class="mt-2">Use the "Repair Schema" button to try fixing this issue.</p>' : ''}
        </div>
      `);
    })
    .catch(error => {
      $(".schema-status").replaceWith(`
        <div class="mt-2 schema-status alert alert-danger">
          <i class="fas fa-times-circle"></i> Error checking schema: ${error.message}
          <p class="mt-2">Try refreshing the page or using the "Force Version Upgrade" option as a last resort.</p>
        </div>
      `);
    });
}

// Repair database schema
function repairSchema() {
  // Make sure we have a database reference
  const db = (window.appState && window.appState.db) || window.db;
  
  if (!db) {
    showNotification("Database not available. Try refreshing the page.", "danger");
    return;
  }
  
  // Remove any existing status
  $("#repairSchemaBtn").siblings(".repair-status").remove();
  
  // Add "in progress" status
  $("#repairSchemaBtn").after(`
    <div class="mt-2 repair-status alert alert-info">
      <i class="fas fa-spinner fa-spin"></i> Attempting to repair database schema...
    </div>
  `);
  
  checkDatabaseSchema().then(result => {
    if (result.complete) {
      $(".repair-status").replaceWith(`
        <div class="mt-2 repair-status alert alert-success">
          <i class="fas fa-check-circle"></i> Schema is already complete. No repair needed.
        </div>
      `);
      return;
    }
    
    // Try force upgrade
    forceSchemaUpgrade().then(success => {
      if (success) {
        $(".repair-status").replaceWith(`
          <div class="mt-2 repair-status alert alert-success">
            <i class="fas fa-check-circle"></i> Schema repair successful. Database upgraded to version ${CURRENT_DB_VERSION}.
          </div>
        `);
      } else {
        $(".repair-status").replaceWith(`
          <div class="mt-2 repair-status alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i> Schema repair completed but some issues may remain. Please check schema.
          </div>
        `);
      }
    }).catch(error => {
      $(".repair-status").replaceWith(`
        <div class="mt-2 repair-status alert alert-danger">
          <i class="fas fa-times-circle"></i> Schema repair failed: ${error.message}
          <p>You may need to try the "Force Version Upgrade" option.</p>
        </div>
      `);
    });
  });
}

// Confirm force upgrade
function confirmForceUpgrade() {
  if (confirm("WARNING: This will delete and recreate the database which may cause data loss. Export your data before continuing. Are you sure?")) {
    forceVersionUpgrade();
  }
}

// Force version upgrade
function forceVersionUpgrade() {
  // Remove any existing status
  $("#forceVersionUpgradeBtn").siblings(".upgrade-status").remove();
  
  // Add "in progress" status
  $("#forceVersionUpgradeBtn").after(`
    <div class="mt-2 upgrade-status alert alert-info">
      <i class="fas fa-spinner fa-spin"></i> Forcing database version upgrade...
    </div>
  `);
  
  forceSchemaUpgrade().then(success => {
    if (success) {
      $(".upgrade-status").replaceWith(`
        <div class="mt-2 upgrade-status alert alert-success">
          <i class="fas fa-check-circle"></i> Database upgraded successfully to version ${CURRENT_DB_VERSION}.
          <p>You may need to refresh the page to see the changes.</p>
        </div>
      `);
    } else {
      $(".upgrade-status").replaceWith(`
        <div class="mt-2 upgrade-status alert alert-warning">
          <i class="fas fa-exclamation-triangle"></i> Database upgrade completed but there may still be issues.
        </div>
      `);
    }
  }).catch(error => {
    $(".upgrade-status").replaceWith(`
      <div class="mt-2 upgrade-status alert alert-danger">
        <i class="fas fa-times-circle"></i> Database upgrade failed: ${error.message}
      </div>
    `);
  });
}

// Reset database
function resetDatabase() {
  if (!window.indexedDB) {
    showNotification("IndexedDB is not supported in your browser", "danger");
    return;
  }
  
  // Close current connection if it exists
  if (window.appState.db) {
    window.appState.db.close();
    window.appState.db = null;
  }
  
  // Delete the database
  const request = window.indexedDB.deleteDatabase("EnhancedNoteDB");
  
  request.onsuccess = function() {
    showNotification("Database has been reset successfully. Reloading page...", "success");
    
    // Reload page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };
  
  request.onerror = function() {
    showNotification("Error resetting database: " + request.error, "danger");
  };
}
