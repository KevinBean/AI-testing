// App initialization and tab management

// Document ready function
$(document).ready(function() {
  console.log("App initialization started");
  
  // Ensure window.appState exists
  if (!window.appState) {
    console.error("App state not initialized, creating default state");
    window.appState = {
      blockAutocomplete: [],
      standardAutocomplete: [],
      tagAutocomplete: [],
      selectedTag: null,
      editingBlockId: null,
      editingStandardId: null,
      editingDocumentId: null,
      editingActionId: null,
      editingWorkflowId: null,
      db: null,
      openaiApiKey: null,
      importedData: null,
      selectedContentItems: [],
      selectedActionId: null,
      viewsLoaded: {
        blocks: false,
        standards: false,
        documents: false,
        tags: false,
        actions: false,
        workflows: false,
        settings: false,
        collections: false
      }
    };
  }
  
  // Ensure viewsLoaded exists
  if (!window.appState.viewsLoaded) {
    console.log("Creating viewsLoaded object");
    window.appState.viewsLoaded = {
      blocks: false,
      standards: false,
      documents: false,
      tags: false,
      actions: false,
      workflows: false,
      settings: false,
      collections: false
    };
  }
  
  // Load API key from localStorage if available
  if (localStorage.getItem('openai_api_key')) {
    window.appState.openaiApiKey = localStorage.getItem('openai_api_key');
  }
  
  // Initialize database first, then load views when ready
  console.log("Starting database initialization");
  initializeDatabase();
  
  // Set up listener for database ready event before loading views
  window.addEventListener('database-ready', function() {
    console.log("Database ready event received in app.js");
    // Load the views after database is initialized
    loadViewContent();
  }, { once: true });
  
  // Fallback in case database initialization takes too long
  setTimeout(() => {
    if (!window.appState.viewsLoaded.blocks) {
      console.log("Fallback: Loading views after timeout");
      loadViewContent();
    }
  }, 2000);
  
  // Initialize tab switching
  initTabSwitching();

  // Initialize tooltips
  $('[data-toggle="tooltip"]').tooltip();

  // Initialize accessibility fixes for modals
  initializeA11yFixes();
});

/**
 * Initialize accessibility fixes
 */
function initializeA11yFixes() {
  // Accessibility fix for modals with aria-hidden
  $(document).on('hidden.bs.modal', '.modal', function() {
    // Use inert attribute to hide content from assistive technology
    $(this).attr('inert', '');
    // Save original tabindex values and set to -1 to remove from tab order
    $(this).find('button, input, textarea, select, a, [tabindex]').each(function() {
      if ($(this).attr('tabindex')) {
        $(this).attr('data-original-tabindex', $(this).attr('tabindex'));
      }
      $(this).attr('tabindex', '-1');
    });
  });
  
  $(document).on('show.bs.modal', '.modal', function() {
    // Remove inert attribute to make content available to assistive technology
    $(this).removeAttr('inert');
    // Restore focusability
    $(this).find('button, input, textarea, select, a').each(function() {
      if ($(this).attr('data-original-tabindex')) {
        $(this).attr('tabindex', $(this).attr('data-original-tabindex'));
      } else {
        $(this).removeAttr('tabindex');
      }
    });
  });
  
  // Add polyfill for inert if not supported by browser
  if (!('inert' in document.createElement('div'))) {
    console.log('Adding inert polyfill');
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/wicg-inert@latest/dist/inert.min.js';
    document.head.appendChild(script);
  }
}

// Load view content from separate HTML files
function loadViewContent() {
  console.log("Loading view content");
  
  // Avoid loading views multiple times
  if (window.viewsLoadingStarted) {
    console.log("Views already loading, skipping");
    return;
  }
  window.viewsLoadingStarted = true;
  
  // Define loading indicator
  const loadingIndicator = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-2">Loading view...</p></div>';
  
  // Set loading indicators for all views
  $("#blocksView, #standardsView, #documentsView, #tagsView, #actionsView, #workflowsView, #settingsView").html(loadingIndicator);
  
  // Load blocks view
  $.get("views/blocks.html", function(data) {
    $("#blocksView").html(data);
    if (window.appState && window.appState.viewsLoaded) {
      window.appState.viewsLoaded.blocks = true;
    }
    console.log("Blocks view loaded");
    initializeBlockViewHandlers();
  }).fail(function() {
    console.error("Failed to load blocks view");
    $("#blocksView").html('<div class="alert alert-danger">Failed to load blocks view</div>');
  });
  
  // Load standards view
  $.get("views/standards.html", function(data) {
    $("#standardsView").html(data);
    if (window.appState && window.appState.viewsLoaded) {
      window.appState.viewsLoaded.standards = true;
    }
    console.log("Standards view loaded");
    initializeStandardViewHandlers();
  }).fail(function() {
    console.error("Failed to load standards view");
    $("#standardsView").html('<div class="alert alert-danger">Failed to load standards view</div>');
  });
  
  // Load documents view  
  $.get("views/documents.html", function(data) {
    $("#documentsView").html(data);
    if (window.appState && window.appState.viewsLoaded) {
      window.appState.viewsLoaded.documents = true;
    }
    console.log("Documents view loaded");
    initializeDocumentViewHandlers();
  }).fail(function() {
    console.error("Failed to load documents view");
    $("#documentsView").html('<div class="alert alert-danger">Failed to load documents view</div>');
  });
  
  // Load tags view
  $.get("views/tags.html", function(data) {
    $("#tagsView").html(data);
    if (window.appState && window.appState.viewsLoaded) {
      window.appState.viewsLoaded.tags = true;
    }
    console.log("Tags view loaded");
    initializeTagViewHandlers();
  }).fail(function() {
    console.error("Failed to load tags view");
    $("#tagsView").html('<div class="alert alert-danger">Failed to load tags view</div>');
  });
  
  // Load actions view
  $.get("views/actions.html", function(data) {
    $("#actionsView").html(data);
    if (window.appState && window.appState.viewsLoaded) {
      window.appState.viewsLoaded.actions = true;
    }
    console.log("Actions view loaded");
    initializeActionViewHandlers();
  }).fail(function() {
    console.error("Failed to load actions view");
    $("#actionsView").html('<div class="alert alert-danger">Failed to load actions view</div>');
  });
  
  // Load workflows view
  $.get("views/workflows.html", function(data) {
    $("#workflowsView").html(data);
    if (window.appState && window.appState.viewsLoaded) {
      window.appState.viewsLoaded.workflows = true;
    }
    console.log("Workflows view loaded");
    initializeWorkflowViewHandlers();
  }).fail(function() {
    console.error("Failed to load workflows view");
    $("#workflowsView").html('<div class="alert alert-danger">Failed to load workflows view</div>');
  });
  
  // Load settings view
  loadSettingsView();
  
  // Load collections view
  loadCollectionsView();
}

// Load Settings tab content
function loadSettingsView() {
  console.log("Loading settings view...");
  $("#settingsView").load("views/settings.html", function() {
    console.log("Settings view loaded.");
    
    if (window.appState) {
      window.appState.viewsLoaded.settings = true;
    }
    
    // Initialize settings functionality
    if (typeof loadApiKeyStatus === 'function') {
      loadApiKeyStatus();
    }
    
    // Verify database is in proper state
    ensureDatabaseIntegrity();
  });
}

// Add this function to load Collections view
function loadCollectionsView() {
  console.log("Loading collections view...");
  $("#collectionsView").load("views/collections.html", function() {
    console.log("Collections view loaded.");
    
    if (window.appState) {
      window.appState.viewsLoaded.collections = true;
    }
    
    // Initialize collections functionality if needed
    if (typeof initializeCollections === 'function') {
      setTimeout(() => {
        initializeCollections();
      }, 500);
    }
  });
}

// Check database integrity when opening settings
function ensureDatabaseIntegrity() {
  console.log("Checking database integrity...");
  
  if (!window.db) {
    console.warn("Database not available for integrity check");
    return;
  }
  
  try {
    // Verify all required object stores exist
    const expectedStores = ["blocks", "standards", "documents", "collections", "documentCollections", "actions", "workflows"];
    const existingStores = Array.from(window.db.objectStoreNames);
    
    const missingStores = expectedStores.filter(name => !existingStores.includes(name));
    if (missingStores.length > 0) {
      console.warn("Missing object stores detected:", missingStores);
      // Add a warning to the settings page
      $(".card-header:contains('Database Troubleshooting')").after(
        `<div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle"></i> 
          Database schema is missing some object stores (${missingStores.join(', ')}).
          This could be due to a version mismatch. Consider using Reset Database to recreate the database with the correct schema.
        </div>`
      );
    } else {
      console.log("Database schema integrity check passed");
    }
  } catch (err) {
    console.error("Error checking database integrity:", err);
  }
}

// Initialize view specific event handlers
function initializeBlockViewHandlers() {
  console.log("App: Setting up block view handlers");
  
  // Use the centralized init function in block.js
  if (typeof initBlockViewHandlers === 'function') {
    initBlockViewHandlers();
  }
  
  // Load blocks if already on blocks tab
  if ($("#blocks-tab").hasClass("active") && typeof loadBlocks === 'function') {
    console.log("Initial blocks load from app.js");
    setTimeout(function() {
      loadBlocks();
    }, 500);
  }
}

function initializeStandardViewHandlers() {
  if ($("#stdSearch").length) {
    console.log("Setting up standard search handler");
    $("#stdSearch").on("keyup", function() {
      const searchTerm = $(this).val().trim();
      loadStandardsMetadata(searchTerm);
    });
  }
  
  if ($("#standardForm").length) {
    console.log("Setting up standard form handler");
    $("#standardForm").on("submit", function(e) {
      e.preventDefault();
      if (typeof handleStandardFormSubmit === 'function') {
        handleStandardFormSubmit(e);
      }
    });
  }
  
  // Load standards if already on standards tab
  if ($("#standards-tab").hasClass("active") && typeof loadStandardsMetadata === 'function') {
    console.log("Initial standards load");
    setTimeout(() => loadStandardsMetadata(), 100);
  }
}

function initializeDocumentViewHandlers() {
  if ($("#docSearch").length) {
    console.log("Setting up document search handler");
    $("#docSearch").on("keyup", function() {
      const searchTerm = $(this).val().trim();
      loadDocuments(searchTerm);
    });
  }
  
  if ($("#docFullTextSearch").length) {
    console.log("Setting up full text search handler");
    $("#docFullTextSearch").on("keyup", function() {
      const searchTerm = $(this).val().trim();
      loadDocumentsByFullText(searchTerm);
    });
  }
  
  if ($("#documentForm").length) {
    console.log("Setting up document form handler");
    $("#documentForm").on("submit", function(e) {
      e.preventDefault();
      if (typeof handleDocumentFormSubmit === 'function') {
        handleDocumentFormSubmit(e);
      }
    });
  }
  
  if ($("#addParagraphButton").length) {
    console.log("Setting up add paragraph button");
    $("#addParagraphButton").on("click", function() {
      if (typeof addParagraph === 'function') {
        addParagraph();
      } else {
        console.error("addParagraph function not available");
      }
    });
  }
  
  // Load documents if already on documents tab
  if ($("#documents-tab").hasClass("active") && typeof loadDocuments === 'function') {
    console.log("Initial documents load");
    setTimeout(() => loadDocuments(), 100);
  }
}

function initializeTagViewHandlers() {
  if ($("#tagSearch").length) {
    console.log("Setting up tag search handler");
    $("#tagSearch").on("keyup", function(e) {
      if (e.which === 13) { // Enter key
        const tag = $(this).val().trim();
        if (tag) {
          window.appState.selectedTag = tag;
          $("#selectedTagName").text(tag);
          if (typeof loadContentByTag === 'function') {
            loadContentByTag(tag);
          }
        }
      }
    });
    
    $("#searchTagBtn").on("click", function() {
      const tag = $("#tagSearch").val().trim();
      if (tag) {
        window.appState.selectedTag = tag;
        $("#selectedTagName").text(tag);
        if (typeof loadContentByTag === 'function') {
          loadContentByTag(tag);
        }
      }
    });
  }
  
  // Load tags if already on tags tab
  if ($("#tags-tab").hasClass("active") && typeof updateTagCloud === 'function') {
    console.log("Initial tag cloud update");
    updateTagCloud({});
  }
}

function initializeActionViewHandlers() {
  if ($("#actionSearch").length) {
    console.log("Setting up action search handler");
    $("#actionSearch").on("keyup", function() {
      const searchTerm = $(this).val().trim();
      if (typeof loadActions === 'function') {
        loadActions(searchTerm);
      }
    });
  }
  
  if ($("#actionForm").length) {
    console.log("Setting up action form handler");
    $("#actionForm").on("submit", function(e) {
      e.preventDefault();
      if (typeof handleActionFormSubmit === 'function') {
        handleActionFormSubmit(e);
      }
    });
  }
}

function initializeWorkflowViewHandlers() {
  if ($("#workflowSearch").length) {
    console.log("Setting up workflow search handler");
    $("#workflowSearch").on("keyup", function() {
      const searchTerm = $(this).val().trim();
      if (typeof loadWorkflows === 'function') {
        loadWorkflows(searchTerm);
      }
    });
  }
  
  if ($("#workflowForm").length) {
    console.log("Setting up workflow form handler");
    $("#workflowForm").on("submit", function(e) {
      e.preventDefault();
      if (typeof handleWorkflowFormSubmit === 'function') {
        handleWorkflowFormSubmit(e);
      }
    });
  }
}

function initializeSettingsViewHandlers() {
  if ($("#apiSettingsForm").length) {
    console.log("Setting up API settings form handler");
    $("#apiSettingsForm").on("submit", function(e) {
      e.preventDefault();
      if (typeof saveApiKey === 'function') {
        saveApiKey();
      }
    });
  }
  
  if (typeof loadApiKeyStatus === 'function') {
    loadApiKeyStatus();
  }
}

// Initialize tab switching behavior
function initTabSwitching() {
  console.log("Initializing tab switching");
  
  $('#viewTabs a').on('shown.bs.tab', function(e) {
    const targetId = $(e.target).attr('href');
    console.log("Tab switched to: " + targetId);
    
    // Load data based on the active tab
    switch(targetId) {
      case "#blocksView":
        if(typeof initBlockViewHandlers === 'function') {
          console.log("Initializing block handlers from tab switch");
          initBlockViewHandlers();
        }
        break;
        
      case "#standardsView":
        if(typeof loadStandardsMetadata === 'function') {
          console.log("Loading standards data");
          loadStandardsMetadata();
          if(typeof updateStandardAutocomplete === 'function') {
            updateStandardAutocomplete();
          }
        }
        break;
        
      case "#documentsView":
        if(typeof loadDocuments === 'function') {
          console.log("Loading documents data");
          loadDocuments();
        }
        break;
        
      case "#tagsView":
        if(typeof updateTagCloud === 'function') {
          console.log("Updating tag cloud");
          updateTagCloud({});
        }
        break;
        
      case "#actionsView":
        if(typeof loadActions === 'function') {
          console.log("Loading actions data");
          loadActions();
        }
        break;
        
      case "#workflowsView":
        if(typeof loadWorkflows === 'function') {
          console.log("Loading workflows data");
          loadWorkflows();
        }
        break;
        
      case "#settingsView":
        if(typeof loadApiKeyStatus === 'function') {
          console.log("Loading API key status");
          loadApiKeyStatus();
        }
        break;
        
      case "#collectionsView":
        if(typeof loadCollections === 'function') {
          console.log("Loading collections data");
          loadCollections();
        }
        break;
    }
  });
}

// Show notification function
function showNotification(message, type = "success") {
  const toast = $(`
    <div class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="3000">
      <div class="toast-header bg-${type} text-white">
        <strong class="mr-auto">Notification</strong>
        <button type="button" class="ml-2 mb-1 close text-white" data-dismiss="toast" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `);
  
  $("body").append(toast);
  toast.toast('show');
  
  // Remove toast from DOM after it's hidden
  toast.on('hidden.bs.toast', function() {
    $(this).remove();
  });
}

// Helper functions to safely access and modify app state
function getAppState() {
  return window.appState || {};
}

function setEditingBlockId(id) {
  if (window.appState) {
    window.appState.editingBlockId = id;
  }
}

function setEditingStandardId(id) {
  if (window.appState) {
    window.appState.editingStandardId = id;
  }
}

function setEditingDocumentId(id) {
  if (window.appState) {
    window.appState.editingDocumentId = id;
  }
}

function setEditingActionId(id) {
  if (window.appState) {
    window.appState.editingActionId = id;
  }
}

function setEditingWorkflowId(id) {
  if (window.appState) {
    window.appState.editingWorkflowId = id;
  }
}

// Helper function to check if database is initialized
function isDatabaseReady() {
  // Check both appState.db and window.db for backward compatibility
  const dbAvailable = (window.appState && window.appState.db !== null) || window.db !== null;
  console.log("Database ready check:", dbAvailable);
  return dbAvailable;
}

// New function to safely get database instance
function getDatabase() {
  return (window.appState && window.appState.db) || window.db || null;
}

// Add a utility function to check database connectivity
function checkDatabaseConnectivity() {
  console.log("Checking database connectivity...");
  const db = getDatabase();
  
  if (!db) {
    console.error("No database connection available");
    showNotification("Database connection issue detected. Please refresh the page.", "warning");
    return false;
  }
  
  try {
    // Try a simple operation
    const transaction = db.transaction(["blocks"], "readonly");
    transaction.oncomplete = function() {
      console.log("Database connectivity check passed");
    };
    transaction.onerror = function(event) {
      console.error("Database connectivity check failed:", event.target.error);
      showNotification("Database operation failed. Try refreshing the page.", "danger");
    };
    return true;
  } catch (err) {
    console.error("Error checking database connectivity:", err);
    showNotification("Database access error. Please refresh the page.", "danger");
    return false;
  }
}

// Additional utility functions for block notes
function getAllBlocksWithNotes() {
  return new Promise((resolve, reject) => {
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction(["blocks"], "readonly");
        const store = transaction.objectStore("blocks");
        const blocksWithNotes = [];
        
        store.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const block = cursor.value;
            if (block.notes && block.notes.trim()) {
              blocksWithNotes.push(block);
            }
            cursor.continue();
          } else {
            resolve(blocksWithNotes);
          }
        };
        
        transaction.onerror = function(e) {
          reject(e.target.error);
        };
      })
      .catch(err => reject(err));
  });
}

// Helper function to get all blocks without notes
function getBlocksWithoutNotes() {
  return new Promise((resolve, reject) => {
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction(["blocks"], "readonly");
        const store = transaction.objectStore("blocks");
        const blocksWithoutNotes = [];
        
        store.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const block = cursor.value;
            if (!block.notes || !block.notes.trim()) {
              blocksWithoutNotes.push(block);
            }
            cursor.continue();
          } else {
            resolve(blocksWithoutNotes);
          }
        };
        
        transaction.onerror = function(e) {
          reject(e.target.error);
        };
      })
      .catch(err => reject(err));
  });
}
