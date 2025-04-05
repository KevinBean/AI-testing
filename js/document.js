// Document Management Functions

let editingDocumentId = null;
let blockAutocomplete = []; // Add this line to define blockAutocomplete

// Initialize document view
$(document).ready(function() {
  console.log("Document view initialized");
  
  // Add handlers for the new document preview control buttons
  $("#printDocBtn").click(function() {
    window.print();
  });
  
  $("#expandAllBlocksBtn").click(function() {
    $(".block-content").slideDown();
    $(".toggle-block-btn i").removeClass("fa-chevron-down").addClass("fa-chevron-up");
  });
  
  $("#collapseAllBlocksBtn").click(function() {
    $(".block-content").slideUp();
    $(".toggle-block-btn i").removeClass("fa-chevron-up").addClass("fa-chevron-down");
  });
  
  // Initialize document modal
  $("#createDocumentButton").click(function() {
    // Reset form and prepare modal for creating new document
    $("#documentForm")[0].reset();
    $("#documentModalTitle").text("Create New Document");
    $("#paragraphContainer").empty();
    addParagraph(); // Add an initial paragraph
    editingDocumentId = null; // Use the correct variable
  });
  
  // Add document form submission handler
  $("#saveDocumentButton").click(function(event) {
    event.preventDefault(); // Add this to prevent default behavior
    handleDocumentFormSubmit(event);
  });

  // Add paragraph handler
  $("#addParagraphButton").click(function() {
    addParagraph();
  });
  
  // Search documents handler
  $("#docSearch").on("keyup", function() {
    const searchTerm = $(this).val().trim();
    loadDocuments(searchTerm);
  });
  
  // Live preview button
  $("#livePreviewBtn").click(function() {
    generateDocumentPreview();
  });
  
  // Initialize document list
  loadDocuments();
  
  // Initialize block autocomplete data for document references
  updateBlockAutocomplete();
  
  // Fix: Add event delegation for edit and delete buttons
  $(document).on("click", ".edit-document-btn", function(e) {
    e.stopPropagation();
    const docId = parseInt($(this).data("id"));
    fetchDocumentById(docId, function(doc) {
      editDocument(doc);
      $("#documentModal").modal("show");
    });
  });
  
  $(document).on("click", ".delete-document-btn", function(e) {
    e.stopPropagation();
    const docId = $(this).data("id");
    deleteDocument(docId);
  });
});

// Function to get all block IDs for autocomplete
async function updateBlockAutocomplete() {
  try {
    const db = await ensureDatabaseReady();
    blockAutocomplete = [];
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if(cursor) {
          const block = cursor.value;
          // Create a rich label with content preview
          const contentPreview = block.content ? 
            block.content.substring(0, 60).replace(/\n/g, ' ') + 
            (block.content.length > 60 ? '...' : '') : 'No content';
          
          blockAutocomplete.push({ 
            // Label with title and content snippet for dropdown display
            label: `${block.id} - ${block.title || 'Untitled Block'}: "${contentPreview}"${block.standard ? ` (${block.standard})` : ''}`, 
            // Just the ID for the actual field value
            value: block.id,
            // Store full data for custom rendering
            blockData: {
              id: block.id,
              title: block.title || 'Untitled Block',
              content: block.content || '',
              standard: block.standard || '',
              tags: block.tags || []
            }
          });
          cursor.continue();
        } else {
          console.log("Block autocomplete updated with", blockAutocomplete.length, "items");
          resolve(blockAutocomplete);
        }
      };
      
      transaction.onerror = function(e) {
        console.error("Error updating block autocomplete:", e.target.error);
        reject(e.target.error);
      };
    });
  } catch (err) {
    console.error("Failed to update block autocomplete:", err);
    return [];
  }
}

// Function to fetch document by ID
function fetchDocumentById(id, callback) {
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["documents"], "readonly");
      const store = transaction.objectStore("documents");
      const request = store.get(parseInt(id));
      
      request.onsuccess = function(event) {
        callback(event.target.result);
      };
      
      request.onerror = function(event) {
        console.error("Error fetching document:", event.target.error);
        showNotification("Error loading document", "danger");
      };
    })
    .catch(err => {
      console.error("Database not ready when fetching document:", err);
      showNotification("Database error. Please try again.", "danger");
    });
}

async function loadDocuments(searchTerm = "") {
  console.log("Loading documents with search:", searchTerm);
  
  // Clear and add loading indicator
  $("#docList").html('<li class="list-group-item text-center"><i class="fas fa-spinner fa-spin"></i> Loading documents...</li>');
  
  // Ensure database is ready
  await ensureDatabaseReady();
  
  // Check if db exists
  if (!db) {
    console.error("Database not available for loading documents");
    $("#docList").html(`
      <li class="list-group-item text-danger">
        <i class="fas fa-exclamation-triangle"></i> 
        Database not available. Please refresh the page.
      </li>`);
    return;
  }
  
  try {
    const transaction = db.transaction("documents", "readonly");
    const store = transaction.objectStore("documents");
    let documentsFound = 0;
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        const doc = cursor.value;
        
        // For search, only consider title for now
        if (searchTerm === "" || doc.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          documentsFound++;
          const createdDate = doc.created ? new Date(doc.created).toLocaleDateString() : "";
          
          // Create document list item
          const li = $("<li>")
            .addClass("list-group-item list-item")
            .attr("data-id", doc.id)  // Add data-id attribute
            .html(`
              <strong>${doc.title}</strong>
              ${createdDate ? `<br><small>Created: ${createdDate}</small>` : ""}
            `)
            .click(function() { previewDocument(doc.id); }); // Fix this to use doc.id instead of doc
          
          // Create edit and delete buttons
          const btnGroup = $('<div class="mt-2 action-buttons">');
          
          const editBtn = $("<button>")
            .addClass("btn btn-sm btn-warning action-btn edit-document-btn")
            .html('<i class="fas fa-edit"></i> Edit')
            .attr('data-id', doc.id);
            
          const delBtn = $("<button>")
            .addClass("btn btn-sm btn-danger action-btn delete-document-btn")
            .html('<i class="fas fa-trash-alt"></i> Delete')
            .attr('data-id', doc.id);
            
          btnGroup.append(editBtn, delBtn);
          li.append(btnGroup);
          
          $("#docList").append(li);
        }
        cursor.continue();
      } else {
        // Remove loading indicator if present
        $("#docList .text-center").remove();
        
        console.log(`Found ${documentsFound} documents`);
        
        // Show message if no documents found
        if (documentsFound === 0) {
          if (searchTerm) {
            $("#docList").html(`
              <li class="list-group-item">
                <div class="alert alert-info mb-0">
                  No documents found matching "${searchTerm}"
                </div>
              </li>`);
          } else {
            $("#docList").html(`
              <li class="list-group-item">
                <div class="alert alert-info mb-0">
                  <h5 class="alert-heading">No documents yet</h5>
                  <p>Create your first document using the form on the right.</p>
                </div>
              </li>`);
          }
        }
      }
    };
    
    transaction.onerror = function(event) {
      console.error("Transaction error:", event.target.error);
      $("#docList").html(`
        <li class="list-group-item text-danger">
          <i class="fas fa-exclamation-triangle"></i> 
          Error loading documents. Please try refreshing the page.
        </li>`);
    };
  } catch (err) {
    console.error("Error in loadDocuments:", err);
    $("#docList").html(`
      <li class="list-group-item text-danger">
        <i class="fas fa-exclamation-triangle"></i> 
        Failed to load documents. Please try refreshing the page.
      </li>`);
  }
}

// Add this function to preview a document
function previewDocument(documentId) {
  console.log("Previewing document:", documentId);
  fetchDocumentById(parseInt(documentId), function(doc) {
    if (!doc) {
      showNotification("Document not found", "warning");
      return;
    }
    
    // Generate document preview HTML
    let previewHtml = `
      <h2>${doc.title}</h2>
      <div class="document-metadata mb-3">
        <div class="small text-muted">
          Created: ${doc.created ? new Date(doc.created).toLocaleDateString() : "Unknown"}
          ${doc.updated ? ` • Updated: ${new Date(doc.updated).toLocaleDateString()}` : ""}
        </div>
      </div>
    `;
    
    // Process paragraphs
    if (doc.paragraphs && doc.paragraphs.length > 0) {
      previewHtml += '<div class="document-paragraphs">';
      
      doc.paragraphs.forEach((paragraph, index) => {
        previewHtml += `
          <div class="document-paragraph mb-4">
            ${paragraph.title ? `<h4>${paragraph.title}</h4>` : ''}
            <div class="paragraph-content mb-2">
              ${paragraph.content ? marked.parse(paragraph.content) : ''}
            </div>
        `;
        
        // Process block references
        if (paragraph.blockRefs && paragraph.blockRefs.length > 0) {
          previewHtml += '<div class="paragraph-references">';
          previewHtml += '<div class="referenced-blocks mt-2">';
          
          // Add toggle button for block references
          previewHtml += `
            <button class="btn btn-sm btn-outline-secondary toggle-block-btn mb-2" data-paragraph="${index}">
              <i class="fas fa-chevron-down"></i> Referenced Blocks (${paragraph.blockRefs.length})
            </button>
            <div class="block-content" style="display:none;">
          `;
          
          // Add each block reference
          previewHtml += `<div class="referenced-blocks-container" data-paragraph="${index}">
            <div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading referenced blocks...</div>
          </div>`;
          
          previewHtml += '</div>'; // Close block-content
          previewHtml += '</div>'; // Close referenced-blocks
          previewHtml += '</div>'; // Close paragraph-references
        }
        
        // Add tags if present
        if (paragraph.tags && paragraph.tags.length) {
          previewHtml += `<div class="paragraph-tags mt-2">
            ${paragraph.tags.map(tag => `<span class="badge badge-secondary mr-1">${tag}</span>`).join('')}
          </div>`;
        }
        
        previewHtml += '</div>'; // Close document-paragraph
      });
      
      previewHtml += '</div>'; // Close document-paragraphs
    } else {
      previewHtml += '<div class="alert alert-info">This document has no content.</div>';
    }
    
    // Update the preview section with the generated HTML
    $("#docPreviewContent").html(previewHtml);
    
    // Highlight the selected document
    $("#docList .list-group-item").removeClass("active");
    $(`#docList .list-group-item[data-id="${doc.id}"]`).addClass("active");
    
    // Load referenced blocks after rendering the preview
    loadBlockReferences(doc);
    
    // Set up toggle handlers for block references
    $(".toggle-block-btn").click(function() {
      const content = $(this).next(".block-content");
      content.slideToggle();
      $(this).find("i").toggleClass("fa-chevron-down fa-chevron-up");
    });
  });
}

// Function to load block references
function loadBlockReferences(doc) {
  if (!doc.paragraphs) return;
  
  doc.paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph.blockRefs || paragraph.blockRefs.length === 0) return;
    
    const container = $(`.referenced-blocks-container[data-paragraph="${paragraphIndex}"]`);
    if (!container.length) return;
    
    // Clear loading indicator
    container.empty();
    
    // Load each referenced block
    paragraph.blockRefs.forEach(blockId => {
      fetchBlockById(parseInt(blockId), function(block) {
        if (!block) {
          container.append(`<div class="alert alert-warning mb-2">Block #${blockId} not found</div>`);
          return;
        }
        
        const blockHtml = `
          <div class="referenced-block card mb-2">
            <div class="card-header">
              <strong>Block #${block.id}: ${block.title || 'Untitled'}</strong>
              ${block.standard ? `<span class="badge badge-primary ml-2">${block.standard}</span>` : ''}
            </div>
            <div class="card-body">
              ${marked.parse(block.content || block.text || '')}
              ${block.tags && block.tags.length ? 
                `<div class="block-tags mt-2">${block.tags.map(tag => `<span class="badge badge-secondary mr-1">${tag}</span>`).join('')}</div>` : ''}
            </div>
          </div>
        `;
        
        container.append(blockHtml);
      });
    });
  });
}

function editDocument(doc) {
  if (!doc) {
    showNotification("Document not found", "warning");
    return;
  }
  
  console.log("Editing document:", doc.id);
  
  // Set editing state with the document's ID
  editingDocumentId = doc.id;
  
  // Update form title
  $("#documentModalTitle").text("Edit Document");
  
  // Set document title
  $("#docTitle").val(doc.title || "");
  
  // Clear existing paragraphs
  $("#paragraphContainer").empty();
  
  // Add paragraphs from document
  if (doc.paragraphs && doc.paragraphs.length > 0) {
    doc.paragraphs.forEach(p => {
      addParagraphWithData(p);
    });
  } else {
    // Add at least one paragraph if none exist
    addParagraph();
  }
}

// Function to add paragraph with existing data
function addParagraphWithData(paragraphData) {
  // Create a new paragraph block
  const block = addParagraph();
  
  // Fill in the data
  block.find(".paragraphTitle").val(paragraphData.title || "");
  block.find(".docParagraph").val(paragraphData.content || "");
  
  // Set tags if they exist
  if (paragraphData.tags && paragraphData.tags.length) {
    block.find(".paraTags").val(paragraphData.tags.join(", "));
  }
  
  // Clear existing references
  block.find(".block-references-container").empty();
  
  // Add block references
  const blockRefs = paragraphData.blockRefs || [];
  if (blockRefs.length > 0) {
    blockRefs.forEach(blockRef => {
      addBlockReferenceToContainer(block.find(".block-references-container"), blockRef);
    });
  } else {
    // Add an empty reference field
    addBlockReferenceToContainer(block.find(".block-references-container"));
  }
  
  return block;
}

// Helper function to add a block reference to a container
function addBlockReferenceToContainer(container, blockRefId = null) {
  const refField = $(`
    <div class="input-group mb-2">
      <input type="text" class="blockRef form-control" placeholder="Reference block ID (autocomplete enabled)" ${blockRefId ? `value="${blockRefId}"` : ''}>
      <div class="input-group-append">
        <button class="btn btn-outline-secondary preview-block-btn" type="button" title="Preview referenced block"><i class="fas fa-eye"></i></button>
        <button class="btn btn-outline-info inherit-tags-btn" type="button" title="Inherit tags from block"><i class="fas fa-tags"></i></button>
        <button class="btn btn-outline-danger remove-ref-btn" type="button" title="Remove this reference"><i class="fas fa-times"></i></button>
      </div>
    </div>
  `);
  
  // Set up enhanced autocomplete
  refField.find(".blockRef").autocomplete({
    source: function(request, response) {
      const results = $.ui.autocomplete.filter(blockAutocomplete, request.term);
      response(results.slice(0, 10));
    },
    minLength: 1,
    select: function(event, ui) {
      $(this).val(ui.item.value);
      return false;
    },
    // Enhanced rendering of autocomplete items
    open: function(event, ui) {
      $('.ui-autocomplete').css('width', '500px'); // Make dropdown wider
    }
  })
  .data("ui-autocomplete")._renderItem = function(ul, item) {
    // Custom rendering for each autocomplete item to show rich content
    const $li = $("<li>").addClass("ui-menu-item-with-icon");
    
    // Create a styled div for the item
    const $content = $(`
      <div class="block-autocomplete-item">
        <div class="block-header">
          <strong>#${item.blockData.id} - ${item.blockData.title}</strong>
          ${item.blockData.standard ? `<span class="badge badge-primary ml-2">${item.blockData.standard}</span>` : ''}
        </div>
        <div class="block-preview-text text-muted small">
          ${item.blockData.content.substring(0, 100).replace(/\n/g, ' ')}${item.blockData.content.length > 100 ? '...' : ''}
        </div>
        ${item.blockData.tags && item.blockData.tags.length ? 
          `<div class="block-tags small">
            ${item.blockData.tags.map(tag => `<span class="badge badge-secondary mr-1">${tag}</span>`).join('')}
           </div>` : ''}
      </div>
    `);
    
    $li.append($content);
    return $li.appendTo(ul);
  };
  
  // Set up buttons
  refField.find(".preview-block-btn").click(function() {
    const blockId = $(this).closest(".input-group").find(".blockRef").val();
    if (blockId) {
      previewBlockReference(blockId, $(this).closest(".paragraph-block"));
    } else {
      showNotification("Please enter a block ID first", "warning");
    }
  });
  
  refField.find(".inherit-tags-btn").click(function() {
    const blockId = $(this).closest(".input-group").find(".blockRef").val();
    if (blockId) {
      inheritTagsFromBlock(blockId, $(this).closest(".paragraph-block"));
    } else {
      showNotification("Please enter a block ID first", "warning");
    }
  });
  
  refField.find(".remove-ref-btn").click(function() {
    const numRefs = $(this).closest(".block-references-container").find(".input-group").length;
    if (numRefs > 1) {
      $(this).closest(".input-group").remove();
    } else {
      // Don't remove the last one, just clear it
      $(this).closest(".input-group").find(".blockRef").val("");
    }
  });
  
  container.append(refField);
}

function addParagraph() {
  const block = $(`
    <div class="paragraph-block">
      <div class="btn-group btn-group-sm mb-2 float-right">
        <button type="button" class="btn btn-outline-secondary move-up-btn"><i class="fas fa-arrow-up"></i></button>
        <button type="button" class="btn btn-outline-secondary move-down-btn"><i class="fas fa-arrow-down"></i></button>
        <button type="button" class="btn btn-outline-danger remove-para-btn"><i class="fas fa-trash"></i></button>
      </div>
      <div class="form-group">
        <label>Paragraph Title</label>
        <input type="text" class="form-control paragraphTitle" placeholder="Optional paragraph title">
      </div>
      <label>Paragraph Content (Markdown)</label>
      <textarea class="form-control docParagraph" rows="6" placeholder="Enter markdown content"></textarea>
      
      <div class="row mt-2">
        <div class="col-md-8">
          <label>Reference Blocks <small>(Multiple blocks can be referenced)</small></label>
          <div class="block-references-container">
            <div class="input-group mb-2">
              <input type="text" class="blockRef form-control" placeholder="Reference block ID (autocomplete enabled)">
              <div class="input-group-append">
                <button class="btn btn-outline-secondary preview-block-btn" type="button" title="Preview referenced block"><i class="fas fa-eye"></i></button>
                <button class="btn btn-outline-info inherit-tags-btn" type="button" title="Inherit tags from block"><i class="fas fa-tags"></i></button>
                <button class="btn btn-outline-danger remove-ref-btn" type="button" title="Remove this reference"><i class="fas fa-times"></i></button>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary add-block-ref-btn mt-1"><i class="fas fa-plus"></i> Add Another Block Reference</button>
          <small class="form-text text-muted">Enter block IDs to include references</small>
        </div>
        <div class="col-md-4">
          <label>Paragraph Tags</label>
          <input type="text" class="paraTags form-control" placeholder="tag1, tag2">
          <small class="form-text text-muted">Separate tags with commas</small>
        </div>
      </div>
    </div>
  `);
  $("#paragraphContainer").append(block);
  
  // Set up enhanced autocomplete for blocks
  block.find(".blockRef").autocomplete({
    source: function(request, response) {
      const results = $.ui.autocomplete.filter(blockAutocomplete, request.term);
      response(results.slice(0, 10));
    },
    minLength: 1,
    select: function(event, ui) {
      $(this).val(ui.item.value);
      return false;
    },
    // Enhanced rendering of autocomplete items
    open: function(event, ui) {
      $('.ui-autocomplete').css('width', '500px'); // Make dropdown wider
    }
  })
  .data("ui-autocomplete")._renderItem = function(ul, item) {
    // Custom rendering for each autocomplete item to show rich content
    const $li = $("<li>").addClass("ui-menu-item-with-icon");
    
    // Create a styled div for the item
    const $content = $(`
      <div class="block-autocomplete-item">
        <div class="block-header">
          <strong>#${item.blockData.id} - ${item.blockData.title}</strong>
          ${item.blockData.standard ? `<span class="badge badge-primary ml-2">${item.blockData.standard}</span>` : ''}
        </div>
        <div class="block-preview-text text-muted small">
          ${item.blockData.content.substring(0, 100).replace(/\n/g, ' ')}${item.blockData.content.length > 100 ? '...' : ''}
        </div>
        ${item.blockData.tags && item.blockData.tags.length ? 
          `<div class="block-tags small">
            ${item.blockData.tags.map(tag => `<span class="badge badge-secondary mr-1">${tag}</span>`).join('')}
           </div>` : ''}
      </div>
    `);
    
    $li.append($content);
    return $li.appendTo(ul);
  };
  
  // Set up paragraph control buttons
  block.find(".move-up-btn").click(function() {
    let currentBlock = $(this).closest(".paragraph-block");
    let prevBlock = currentBlock.prev(".paragraph-block");
    if(prevBlock.length) {
      currentBlock.insertBefore(prevBlock);
    }
  });
  
  block.find(".move-down-btn").click(function() {
    let currentBlock = $(this).closest(".paragraph-block");
    let nextBlock = currentBlock.next(".paragraph-block");
    if(nextBlock.length) {
      currentBlock.insertAfter(nextBlock);
    }
  });
  
  block.find(".remove-para-btn").click(function() {
    if(confirm("Are you sure you want to remove this paragraph?")) {
      $(this).closest(".paragraph-block").remove();
    }
  });
  
  // Add block reference button
  block.find(".add-block-ref-btn").click(function() {
    const refContainer = $(this).siblings('.block-references-container');
    const newRef = $(`
      <div class="input-group mb-2">
        <input type="text" class="blockRef form-control" placeholder="Reference block ID (autocomplete enabled)">
        <div class="input-group-append">
          <button class="btn btn-outline-secondary preview-block-btn" type="button" title="Preview referenced block"><i class="fas fa-eye"></i></button>
          <button class="btn btn-outline-info inherit-tags-btn" type="button" title="Inherit tags from block"><i class="fas fa-tags"></i></button>
          <button class="btn btn-outline-danger remove-ref-btn" type="button" title="Remove this reference"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `);
    
    // Set up enhanced autocomplete for the new block reference
    newRef.find(".blockRef").autocomplete({
      source: function(request, response) {
        const results = $.ui.autocomplete.filter(blockAutocomplete, request.term);
        response(results.slice(0, 10));
      },
      minLength: 1,
      select: function(event, ui) {
        $(this).val(ui.item.value);
        return false;
      },
      // Enhanced rendering of autocomplete items
      open: function(event, ui) {
        $('.ui-autocomplete').css('width', '500px'); // Make dropdown wider
      }
    })
    .data("ui-autocomplete")._renderItem = function(ul, item) {
      // Custom rendering for each autocomplete item to show rich content
      const $li = $("<li>").addClass("ui-menu-item-with-icon");
      
      // Create a styled div for the item
      const $content = $(`
        <div class="block-autocomplete-item">
          <div class="block-header">
            <strong>#${item.blockData.id} - ${item.blockData.title}</strong>
            ${item.blockData.standard ? `<span class="badge badge-primary ml-2">${item.blockData.standard}</span>` : ''}
          </div>
          <div class="block-preview-text text-muted small">
            ${item.blockData.content.substring(0, 100).replace(/\n/g, ' ')}${item.blockData.content.length > 100 ? '...' : ''}
          </div>
          ${item.blockData.tags && item.blockData.tags.length ? 
            `<div class="block-tags small">
              ${item.blockData.tags.map(tag => `<span class="badge badge-secondary mr-1">${tag}</span>`).join('')}
             </div>` : ''}
        </div>
      `);
      
      $li.append($content);
      return $li.appendTo(ul);
    };
    
    // Set up the remove button
    newRef.find(".remove-ref-btn").click(function() {
      $(this).closest('.input-group').remove();
    });
    
    // Set up preview button
    newRef.find(".preview-block-btn").click(function() {
      const blockId = $(this).closest(".input-group").find(".blockRef").val();
      if (blockId) {
        previewBlockReference(blockId, $(this).closest(".paragraph-block"));
      } else {
        showNotification("Please enter a block ID first", "warning");
      }
    });
    
    // Set up inherit tags button
    newRef.find(".inherit-tags-btn").click(function() {
      const blockId = $(this).closest(".input-group").find(".blockRef").val();
      if (blockId) {
        inheritTagsFromBlock(blockId, $(this).closest(".paragraph-block"));
      } else {
        showNotification("Please enter a block ID first", "warning");
      }
    });
    
    refContainer.append(newRef);
  });
  
  return block;
}

function handleDocumentFormSubmit(e) {
  if (e) e.preventDefault();
  
  // Check if database is available
  if (!db || db.version === null) {
    showNotification("Database is not available. Please refresh the page.", "danger");
    return;
  }
  
  const title = $("#docTitle").val().trim();
  
  if (!title) {
    showNotification("Document title is required", "warning");
    return;
  }
  
  const paragraphs = [];
  $(".paragraph-block").each(function() {
    const paragraphTitle = $(this).find(".paragraphTitle").val().trim();
    const content = $(this).find(".docParagraph").val();
    
    // Collect all block references
    const blockRefs = [];
    $(this).find(".blockRef").each(function() {
      const refVal = $(this).val().trim();
      if (refVal) {
        blockRefs.push(parseInt(refVal));
      }
    });
    
    // Get paragraph tags
    const tagsStr = $(this).find(".paraTags").val();
    const tags = tagsStr ? tagsStr.split(/,\s*/).filter(t => t.trim()) : [];
    
    paragraphs.push({ 
      title: paragraphTitle,
      content, 
      blockRefs: blockRefs.length > 0 ? blockRefs : [], // Array of block references
      tags: tags 
    });
  });
  
  try {
    const transaction = db.transaction("documents", "readwrite");
    const store = transaction.objectStore("documents");
    
    transaction.onerror = function(event) {
      console.error("Transaction error:", event.target.error);
      showNotification("Error saving document: " + event.target.error.message, "danger");
    };
    
    if (editingDocumentId) {
      console.log("Updating document with ID:", editingDocumentId);
      
      store.get(editingDocumentId).onsuccess = function(e) {
        const doc = e.target.result;
        if (!doc) {
          console.error("Document not found for ID:", editingDocumentId);
          showNotification("Error: Document not found", "danger");
          return;
        }
        
        // Update the document properties
        doc.title = title;
        doc.paragraphs = paragraphs;
        doc.updated = new Date();
        
        // Save the updated document
        const updateRequest = store.put(doc);
        
        updateRequest.onsuccess = function() {
          console.log("Document updated successfully");
          showNotification("Document updated successfully!");
          $("#documentModal").modal("hide");
          editingDocumentId = null;
          $("#documentForm")[0].reset();
          $("#paragraphContainer").empty();
          loadDocuments();
        };
        
        updateRequest.onerror = function(event) {
          console.error("Error updating document:", event.target.error);
          showNotification("Error updating document", "danger");
        };
      };
    } else {
      // Add new document
      const addRequest = store.add({ 
        title, 
        paragraphs, 
        created: new Date() 
      });
      
      addRequest.onsuccess = function() {
        console.log("Document created successfully");
        showNotification("New document created!");
        $("#documentModal").modal("hide");
        $("#documentForm")[0].reset();
        $("#paragraphContainer").empty();
        loadDocuments();
      };
      
      addRequest.onerror = function(event) {
        console.error("Error adding document:", event.target.error);
        showNotification("Error creating document", "danger");
      };
    }
  } catch (err) {
    console.error("Database error:", err);
    showNotification("Failed to save document. The database might be closing or unavailable. Please try again after refreshing the page.", "danger");
  }
}

function deleteDocument(id) {
  if (id && confirm("Are you sure you want to delete this document?")) {
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction("documents", "readwrite");
        const store = transaction.objectStore("documents");
        const request = store.delete(parseInt(id));
        
        request.onsuccess = function() {
          showNotification("Document deleted successfully!", "success");
          loadDocuments();
        };
        
        request.onerror = function(event) {
          console.error("Error deleting document:", event.target.error);
          showNotification("Failed to delete document. Please try again.", "danger");
        };
      })
      .catch(err => {
        console.error("Database error when deleting document:", err);
        showNotification("Database error. Please try refreshing the page.", "danger");
      });
  }
}
