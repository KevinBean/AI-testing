/**
 * Block management functionality
 */

let editingBlockId = null;
let selectedBlockId = null;
let standardAutocomplete = [];
let tagAutocomplete = [];

// Initialize blocks view
$(document).ready(function() {
  console.log("Blocks view initialized");
  
  // Hook up search functionality
  $("#blockSearch").on("keyup", function() {
    const searchTerm = $(this).val().trim();
    loadBlocks(searchTerm);
  });
  
  // Hook up create button
  $("#createBlockButton").on("click", function() {
    showBlockModal();
  });
  
  // Hook up save block button - ONLY attach to modal version if it exists
  $(document).on("click", "#saveBlockButton", function() {
    // Only execute if we're in a modal context or this handler isn't for the blocks.html page
    if ($("#blockFormSection").length === 0) {
      const block = {
        title: $("#blockModalForm #blockTitle").val().trim(),
        content: $("#blockModalForm #blockText").val().trim(),
        tags: $("#blockModalForm #blockTags").val().trim().split(',').map(tag => tag.trim()).filter(tag => tag),
        standard: $("#blockModalForm #blockStandard").val().trim() || null,
        levels: Array.from({ length: 6 }, (_, i) => {
          const level = $(`#blockModalForm #blockLevel${i + 1}`).val();
          return level ? parseInt(level) : null;
        }),
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      if (!block.title || !block.content) {
        showNotification("Title and content are required", "warning");
        return;
      }

      saveBlock(block, "#blockModalForm");
    }
  });
  
  // Debug button handler
  $("#debugBlocksBtn").click(function() {
    console.log("Debug blocks triggered");
    alert("Current editing block: " + (editingBlockId || "None") + 
          "\nSelected block: " + (selectedBlockId || "None") + 
          "\nDatabase status: " + (db ? "Connected" : "Not connected") +
          "\nStandard autocomplete items: " + standardAutocomplete.length +
          "\nTag autocomplete items: " + tagAutocomplete.length);
  });
  
  // Close block details handler
  $(document).on("click", ".close-block-details", function() {
    $("#blockDetailView").hide();
  });
  
  // Initialize autocomplete for standard references in both forms
  initializeStandardAutocomplete("#blockQuickForm #blockStandard");
  initializeStandardAutocomplete("#blockModalForm #blockStandard");
  
  // Initialize autocomplete for tags
  initializeTagAutocomplete("#blockQuickForm #blockTags");
  initializeTagAutocomplete("#blockModalForm #blockTags");
  
  // Hook up quick form submit
  $("#blockQuickForm").submit(function(e) {
    e.preventDefault();
    saveBlockFromForm("#blockQuickForm");
  });
  
  // Initialize autocomplete data
  updateStandardAutocomplete();
  updateTagsList();
  
  // Initialize blocks data
  loadBlocks();
});

// Initialize standard autocomplete
function initializeStandardAutocomplete(selector) {
  $(selector).autocomplete({
    source: function(request, response) {
      if (!standardAutocomplete || standardAutocomplete.length === 0) {
        // If autocomplete data isn't loaded yet, update it first
        updateStandardAutocomplete().then(() => {
          const results = $.ui.autocomplete.filter(standardAutocomplete, request.term);
          response(results.slice(0, 10));
        });
      } else {
        const results = $.ui.autocomplete.filter(standardAutocomplete, request.term);
        response(results.slice(0, 10));
      }
    },
    minLength: 1
  });
}

// Initialize tag autocomplete with comma separation
function initializeTagAutocomplete(selector) {
  $(selector).autocomplete({
    source: function(request, response) {
      const term = request.term.split(/,\s*/).pop();
      if (!tagAutocomplete || tagAutocomplete.length === 0) {
        // If autocomplete data isn't loaded yet, update tags
        updateTagsList().then(() => {
          const results = $.ui.autocomplete.filter(tagAutocomplete, term);
          response(results.slice(0, 10));
        });
      } else {
        const results = $.ui.autocomplete.filter(tagAutocomplete, term);
        response(results.slice(0, 10));
      }
    },
    focus: function() {
      return false;
    },
    select: function(event, ui) {
      const terms = this.value.split(/,\s*/);
      terms.pop();
      terms.push(ui.item.value);
      terms.push("");
      this.value = terms.join(", ");
      return false;
    },
    minLength: 1
  });
}

// Save block from form data
function saveBlockFromForm(formSelector) {
  const title = $(formSelector + " #blockTitle").val().trim();
  const content = $(formSelector + " #blockText").val().trim();
  const tagsString = $(formSelector + " #blockTags").val().trim();
  const standard = $(formSelector + " #blockStandard").val().trim();
  
  // Get level values
  const levels = [];
  for (let i = 1; i <= 6; i++) {
    const level = $(formSelector + ` #blockLevel${i}`).val();
    levels.push(level ? parseInt(level) : null);
  }
  
  if (!title || !content) {
    showNotification("Title and content are required", "warning");
    return;
  }
  
  // Process tags
  const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
  
  const block = {
    title: title,
    content: content,
    tags: tags,
    standard: standard || null,
    levels: levels,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  
  saveBlock(block, formSelector);
}

// Show block modal - either for creating new or editing
function showBlockModal(blockId = null) {
  // Reset the form
  $("#blockModalForm")[0].reset();
  
  if (blockId) {
    // We're editing an existing block
    editingBlockId = blockId;
    $("#blockModalTitle").text("Edit Block");
    
    // Load block data
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction(["blocks"], "readonly");
        const store = transaction.objectStore("blocks");
        const request = store.get(blockId);
        
        request.onsuccess = function(event) {
          const block = event.target.result;
          if (block) {
            $("#blockModalForm #blockTitle").val(block.title || "");
            $("#blockModalForm #blockText").val(block.content || "");
            $("#blockModalForm #blockTags").val(block.tags ? block.tags.join(", ") : "");
            $("#blockModalForm #blockStandard").val(block.standard || "");
            
            // Set level values if they exist
            if (block.levels) {
              for (let i = 1; i <= 6; i++) {
                if (block.levels[i-1]) {
                  $(`#blockModalForm #blockLevel${i}`).val(block.levels[i-1]);
                }
              }
            }
          }
        };
        
        request.onerror = function(event) {
          console.error("Error loading block for editing:", event.target.error);
          showNotification("Error loading block data", "danger");
        };
      })
      .catch(err => {
        console.error("Database not ready when loading block:", err);
        showNotification("Database error. Please try again.", "danger");
      });
  } else {
    // We're creating a new block
    editingBlockId = null;
    $("#blockModalTitle").text("Create New Block");
  }
  
  // Show the modal
  $("#blockModal").modal("show");
}

// Save block (create new or update existing)
function saveBlock(block, formSelector) {
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["blocks"], "readwrite");
      const store = transaction.objectStore("blocks");
      
      let request;
      if (editingBlockId) {
        // Update existing block
        block.id = editingBlockId;
        request = store.put(block);
      } else {
        // Create new block
        request = store.add(block);
      }
      
      request.onsuccess = function(event) {
        console.log("Block saved successfully");
        
        // Reset the form that was used
        $(formSelector)[0].reset();
        
        // If the modal was used, close it
        if (formSelector === "#blockModalForm") {
          $("#blockModal").modal("hide");
        }
        
        // Show success message and update UI
        showNotification(editingBlockId ? "Block updated" : "Block created", "success");
        editingBlockId = null;
        loadBlocks(); // Reload blocks list
        
        // Update autocomplete lists with new data
        updateTagsList();
      };
      
      request.onerror = function(event) {
        console.error("Error saving block:", event.target.error);
        showNotification("Error saving block", "danger");
      };
    })
    .catch(err => {
      console.error("Database not ready when saving block:", err);
      showNotification("Database error. Please try again.", "danger");
    });
}

// Load blocks, optionally filtered by search term
function loadBlocks(searchTerm = '') {
  console.log("Loading blocks", searchTerm ? "with search term: " + searchTerm : "");
  
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["blocks"], "readonly");
      const store = transaction.objectStore("blocks");
      const request = store.getAll();
      
      request.onsuccess = function(event) {
        let blocks = event.target.result || [];
        
        // Filter by search term if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          blocks = blocks.filter(block => 
            (block.title && block.title.toLowerCase().includes(searchLower)) || 
            (block.content && block.content.toLowerCase().includes(searchLower)) ||
            (block.standard && block.standard.toLowerCase().includes(searchLower)) ||
            (block.tags && block.tags.some(tag => tag.toLowerCase().includes(searchLower)))
          );
        }
        
        // Display blocks
        renderBlocksList(blocks);
      };
      
      request.onerror = function(event) {
        console.error("Error loading blocks:", event.target.error);
        showBlocksError("Error loading blocks. Please try refreshing the page.");
      };
    })
    .catch(err => {
      console.error("Database not ready when loading blocks:", err);
      showBlocksError("Database error. Please try refreshing the page.");
    });
}

// Render the blocks list in the UI
function renderBlocksList(blocks) {
  // Clear the blocks list
  const blockList = $("#blockList");
  blockList.empty();
  
  if (blocks.length === 0) {
    blockList.html(`
      <li class="list-group-item text-center">
        <div class="alert alert-info mb-0">
          No blocks found. Create your first block using the form.
        </div>
      </li>
    `);
    return;
  }
  
  // Sort blocks by title
  blocks.sort((a, b) => {
    // First sort by standard if available
    if (a.standard && b.standard) {
      if (a.standard !== b.standard) {
        return a.standard.localeCompare(b.standard);
      }
      
      // If same standard, sort by levels
      if (a.levels && b.levels) {
        for (let i = 0; i < Math.min(a.levels.length, b.levels.length); i++) {
          const aLevel = a.levels[i] || 0;
          const bLevel = b.levels[i] || 0;
          if (aLevel !== bLevel) {
            return aLevel - bLevel;
          }
        }
      }
    }
    
    // Fall back to sorting by title or id
    if (a.title && b.title) {
      return a.title.localeCompare(b.title);
    } else {
      return (a.id || 0) - (b.id || 0);
    }
  });
  
  // Add each block to the list
  blocks.forEach(block => {
    // Create the list item
    const listItem = $("<li>").addClass("list-group-item list-item");
    
    // Create the title and metadata
    const titleElement = $("<div>").addClass("block-title");
    
    let titleText = block.title || `Block ${block.id}`;
    if (block.standard) {
      titleText = `${block.standard}: ${titleText}`;
    }
    
    titleElement.html(`<strong>${escapeHtml(titleText)}</strong>`);
    
    // Create block metadata
    const metaElement = $("<div>").addClass("block-meta small text-muted");
    let metaText = `ID: ${block.id}`;
    
    if (block.tags && block.tags.length) {
      metaText += ` • Tags: ${block.tags.join(", ")}`;
    }
    
    metaElement.text(metaText);
    
    // Create the action buttons
    const actionButtons = $("<div>").addClass("action-buttons mt-2");
    
    // View button
    const viewBtn = $("<button>")
      .addClass("btn btn-sm btn-outline-primary action-btn mr-1")
      .html('<i class="fas fa-eye"></i> View')
      .click(function(e) {
        e.stopPropagation();
        viewBlock(block.id);
      });
    
    // Edit button
    const editBtn = $("<button>")
      .addClass("btn btn-sm btn-warning action-btn mr-1")
      .html('<i class="fas fa-edit"></i> Edit')
      .click(function(e) {
        e.stopPropagation();
        showBlockModal(block.id);
      });
    
    // Delete button
    const deleteBtn = $("<button>")
      .addClass("btn btn-sm btn-danger action-btn")
      .html('<i class="fas fa-trash"></i> Delete')
      .click(function(e) {
        e.stopPropagation();
        deleteBlock(block.id);
      });
    
    // Add buttons to action container
    actionButtons.append(viewBtn, editBtn, deleteBtn);
    
    // Add all elements to the list item
    listItem.append(titleElement, metaElement, actionButtons);
    
    // Add click handler for the list item
    listItem.click(function() {
      viewBlock(block.id);
    });
    
    // Add the list item to the block list
    blockList.append(listItem);
  });
}

// View a block's details
function viewBlock(blockId) {
  // Set the selected block
  selectedBlockId = blockId;
  
  // Fetch the block data
  fetchBlockById(blockId, function(block) {
    if (block) {
      // Create the HTML for the block details
      let detailsHtml = `
        <h4>${escapeHtml(block.title || `Block ${block.id}`)}</h4>
        <div class="block-metadata mb-3">
          <span class="badge badge-secondary">ID: ${block.id}</span>
          ${block.standard ? `<span class="badge badge-primary ml-2">${block.standard}</span>` : ''}
      `;
      
      // Add levels if present
      if (block.levels && block.levels.some(level => level !== null)) {
        const levelStr = block.levels.filter(l => l !== null).join('.');
        detailsHtml += `<span class="badge badge-info ml-2">Level: ${levelStr}</span>`;
      }
      
      // Add tags if present
      if (block.tags && block.tags.length) {
        detailsHtml += `<div class="block-tags mt-2">
          ${block.tags.map(tag => `<span class="badge badge-secondary mr-1">${tag}</span>`).join('')}
        </div>`;
      }
      
      // Add dates
      if (block.created) {
        const createdDate = new Date(block.created).toLocaleDateString();
        detailsHtml += `<div class="block-dates mt-2 small text-muted">
          Created: ${createdDate}
          ${block.lastModified ? ` • Updated: ${new Date(block.lastModified).toLocaleDateString()}` : ''}
        </div>`;
      }
      
      detailsHtml += `</div>`;
      
      // Add block content
      detailsHtml += `
        <div class="block-content-preview card">
          <div class="card-header">Content</div>
          <div class="card-body">
            ${marked.parse(block.content || '')}
          </div>
        </div>
        
        <div class="block-actions mt-3">
          <button class="btn btn-warning edit-block-btn" data-id="${block.id}">
            <i class="fas fa-edit"></i> Edit Block
          </button>
          <button class="btn btn-danger delete-block-btn ml-2" data-id="${block.id}">
            <i class="fas fa-trash-alt"></i> Delete Block
          </button>
        </div>
      `;
      
      // Show the block detail view and update its content
      $("#blockDetailView .block-detail-content").html(detailsHtml);
      $("#blockDetailView").show();
      
      // Hide the form section if it's visible
      $("#blockFormSection").hide();
      
      // Attach action handlers
      $(".edit-block-btn").click(function() {
        const id = $(this).data("id");
        showBlockModal(id);
      });
      
      $(".delete-block-btn").click(function() {
        const id = $(this).data("id");
        deleteBlock(id);
      });
      
      // Highlight the selected block in the list
      $("#blockList .list-group-item").removeClass("active");
      $(`#blockList .list-group-item[data-id="${blockId}"]`).addClass("active");
    } else {
      showNotification(`Block with ID ${blockId} not found`, "warning");
    }
  });
}

// Delete a block
function deleteBlock(blockId) {
  if (confirm(`Are you sure you want to delete block #${blockId}? This cannot be undone.`)) {
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction(["blocks"], "readwrite");
        const store = transaction.objectStore("blocks");
        const request = store.delete(blockId);
        
        request.onsuccess = function() {
          showNotification(`Block #${blockId} deleted successfully`, "success");
          
          // If we were viewing the deleted block, hide the detail view
          if (selectedBlockId === blockId) {
            $("#blockDetailView").hide();
            selectedBlockId = null;
          }
          
          // Reload the blocks list
          loadBlocks();
          
          // Update autocomplete data
          updateTagsList();
        };
        
        request.onerror = function(event) {
          console.error("Error deleting block:", event.target.error);
          showNotification("Error deleting block", "danger");
        };
      })
      .catch(err => {
        console.error("Database not ready when deleting block:", err);
        showNotification("Database error. Please try again.", "danger");
      });
  }
}

// Update autocomplete for standards
async function updateStandardAutocomplete() {
  try {
    const db = await ensureDatabaseReady();
    standardAutocomplete = [];
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("standards", "readonly");
      const store = transaction.objectStore("standards");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if(cursor) {
          const std = cursor.value;
          standardAutocomplete.push({ 
            label: std.id + " - " + std.name + (std.type ? ` (${std.type})` : ""), 
            value: std.id 
          });
          cursor.continue();
        } else {
          console.log("Standards autocomplete updated with", standardAutocomplete.length, "items");
          resolve(standardAutocomplete);
        }
      };
      
      transaction.onerror = function(e) {
        console.error("Error updating standards autocomplete:", e.target.error);
        reject(e.target.error);
      };
    });
  } catch (err) {
    console.error("Failed to update standards autocomplete:", err);
    return [];
  }
}

// Update list of tags for autocomplete
async function updateTagsList() {
  try {
    const db = await ensureDatabaseReady();
    const uniqueTags = new Set();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if(cursor) {
          const block = cursor.value;
          if (block.tags && Array.isArray(block.tags)) {
            block.tags.forEach(tag => uniqueTags.add(tag.trim()));
          }
          cursor.continue();
        } else {
          tagAutocomplete = Array.from(uniqueTags);
          console.log("Tags autocomplete updated with", tagAutocomplete.length, "items");
          resolve(tagAutocomplete);
        }
      };
      
      transaction.onerror = function(e) {
        console.error("Error updating tags list:", e.target.error);
        reject(e.target.error);
      };
    });
  } catch (err) {
    console.error("Failed to update tags list:", err);
    return [];
  }
}

// Show notification
function showNotification(message, type = "info") {
  const $notification = $(`
    <div class="alert alert-${type} alert-dismissible fade show notification-toast" role="alert">
      ${message}
      <button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  `);
  
  // Remove existing notifications
  $(".notification-toast").remove();
  
  // Add to page
  $("body").append($notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    $notification.alert('close');
  }, 3000);
}

// Show blocks error message
function showBlocksError(message) {
  $("#blockList").html(`
    <li class="list-group-item text-danger">
      <i class="fas fa-exclamation-triangle"></i> ${message}
    </li>
  `);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add a universal function to edit blocks from any view
function editBlockUniversal(blockId) {
  console.log("Editing block:", blockId);
  
  // Switch to blocks tab if not already there
  $("#blocks-tab").tab('show');
  
  // Then show the block modal for editing
  setTimeout(() => {
    showBlockModal(blockId);
  }, 300); // Short delay to ensure tab switching completes
}

// Function to fetch block by ID (for other modules to use)
function fetchBlockById(id, callback) {
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["blocks"], "readonly");
      const store = transaction.objectStore("blocks");
      const request = store.get(parseInt(id));
      
      request.onsuccess = function(event) {
        callback(event.target.result);
      };
      
      request.onerror = function(event) {
        console.error("Error fetching block:", event.target.error);
        callback(null);
      };
    })
    .catch(err => {
      console.error("Database not ready when fetching block:", err);
      callback(null);
    });
}
