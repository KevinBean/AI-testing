/**
 * Simplified dashboard functionality
 */

/**
 * Initialize the dashboard with essential features only
 */
function initializeDashboard() {
  // Set dashboard as the first tab to show on initial load
  if (window.location.hash === '' || window.location.hash === '#') {
    setTimeout(() => {
      $('#dashboard-tab').tab('show');
    }, 100);
  }

  // Initialize the search UI if available
  if (typeof SearchUI !== 'undefined') {
    SearchUI.init({
      searchInputSelector: '#universalSearch',
      searchButtonSelector: '#universalSearchBtn',
      searchScopeSelector: '#searchScope',
      resultsContainerSelector: '#searchResultsContainer',
      searchFormSelector: '#searchForm'
    });
  }
  
  // Update system stats
  updateSystemStats();
  
  // Initialize quick action handlers
  initializeQuickActions();
  
  // Update tag cloud with a simpler visualization
  updateTagAutocomplete();
}

/**
 * Update system statistics
 */
function updateSystemStats() {
  if (!db) {
    console.error("Database not initialized");
    return;
  }
  
  // Count blocks
  countObjectStore("blocks").then(count => {
    $("#blocksCount").text(count);
  }).catch(err => {
    console.error("Error counting blocks:", err);
  });
  
  // Count documents
  countObjectStore("documents").then(count => {
    $("#documentsCount").text(count);
  }).catch(err => {
    console.error("Error counting documents:", err);
  });
  
  // Count references
  countObjectStore("references").then(count => {
    $("#referencesCount").text(count);
  }).catch(err => {
    console.error("Error counting references:", err);
  });
  
  // Count unique tags
  countUniqueTags().then(count => {
    $("#tagsCount").text(count);
  }).catch(err => {
    console.error("Error counting tags:", err);
  });
}

/**
 * Count objects in a store
 * @param {string} storeName - The object store name to count
 * @returns {Promise<number>} - Promise that resolves with the count
 */
function countObjectStore(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onsuccess = function() {
        resolve(request.result);
      };
      
      request.onerror = function(e) {
        reject(e.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Count unique tags across all blocks
 * @returns {Promise<number>} - Promise that resolves with the count
 */
function countUniqueTags() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const uniqueTags = new Set();
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          const block = cursor.value;
          if (block.tags && block.tags.length) {
            block.tags.forEach(tag => uniqueTags.add(tag));
          }
          cursor.continue();
        } else {
          resolve(uniqueTags.size);
        }
      };
      
      transaction.onerror = function(e) {
        reject(e.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Simplified quick action buttons
 */
function initializeQuickActions() {
  // Add new block
  $("#quickAddBlock").click(function() {
    $('#blocks-tab').tab('show');
    $("#addBlockBtn").click();
  });
  
  // Add new document
  $("#quickAddDocument").click(function() {
    $('#documents-tab').tab('show');
    $("#addDocumentBtn").click();
  });
  
  // Add new reference
  $("#quickAddReference").click(function() {
    $('#references-tab').tab('show');
    $("#addReferenceBtn").click();
  });

  // AI assistant
  $("#quickAIAssistant").click(function() {
    $('#actions-tab').tab('show');
  });

  
  // Export data
  $("#quickExportData").click(function() {
    exportData();
  });

}