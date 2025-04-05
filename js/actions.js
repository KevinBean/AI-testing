// AI Actions Management Functions

let editingActionId = null;
let selectedActionId = null; // Track the selected action ID

// Update temperature display when slider changes
$(document).ready(function() {
  $("#actionTemperature").on("input", function() {
    $("#tempValue").text($(this).val());
  });
  
  // Toggle visibility of tools definition textarea based on checkbox
  $("#useTools").on("change", function() {
    if ($(this).is(":checked")) {
      $("#toolsDefinitionContainer").slideDown();
    } else {
      $("#toolsDefinitionContainer").slideUp();
    }
  });
  
  // Search actions
  $("#actionSearch").on("keyup", function() {
    const searchTerm = $(this).val().trim();
    loadActions(searchTerm);
  });
  
  // Cancel button handler
  $("#cancelActionBtn").on("click", function(e) {
    e.preventDefault();
    resetActionForm();
  });
  
  // Make sure the action form is properly attached to submission event
  $("#actionForm").on("submit", function(e) {
    handleActionFormSubmit(e);
  });
  
  // Initialize buttons only after document is fully loaded
  initializeActionButtons();
});

// Function to initialize action buttons to ensure they're properly bound
function initializeActionButtons() {
  // Select content button handler
  $("#selectContentBtn").off("click").on("click", function() {
    console.log("Select content button clicked");
    // Get the action details to determine selection requirements
    if (!selectedActionId) {
      showNotification("Please select an action first", "warning");
      return;
    }
    
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    
    store.get(parseInt(selectedActionId)).onsuccess = function(e) {
      const action = e.target.result;
      if (!action) {
        showNotification("Action not found", "danger");
        return;
      }
      
      // Reset selected items
      selectedContentItems = [];
      updateSelectedItemsUI();
      
      // Set selection mode based on action purpose
      let selectionInfo = "";
      let selectionMode = "multiple";
      
      switch(action.purpose) {
        case "modify":
          selectionInfo = "Select zero or one block/paragraph to modify.";
          selectionMode = "single";
          break;
        case "generate":
          selectionInfo = "Select zero or multiple blocks/paragraphs as reference for generation.";
          selectionMode = "multiple";
          break;
        case "analyze":
        case "synthesize":
          selectionInfo = "Select one or multiple blocks/paragraphs to " + action.purpose + ".";
          selectionMode = "multiple-required";
          break;
        default:
          selectionInfo = "Select content to process with this action.";
      }
      
      // Update the selection modal info
      $(".action-selection-info").text(selectionInfo);
      $("#contentSelectionModal").data("selection-mode", selectionMode);
      
      // Load blocks and documents for selection
      loadBlocksForSelection();
      loadDocumentsForSelection();
      loadTagsForSelection();
      loadReferencesForSelection();
      
      // Show the selection modal
      $("#contentSelectionModal").modal("show");
    };
  });
  
  // Run action button handler
  $("#runActionBtn").off("click").on("click", async function() {
    console.log("Run action button clicked");
    if (!selectedActionId) {
      showNotification("Please select an action first", "warning");
      return;
    }
    
    // Show loading state
    $("#actionResultContainer").html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Processing your request...</div>');
    
    // Process the selected items and run the action
    try {
      const contentText = await assembleContentFromSelectedItems();
      runActionWithContent(selectedActionId, contentText);
    } catch (error) {
      $("#actionResultContainer").html(`
        <div class="alert alert-danger">
          <strong>Error:</strong> ${error.message || error}
        </div>
      `);
    }
  });

  // Confirm content selection button in modal
  $("#confirmContentSelection").off("click").on("click", function() {
    console.log("Confirm content selection clicked");
    const selectionMode = $("#contentSelectionModal").data("selection-mode");
    
    // Validate selection based on mode
    if (selectionMode === "multiple-required" && selectedContentItems.length === 0) {
      showNotification("Please select at least one item", "warning");
      return;
    }
    
    if (selectionMode === "single" && selectedContentItems.length > 1) {
      showNotification("Please select only one item", "warning");
      return;
    }
    
    // Close the modal
    $("#contentSelectionModal").modal("hide");
    
    // Update UI to show content is selected
    $("#runActionBtn").addClass("btn-success").removeClass("btn-primary").text("Run Action with Selected Content");
    showNotification("Content selected successfully!", "success");
  });
}

// Initialize selection modal tabs
$('#contentSelectionModal').on('shown.bs.modal', function() {
  // Load initial data for each tab
  loadBlocksForSelection();
  loadDocumentsForSelection();
  loadTagsForSelection();
  loadReferencesForSelection();
  
  // Clear any previous selections
  selectedContentItems = [];
  updateSelectedItemsUI();
});

// Search blocks in selection modal
$("#searchBlocksSelectionBtn").on("click", function() {
  const searchTerm = $("#blockSelectionSearch").val().trim();
  loadBlocksForSelection(searchTerm);
});

// Search documents in selection modal
$("#searchDocsSelectionBtn").on("click", function() {
  const searchTerm = $("#docSelectionSearch").val().trim();
  loadDocumentsForSelection(searchTerm);
});

// Search tags in selection modal
$("#searchTagsSelectionBtn").on("click", function() {
  const searchTerm = $("#tagSelectionSearch").val().trim();
  loadTagsForSelection(searchTerm);
});

// Search references in selection modal
$("#searchReferencesSelectionBtn").on("click", function() {
  const searchTerm = $("#referenceSelectionSearch").val().trim();
  loadReferencesForSelection(searchTerm);
});

// Enter key handling for search inputs
$("#blockSelectionSearch, #docSelectionSearch, #tagSelectionSearch, #referenceSelectionSearch").keypress(function(e) {
  if (e.which === 13) {
    $(this).siblings(".input-group-append").find("button").click();
  }
});

// Load saved actions
function loadActions(searchTerm = "") {
  $("#actionsList").empty();
  const transaction = db.transaction("actions", "readonly");
  const store = transaction.objectStore("actions");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const action = cursor.value;
      // Make sure all properties have default values to prevent undefined errors
      const title = action.title || "Untitled Action";
      const description = action.description || "";
      const tags = action.tags && Array.isArray(action.tags) ? action.tags : [];
      
      const searchableText = (
        title + " " + 
        description + " " + 
        tags.join(" ")
      ).toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        const li = $("<li>")
          .addClass("list-group-item list-item")
          .html(`<strong>${title}</strong><br><small>${description}</small>`)
          .click(function() { previewAction(action); });
          
        const editBtn = $("<button>")
          .addClass("btn btn-sm btn-warning action-btn")
          .text("Edit")
          .click(function(e) { 
            e.stopPropagation(); 
            editAction(action); 
          });
          
        const delBtn = $("<button>")
          .addClass("btn btn-sm btn-danger action-btn")
          .text("Delete")
          .click(function(e) { 
            e.stopPropagation(); 
            deleteAction(action.id); 
          });
          
        li.append(editBtn, delBtn);
        
        // Add defensive check for tags
        if (tags.length > 0) {
          const tagsSpan = $("<div>")
            .addClass("mt-1")
            .html(tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join(""));
          li.append(tagsSpan);
        }
        
        $("#actionsList").append(li);
      }
      cursor.continue();
    }
  };
}

// Preview action
function previewAction(action) {
  // Add defaults to prevent undefined errors
  const title = action.title || "Untitled Action";
  const description = action.description || "";
  const tags = action.tags && Array.isArray(action.tags) ? action.tags : [];
  const model = action.model || "gpt-3.5-turbo";
  const purpose = action.purpose || "generate";
  const temperature = action.temperature || "0.7";
  const prompt = action.prompt || "";
  
  let html = `
    <h5>${title}</h5>
    <p>${description || "<em>No description</em>"}</p>
    
    <div class="row mb-3">
      <div class="col-md-4">
        <strong>AI Model:</strong><br>
        ${model}
      </div>
      <div class="col-md-4">
        <strong>Purpose:</strong><br>
        ${purpose}
      </div>
      <div class="col-md-4">
        <strong>Web Search:</strong><br>
        ${action.enablewebsearch ? "Enabled" : "Disabled"}
      </div>
      <div class="col-md-4">
        <strong>Temperature:</strong><br>
        ${temperature}
      </div>
    </div>
    
    <div class="mb-3">
      <strong>Tags:</strong><br>
      ${tags.length > 0 ? 
        tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join("") : 
        "<em>No tags</em>"}
    </div>
    
    <div>
      <strong>Prompt Template:</strong>
      <pre class="bg-light p-2 border rounded">${prompt}</pre>
    </div>
  `;
  
  $("#actionPreview").html(html);
  
  // Enable both buttons and store the selected action ID
  selectedActionId = action.id;
  console.log("Action selected, ID:", selectedActionId);
  $("#selectContentBtn").prop("disabled", false);
  $("#runActionBtn").prop("disabled", false).removeClass("btn-success").addClass("btn-primary").text("Run Action");
  
  // Re-initialize buttons to ensure they're bound with the current actionId
  initializeActionButtons();
}

// Edit action - also add defensive checks here
function editAction(action) {
  editingActionId = action.id;
  $("#actionTitle").val(action.title || "");
  $("#actionDescription").val(action.description || "");
  
  // Make sure tags is an array before joining
  const tags = action.tags && Array.isArray(action.tags) ? action.tags : [];
  $("#actionTags").val(tags.join(", "));
  
  $("#actionModel").val(action.model || "gpt-3.5-turbo");
  $("#actionPurpose").val(action.purpose || "generate");
  $("#actionTemperature").val(action.temperature || "0.7");
  $("#tempValue").text(action.temperature || "0.7");
  $("#enableWebSearch").prop("checked", action.enablewebsearch || false);

  // Set the Use Tools checkbox and Tools Definition textarea
  $("#useTools").prop("checked", action.useTools || false).trigger("change");
  $("#toolsDefinition").val(action.toolsDefinition || "");

  $("#actionPrompt").val(action.prompt || "");
  $("#saveActionBtn").text("Update Action");
}

// Delete action
function deleteAction(id) {
  if (confirm("Are you sure you want to delete this action?")) {
    const transaction = db.transaction("actions", "readwrite");
    const store = transaction.objectStore("actions");
    store.delete(id).onsuccess = function() {
      loadActions();
      showNotification("Action deleted successfully!");
      if (editingActionId === id) {
        resetActionForm();
      }
    };
  }
}

// Reset action form
function resetActionForm() {
  editingActionId = null;
  $("#actionForm")[0].reset();
  $("#tempValue").text("0.7"); // Reset temperature display
  $("#saveActionBtn").text("Save Action");
  $("#actionPreview").html('<p class="text-muted">Select an action to preview its settings and prompt template.</p>');
  $("#runActionBtn").prop("disabled", true).removeClass("btn-success").addClass("btn-primary").text("Run Action");
  $("#selectContentBtn").prop("disabled", true);
  selectedActionId = null;
}

function handleActionFormSubmit(e) {
  e.preventDefault();
  
  const title = $("#actionTitle").val().trim();
  const description = $("#actionDescription").val().trim();
  const tags = $("#actionTags").val().split(",").map(s => s.trim()).filter(s => s);
  const model = $("#actionModel").val();
  const purpose = $("#actionPurpose").val();
  const enablewebsearch = $("#enableWebSearch").is(":checked") ? true : false;
  const useTools = $("#useTools").is(":checked") ? true : false;
  const toolsDefinition = $("#toolsDefinition").val().trim();
  const temperature = $("#actionTemperature").val();
  const prompt = $("#actionPrompt").val().trim();
  
  const transaction = db.transaction("actions", "readwrite");
  const store = transaction.objectStore("actions");
  
  if (editingActionId) {
    store.get(editingActionId).onsuccess = function(e) {
      let action = e.target.result;
      action.title = title;
      action.description = description;
      action.tags = tags;
      action.model = model;
      action.purpose = purpose;
      action.temperature = temperature;
      action.enablewebsearch = enablewebsearch;
      action.useTools = useTools;
      action.toolsDefinition = toolsDefinition;
      action.prompt = prompt;
      action.updated = new Date();
      
      store.put(action).onsuccess = function() {
        showNotification("Action updated successfully!");
        resetActionForm();
        loadActions();
      };
    };
  } else {
    const action = {
      title,
      description,
      tags,
      model,
      purpose,
      temperature,
      enablewebsearch,
      useTools,
      toolsDefinition,
      prompt,
      created: new Date()
    };
    
    store.add(action).onsuccess = function() {
      showNotification("New action created!");
      resetActionForm();
      loadActions();
    };
  }
}

// Load blocks for selection
function loadBlocksForSelection(searchTerm = "") {
  const blocksList = $(".block-selection-list");
  blocksList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading blocks...</div>');

  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  let blocksHtml = "";

  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      const searchableText = (
        (block.title || "") + " " + 
        (typeof block.text === "string" ? block.text : "") + " " + 
        (block.tags ? block.tags.join(" ") : "") + " " + 
        (block.standard || "")
      ).toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        // Build selectable checkbox for each block
        const title = block.title || ("Block " + block.id);
        const text = (typeof block.text === "string") ? block.text : "";
        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
        
        blocksHtml += `
          <div class="card mb-2 selectable-block" data-id="${block.id}">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="block_${block.id}">
                <label class="form-check-label w-100" for="block_${block.id}">
                  <strong>${title}</strong>
                  <p class="mb-0 text-muted small">${preview}</p>
                </label>
              </div>
            </div>
          </div>
        `;
      }
      cursor.continue();
    } else {
      if (blocksHtml) {
        blocksList.html(blocksHtml);
        // Attach event for block selection
        $(".block-selection-list .select-content-item").on("change", function() {
          const blockDiv = $(this).closest(".selectable-block");
          const blockId = blockDiv.data("id");
          if ($(this).prop("checked")) {
            // Add to selected items
            selectedContentItems.push({
              id: blockId,
              title: blockDiv.find("label strong").text(),
              type: "block"
            });
          } else {
            // Remove from selected items
            const index = selectedContentItems.findIndex(item => item.id === blockId && item.type === "block");
            if (index > -1) {
              selectedContentItems.splice(index, 1);
            }
          }
          updateSelectedItemsUI();
        });
      } else {
        blocksList.html('<p class="text-muted text-center">No blocks found.</p>');
      }
    }
  };
}

// Load documents for selection
function loadDocumentsForSelection(searchTerm = "") {
  const docsList = $(".document-selection-list");
  docsList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>');
  
  const transaction = db.transaction("documents", "readonly");
  const store = transaction.objectStore("documents");
  let docsHtml = '';
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const doc = cursor.value;
      const searchableText = doc.title.toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        docsHtml += `
          <div class="card mb-2 selectable-document" data-id="${doc.id}" data-title="${doc.title}">
            <div class="card-body py-2">
              <strong>${doc.title}</strong> <small class="text-muted">(ID: ${doc.id})</small>
              <button class="btn btn-sm btn-outline-primary float-right load-paragraphs-btn">
                Load Paragraphs
              </button>
            </div>
          </div>
        `;
      }
      cursor.continue();
    } else {
      if (docsHtml) {
        docsList.html(docsHtml);
        
        // Add event handlers for document selection
        $(".load-paragraphs-btn").on("click", function() {
          const docId = $(this).closest(".selectable-document").data("id");
          loadParagraphsForSelection(docId);
        });
      } else {
        docsList.html('<p class="text-center text-muted">No documents found matching your search.</p>');
      }
    }
  };
}

// Update the selected items UI
function updateSelectedItemsUI() {
  const selectedItemsList = $("#selectedItemsList");
  const selectedItemsCount = $("#selectedItemsCount");
  
  selectedItemsCount.text(selectedContentItems.length);
  
  if (selectedContentItems.length === 0) {
    selectedItemsList.html('<p class="text-muted text-center mb-0">No items selected</p>');
  } else {
    let itemsHtml = '';
    
    selectedContentItems.forEach((item, index) => {
      itemsHtml += `
        <div class="selected-item mb-1 d-flex justify-content-between align-items-center">
          <span>${item.title} <small class="text-muted">(${item.type})</small></span>
          <button type="button" class="btn btn-sm btn-outline-danger remove-selected-item" data-index="${index}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    });
    
    selectedItemsList.html(itemsHtml);
    
    // Add event handlers for removing selected items
    $(".remove-selected-item").on("click", function() {
      const index = $(this).data("index");
      const itemToRemove = selectedContentItems[index];
      
      // Uncheck the corresponding checkbox
      if (itemToRemove.type === "block") {
        $(`#block-${itemToRemove.id}`).prop("checked", false);
      } else if (itemToRemove.type === "paragraph") {
        $(`#para-${itemToRemove.id}`).prop("checked", false);
      }
      
      // Remove from the array
      selectedContentItems.splice(index, 1);
      updateSelectedItemsUI();
    });
  }
}

// Load paragraphs for a selected document
function loadParagraphsForSelection(docId) {
  const paragraphsList = $(".paragraph-selection-list");
  paragraphsList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading paragraphs...</div>');
  
  const transaction = db.transaction("documents", "readonly");
  const store = transaction.objectStore("documents");
  
  store.get(parseInt(docId)).onsuccess = function(e) {
    const doc = e.target.result;
    if (doc && doc.paragraphs) {
      let paragraphsHtml = '';
      
      doc.paragraphs.forEach((para, index) => {
        const preview = para.content.length > 100 ? para.content.substring(0, 100) + "..." : para.content;
        
        paragraphsHtml += `
          <div class="card mb-2 selectable-paragraph" data-id="${doc.id}-${index}" data-doc-id="${doc.id}" 
               data-para-index="${index}" data-doc-title="${doc.title}" data-type="paragraph">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="para-${doc.id}-${index}">
                <label class="form-check-label w-100" for="para-${doc.id}-${index}">
                  <strong>Paragraph ${index + 1}</strong>
                  <p class="mb-0 text-muted small">${preview}</p>
                </label>
              </div>
            </div>
          </div>
        `;
      });
      
      paragraphsList.html(paragraphsHtml);
      
      // Add event handlers for paragraph selection
      $(".selectable-paragraph .select-content-item").on("change", function() {
        const paragraph = $(this).closest(".selectable-paragraph");
        const docId = paragraph.data("doc-id");
        const paraIndex = paragraph.data("para-index");
        const docTitle = paragraph.data("doc-title");
        const itemId = `${docId}-${paraIndex}`;
        const selectionMode = $("#contentSelectionModal").data("selection-mode");
        
        if ($(this).prop("checked")) {
          // If single mode and something is already selected, uncheck others
          if (selectionMode === "single" && selectedContentItems.length > 0) {
            // Uncheck all other checkboxes
            $(".select-content-item").not(this).prop("checked", false);
            // Clear the selection array
            selectedContentItems = [];
          }
          
          // Add to selected items
          selectedContentItems.push({
            id: itemId,
            docId: docId,
            paraIndex: paraIndex,
            type: "paragraph",
            title: `Paragraph ${paraIndex + 1} from ${docTitle}`
          });
        } else {
          // Remove from selected items
          selectedContentItems = selectedContentItems.filter(item => 
            !(item.type === "paragraph" && item.id === itemId)
          );
        }
        
        updateSelectedItemsUI();
      });
    } else {
      paragraphsList.html('<p class="text-center text-muted">No paragraphs found in this document.</p>');
    }
  };
}

// Assemble content from selected items
async function assembleContentFromSelectedItems() {
  let contentParts = [];
  const blockFetchPromises = [];
  const paragraphFetchPromises = [];
  
  // Process blocks
  for (const item of selectedContentItems) {
    if (item.type === "block") {
      blockFetchPromises.push(
        new Promise((resolve, reject) => {
          const transaction = db.transaction("blocks", "readonly");
          const store = transaction.objectStore("blocks");
          
          store.get(parseInt(item.id)).onsuccess = function(e) {
            const block = e.target.result;
            if (block) {
              resolve({
                id: block.id,
                title: block.title || `Block ${block.id}`,
                text: block.content || "",
                tags: block.tags,
                standard: block.standard,
                stdLevels: block.stdLevels
              });
            } else {
              resolve({
                id: item.id,
                title: `Unknown Block ${item.id}`,
                text: `Block with ID ${item.id} not found`,
                error: true
              });
            }
          };
        })
      );
    } else if (item.type === "paragraph") {
      paragraphFetchPromises.push(
        new Promise((resolve, reject) => {
          const transaction = db.transaction("documents", "readonly");
          const store = transaction.objectStore("documents");
          
          store.get(parseInt(item.docId)).onsuccess = function(e) {
            const doc = e.target.result;
            if (doc && doc.paragraphs && doc.paragraphs[item.paraIndex]) {
              const para = doc.paragraphs[item.paraIndex];
              
              // Fetch referenced blocks if any
              const refBlockPromises = [];
              if (para.blockRefs && para.blockRefs.length > 0) {
                para.blockRefs.forEach(blockId => {
                  refBlockPromises.push(
                    new Promise((resolveBlock) => {
                      const blockTx = db.transaction("blocks", "readonly");
                      const blockStore = blockTx.objectStore("blocks");
                      blockStore.get(parseInt(blockId)).onsuccess = function(e) {
                        const block = e.target.result;
                        if (block) {
                          resolveBlock({
                            id: block.id,
                            title: block.title || `Block ${block.id}`,
                            text: block.content
                          });
                        } else {
                          resolveBlock({
                            id: blockId,
                            title: `Unknown Block ${blockId}`,
                            text: `Block with ID ${blockId} not found`,
                            error: true
                          });
                        }
                      };
                    })
                  );
                });
              }
              
              Promise.all(refBlockPromises).then(refBlocks => {
                resolve({
                  id: `${doc.id}-${item.paraIndex}`,
                  docTitle: doc.title,
                  paragraphNumber: item.paraIndex + 1,
                  text: para.content,
                  tags: para.tags,
                  refBlocks: refBlocks
                });
              });
            } else {
              resolve({
                id: item.id,
                text: `Paragraph not found`,
                error: true
              });
            }
          };
        })
      );
    }
  }
  
  // Wait for all blocks to be fetched
  const blocks = await Promise.all(blockFetchPromises);
  for (const block of blocks) {
    contentParts.push(`# Block: ${block.title}\n\n${block.text || ""}`);
  }
  
  // Wait for all paragraphs and their referenced blocks
  const paragraphs = await Promise.all(paragraphFetchPromises);
  for (const para of paragraphs) {
    contentParts.push(`# Paragraph ${para.paragraphNumber} from "${para.docTitle}"\n\n${para.text || ""}`);
    
    // Add referenced blocks for this paragraph
    if (para.refBlocks && para.refBlocks.length) {
      for (const refBlock of para.refBlocks) {
        contentParts.push(`## Referenced Block: ${refBlock.title}\n\n${refBlock.text}`);
      }
    }
  }
  
  // If nothing was selected, use the text from input instead
  if (contentParts.length === 0) {
    const inputContent = $("#actionTestInput").val().trim();
    if (inputContent) {
      contentParts.push(inputContent);
    }
  }
  
  return contentParts.join("\n\n---\n\n");
}

// Load tags for selection
function loadTagsForSelection(searchTerm = "") {
  const tagsCloud = $(".tag-selection-cloud");
  tagsCloud.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading tags...</div>');
  
  const tagCounts = {};
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      try {
        const block = cursor.value;
        
        // Completely safe check for tags that doesn't rely on accessing length property
        if (block && typeof block === 'object') {
          const tags = block.tags;
          
          // Only process if tags is an array with elements
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              // Skip empty, null, or undefined tags
              if (!tag) return;
              
              // Skip if doesn't match search term
              if (searchTerm && tag.toLowerCase().indexOf(searchTerm.toLowerCase()) === -1) {
                return;
              }
              
              // Count this tag
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          }
        }
      } catch (error) {
        console.error("Error processing block:", error);
      }
      
      // Continue to next cursor regardless of any errors
      cursor.continue();
    } else {
      // After counting all tags, display them
      if (Object.keys(tagCounts).length === 0) {
        tagsCloud.html('<p class="text-center text-muted">No tags found matching your search.</p>');
        return;
      }
      
      // Sort tags by frequency
      const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
      let tagsHtml = '';
      
      sortedTags.forEach(tag => {
        const count = tagCounts[tag];
        tagsHtml += `
          <button class="btn btn-outline-info m-1 selectable-tag" data-tag="${tag}">
            ${tag} <span class="badge badge-light">${count}</span>
          </button>
        `;
      });
      
      tagsCloud.html(tagsHtml);
      
      // Add event handlers for tag selection
      $(".selectable-tag").click(function() {
        const tag = $(this).data("tag");
        loadContentByTagForSelection(tag);
      });
    }
  };
}

// Load references for selection
function loadReferencesForSelection(searchTerm = "") {
  const referencesList = $(".reference-selection-list");
  referencesList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading references...</div>');
  
  const transaction = db.transaction("standards", "readonly");
  const store = transaction.objectStore("standards");
  let referencesHtml = '';
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const std = cursor.value;
      const searchableText = (std.id + " " + std.name).toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        referencesHtml += `
          <div class="card mb-2 selectable-reference" data-id="${std.id}">
            <div class="card-body py-2">
              <strong>${std.id} - ${std.name}</strong>
              <button class="btn btn-sm btn-outline-primary float-right load-ref-blocks-btn">
                Load Blocks
              </button>
            </div>
          </div>
        `;
      }
      cursor.continue();
    } else {
      if (referencesHtml) {
        referencesList.html(referencesHtml);
        
        // Add event handlers for reference selection
        $(".load-ref-blocks-btn").on("click", function() {
          const refId = $(this).closest(".selectable-reference").data("id");
          loadBlocksForReference(refId);
        });
      } else {
        referencesList.html('<p class="text-center text-muted">No references found matching your search.</p>');
      }
    }
  };
}

// Load blocks for a selected reference
function loadBlocksForReference(referenceId) {
  const blocksList = $(".reference-blocks-list");
  blocksList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading blocks...</div>');
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  const blocksForReference = [];
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.standard === referenceId) {
        blocksForReference.push(block);
      }
      cursor.continue();
    } else {
      if (blocksForReference.length === 0) {
        blocksList.html('<p class="text-center text-muted">No blocks found for this reference.</p>');
        return;
      }
      
      // Sort blocks by levels
      blocksForReference.sort((a, b) => {
        let al = a.stdLevels || [];
        let bl = b.stdLevels || [];
        for(let i = 0; i < Math.max(al.length, bl.length); i++){
          let av = al[i] || 0;
          let bv = bl[i] || 0;
          if(av !== bv) return av - bv;
        }
        return 0;
      });
      
      let blocksHtml = '';
      
      blocksForReference.forEach(block => {
        const title = block.title || "Block " + block.id;
        const text = (typeof block.text === "string") ? block.text : "";
        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
        const levelStr = block.stdLevels && block.stdLevels.length > 0 ? 
          `<span class="badge badge-primary mr-2">${block.stdLevels.join(".")}</span>` : '';
        
        blocksHtml += `
          <div class="card mb-2 selectable-block" data-id="${block.id}" data-type="block" data-title="${title}">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="ref-block-${block.id}">
                <label class="form-check-label w-100" for="ref-block-${block.id}">
                  <div>${levelStr}<strong>${title}</strong></div>
                  <p class="mb-0 text-muted small">${preview}</p>
                </label>
              </div>
            </div>
          </div>
        `;
      });
      
      blocksList.html(blocksHtml);
      
      // Add event handlers for block selection
      $(".reference-blocks-list .select-content-item").on("change", function() {
        const block = $(this).closest(".selectable-block");
        const blockId = block.data("id");
        const blockTitle = block.data("title");
        const selectionMode = $("#contentSelectionModal").data("selection-mode");
        
        if ($(this).prop("checked")) {
          if (selectionMode === "single" && selectedContentItems.length > 0) {
            // Uncheck all other checkboxes
            $(".select-content-item").not(this).prop("checked", false);
            // Clear the selection array
            selectedContentItems = [];
          }
          
          // Add to selected items
          selectedContentItems.push({
            id: blockId,
            type: "block",
            title: blockTitle
          });
        } else {
          // Remove from selected items
          selectedContentItems = selectedContentItems.filter(item => 
            !(item.type === "block" && item.id === blockId)
          );
        }
        
        updateSelectedItemsUI();
      });
    }
  };
}

// Load content by tag for selection
function loadContentByTagForSelection(tag) {
  if (!tag) {
    console.error("Cannot load content for undefined tag");
    $(".tagged-items-list").html('<p class="text-center text-muted">Invalid tag specified.</p>');
    return;
  }

  const taggedItemsList = $(".tagged-items-list");
  taggedItemsList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading content...</div>');
  
  // Arrays to collect results
  const taggedBlocks = [];
  const taggedParagraphs = [];
  let blocksLoaded = false;
  let paragraphsLoaded = false;
  
  // Load blocks with the tag
  const blockTx = db.transaction("blocks", "readonly");
  const blockStore = blockTx.objectStore("blocks");
  
  blockStore.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      try {
        const block = cursor.value;
        if (block && Array.isArray(block.tags) && block.tags.includes(tag)) {
          taggedBlocks.push(block);
        }
      } catch (error) {
        console.error("Error checking block tags:", error);
      }
      cursor.continue();
    } else {
      blocksLoaded = true;
      renderResults();
    }
  };
  
  // Load paragraphs with the tag
  const docTx = db.transaction("documents", "readonly");
  const docStore = docTx.objectStore("documents");
  
  docStore.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      try {
        const doc = cursor.value;
        if (doc && Array.isArray(doc.paragraphs)) {
          doc.paragraphs.forEach((para, index) => {
            if (para && Array.isArray(para.tags) && para.tags.includes(tag)) {
              taggedParagraphs.push({
                docId: doc.id,
                docTitle: doc.title || `Document ${doc.id}`,
                index: index,
                content: para.content || ""
              });
            }
          });
        }
      } catch (error) {
        console.error("Error checking paragraph tags:", error);
      }
      cursor.continue();
    } else {
      paragraphsLoaded = true;
      renderResults();
    }
  };
  
  // Function to render results once both are loaded
  function renderResults() {
    if (!blocksLoaded || !paragraphsLoaded) return;
    
    if (taggedBlocks.length === 0 && taggedParagraphs.length === 0) {
      taggedItemsList.html('<p class="text-center text-muted">No content found with this tag.</p>');
      return;
    }
    
    let resultsHtml = '';
    
    // Add blocks
    if (taggedBlocks.length > 0) {
      resultsHtml += '<h6 class="mt-2">Blocks:</h6>';
      taggedBlocks.forEach(block => {
        const title = block.title || "Block " + block.id;
        const text = (typeof block.text === "string") ? block.text : "";
        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
        
        resultsHtml += `
          <div class="card mb-2 selectable-tag-item" data-id="${block.id}" data-type="block" data-title="${title}">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="tag-block-${block.id}">
                <label class="form-check-label w-100" for="tag-block-${block.id}">
                  <strong>${title}</strong>
                  <p class="mb-0 text-muted small">${preview}</p>
                </label>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    // Add paragraphs
    if (taggedParagraphs.length > 0) {
      resultsHtml += '<h6 class="mt-3">Document Paragraphs:</h6>';
      taggedParagraphs.forEach(para => {
        const preview = para.content.length > 100 ? para.content.substring(0, 100) + "..." : para.content;
        
        resultsHtml += `
          <div class="card mb-2 selectable-tag-item" data-id="${para.docId}-${para.index}" 
               data-doc-id="${para.docId}" data-para-index="${para.index}" 
               data-doc-title="${para.docTitle}" data-type="paragraph">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="tag-para-${para.docId}-${para.index}">
                <label class="form-check-label w-100" for="tag-para-${para.docId}-${para.index}">
                  <strong>Paragraph ${para.index + 1} from ${para.docTitle}</strong>
                  <p class="mb-0 text-muted small">${preview}</p>
                </label>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    taggedItemsList.html(resultsHtml);
    
    // Add event handlers for item selection
    $(".selectable-tag-item .select-content-item").change(function() {
      const item = $(this).closest(".selectable-tag-item");
      const itemId = item.data("id");
      const itemType = item.data("type");
      const selectionMode = $("#contentSelectionModal").data("selection-mode");
      
      if ($(this).prop("checked")) {
        if (selectionMode === "single" && selectedContentItems.length > 0) {
          // Uncheck all other checkboxes
          $(".select-content-item").not(this).prop("checked", false);
          // Clear the selection array
          selectedContentItems = [];
        }
        
        if (itemType === "block") {
          // Add block to selected items
          selectedContentItems.push({
            id: itemId,
            type: "block",
            title: item.data("title")
          });
        } else if (itemType === "paragraph") {
          // Add paragraph to selected items
          selectedContentItems.push({
            id: itemId,
            docId: item.data("doc-id"),
            paraIndex: item.data("para-index"),
            type: "paragraph",
            title: `Paragraph ${item.data("para-index") + 1} from ${item.data("doc-title")}`
          });
        }
      } else {
        // Remove from selected items
        selectedContentItems = selectedContentItems.filter(selItem => 
          !(selItem.type === itemType && selItem.id.toString() === itemId.toString())
        );
      }
      
      updateSelectedItemsUI();
    });
  }
}

// Call OpenAI API
async function callOpenAiApi(prompt, action, content) {
  try {
    // Fetch the API key from localStorage if not already defined
    const openaiApiKey = localStorage.getItem('openai_api_key');
    
    // Check if API key exists
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is missing. Please add it in the Settings tab.');
    }
    
    // Prepare the request payload
    const payload = {
      model: action.model || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: content }
      ],
      temperature: parseFloat(action.temperature) || 0.7,
      max_tokens: 800
    };
    
    // Add web search option if the model supports it
    if (action.enablewebsearch) {
      payload.web_search_options = {};
    }

    // Add tools definition if enabled
    if (action.useTools && action.toolsDefinition) {
      try {
        const parsedTools = JSON.parse(action.toolsDefinition);
        payload.tools = Array.isArray(parsedTools) ? parsedTools : [parsedTools];
        // show tools in the console for debugging
        console.log("Tools:", payload.tools);
      } catch (error) {
        throw new Error("Invalid tools definition JSON");
      }
    }

    // Delete temperature if web search is used, because it is not supported
    if (action.enablewebsearch) {
      delete payload.temperature;
    }
    
    // Make the API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    // Handle errors
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }
    
    // Parse and return the response
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
}

// Run the action with assembled content
function runActionWithContent(actionId, content) {
  // Get the action
  const transaction = db.transaction("actions", "readonly");
  const store = transaction.objectStore("actions");
  
  store.get(parseInt(actionId)).onsuccess = function(e) {
    const action = e.target.result;
    if (!action) {
      $("#actionResultContainer").html('<div class="alert alert-danger">Action not found</div>');
      return;
    }

    // Fetch the API key from localStorage
    const openaiApiKey = localStorage.getItem('openai_api_key');

    // Combine selected content with the input text if provided
    const inputText = $("#actionTestInput").val().trim();
    if (inputText) {
      content = content + "\n\n---\n\n" + inputText;
    }
    
    // Show the content preview
    const contentPreview = $(`
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>Content Preview</span>
          <button class="btn btn-sm btn-outline-secondary toggle-content-btn">
            <i class="fas fa-eye-slash"></i> Hide
          </button>
        </div>
        <div class="card-body content-preview-body">
          <div class="alert alert-info">
            <small class="text-muted">This is the content that will be processed:</small>
          </div>
            <pre class="bg-light p-2 border rounded" id="combinedContent">${content || '<em>No content provided</em>'}</pre>
        </div>
      </div>
    `);
    
    // Add toggle functionality
    contentPreview.find('.toggle-content-btn').on('click', function() {
      const previewBody = contentPreview.find('.content-preview-body');
      const btn = $(this);
      
      if (previewBody.is(':visible')) {
        previewBody.slideUp();
        btn.html('<i class="fas fa-eye"></i> Show');
      } else {
        previewBody.slideDown();
        btn.html('<i class="fas fa-eye-slash"></i> Hide');
      }
    });
    
    // Replace the content placeholder in the prompt
    const processedPrompt = action.prompt.replace(/{content}/g, content || "");
    
    // Check if OpenAI API key is available
    if (!openaiApiKey) {
      $("#actionResultContainer").html(`
        <div class="alert alert-warning">
          <strong>API Key Missing!</strong> Please add your OpenAI API key in the Settings tab to use this feature.
        </div>
      `);
      return;
    }
    
    // Show loading state with content preview
    $("#actionResultContainer").html('');
    $("#actionResultContainer").append(contentPreview);
    $("#actionResultContainer").append('<div class="text-center my-3"><i class="fas fa-spinner fa-spin"></i> Processing your request...</div>');

    // Call the OpenAI API
    callOpenAiApi(processedPrompt, action, content).then(response => {
      // Keep the content preview and add results below it
      $("#actionResultContainer").find('.text-center').remove(); // Remove loading indicator
      
      const resultCard = $(`
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>Result</span>
            <div class="btn-group">
              <button class="btn btn-sm btn-outline-primary copy-result-btn">
                <i class="fas fa-copy"></i> Copy
              </button>
              <button class="btn btn-sm btn-outline-success save-as-paragraph-btn">
                <i class="fas fa-save"></i> Save as Paragraph
              </button>
            </div>
          </div>
          <div class="card-body">
            <pre class="bg-light p-3 border rounded">${response}</pre>
          </div>
        </div>
      `);
      
      $("#actionResultContainer").append(resultCard);
      
      // Store the raw result for copying and saving
      $("#actionResultContainer").data("raw-result", response);
      
      // Add event handler for copying result
      $(".copy-result-btn").click(function() {
        copyTextToClipboard(response);
      });
      
      // Add event handler for saving result as paragraph
      $(".save-as-paragraph-btn").click(function() {
        saveResultAsParagraph(response);
      });
    }).catch(error => {
      // Keep the content preview and add error below it
      $("#actionResultContainer").find('.text-center').remove(); // Remove loading indicator
      $("#actionResultContainer").append(`
        <div class="alert alert-danger">
          <strong>Error:</strong> ${error.message || error}
        </div>
      `);
    });
  };
}

// Function to copy text to clipboard
function copyTextToClipboard(text) {
  // Create a temporary textarea element to hold the text
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  
  // Select the text and copy it
  textarea.select();
  document.execCommand('copy');
  
  // Remove the textarea
  document.body.removeChild(textarea);
  
  // Show notification
  showNotification("Results copied to clipboard!");
}

// Function to save result as a paragraph in the document form
function saveResultAsParagraph(text) {
  // Switch to Documents tab
  $('#viewTabs a[href="#documentsView"]').tab('show');
  
  // Add a new paragraph if there's not already one
  if ($("#paragraphContainer").children().length === 0) {
    addParagraph();
  } else {
    // Otherwise, add a new paragraph at the end
    addParagraph();
  }
  
  // Get the last paragraph added and set its content
  const lastParagraph = $("#paragraphContainer .paragraph-block").last();
  lastParagraph.find(".docParagraph").val(text);
  
  // Show notification
  showNotification("Results added as a new paragraph!", "success");
}
