/**
 * Block management module
 */

/**
 * Update the block autocomplete data
 */
function updateBlockAutocomplete() {
  blockAutocomplete = [];
  
  if (!db) {
    console.error("Database not initialized");
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      const title = block.title || "Block " + block.id;
      blockAutocomplete.push({ 
        label: title + " (ID:" + block.id + ") - " + block.text + " - " + block.notes, 
        value: block.id 
      });
      cursor.continue();
    }
  };
}

/**
 * Handle block form submission
 * @param {Event} e - Form submission event
 */
function handleBlockFormSubmit(e) {
  e.preventDefault();
  
  // Check database is available
  if (!db) {
    showNotification("Database is not available. Please refresh the page.", "danger");
    return;
  }
  
  const title = $("#blockTitle").val().trim();
  const text = $("#blockText").val().trim();
  const notes = $("#blockNotes").val().trim();
  const tags = $("#blockTags").val().split(",").map(s => s.trim()).filter(s => s);
  // The reference must be selected from the autocomplete (i.e. a valid reference id)
  const reference = $("#blockReference").val().trim();
  let refLevels = [];
  for(let i=1; i<=6; i++){
    let val = $("#blockLevel"+i).val().trim();
    if(val !== "") { refLevels.push(parseInt(val)); } else { break; }
  }
  
  try {
    const transaction = db.transaction("blocks", "readwrite");
    const store = transaction.objectStore("blocks");
    
    // if editing an existing block, update it
    // else add a new block
    if(editingBlockId) {
      store.get(editingBlockId).onsuccess = function(e) {
        let block = e.target.result;
        block.title = title;
        block.text = text;
        block.notes = notes;
        block.tags = tags;
        block.reference = reference;
        block.refLevels = refLevels;
        block.updated = new Date();
        
        store.put(block).onsuccess = function() {
          showNotification("Block updated successfully!");
          editingBlockId = null;
          $("#blockForm")[0].reset();
          $("#blockForm button[type=submit]").text("Add Block");
          loadBlocks();
          updateBlockAutocomplete();
        };
      };
    } else {
      const block = { 
        title, 
        text, 
        notes, 
        tags, 
        reference, 
        refLevels, 
        created: new Date() 
      };
      
      store.add(block).onsuccess = function() {
        showNotification("New block added!");
        $("#blockForm")[0].reset();
        loadBlocks();
        updateBlockAutocomplete();
      };
    }
  } catch (err) {
    console.error("Database error:", err);
    showNotification("Failed to save block. The database might be closing or unavailable. Please try again after refreshing the page.", "danger");
  }
}

/**
 * Load blocks with optional search filtering
 * @param {string} searchTerm - Optional search term
 */
function loadBlocks(searchTerm = "") {
  $("#blockList").empty();
  
  if (!db) {
    $("#blockList").append('<li class="list-group-item text-danger">Database not available. Please refresh the page.</li>');
    return;
  }
  
  try {
    const transaction = db.transaction("blocks", "readonly");
    const store = transaction.objectStore("blocks");
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if(cursor) {
        const block = cursor.value;
        const title = block.title || "Block " + block.id;
        const combinedText = (title + " " + block.text + " " + block.tags.join(" ") + " " + (block.reference || "")).toLowerCase();
        
        if(searchTerm === "" || combinedText.indexOf(searchTerm.toLowerCase()) !== -1) {
          let renderedText = getHighlightedSearchContext(block.text, searchTerm);
          let display = "<strong>" + title + "</strong><br>" + renderedText;
          
          if(block.tags.length) {
            display += " <span class='badge badge-info'>" + block.tags.join("</span> <span class='badge badge-info'>") + "</span><br>";
          }
          
          if(block.reference) {
            display += " <span class='block-reference'>[[" + block.reference;
            if(block.refLevels && block.refLevels.length > 0) { 
              display += " " + block.refLevels.join("."); 
            }
            display += "]]</span>";
          }
          
          const li = $("<li>").addClass("list-group-item list-item").html(display);
          
          // Make the entire list item clickable to show block details
          li.on("click", function() {
            showBlockDetails(block);
          });
          
          $("#blockList").append(li);
        }
        cursor.continue();
      }
    };
  } catch (err) {
    console.error("Database error:", err);
    $("#blockList").append('<li class="list-group-item text-danger">Error loading blocks. Please refresh the page.</li>');
  }
}

/**
 * Edit a block
 * @param {Object} block - The block to edit
 */
function editBlock(block) {
  editingBlockId = block.id;
  $("#blockTitle").val(block.title || "");
  $("#blockText").val(block.text);
  $("#blockNotes").val(block.notes || "");
  $("#blockTags").val(block.tags.join(", "));
  $("#blockReference").val(block.reference || "");
  
  for(let i=1; i<=6; i++){
    $("#blockLevel"+i).val(block.refLevels && block.refLevels[i-1] !== undefined ? block.refLevels[i-1] : "");
  }
  
  $("#blockForm button[type=submit]").text("Update Block");
}

/**
 * Delete a block
 * @param {number} id - The block ID to delete
 */
function deleteBlock(id) {
  if(confirm("Are you sure you want to delete this block?")) {
    if (!db) {
      showNotification("Database not available. Please refresh the page.", "danger");
      return;
    }
    
    try {
      const transaction = db.transaction("blocks", "readwrite");
      const store = transaction.objectStore("blocks");
      
      store.delete(parseInt(id)).onsuccess = function() {
        loadBlocks();
        updateBlockAutocomplete();
        showNotification("Block deleted successfully!");
      };
    } catch (err) {
      console.error("Database error:", err);
      showNotification("Failed to delete block. Please refresh the page and try again.", "danger");
    }
  }
}

/**
 * Universal method to edit a block from anywhere in the UI
 * @param {number} blockId - The block ID to edit
 */
function editBlockUniversal(blockId) {
  if (blockId) {
    if (!db) {
      showNotification("Database not available. Please refresh the page.", "danger");
      return;
    }
    
    try {
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
      store.get(parseInt(blockId)).onsuccess = function(e) {
        const block = e.target.result;
        if (block) {
          // Switch to blocks tab
          $('#viewTabs a[href="#blocksView"]').tab('show');
          
          // Edit the block
          editBlock(block);
          
          // Hide any block detail view that might be open
          $("#blockDetailView").hide();
          
          // Scroll to the edit form
          $('html, body').animate({
            scrollTop: $("#blockForm").offset().top - 100
          }, 500);
        } else {
          showNotification(`Block with ID ${blockId} not found`, "warning");
        }
      };
    } catch (err) {
      console.error("Database error:", err);
      showNotification("Failed to edit block. Please refresh the page and try again.", "danger");
    }
  }
}

/**
 * Shows block details with referencing paragraphs
 * @param {Object} block - The block to display
 */
function showBlockDetails(block) {
  const title = block.title || "Block " + block.id;
  
  // Clear the view 
  $("#blockDetailView").empty().show();
  
  // Create header card
  const headerCard = $(`
    <div class="card mb-3">
      <div class="card-header">
        <strong>${title}</strong> (ID: ${block.id})
        <div class="btn-group float-right">
          <button class="btn btn-sm btn-warning edit-block-btn" data-block-id="${block.id}">Edit</button>
          <button class="btn btn-sm btn-danger delete-block-btn">Delete</button>
        </div>
      </div>
      <div class="card-body" id="blockContentContainer"></div>
    </div>
  `);
  
  // Create a preview for the block content
  const additionalContent = `
    <div class="mt-3">
      <div><strong>Notes:</strong> ${block.notes || "No notes available."}</div>
      
      ${block.tags && block.tags.length ? 
        `<div class="mt-2">Tags: ${block.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}</div>` : ''}
      
      ${block.reference ? 
        `<div class="mt-2">Reference: ${block.reference} ${block.refLevels && block.refLevels.length > 0 ? 
          block.refLevels.join(".") : ""}</div>` : ''}
    </div>
  `;
  
  const contentPreview = createContentPreview(block.text, {
    showControls: false, // No controls needed here
    additionalFooterContent: additionalContent
  });
  
  // Add the block content
  headerCard.find("#blockContentContainer").append(contentPreview);
  
  // Create the referencing paragraphs card
  const referencesCard = $(`
    <div class="card">
      <div class="card-header">Paragraphs Referencing This Block</div>
      <div class="card-body" id="referencingParagraphsList">
        <div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading references...</div>
      </div>
    </div>
  `);
  
  // Add both cards to the view
  $("#blockDetailView").append(headerCard, referencesCard);
  
  // Set up event handlers
  headerCard.find(".delete-block-btn").on("click", function(e) {
    e.stopPropagation(); 
    deleteBlock(block.id);
  });
  
  headerCard.find(".edit-block-btn").on("click", function() {
    editBlockUniversal($(this).data("block-id"));
  });
  
  // Now find paragraphs that reference this block
  findParagraphsReferencingBlock(block.id).then(references => {
    const refList = $("#referencingParagraphsList");
    
    if (references.length === 0) {
      refList.html('<p class="text-muted">No paragraphs are referencing this block.</p>');
      return;
    }
    
    // Clear the loading indicator
    refList.empty();
    
    // Create a container for references
    const referencesContainer = $('<div class="references-container"></div>');
    refList.append(referencesContainer);
    
    // Add each reference
    references.forEach(ref => {
      // Create reference card
      const refCard = $(`
        <div class="mb-3 reference-item">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <strong>Document:</strong> ${ref.docTitle} 
              <br><strong>Paragraph:</strong> ${ref.paraIndex + 1}
            </div>
            <button class="btn btn-sm btn-outline-primary view-document-btn" 
                    data-doc-id="${ref.docId}" data-para-index="${ref.paraIndex}">
              <i class="fas fa-eye"></i> View
            </button>
          </div>
        </div>
      `);
      
      // Create preview for the paragraph content
      const paragraphPreview = createContentPreview(ref.content, {
        showControls: false,
        containerClass: "paragraph-reference-preview"
      });
      
      // Add the preview to the card
      refCard.append(paragraphPreview);
      
      // Add the card to the container
      referencesContainer.append(refCard);
      
      // Add click handler for view button
      refCard.find(".view-document-btn").click(function() {
        const docId = $(this).data("doc-id");
        const paraIndex = $(this).data("para-index");
        
        // Load and display the document
        fetchDocumentById(docId).then(doc => {
          if (doc) {
            previewDocument(doc);
            $("#blockDetailView").hide();
            // Switch to the documents tab
            $('#viewTabs a[href="#documentsView"]').tab('show');
            
            // Highlight the referenced paragraph
            setTimeout(() => {
              const paraElement = $("#docPreviewContent .paragraph-container").eq(paraIndex);
              if (paraElement.length) {
                paraElement.addClass("highlight-paragraph");
                $('html, body').animate({
                  scrollTop: paraElement.offset().top - 100
                }, 500);
                setTimeout(() => paraElement.removeClass("highlight-paragraph"), 120000);
              }
            }, 500);
          }
        }).catch(error => {
          console.error("Error fetching document:", error);
          showNotification("Error loading document: " + error.message, "danger");
        });
      });
    });
  }).catch(error => {
    console.error("Error finding referencing paragraphs:", error);
    $("#referencingParagraphsList").html('<p class="text-danger">Error loading references: ' + error.message + '</p>');
  });
}