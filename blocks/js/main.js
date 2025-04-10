/**
 * Main application initialization
 */

// Global variables
let editingBlockId = null;
let editingDocumentId = null;
let editingReferenceId = null;
let editingActionId = null;
let editingWorkflowId = null;
let editingCollectionId = null;
let blockAutocomplete = [];
let referenceAutocomplete = [];
let tagAutocomplete = [];
let selectedTag = null;
let importedData = null;
let openaiApiKey = null;
let selectedActionId = null;
let selectedContentItems = [];
let collectionItems = [];

// Document ready function
$(document).ready(function() {
  // Initialize tooltips
  $('[data-toggle="tooltip"]').tooltip();
  
  // Load API key from local storage
  openaiApiKey = getSecureApiKey();
  updateApiKeyStatus();
  
  // Initialize the database FIRST, then attach event handlers
  initializeDB().then(() => {
    // Attach event handlers AFTER database is initialized
    registerEventHandlers();
    
    // Load data after database is initialized
    loadBlocks();
    loadReferencesMetadata();
    loadDocuments();
    loadActions();
    loadWorkflows();
    loadCollections();
    initializeDashboard();
    updateBlockAutocomplete();
    updateReferenceAutocomplete();
    updateTagAutocomplete();
    
    // Add initial paragraph for new documents, but only if addParagraph is defined
    if (typeof addParagraph === 'function') {
      addParagraph();
    } else {
      console.warn("addParagraph function is not defined yet. Make sure documents.js is loaded properly.");
    }
  }).catch(error => {
    console.error("Database initialization error:", error);
    showNotification("Failed to initialize database. Please refresh the page.", "danger");
  });

// After a short delay to ensure DB is initialized
setTimeout(() => {
  console.log("Checking database availability...");
  if (window.db) {
    console.log("Database is available globally!");
    try {
      const tx = window.db.transaction("blocks", "readonly");
      console.log("Successfully created transaction!");
      const store = tx.objectStore("blocks");
      console.log("Successfully accessed blocks store!");
      const countRequest = store.count();
      countRequest.onsuccess = function() {
        console.log("Total blocks in database:", countRequest.result);
      };
    } catch (err) {
      console.error("Error accessing database:", err);
    }
  } else {
    console.error("Database is not available globally");
  }
}, 1000);

});

/**
 * Register all event handlers for the application
 */
function registerEventHandlers() {
  // Initialize event handlers for search inputs
  $("#blockSearch").on("keyup", function() {
    loadBlocks($(this).val().trim());
  });
  
  $("#refSearch").on("keyup", function() {
    loadReferencesMetadata($(this).val().trim());
  });
  
  $("#docSearch").on("keyup", function() {
    loadDocuments($(this).val().trim());
  });
  
  $("#actionSearch").on("keyup", function() {
    loadActions($(this).val().trim());
  });
  
  $("#collectionSearch").on("keyup", function() {
    loadCollections($(this).val().trim());
  });
  
  $("#searchTagBtn").click(function() {
    const tag = $("#tagSearch").val().trim();
    if (tag) {
      selectedTag = tag;
      $("#selectedTagName").text(tag);
      loadContentByTag(tag);
    }
  });
  
  $("#tagSearch").keypress(function(e) {
    if (e.which === 13) {
      $("#searchTagBtn").click();
    }
  });
  
  // Make paragraph container sortable
  $("#paragraphContainer").sortable({ 
    placeholder: "sortable-placeholder" 
  });
  
  // Add paragraph button handler - Only register if function exists
  if (typeof addParagraph === 'function') {
    $("#addParagraphButton").on("click", addParagraph);
  } else {
    $("#addParagraphButton").on("click", function() {
      console.warn("addParagraph function not found. Make sure documents.js is loaded correctly.");
    });
  }
  
  // Add new buttons
  $("#addBlockBtn").on("click", function() {
    $("#blockForm")[0].reset();
    editingBlockId = null;
    $("#blockForm button[type=submit]").text("Add Block");
    $("#blockForm").show();
    $("#blockTitle").focus();
  });
  
  $("#addReferenceBtn").on("click", function() {
    $("#referenceForm")[0].reset();
    editingReferenceId = null;
    $("#refId").prop("disabled", false);
    $("#referenceForm button[type=submit]").text("Add Reference");
    $("#referenceForm").show();
    $("#refId").focus();
  });
  
  $("#addDocumentBtn").on("click", function() {
    $("#documentForm")[0].reset();
    editingDocumentId = null;
    $("#documentForm button[type=submit]").text("Add Document");
    $("#documentForm").show();
    $("#docTitle").focus();
    $("#paragraphContainer").empty();
    
    // Only call if function exists
    if (typeof addParagraph === 'function') {
      addParagraph();
    }
  });
  
  $("#addActionBtn").on("click", function() {
    $("#actionForm")[0].reset();
    editingActionId = null;
    $("#actionForm button[type=submit]").text("Add Action");
    $("#actionForm").show();
    $("#actionTitle").focus();
    $("#tempValue").text("0.7");
  });
  
  $("#addCollectionBtn").on("click", function() {
    $("#collectionForm")[0].reset();
    editingCollectionId = null;
    collectionItems = [];
    updateCollectionItemsUI();
  });
  
  $("#addWorkflowStepBtn").on("click", addWorkflowStep);
  
  // Form submissions
  $("#blockForm").on("submit", handleBlockFormSubmit);
  $("#referenceForm").on("submit", handleReferenceFormSubmit);
  $("#documentForm").on("submit", handleDocumentFormSubmit);
  $("#actionForm").on("submit", handleActionFormSubmit);
  $("#collectionForm").on("submit", handleCollectionFormSubmit);
  $("#workflowForm").on("submit", handleWorkflowFormSubmit);
  $("#apiSettingsForm").on("submit", handleApiSettingsFormSubmit);
  
  // Live preview handlers
  $("#livePreviewBtn").on("click", previewDocumentLive);
  
  // Import/Export handlers
  $("#exportBtn").on("click", exportData);
  $("#importFile").on("change", handleImportFile);
  $("#confirmImport").on("click", handleImportConfirm);
  
  // Workflow execution
  $(document).on('click', '.run-workflow-interactive-btn', function() {
    const workflowId = $(this).data('workflow-id');
    runWorkflow(workflowId, 'interactive');
  });

  $(document).on('click', '.run-workflow-straight-btn', function() {
    const workflowId = $(this).data('workflow-id');
    runWorkflow(workflowId, 'straight');
  });
  
  // Action execution
  $("#runActionBtn").on("click", prepareActionExecution);
  
  // API Key UI handlers
  $("#clearApiKey").on("click", function() {
    if (confirm("Are you sure you want to remove your API key?")) {
      localStorage.removeItem('openai_api_key_secure');
      openaiApiKey = null;
      $("#apiKey").val('');
      showNotification("API key removed");
      updateApiKeyStatus();
    }
  });
  
  // Temperature slider display
  $("#actionTemperature").on("input", function() {
    $("#tempValue").text($(this).val());
  });

  // Add this new handler for max tokens slider
$("#actionMaxTokens").on("input", function() {
  $("#maxTokensValue").text($(this).val());
});
  
  // Tools toggle
  $("#useTools").on("change", function() {
    if ($(this).is(":checked")) {
      $("#toolsDefinitionContainer").slideDown();
    } else {
      $("#toolsDefinitionContainer").slideUp();
    }
  });
  
  // Initialize collection handlers
  $("#addBlockToCollection").click(function() {
    const selectDialog = $(`
      <div class="modal fade" id="selectBlockModal">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Select Blocks</h5>
              <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <div class="modal-body">
              <input type="text" class="form-control mb-3" id="blockSearchInput" placeholder="Search blocks...">
              <div id="blockSelectionList"></div>
            </div>
          </div>
        </div>
      </div>
    `).appendTo('body');

    loadBlocksForCollection();
    selectDialog.modal('show');

    selectDialog.on('hidden.bs.modal', function() {
      selectDialog.remove();
    });
  });

  $("#addDocToCollection").click(function() {
    const selectDialog = $(`
      <div class="modal fade" id="selectDocModal">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Select Documents</h5>
              <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <div class="modal-body">
              <input type="text" class="form-control mb-3" id="docSearchInput" placeholder="Search documents...">
              <div id="docSelectionList"></div>
            </div>
          </div>
        </div>
      </div>
    `).appendTo('body');

    loadDocsForCollection();
    selectDialog.modal('show');

    selectDialog.on('hidden.bs.modal', function() {
      selectDialog.remove();
    });
  });
  
  $("#cancelCollectionBtn").click(resetCollectionForm);
  
  // Initialize toolbar handlers
  initializeToolbarHandlers();

  // Help button in header opens the help modal
  $("a[href='#helpModal']").click(function(e) {
    e.preventDefault();
    $("#helpModal").modal("show");
  });
  
}

function initializeToolbarHandlers() {
  // Block Editor Toolbar
  $("#blockTextToolbar .insert-bold").click(function() {
    insertAtCursor(document.getElementById("blockText"), "**bold text**");
  });
  $("#blockTextToolbar .insert-italic").click(function() {
    insertAtCursor(document.getElementById("blockText"), "*italic text*");
  });
  $("#blockTextToolbar .insert-equation").click(function() {
    insertAtCursor(document.getElementById("blockText"), "\n$$\nequation\n$$\n");
  });
  $("#blockTextToolbar .insert-mermaid").click(function() {
    insertAtCursor(document.getElementById("blockText"), "\n```mermaid\ngraph TD;\n    A-->B;\n```\n");
  });
  $("#blockTextToolbar .toggle-preview").click(function() {
    let textarea = $("#blockText");
    let previewDiv = $("#blockTextPreview");
    if (previewDiv.is(":visible")) {
      previewDiv.hide();
    } else {
      let content = textarea.val();
      previewDiv.html(renderMarkdown(content));
      renderMermaidIn("#blockTextPreview .mermaid");
      previewDiv.show();
    }
  });

  // Paragraph Editor Toolbar (delegated event handlers for dynamically added editors)
  $("#paragraphContainer").on("click", ".insert-bold", function() {
    let textarea = $(this).closest('.paragraph-editor').find("textarea")[0];
    insertAtCursor(textarea, "**bold text**");
  });
  $("#paragraphContainer").on("click", ".insert-italic", function() {
    let textarea = $(this).closest('.paragraph-editor').find("textarea")[0];
    insertAtCursor(textarea, "*italic text*");
  });
  $("#paragraphContainer").on("click", ".insert-equation", function() {
    let textarea = $(this).closest('.paragraph-editor').find("textarea")[0];
    insertAtCursor(textarea, "\n$$\nequation\n$$\n");
  });
  $("#paragraphContainer").on("click", ".insert-mermaid", function() {
    let textarea = $(this).closest('.paragraph-editor').find("textarea")[0];
    insertAtCursor(textarea, "\n```mermaid\ngraph TD;\n    A-->B;\n```\n");
  });
  $("#paragraphContainer").on("click", ".toggle-preview", function() {
    let container = $(this).closest('.paragraph-editor');
    let textarea = container.find("textarea");
    let previewDiv = container.find(".preview");
    if (previewDiv.is(":visible")) {
      previewDiv.hide();
    } else {
      console.log("Previewing:", textarea.val());
      previewDiv.html(renderMarkdown(textarea.val()));
      renderMermaidIn(previewDiv.find(".mermaid"));
      previewDiv.show();
    }
  });
}

/**
 * Function to handle the import confirmation
 */
function handleImportConfirm() {
  if (!importedData) {
    $("#importOptionsModal").modal("hide");
    return;
  }
  
  const importOption = $('input[name="importOption"]:checked').val();
  
  showNotification("Import started, please wait...", "info");
  
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

/**
 * Integration code for the enhanced workflows system
 * Add this to the end of main.js or in a separate file loaded after main.js
 */

// Workflow button event handlers
function initializeWorkflowHandlers() {
  // Add new workflow button
  $("#addWorkflowBtn").on("click", function() {
    resetWorkflowForm();
    $("#workflowForm").show();
    $("#workflowName").focus();
  });
  
  // Navigate between workflow execution steps
  $("#previous-step-btn").on("click", function() {
    const currentStep = parseInt($("#workflow-execution-modal").data("current-step"));
    if (currentStep > 0) {
      navigateWorkflowStep(currentStep - 1);
    }
  });
  
  $("#next-step-btn").on("click", function() {
    const currentStep = parseInt($("#workflow-execution-modal").data("current-step"));
    const totalSteps = parseInt($("#workflow-execution-modal").data("total-steps"));
    
    if (currentStep < totalSteps - 1) {
      // Move to next step
      navigateWorkflowStep(currentStep + 1);
    } else {
      // This is the last step, complete the workflow
      completeWorkflowExecution();
    }
  });
  
  // Configure run type handlers
  $(document).on("click", ".configure-workflow-btn", function() {
    const workflowId = $(this).data("workflow-id");
    configureAndRunWorkflow(workflowId);
  });
  
  $(document).on("click", ".run-workflow-direct-btn", function() {
    const workflowId = $(this).data("workflow-id");
    runWorkflowWithSavedConfig(workflowId);
  });
  
  // Input source type radio buttons
  $(document).on("change", 'input[name="sourceType"]', function() {
    const sourceType = $(this).val();
    $('.source-config').addClass('d-none');
    
    if (sourceType === 'tag') {
      $('#tag-config').removeClass('d-none');
    } else if (sourceType === 'document') {
      $('#document-config').removeClass('d-none');
    } else if (sourceType === 'reference') {
      $('#reference-config').removeClass('d-none');
    }
  });
}

/**
 * Navigate between steps in the workflow execution modal
 * @param {number} stepIndex - The step index to navigate to
 */
function navigateWorkflowStep(stepIndex) {
  const modal = $("#workflow-execution-modal");
  const workflow = modal.data("current-workflow");
  const totalSteps = workflow.steps.length;
  
  // Update current step
  modal.data("current-step", stepIndex);
  
  // Update buttons
  $("#previous-step-btn").prop("disabled", stepIndex === 0);
  
  if (stepIndex === totalSteps - 1) {
    // Last step
    $("#next-step-btn").text("Complete Workflow");
  } else {
    $("#next-step-btn").text("Next Step");
  }
  
  // Update step display
  $(".workflow-execution-step").removeClass("active");
  $(`.workflow-execution-step[data-step-index="${stepIndex}"]`).addClass("active");
  
  // Scroll to active step
  const activeStep = $(`.workflow-execution-step[data-step-index="${stepIndex}"]`);
  if (activeStep.length) {
    modal.find(".modal-body").animate({
      scrollTop: activeStep.position().top
    }, 300);
  }
}

/**
 * Complete the workflow execution
 */
function completeWorkflowExecution() {
  const modal = $("#workflow-execution-modal");
  const workflow = modal.data("current-workflow");
  const allStepResults = modal.data("step-results") || [];
  const finalContent = modal.data("final-content") || "";
  
  // Close execution modal
  modal.modal("hide");
  
  // Show results
  displayWorkflowResults(allStepResults, finalContent);
  
  // Update workflow with last run information
  saveWorkflowRunResults(workflow, allStepResults, finalContent);
  
  // Show notification
  Helpers.showNotification("Workflow execution completed successfully!", "success");
}

// Initialize when document is ready
$(document).ready(function() {

  // In main.js, add this to the document ready function
initializeConversations();

// Add this to registerEventHandlers
$("#conversationSearch").on("keyup", function() {
  loadConversations($(this).val().trim());
});

  // Initialize the workflow handlers
  initializeWorkflowHandlers();
  
  // Register the original event handlers defined in workflow.js
  try {
    // Add step button
    $("#addWorkflowStepBtn").on("click", addWorkflowStep);
    
    // Cancel button
    $("#cancelWorkflowBtn").on("click", resetWorkflowForm);
    
    // Form submission
    $("#workflowForm").on("submit", handleWorkflowFormSubmit);
  } catch(error) {
    console.error("Error registering workflow event handlers:", error);
  }
});