/**
 * Actions management module
 */

/**
 * Load actions with optional search filtering
 * @param {string} searchTerm - Optional search term
 */
function loadActions(searchTerm = "") {
  $("#actionsList").empty();
  
  if (!db) {
    $("#actionsList").append('<li class="list-group-item text-danger">Database not available. Please refresh the page.</li>');
    return;
  }
  
  const transaction = db.transaction("actions", "readonly");
  const store = transaction.objectStore("actions");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const action = cursor.value;
      const searchableText = (
        action.title + " " + 
        action.description + " " + 
        (action.tags ? action.tags.join(" ") : "")
      ).toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        const li = $("<li>")
          .addClass("list-group-item list-item")
          .html(`<strong>${action.title}</strong><br><small>${action.description || ""}</small>`)
          .click(function() { previewAction(action); });
        
        if (action.tags && action.tags.length) {
          const tagsSpan = $("<div>")
            .addClass("mt-1")
            .html(action.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join(""));
          li.append(tagsSpan);
        }
        
        $("#actionsList").append(li);
      }
      cursor.continue();
    }
  };
}

/**
 * Preview an action
 * @param {Object} action - The action to preview
 */
function previewAction(action) {
  let html = `
    <div class="card-header">${action.title}
      <div class="btn-group float-right">
        <button class="btn btn-sm btn-warning action-btn" id="editActionBtn">Edit</button>
        <button class="btn btn-sm btn-danger action-btn" id="deleteActionBtn">Delete</button>
      </div>
    </div>
    <div class="card-body">
      <p>${action.description || "<em>No description</em>"}</p>
      
      <div class="row mb-3">
        <div class="col-md-4">
          <strong>AI Model:</strong><br>
          ${action.model || "gpt-3.5-turbo"}
        </div>
        <div class="col-md-4">
          <strong>Purpose:</strong><br>
          ${action.purpose || "generate"}
        </div>
        <div class="col-md-4">
          <strong>Web Search:</strong><br>
          ${action.enablewebsearch ? "Enabled" : "Disabled"}
        </div>
        <div class="col-md-4">
          <strong>Temperature:</strong><br>
          ${action.temperature || "0.7"}
        </div>
      </div>
      
      <div class="mb-3">
        <strong>Tags:</strong><br>
        ${action.tags && action.tags.length ? 
          action.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join("") : 
          "<em>No tags</em>"}
      </div>
      
      <div>
        <strong>Prompt Template:</strong>
        <pre class="bg-light p-2 border rounded">${action.prompt}</pre>
      </div>
    </div>
  `;
  
  $("#actionPreview").html(html);
  $("#runActionBtn").prop("disabled", false);
  $("#runActionBtn").data("action-id", action.id);
  
  //edit and delete buttons
  $("#editActionBtn").off("click").on("click", function(e) {
    e.stopPropagation();
    editAction(action);
  });

  $("#deleteActionBtn").off("click").on("click", function(e) {
    e.stopPropagation();
    deleteAction(action.id);
  });
  
  selectedActionId = action.id;
}

/**
 * Edit an action
 * @param {Object} action - The action to edit
 */
function editAction(action) {
  editingActionId = action.id;
  $("#actionTitle").val(action.title);
  $("#actionDescription").val(action.description || "");
  $("#actionTags").val(action.tags ? action.tags.join(", ") : "");
  $("#actionModel").val(action.model || "gpt-3.5-turbo");
  $("#actionPurpose").val(action.purpose || "generate");
  $("#actionTemperature").val(action.temperature || "0.7");
  $("#tempValue").text(action.temperature || "0.7");
  $("#enableWebSearch").prop("checked", action.enablewebsearch || false);

  $("#useTools").prop("checked", action.useTools || false).trigger("change");
  $("#toolsDefinition").val(action.toolsDefinition || "");

  $("#actionPrompt").val(action.prompt);
  $("#saveActionBtn").text("Update Action");
  // focus on the title field
  $("#actionForm").show();
  $("#actionTitle").focus();
}

/**
 * Delete an action
 * @param {number} id - The action ID to delete
 */
function deleteAction(id) {
  if (confirm("Are you sure you want to delete this action?")) {
    if (!db) {
      showNotification("Database not available. Please refresh the page.", "danger");
      return;
    }
    
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

/**
 * Reset the action form
 */
function resetActionForm() {
  editingActionId = null;
  $("#actionForm")[0].reset();
  $("#tempValue").text("0.7");
  $("#saveActionBtn").text("Save Action");
  $("#actionPreview").html('<p class="text-muted">Select an action to preview its settings and prompt template.</p>');
  $("#runActionBtn").prop("disabled", true);
}

/**
 * Handle action form submission
 * @param {Event} e - Form submission event
 */
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
  
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
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

/**
 * Prepare action execution
 * Shows a modal for selecting content
 */
function prepareActionExecution() {
  const actionId = selectedActionId;
  
  if (!actionId) {
    showNotification("Please select an action first", "warning");
    return;
  }
  
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("actions", "readonly");
  const store = transaction.objectStore("actions");
  
  store.get(parseInt(actionId)).onsuccess = function(e) {
    const action = e.target.result;
    if (!action) {
      showNotification("Action not found", "danger");
      return;
    }
    
    selectedContentItems = [];
    updateSelectedItemsUI();
    
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
    
    $(".action-selection-info").text(selectionInfo);
    $("#contentSelectionModal").data("selection-mode", selectionMode);
    
    // Reset any existing tabs and load fresh content
    loadBlocksForSelection();
    loadDocumentsForSelection();
    loadTagsForSelection();
    loadReferencesForSelection();
    
    // Enable the selection modal
    $("#contentSelectionModal").modal("show");
  };
}

/**
 * Load blocks for selection
 * @param {string} searchTerm - Optional search term
 */
function loadBlocksForSelection(searchTerm = "") {
  const blocksList = $(".block-selection-list");
  blocksList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading blocks...</div>');
  
  if (!db) {
    blocksList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  let blocksHtml = '';
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      const searchableText = (
        (block.title || "") + " " + 
        block.text + " " + 
        (block.tags ? block.tags.join(" ") : "") + " " + 
        (block.reference || "")
      ).toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        const title = block.title || "Block " + block.id;
        const preview = block.text.length > 100 ? block.text.substring(0, 100) + "..." : block.text;
        
        blocksHtml += `
          <div class="card mb-2 selectable-block" data-id="${block.id}" data-type="block" data-title="${title}">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="block-${block.id}">
                <label class="form-check-label w-100" for="block-${block.id}">
                  <strong>${title}</strong> <small class="text-muted">(ID: ${block.id})</small><br>
                  <small>${preview}</small>
                  ${block.tags && block.tags.length ? 
                    `<div class="mt-1">${block.tags.map(t => `<span class="badge badge-info">${t}</span>`).join(' ')}</div>` : ''}
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
        
        $(".selectable-block .select-content-item").on("change", function() {
          const block = $(this).closest(".selectable-block");
          const blockId = block.data("id");
          const blockTitle = block.data("title");
          const selectionMode = $("#contentSelectionModal").data("selection-mode");
          
          if ($(this).prop("checked")) {
            if (selectionMode === "single" && selectedContentItems.length > 0) {
              $(".select-content-item").not(this).prop("checked", false);
              selectedContentItems = [];
            }
            
            selectedContentItems.push({
              id: blockId,
              type: "block",
              title: blockTitle
            });
          } else {
            selectedContentItems = selectedContentItems.filter(item => 
              !(item.type === "block" && item.id === blockId)
            );
          }
          
          updateSelectedItemsUI();
        });
        
      } else {
        blocksList.html('<p class="text-center text-muted">No blocks found matching your search.</p>');
      }
    }
  };
}

/**
 * Load documents for selection
 * @param {string} searchTerm - Optional search term
 */
function loadDocumentsForSelection(searchTerm = "") {
  const docsList = $(".document-selection-list");
  docsList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>');
  
  if (!db) {
    docsList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
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
                Show Paragraphs
              </button>
            </div>
          </div>
        `;
      }
      cursor.continue();
    } else {
      if (docsHtml) {
        docsList.html(docsHtml);
        
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

/**
 * Load paragraphs for selection
 * @param {number} docId - The document ID
 */
function loadParagraphsForSelection(docId) {
  const paragraphsList = $(".paragraph-selection-list");
  paragraphsList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading paragraphs...</div>');
  
  if (!db) {
    paragraphsList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
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
                  <strong>Paragraph ${index + 1}</strong> <small class="text-muted">(Document: ${doc.title})</small><br>
                  <small>${preview}</small>
                  ${para.tags && para.tags.length ? 
                    `<div class="mt-1">${para.tags.map(t => `<span class="badge badge-info">${t}</span>`).join(' ')}</div>` : ''}
                </label>
              </div>
            </div>
          </div>
        `;
      });
      
      paragraphsList.html(paragraphsHtml);
      
      $(".selectable-paragraph .select-content-item").on("change", function() {
        const paragraph = $(this).closest(".selectable-paragraph");
        const docId = paragraph.data("doc-id");
        const paraIndex = paragraph.data("para-index");
        const docTitle = paragraph.data("doc-title");
        const itemId = `${docId}-${paraIndex}`;
        const selectionMode = $("#contentSelectionModal").data("selection-mode");
        
        if ($(this).prop("checked")) {
          if (selectionMode === "single" && selectedContentItems.length > 0) {
            $(".select-content-item").not(this).prop("checked", false);
            selectedContentItems = [];
          }
          
          selectedContentItems.push({
            id: itemId,
            docId: docId,
            paraIndex: paraIndex,
            type: "paragraph",
            title: `Paragraph ${paraIndex + 1} from ${docTitle}`
          });
        } else {
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

/**
 * Load references for selection
 * @param {string} searchTerm - Optional search term
 */
function loadReferencesForSelection(searchTerm = "") {
  const referencesList = $(".reference-selection-list");
  referencesList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading references...</div>');
  
  if (!db) {
    referencesList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
  const transaction = db.transaction("references", "readonly");
  const store = transaction.objectStore("references");
  let referencesHtml = '';
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const reference = cursor.value;
      const searchableText = (reference.id + " " + reference.name + " " + (reference.description || "")).toLowerCase();
      
      if (!searchTerm || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        referencesHtml += `
          <div class="card mb-2 selectable-reference" data-id="${reference.id}" data-name="${reference.name}">
            <div class="card-body py-2">
              <strong>${reference.id}</strong> - ${reference.name}
              ${reference.type ? `<span class="badge badge-secondary ml-1">${reference.type}</span>` : ''}
            </div>
          </div>
        `;
      }
      cursor.continue();
    } else {
      if (referencesHtml) {
        referencesList.html(referencesHtml);
        
        $(".selectable-reference").click(function() {
          $(".selectable-reference").removeClass("active");
          $(this).addClass("active");
          
          const referenceId = $(this).data("id");
          loadBlocksForReference(referenceId);
        });
      } else {
        referencesList.html('<p class="text-center text-muted">No references found matching your search.</p>');
      }
    }
  };
}

/**
 * Load blocks for a reference
 * @param {string} referenceId - The reference ID
 */
function loadBlocksForReference(referenceId) {
  const blocksList = $(".reference-blocks-list");
  blocksList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading blocks...</div>');
  
  if (!db) {
    blocksList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  const blocksForReference = [];
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.reference === referenceId) {
        blocksForReference.push(block);
      }
      cursor.continue();
    } else {
      // Sort blocks by reference levels
      blocksForReference.sort((a, b) => {
        let al = a.refLevels || [];
        let bl = b.refLevels || [];
        for(let i = 0; i < Math.max(al.length, bl.length); i++){
          let av = al[i] || 0;
          let bv = bl[i] || 0;
          if(av !== bv) return av - bv;
        }
        return 0;
      });
      
      if (blocksForReference.length > 0) {
        let blocksHtml = '';
        
        blocksForReference.forEach(block => {
          const levelStr = block.refLevels && block.refLevels.length > 0 ? 
            block.refLevels.join(".") + " - " : '';
          const preview = block.text.length > 100 ? block.text.substring(0, 100) + "..." : block.text;
          
          blocksHtml += `
            <div class="card mb-2 selectable-ref-block" data-id="${block.id}" data-type="block" data-title="${block.title || 'Block ' + block.id}">
              <div class="card-body py-2">
                <div class="form-check">
                  <input class="form-check-input select-content-item" type="checkbox" id="ref-block-${block.id}">
                  <label class="form-check-label w-100" for="ref-block-${block.id}">
                    <strong>${levelStr}${block.title || 'Block ' + block.id}</strong> <small class="text-muted">(ID: ${block.id})</small><br>
                    <small>${preview}</small>
                  </label>
                </div>
              </div>
            </div>
          `;
        });
        
        blocksList.html(blocksHtml);
        
        $(".selectable-ref-block .select-content-item").change(function() {
          const block = $(this).closest(".selectable-ref-block");
          const blockId = parseInt(block.data("id"));
          const blockTitle = block.data("title");
          const selectionMode = $("#contentSelectionModal").data("selection-mode");
          
          if ($(this).prop("checked")) {
            if (selectionMode === "single" && selectedContentItems.length > 0) {
              $(".select-content-item").not(this).prop("checked", false);
              selectedContentItems = [];
            }
            
            selectedContentItems.push({
              id: blockId,
              type: "block",
              title: blockTitle
            });
          } else {
            selectedContentItems = selectedContentItems.filter(item => 
              !(item.type === "block" && item.id === blockId)
            );
          }
          
          updateSelectedItemsUI();
        });
      } else {
        blocksList.html('<p class="text-center text-muted">No blocks found for this reference.</p>');
      }
    }
  };
}

/**
 * Update the selected items UI
 */
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
    
    $(".remove-selected-item").on("click", function() {
      const index = $(this).data("index");
      const itemToRemove = selectedContentItems[index];
      
      if (itemToRemove.type === "block") {
        $(`#block-${itemToRemove.id}`).prop("checked", false);
      } else if (itemToRemove.type === "paragraph") {
        $(`#para-${itemToRemove.id}`).prop("checked", false);
      }
      
      selectedContentItems.splice(index, 1);
      updateSelectedItemsUI();
    });
  }
}

/**
 * Assemble content from selected items
 * @returns {Promise<string>} - The assembled content
 */
async function assembleContentFromSelectedItems() {
  let contentParts = [];
  const blockFetchPromises = [];
  const paragraphFetchPromises = [];
  
  for (const item of selectedContentItems) {
    if (item.type === "block") {
      blockFetchPromises.push(
        fetchBlockById(item.id).then(block => {
          if (block) {
            const blockText = `## ${block.title || 'Block ' + block.id}\n${block.text}`;
            return {
              id: block.id,
              text: blockText,
              originalBlock: block
            };
          } else {
            throw new Error(`Block with ID ${item.id} not found`);
          }
        })
      );
    } else if (item.type === "paragraph") {
      paragraphFetchPromises.push(
        fetchDocumentById(item.docId).then(doc => {
          if (doc && doc.paragraphs && doc.paragraphs[item.paraIndex]) {
            const para = doc.paragraphs[item.paraIndex];
            const paraText = `## Paragraph ${parseInt(item.paraIndex) + 1} from ${doc.title}\n${para.content}`;
            
            const blockRefs = para.blockRefs || (para.blockRef ? [para.blockRef] : []);
            const refBlockPromises = blockRefs.map(blockId => 
              fetchBlockById(parseInt(blockId)).then(refBlock => {
                if (refBlock) {
                  return {
                    id: refBlock.id,
                    text: `### Referenced Block: ${refBlock.title || 'Block ' + refBlock.id}\n${refBlock.text}`,
                    originalBlock: refBlock
                  };
                } else {
                  return null;
                }
              }).catch(() => null)
            );
            
            return Promise.all(refBlockPromises).then(refBlocks => {
              const filteredRefBlocks = refBlocks.filter(b => b !== null);
              return {
                id: item.id,
                text: paraText,
                refBlocks: filteredRefBlocks
              };
            });
          } else {
            throw new Error(`Paragraph not found in document ${item.docId}`);
          }
        })
      );
    }
  }
  
  const blocks = await Promise.all(blockFetchPromises);
  for (const block of blocks) {
    contentParts.push(block.text);
  }
  
  const paragraphs = await Promise.all(paragraphFetchPromises);
  for (const para of paragraphs) {
    contentParts.push(para.text);
    
    if (para.refBlocks && para.refBlocks.length) {
      for (const refBlock of para.refBlocks) {
        contentParts.push(refBlock.text);
      }
    }
  }
  
  const inputContent = $("#actionTestInput").val().trim();
  if (inputContent) {
    contentParts.push(inputContent);
  }
  
  return contentParts.join("\n\n---\n\n");
}

/**
 * Run an action with content
 * @param {number} actionId - The action ID
 * @param {string} content - The content to process
 */
function runActionWithContent(actionId, content) {
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("actions", "readonly");
  const store = transaction.objectStore("actions");
  
  store.get(parseInt(actionId)).onsuccess = function(e) {
    const action = e.target.result;
    if (!action) {
      $("#actionResultContainer").html('<div class="alert alert-danger">Action not found</div>');
      return;
    }
    
    const contentPreview = createContentPreview(content, {
      title: "Content Preview",
      additionalHeaderContent: '<small class="text-muted ml-2">Content to be processed</small>',
      containerClass: "card mb-3",
      maxHeight: 300
    });

    
    const processedPrompt = action.prompt.replace(/{content}/g, content || "");
    
    if (!openaiApiKey) {
      $("#actionResultContainer").html(`
        <div class="alert alert-warning">
          <strong>API Key Missing!</strong> Please add your OpenAI API key in the Settings tab to use this feature.
        </div>
      `);
      return;
    }
    
    $("#actionResultContainer").html('');
    $("#actionResultContainer").append(contentPreview);
    $("#actionResultContainer").append('<div class="text-center my-3"><i class="fas fa-spinner fa-spin"></i> Processing your request...</div>');
    
    callOpenAiApi(action, processedPrompt).then(response => {
      $("#actionResultContainer").find('.text-center').remove();
      const resultPreview = createContentPreview(response, {
        title: "Result",
        containerClass: "card",
        additionalFooterContent: `
          <div class="mt-2">
            <button class="btn btn-sm btn-outline-primary copy-result-btn">
              <i class="fas fa-copy"></i> Copy Results
            </button>
            <button class="btn btn-sm btn-outline-success save-as-paragraph-btn">
              <i class="fas fa-save"></i> Save as Paragraph
            </button>
          </div>
        `
      });
      
      $("#actionResultContainer").append(resultPreview);
      $("#actionResultContainer").data("raw-result", response);
      
      // Add event handlers for the buttons
      resultPreview.find(".copy-result-btn").click(function() {
        copyTextToClipboard(response);
      });
      
      resultPreview.find(".save-as-paragraph-btn").click(function() {
        saveResultAsParagraph(response);
      });
    }).catch(error => {
      $("#actionResultContainer").find('.text-center').remove();
      $("#actionResultContainer").append(`
        <div class="alert alert-danger">
          <strong>Error:</strong> ${error.message || error}
        </div>
      `);
    });
  };
}

$(document).ready(function() {
  // Make sure we're properly attaching the event handler to the confirm button
  $("#confirmContentSelection").off("click").on("click", function() {
    // Check if any items are selected
    if (selectedContentItems.length === 0) {
      const selectionMode = $("#contentSelectionModal").data("selection-mode");
      if (selectionMode === "multiple-required" || selectionMode === "single-required") {
        showNotification("Please select at least one item", "warning");
        return;
      }
    }
    
    const workflowStepIndex = $("#contentSelectionModal").data("workflow-step-index");
    
    // If this is for a workflow step, handle it differently
    if (workflowStepIndex !== undefined) {
      const workflow = $('#workflow-execution-modal').data('current-workflow');
      
      // Handle workflow step content selection
      // This logic should be part of your workflow.js
      
    } else {
      // This is for regular action execution
      // Get the content from selected items and run the action
      
      $("#contentSelectionModal").modal("hide");
      
      // Show loading indicator
      $("#actionResultContainer").html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Processing...</div>');
      
      // Get the custom input text if provided
      const customInputText = $("#actionTestInput").val().trim();
      
      // Assemble content from selected items
      assembleContentFromSelectedItems()
        .then(content => {
          // If we have custom text, add it to the assembled content
          const finalContent = customInputText ? 
            (content ? content + "\n\n---\n\n" + customInputText : customInputText) : 
            content;
          
          // Run the action with the assembled content
          runActionWithContent(selectedActionId, finalContent);
        })
        .catch(error => {
          console.error("Error assembling content:", error);
          $("#actionResultContainer").html(`
            <div class="alert alert-danger">
              <strong>Error:</strong> ${error.message || "Failed to assemble content"}
            </div>
          `);
        });
    }
  });
  
  // Add event handler for the confirmation button in the modal footer
  $("#confirmContentSelection").on("click", function() {
    console.log("Confirm button clicked with", selectedContentItems.length, "items selected");
  });
});