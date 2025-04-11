/**
 * Settings management module
 */

/**
 * Initialize settings module event handlers
 */
function initializeSettings() {
  // Add reset database button
  if (!$('#resetDbBtn').length) {
    const resetDbBtn = $(`
      <div class="card mt-3">
        <div class="card-header bg-danger text-white">Database Troubleshooting</div>
        <div class="card-body">
          <div class="alert alert-warning">
            <strong>Warning:</strong> Only use this option if you're experiencing database errors or if instructed by support.
            This will delete all your data and cannot be undone!
          </div>
          <button id="resetDbBtn" class="btn btn-danger">Reset Database</button>
          <div class="mt-3">
            <small class="text-muted">Use this option to delete the current database if you're experiencing persistent errors, especially after updating the application.</small>
          </div>
        </div>
      </div>
    `);
    
    $("#settingsView .editor-col").append(resetDbBtn);
    
    $("#resetDbBtn").on("click", resetDatabaseHandler);
  }
  
  // Load API key status
  updateApiKeyStatus();
}

/**
 * Reset database handler
 */
function resetDatabaseHandler() {
  const confirmReset = confirm("WARNING: This will permanently delete all your data including blocks, references, and documents. This action cannot be undone. Are you sure you want to proceed?");
  
  if (confirmReset) {
    resetDatabase()
      .then(() => {
        alert("Database successfully deleted. Please refresh the page to create a new database.");
        $(".container").prepend(`
          <div class="alert alert-success">
            <strong>Success!</strong> Database has been reset. 
            <a href="javascript:location.reload()" class="alert-link">Click here to refresh the page</a> or refresh manually to complete the process.
          </div>
        `);
      })
      .catch(error => {
        console.error("Error resetting database:", error);
        alert("Error deleting database: " + error.message);
      });
  }
}

/**
 * Export data handler
 */
function exportDataHandler() {
  exportData();
}

/**
 * Handle import file selection
 * @param {Event} e - Change event
 */
function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      importedData = JSON.parse(e.target.result);
      
      const totalItems = (importedData.documents?.length || 0) + 
                         ((importedData.blocks?.length || 0) + (importedData.clauses?.length || 0)) +
                         (importedData.references?.length || 0) +
                         (importedData.actions?.length || 0) +
                         (importedData.collections?.length || 0) +
                         (importedData.workflows?.length || 0);
      
      $("#importItemCount").text(totalItems);
      
      $("#importOptionsModal").modal("show");
    } catch (error) {
      console.error("Error parsing JSON:", error);
      showNotification("Invalid JSON file. Import failed.", "danger");
    }
  };
  reader.readAsText(file);
}

/**
 * Handle import options confirmation
 */
function handleImportConfirm() {
  if (!importedData) {
    $("#importOptionsModal").modal("hide");
    return;
  }
  
  const importOption = $('input[name="importOption"]:checked').val();
  
  // Process import directly
  importData(importedData, importOption)
    .then(() => {
      showNotification("Import completed successfully!");
      loadBlocks();
      loadReferencesMetadata();
      loadDocuments();
      loadActions();
      loadCollections();
      loadWorkflows();
      updateBlockAutocomplete();
      updateReferenceAutocomplete();
      updateTagAutocomplete();
      
      // Reset import data and file input
      importedData = null;
      $("#importFile").val("");
    })
    .catch(error => {
      console.error("Import error:", error);
      showNotification("Import failed: " + error.message, "danger");
    });
  
  $("#importOptionsModal").modal("hide");
}

// Initialize settings on page load
$(document).ready(initializeSettings);
