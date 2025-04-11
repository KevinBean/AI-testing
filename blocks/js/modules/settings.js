/**
 * Settings management module
 * Updated to use the Helpers module pattern
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
  Helpers.updateApiKeyStatus();
}

/**
 * Reset database handler
 */
function resetDatabaseHandler() {
  Helpers.confirm({
    title: "Reset Database",
    message: "WARNING: This will permanently delete all your data including blocks, references, and documents. This action cannot be undone. Are you sure you want to proceed?",
    confirmButtonClass: "btn-danger",
    confirmText: "Reset Database"
  }).then(confirmed => {
    if (confirmed) {
      resetDatabase()
        .then(() => {
          Helpers.showNotification("Database has been reset. Please refresh the page to create a new database.", "success", 10000);
          $(".container").prepend(`
            <div class="alert alert-success">
              <strong>Success!</strong> Database has been reset. 
              <a href="javascript:location.reload()" class="alert-link">Click here to refresh the page</a> or refresh manually to complete the process.
            </div>
          `);
        })
        .catch(error => {
          console.error("Error resetting database:", error);
          Helpers.showNotification("Error deleting database: " + error.message, "danger");
        });
    }
  });
}

/**
 * Export data handler
 */
function exportDataHandler() {
  Helpers.exportData();
}

/**
 * Handle import file selection
 * @param {Event} e - Change event
 */
function handleImportFile(e) {
  Helpers.handleImportFile(e);
}

/**
 * Handle import options confirmation
 */
function handleImportConfirm() {
  Helpers.handleImportConfirm();
}

/**
 * Handle API settings form submission
 * @param {Event} e - Form submission event
 */
function handleApiSettingsFormSubmit(e) {
  Helpers.handleApiSettingsFormSubmit(e);
}

// Initialize settings on page load
$(document).ready(initializeSettings);