/**
 * Documents management module
 */

/**
 * Add a new paragraph to the document form
 */
function addParagraph() {
  const block = $(`
    <div class="paragraph-block">
      <div class="btn-group btn-group-sm mb-2 float-right">
        <button type="button" class="btn btn-outline-secondary move-up-btn"><i class="fas fa-arrow-up"></i></button>
        <button type="button" class="btn btn-outline-secondary move-down-btn"><i class="fas fa-arrow-down"></i></button>
        <button type="button" class="btn btn-outline-danger remove-para-btn"><i class="fas fa-trash"></i></button>
      </div>
      <label>Paragraph Title</label>
      <input type="text" class="form-control paraTitle mb-2" placeholder="Enter paragraph title (optional)">
      <label>Paragraph Content (Markdown)</label>
      <div class="paragraph-editor mb-3">
        <div class="btn-group mb-2">
          <button type="button" class="btn btn-light insert-bold">Bold</button>
          <button type="button" class="btn btn-light insert-italic">Italic</button>
          <button type="button" class="btn btn-light insert-equation">Equation</button>
          <button type="button" class="btn btn-light insert-mermaid">Mermaid</button>
          <button type="button" class="btn btn-light toggle-preview">Toggle Preview</button>
        </div>
        <textarea class="docParagraph form-control" rows="4" placeholder="Enter paragraph text"></textarea>
        <div class="preview mt-2" style="display:none; border: 1px solid #ccc; padding: 10px;"></div>
      </div>
      
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
  
  // Set up autocomplete for blocks
  block.find(".blockRef").autocomplete({
    source: function(request, response) {
      const results = $.ui.autocomplete.filter(blockAutocomplete, request.term);
      response(results.slice(0, 10));
    },
    minLength: 1,
    select: function(event, ui) {
      $(this).val(ui.item.value);
      return false;
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
    
    // Set up autocomplete for the new block reference
    newRef.find(".blockRef").autocomplete({
      source: function(request, response) {
        const results = $.ui.autocomplete.filter(blockAutocomplete, request.term);
        response(results.slice(0, 10));
      },
      minLength: 1,
      select: function(event, ui) {
        $(this).val(ui.item.value);
        return false;
      }
    });
    
    // Set up the remove button
    newRef.find(".remove-ref-btn").click(function() {
      $(this).closest('.input-group').remove();
    });
    
    // Set up preview button
    newRef.find(".preview-block-btn").click(function() {
      previewReferencedBlock(this);
    });
    
    // Set up inherit tags button
    newRef.find(".inherit-tags-btn").click(function() {
      inheritTagsFromBlock(this);
    });
    
    refContainer.append(newRef);
  });
  
  // Set up autocomplete for tags
  block.find(".paraTags").autocomplete({
    source: function(request, response) {
      const term = request.term.split(/,\s*/).pop();
      const results = $.ui.autocomplete.filter(tagAutocomplete, term);
      response(results.slice(0, 10));
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
  
  // Set up preview block button
  block.find(".preview-block-btn").click(function() {
    previewReferencedBlock(this);
  });
  
  // Set up inherit tags button
  block.find(".inherit-tags-btn").click(function() {
    inheritTagsFromBlock(this);
  });
  
  // Set up remove ref button
  block.find(".remove-ref-btn").click(function() {
    const container = $(this).closest('.block-references-container');
    // Only remove if there's more than one reference
    if (container.find('.input-group').length > 1) {
      $(this).closest('.input-group').remove();
    }
  });
}

/**
 * Preview a referenced block
 * @param {HTMLElement} button - The preview button element
 */
function previewReferencedBlock(button) {
  const blockId = $(button).closest(".input-group").find(".blockRef").val();
  if(blockId) {
    fetchBlockById(parseInt(blockId))
      .then(block => {
        if(block) {
          // REPLACE THIS:
          const previewHtml = `<div class="alert alert-info">
            <strong>Block ${blockId}: ${block.title || ''}</strong> ${renderMarkdown(block.text)}
            ${block.reference ? `<div><strong>Reference:</strong> ${block.reference} 
            ${block.refLevels && block.refLevels.length > 0 ? block.refLevels.join(".") : ""}</div>` : '' }
            ${block.tags && block.tags.length ? `<div><strong>Tags:</strong> ${block.tags.join(", ")}</div>` : '' }
          </div>`;
          
          $(button).closest(".paragraph-block").append(previewHtml);
          renderMermaidIn($(button).closest(".paragraph-block").find(".alert .mermaid"));
          
          setTimeout(() => {
            $(button).closest(".paragraph-block").find(".alert").fadeOut('slow', function() {
              $(this).remove();
            });
          }, 10000);
          
          // WITH THIS:
          const additionalContent = `
            ${block.reference ? `<div><strong>Reference:</strong> ${block.reference} 
            ${block.refLevels && block.refLevels.length > 0 ? block.refLevels.join(".") : ""}</div>` : '' }
            ${block.tags && block.tags.length ? `<div><strong>Tags:</strong> ${block.tags.join(", ")}</div>` : '' }
          `;
          
          const previewElement = createContentPreview(block.text, {
            title: `Block ${blockId}: ${block.title || ''}`,
            containerClass: "alert alert-info",
            additionalFooterContent: additionalContent
          });
          
          $(button).closest(".paragraph-block").append(previewElement);
          
          setTimeout(() => {
            previewElement.fadeOut('slow', function() {
              $(this).remove();
            });
          }, 10000);
        } else {
          alert("Block not found!");
        }
      })
      .catch(error => {
        console.error("Error fetching block:", error);
        alert("Error: " + error.message);
      });
  } else {
    alert("Please enter a block ID first");
  }
}

/**
 * Inherit tags from a referenced block
 * @param {HTMLElement} button - The inherit tags button element
 */
function inheritTagsFromBlock(button) {
  const blockId = $(button).closest(".input-group").find(".blockRef").val();
  if(blockId) {
    fetchBlockById(parseInt(blockId))
      .then(block => {
        if(block && block.tags && block.tags.length) {
          const paraTagsInput = $(button).closest(".paragraph-block").find(".paraTags");
          const currentTags = paraTagsInput.val().split(/,\s*/).filter(t => t.trim());
          
          // Merge existing tags with block tags (no duplicates)
          const mergedTags = [...new Set([...currentTags, ...block.tags])];
          paraTagsInput.val(mergedTags.join(", "));
          
          showNotification("Tags inherited from block", "info");
        } else {
          alert("No tags found in the referenced block");
        }
      })
      .catch(error => {
        console.error("Error fetching block:", error);
        alert("Error: " + error.message);
      });
  } else {
    alert("Please enter a block ID first");
  }
}

/**
 * Preview document live
 */
function previewDocumentLive() {
  // Clear existing content and add title
  $("#docPreviewContent").html(`<h1>${$("#docTitle").val()}</h1>`);
  
  // Process each paragraph
  $(".paragraph-block").each(function(index) {
    const content = $(this).find(".docParagraph").val();
    const paraTitle = $(this).find(".paraTitle").val().trim();
    
    // Get all block references
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
    
    // Create paragraph container
    const paragraphContainer = $(`<div class="mb-3 preview-paragraph" data-index="${index}"></div>`);
    $("#docPreviewContent").append(paragraphContainer);
    
    // Create paragraph title
    const paragraphTitle = paraTitle ? 
      `${paraTitle} (Paragraph ${index+1})` : 
      `Paragraph ${index+1}`;
    
    // Create additional content for tags
    const additionalContent = tags.length ? 
      `<p><small>Tags: ${tags.map(t => `<span class="badge badge-info">${t}</span>`).join(' ')}</small></p>` : 
      '';
    
    // Create content preview for the paragraph
    const paragraphPreview = createContentPreview(content, {
      title: paragraphTitle,
      showControls: false,
      additionalFooterContent: additionalContent
    });
    
    paragraphContainer.append(paragraphPreview);
    
    // Process block references if any
    if (blockRefs.length > 0) {
      const blockRefsContainer = $(`<div class="block-references-container"></div>`);
      paragraphContainer.append(blockRefsContainer);
      
      // Process each block reference
      blockRefs.forEach(blockRef => {
        blockRefsContainer.append(`<p><em>Block Reference: ${blockRef}</em></p>`);
        
        // Add a placeholder while we fetch the block
        const blockPlaceholder = $(`<div class="block-placeholder-${blockRef}">
          <div class="text-center">
            <i class="fas fa-spinner fa-spin"></i> Loading block...
          </div>
        </div>`);
        blockRefsContainer.append(blockPlaceholder);
        
        // Fetch and display the block
        fetchBlockById(blockRef)
          .then(block => {
            if (block) {
              // Create additional content with reference info
              const blockAdditionalContent = `
                ${block.reference ? `<span class="block-reference">[Reference: ${block.reference}
                ${block.refLevels && block.refLevels.length > 0 ? " " + block.refLevels.join(".") : ""}]</span>` : ""} 
                ${block.tags && block.tags.length ? `<small>[Tags: ${block.tags.join(", ")}]</small>` : ""}
                <button class="btn btn-sm btn-warning edit-preview-block-btn ml-2" data-block-id="${block.id}">Edit</button>
              `;
              
              // Create preview for the block
              const blockPreview = createContentPreview(block.text, {
                title: `${block.title || 'Block ' + block.id}`,
                containerClass: "referenced-block-preview text-info",
                showControls: false,
                additionalFooterContent: blockAdditionalContent
              });
              
              // Replace the placeholder with the actual block preview
              blockPlaceholder.replaceWith(blockPreview);
              
              // Add event handler for edit button
              blockPreview.find(".edit-preview-block-btn").on("click", function() {
                const blockId = $(this).data("block-id");
                editBlockUniversal(blockId);
              });
            } else {
              blockPlaceholder.replaceWith(`<p class="text-danger">Block with ID ${blockRef} not found</p>`);
            }
          })
          .catch(error => {
            console.error("Error fetching block:", error);
            blockPlaceholder.replaceWith(`<p class="text-danger">Error loading block ${blockRef}: ${error.message}</p>`);
          });
      });
    }
  });
}

/**
 * Handle document form submission
 * @param {Event} e - Form submission event
 */
function handleDocumentFormSubmit(e) {
  e.preventDefault();
  
  // Check if database is available
  if (!db) {
    showNotification("Database is not available. Please refresh the page.", "danger");
    return;
  }
  
  const title = $("#docTitle").val().trim();
  const paragraphs = [];
  let combinedContent = ""; // This will hold the combined content
  
  $(".paragraph-block").each(function(index) {
    const content = $(this).find(".docParagraph").val();
    const paraTitle = $(this).find(".paraTitle").val().trim();
    
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
      title: paraTitle, // Paragraph title
      content, 
      blockRefs: blockRefs.length > 0 ? blockRefs : [], // Array of block references
      tags: tags 
    });

    // Add to combined content with formatting
    if (paraTitle) {
      combinedContent += `## ${paraTitle}\n\n`;
    } else {
      combinedContent += `## Paragraph ${index + 1}\n\n`;
    }
    combinedContent += content + "\n\n";
  });
  
  try {
    const transaction = db.transaction("documents", "readwrite");
    
    transaction.onerror = function(event) {
      console.error("Transaction error:", event.target.error);
      showNotification("Error saving document: " + event.target.error.message, "danger");
    };
    
    const store = transaction.objectStore("documents");
    if(editingDocumentId) {
      store.get(editingDocumentId).onsuccess = function(e) {
        let doc = e.target.result;
        doc.title = title;
        doc.paragraphs = paragraphs;
        doc.combinedContent = combinedContent; // Add combined content
        doc.updated = new Date();
        store.put(doc).onsuccess = function() {
          showNotification("Document updated successfully!");
          editingDocumentId = null;
          $("#documentForm")[0].reset();
          $("#documentForm button[type=submit]").text("Save Document");
          $("#paragraphContainer").empty();
          addParagraph();
          loadDocuments();
        };
      };
    } else {
      store.add({ 
        title, 
        paragraphs, 
        combinedContent, 
        created: new Date() 
      }).onsuccess = function() {
        showNotification("New document created!");
        $("#documentForm")[0].reset();
        $("#paragraphContainer").empty();
        addParagraph();
        loadDocuments();
      };
    }
  } catch (err) {
    console.error("Database error:", err);
    showNotification("Failed to save document. The database might be closing or unavailable. Please try again after refreshing the page.", "danger");
  }
}

/**
 * Load documents with optional search filtering
 * @param {string} searchTerm - Optional search term
 */
function loadDocuments(searchTerm = "") {
  $("#docList").empty();
  
  // Check if database is available
  if (!db) {
    $("#docList").append('<li class="list-group-item">Database not available. Please refresh the page.</li>');
    return;
  }
  
  try {
    // Use SearchHelper for more powerful searches
    if (searchTerm) {
      SearchHelper.searchDocuments(searchTerm)
        .then(results => {
          if (results.length === 0) {
            $("#docList").append('<li class="list-group-item">No documents found matching your search.</li>');
            return;
          }
          
          results.forEach(result => {
            const doc = result.item;
            
            // Use the highlightMatches function for better search result display
            let renderedText = SearchHelper.highlightMatches(
              doc.combinedContent || (doc.paragraphs && doc.paragraphs.length ? doc.paragraphs[0].content : ""),
              searchTerm
            );
            
            let display = "<strong>" + doc.title + "</strong><br>" + renderedText;
            
            const li = $('<li>').addClass('list-group-item list-item').html(display);
            li.click(function(){ previewDocument(doc); });
            
            $("#docList").append(li);
          });
        })
        .catch(err => {
          console.error("Search error:", err);
          $("#docList").append('<li class="list-group-item text-danger">Error searching documents: ' + err.message + '</li>');
        });
    } else {
      // Default behavior for no search term
      const transaction = db.transaction("documents", "readonly");
      const store = transaction.objectStore("documents");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if(cursor) {
          const doc = cursor.value;
          
          let renderedText = renderMarkdown(
            doc.combinedContent ?
              doc.combinedContent.substring(0, 100) + (doc.combinedContent.length > 100 ? "..." : "") :
              doc.paragraphs[0].content.substring(0, 100) + (doc.paragraphs[0].content.length > 100 ? "..." : "")
          );
          
          let display = "<strong>" + doc.title + "</strong><br>" + renderedText;
          
          const li = $('<li>').addClass('list-group-item list-item').html(display);
          li.click(function(){ previewDocument(doc); });
          
          $("#docList").append(li);
          cursor.continue();
        }
      };
    }
  } catch (err) {
    console.error("Database error:", err);
    $("#docList").append('<li class="list-group-item">Database not available. Please refresh the page.</li>');
  }
}

/**
 * Preview a document
 * @param {Object} doc - The document to preview
 */
function previewDocument(doc) {
  // Create the document header with controls
  let headerHtml = `<div class='card-header'><strong>${doc.title}</strong> (ID: ${doc.id})
    <div class="btn-group float-right">
      <button class="btn btn-sm btn-warning edit-doc-btn">Edit</button>
      <button class="btn btn-sm btn-danger delete-doc-btn">Delete</button>
    </div>
  </div>`;

  $("#docPreviewContent").html(headerHtml);
  
  // Process each paragraph
  doc.paragraphs.forEach((p, i) => {
    // Create paragraph container
    const paragraphContainer = $(`<div class="card-body paragraph-container mb-3" data-paragraph-index="${i}"></div>`);
    $("#docPreviewContent").append(paragraphContainer);
    
    // Add paragraph title if available
    const paragraphTitle = p.title ? 
      `<h5 class="mb-2">${p.title}</h5>` : 
      `<strong>Paragraph ${i+1}</strong>`;
    
    // Create content preview for paragraph
    const additionalContent = `
      ${p.tags && p.tags.length ? 
        `<p><small>Tags: ${p.tags.map(t => `<span class="badge badge-info">${t}</span>`).join(' ')}</small></p>` : ''}
    `;
    
    const paragraphPreview = createContentPreview(p.content, {
      title: paragraphTitle,
      showControls: true,
      additionalFooterContent: additionalContent,
      containerClass: "paragraph-content-container",
      allowCopy: false
    });

    console.log("Paragraph preview:", paragraphPreview);
    
    paragraphContainer.append(paragraphPreview);
    
    // Handle block references
    const blockRefs = p.blockRefs || (p.blockRef ? [p.blockRef] : []);
    if (blockRefs.length > 0) {
      blockRefs.forEach(blockRef => {
        paragraphContainer.append(`<p><em>Block Reference: ${blockRef}</em></p>`);
        
        fetchBlockById(blockRef)
          .then(block => {
            if (block) {
              // Create preview for referenced block
              const blockAdditionalContent = `
                ${block.reference ? `<span class="block-reference">[Reference: ${block.reference}
                ${block.refLevels && block.refLevels.length > 0 ? " " + block.refLevels.join(".") : ""}]</span>` : ""} 
                ${block.tags && block.tags.length ? `<small>[Tags: ${block.tags.join(", ")}]</small>` : ""}
                <button class="btn btn-sm btn-warning edit-doc-block-btn ml-2" data-block-id="${block.id}">Edit</button>
              `;
              
              const blockPreview = createContentPreview(block.text, {
                title: `${block.title || 'Block ' + block.id}`,
                containerClass: "referenced-block-preview text-info",
                showControls: false,
                additionalFooterContent: blockAdditionalContent
              });
              
              paragraphContainer.append(blockPreview);
              
              // Add event handler for edit buttons
              blockPreview.find(".edit-doc-block-btn").on("click", function() {
                const blockId = $(this).data("block-id");
                editBlockUniversal(blockId);
              });
            } else {
              paragraphContainer.append(`<p class="text-danger">Block not found</p>`);
            }
          })
          .catch(error => {
            console.error("Error fetching block:", error);
            paragraphContainer.append(`<p class="text-danger">Error loading block: ${error.message}</p>`);
          });
      });
    }
  });

  // Set up delete button handler
  $(".delete-doc-btn").on("click", function(e) {
    e.stopPropagation(); 
    deleteDocument(doc.id);
  });
  
  // Set up edit button handler
  $(".edit-doc-btn").on("click", function(e) {
    e.stopPropagation(); 
    editDocument(doc);
  });
  
  // Show document references whenever a document is previewed
  showDocumentReferences(doc);
}

/**
 * Show document references based on referenced blocks
 * @param {Object} doc - The document to show references for
 */
function showDocumentReferences(doc) {
  // Container to collect unique references
  const uniqueReferences = new Set();
  // Counter to track async operations
  let pendingBlocks = 0;
  let referencesData = {};
  // Map to organize blocks by reference
  const blocksByReference = {};
  
  // If no document is provided, clear the references list
  if (!doc) {
    $("#documentReferencesList").html('<div class="alert alert-info">No document selected. Please select or create a document.</div>');
    return;
  }
  
  // Clear previous content and show loading message
  $("#documentReferencesList").html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading references...</div>');
  
  // Process each paragraph to find referenced blocks
  doc.paragraphs.forEach(para => {
    // Get block references (handle both old and new format)
    const blockRefs = para.blockRefs || (para.blockRef ? [para.blockRef] : []);
    
    if (blockRefs.length > 0) {
      pendingBlocks += blockRefs.length;
      
      // Process each block reference
      blockRefs.forEach(blockId => {
        fetchBlockById(blockId)
          .then(block => {
            if (block && block.reference) {
              uniqueReferences.add(block.reference);
              
              // Organize blocks by reference
              if (!blocksByReference[block.reference]) {
                blocksByReference[block.reference] = [];
              }
              // Add block to the reference group if it's not already there
              if (!blocksByReference[block.reference].some(b => b.id === block.id)) {
                blocksByReference[block.reference].push(block);
              }
              
              // Get reference details
              const transaction = db.transaction("references", "readonly");
              const refStore = transaction.objectStore("references");
              
              const request = refStore.get(block.reference);
              request.onsuccess = function(e) {
                const refData = e.target.result;
                if (refData) {
                  referencesData[block.reference] = refData;
                }
                
                pendingBlocks--;
                if (pendingBlocks === 0) {
                  renderReferencesUI(uniqueReferences, referencesData, blocksByReference);
                }
              };
              
              request.onerror = function(e) {
                console.error("Error fetching reference:", e.target.error);
                pendingBlocks--;
                if (pendingBlocks === 0) {
                  renderReferencesUI(uniqueReferences, referencesData, blocksByReference);
                }
              };
            } else {
              pendingBlocks--;
              if (pendingBlocks === 0) {
                renderReferencesUI(uniqueReferences, referencesData, blocksByReference);
              }
            }
          })
          .catch(error => {
            console.error("Error fetching block:", error);
            pendingBlocks--;
            if (pendingBlocks === 0) {
              renderReferencesUI(uniqueReferences, referencesData, blocksByReference);
            }
          });
      });
    }
  });
  
  // If no blocks with references were found
  if (pendingBlocks === 0) {
    $("#documentReferencesList").html('<div class="alert alert-info">No references found in this document.</div>');
  }
}

/**
 * Helper function to render the references UI
 * @param {Set} uniqueReferences - Set of unique reference IDs
 * @param {Object} referencesData - Reference data by ID
 * @param {Object} blocksByReference - Blocks organized by reference ID
 */
function renderReferencesUI(uniqueReferences, referencesData, blocksByReference) {
  if (uniqueReferences.size === 0) {
    $("#documentReferencesList").html('<div class="alert alert-info">No references found in this document.</div>');
    return;
  }
  
  let html = '<div class="card mb-3"><div class="card-header">Document References</div><div class="card-body">';
  html += '<p class="small text-muted">These references are used by blocks referenced in this document:</p>';
  html += '<div class="accordion" id="referencesAccordion">';
  
  let counter = 0;
  uniqueReferences.forEach(refId => {
    const refData = referencesData[refId] || { id: refId };
    const blocksForRef = blocksByReference[refId] || [];
    counter++;
    
    html += `
      <div class="card">
        <div class="card-header" id="heading${counter}">
          <h5 class="mb-0 d-flex justify-content-between align-items-center">
            <button class="btn btn-link" type="button" data-toggle="collapse" 
              data-target="#collapse${counter}" aria-expanded="true" aria-controls="collapse${counter}">
              <strong>${refId}</strong>${refData.name ? ` - ${refData.name}` : ''}
            </button>
            <span>
              <span class="badge badge-secondary">${blocksForRef.length} block${blocksForRef.length !== 1 ? 's' : ''}</span>
              <button class="btn btn-sm btn-outline-secondary view-reference-btn ml-2" data-ref-id="${refId}">
                <i class="fas fa-external-link-alt"></i> View Reference
              </button>
            </span>
          </h5>
        </div>
        <div id="collapse${counter}" class="collapse hide" aria-labelledby="heading${counter}" data-parent="#referencesAccordion">
          <div class="card-body">
            ${refData.description ? `<p class="text-muted">${refData.description}</p>` : ''}
            <h6>Referenced Blocks:</h6>
            <ul class="list-group">`;
  
    // Sort blocks by levels if available
    blocksForRef.sort((a, b) => {
      let al = a.refLevels || [];
      let bl = b.refLevels || [];
      for(let i = 0; i < Math.max(al.length, bl.length); i++){
        let av = al[i] || 0;
        let bv = bl[i] || 0;
        if(av !== bv) return av - bv;
      }
      return 0;
    });
            
    blocksForRef.forEach(block => {
      const levelStr = block.refLevels && block.refLevels.length > 0 ? 
        `<span class="badge badge-primary mr-2">${block.refLevels.join(".")}</span>` : '';
      
      html += `
        <li class="list-group-item">
          <div>
            ${levelStr}<strong>${block.title || 'Block ' + block.id}</strong> (ID: ${block.id})
            <div class="btn-group float-right">
              <button class="btn btn-sm btn-warning edit-ref-block-btn" data-block-id="${block.id}">Edit</button>
              <button class="btn btn-sm btn-outline-info preview-ref-block-btn" data-block-id="${block.id}">
                <i class="fas fa-eye-slash"></i> Hide Content
              </button>
            </div>
          </div>
          <div class="block-preview-container-${block.id} mt-2">
            <div class="card">
              <div class="card-body bg-light">
                ${renderMarkdown(block.text)}
                ${block.tags && block.tags.length ? 
                  `<div class="mt-2">${block.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}</div>` : ''}
              </div>
            </div>
          </div>
        </li>`;
    });
            
    html += `
            </ul>
          </div>
        </div>
      </div>`;
  });
  
  html += '</div></div></div>';
  $("#documentReferencesList").html(html);
  renderMermaidIn("#documentReferencesList .mermaid");
  
  // Add event listeners to reference view buttons
  $(".view-reference-btn").on("click", function() {
    const refId = $(this).data("ref-id");
    // Show the reference details
    combineReference(refId);
    // Switch to the references tab
    $("#references-tab").tab('show');
  });
  
  // Add event listeners to block edit buttons
  $(".edit-ref-block-btn").on("click", function() {
    const blockId = $(this).data("block-id");
    editBlockUniversal(blockId);
  });
  
  // Add event listeners to block preview buttons
  $(".preview-ref-block-btn").on("click", function() {
    const blockId = $(this).data("block-id");
    const previewContainer = $(`.block-preview-container-${blockId}`);
    const $button = $(this);
    
    // Toggle preview
    if (previewContainer.is(":visible")) {
      previewContainer.slideUp();
      $button.html('<i class="fas fa-eye"></i> Show Content');
    } else {
      previewContainer.slideDown();
      $button.html('<i class="fas fa-eye-slash"></i> Hide Content');
    }
  });
}

/**
 * Edit a document
 * @param {Object} doc - The document to edit
 */
function editDocument(doc) {
  editingDocumentId = doc.id;
  $("#docTitle").val(doc.title);
  $("#paragraphContainer").empty();
  
  doc.paragraphs.forEach(p => {
    const block = $(`
      <div class="paragraph-block">
        <div class="btn-group btn-group-sm mb-2 float-right">
          <button type="button" class="btn btn-outline-secondary move-up-btn"><i class="fas fa-arrow-up"></i></button>
          <button type="button" class="btn btn-outline-secondary move-down-btn"><i class="fas fa-arrow-down"></i></button>
          <button type="button" class="btn btn-outline-danger remove-para-btn"><i class="fas fa-trash"></i></button>
        </div>
        <label>Paragraph Title</label>
        <input type="text" class="form-control paraTitle mb-2" placeholder="Enter paragraph title (optional)">
        <label>Paragraph Content (Markdown)</label>
        <div class="paragraph-editor mb-3">
          <div class="btn-group mb-2">
            <button type="button" class="btn btn-light insert-bold">Bold</button>
            <button type="button" class="btn btn-light insert-italic">Italic</button>
            <button type="button" class="btn btn-light insert-equation">Equation</button>
            <button type="button" class="btn btn-light insert-mermaid">Mermaid</button>
            <button type="button" class="btn btn-light toggle-preview">Toggle Preview</button>
          </div>
          <textarea class="docParagraph form-control" rows="4" placeholder="Enter paragraph text"></textarea>
          <div class="preview mt-2" style="display:none; border: 1px solid #ccc; padding: 10px;"></div>
        </div>
        
        <div class="row mt-2">
          <div class="col-md-8">
            <label>Reference Blocks <small>(Multiple blocks can be referenced)</small></label>
            <div class="block-references-container">
              <!-- Block references will be added here -->
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary add-block-ref-btn mt-1"><i class="fas fa-plus"></i> Add Another Block Reference</button>
            <small class="form-text text-muted">Enter block IDs to include references</small>
          </div>
          <div class="col-md-4">
            <label>Paragraph Tags</label>
            <input type="text" class="paraTags form-control" placeholder="tag1, tag2">
          </div>
        </div>
      </div>
    `);
    
    $("#paragraphContainer").append(block);
    block.find(".docParagraph").val(p.content);
    block.find(".paraTitle").val(p.title || '');
    
    // Get block references (handle both old and new format)
    const blockRefs = p.blockRefs || (p.blockRef ? [p.blockRef] : []);
    
    // Create reference inputs for each block reference
    const refContainer = block.find('.block-references-container');
    
    if (blockRefs.length === 0) {
      // Add an empty reference field if none exist
      const emptyRef = $(`
        <div class="input-group mb-2">
          <input type="text" class="blockRef form-control" placeholder="Reference block ID (autocomplete enabled)">
          <div class="input-group-append">
            <button class="btn btn-outline-secondary preview-block-btn" type="button" title="Preview referenced block"><i class="fas fa-eye"></i></button>
            <button class="btn btn-outline-info inherit-tags-btn" type="button" title="Inherit tags from block"><i class="fas fa-tags"></i></button>
            <button class="btn btn-outline-danger remove-ref-btn" type="button" title="Remove this reference"><i class="fas fa-times"></i></button>
          </div>
        </div>
      `);
      refContainer.append(emptyRef);
    } else {
      // Add a reference field for each existing reference
      blockRefs.forEach(ref => {
        const refField = $(`
          <div class="input-group mb-2">
            <input type="text" class="blockRef form-control" placeholder="Reference block ID (autocomplete enabled)" value="${ref}">
            <div class="input-group-append">
              <button class="btn btn-outline-secondary preview-block-btn" type="button" title="Preview referenced block"><i class="fas fa-eye"></i></button>
              <button class="btn btn-outline-info inherit-tags-btn" type="button" title="Inherit tags from block"><i class="fas fa-tags"></i></button>
              <button class="btn btn-outline-danger remove-ref-btn" type="button" title="Remove this reference"><i class="fas fa-times"></i></button>
            </div>
          </div>
        `);
        refContainer.append(refField);
      });
    }
    
    // Set paragraph tags if they exist
    if(p.tags && p.tags.length) {
      block.find(".paraTags").val(p.tags.join(", "));
    }
    
    // Set up autocomplete for all block references
    block.find(".blockRef").each(function() {
      $(this).autocomplete({
        source: function(request, response) {
          const results = $.ui.autocomplete.filter(blockAutocomplete, request.term);
          response(results.slice(0, 10));
        },
        minLength: 1,
        select: function(event, ui) {
          $(this).val(ui.item.value);
          return false;
        }
      });
    });
    
    // Set up tags autocomplete
    block.find(".paraTags").autocomplete({
      source: function(request, response) {
        const term = request.term.split(/,\s*/).pop();
        const results = $.ui.autocomplete.filter(tagAutocomplete, term);
        response(results.slice(0, 10));
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
      
      // Set up autocomplete for the new block reference
      newRef.find(".blockRef").autocomplete({
        source: function(request, response) {
          const results = $.ui.autocomplete.filter(blockAutocomplete, request.term);
          response(results.slice(0, 10));
        },
        minLength: 1,
        select: function(event, ui) {
          $(this).val(ui.item.value);
          return false;
        }
      });
      
      // Set up buttons
      newRef.find(".preview-block-btn").click(function() {
        previewReferencedBlock(this);
      });
      
      newRef.find(".inherit-tags-btn").click(function() {
        inheritTagsFromBlock(this);
      });
      
      newRef.find(".remove-ref-btn").click(function() {
        $(this).closest('.input-group').remove();
      });
      
      refContainer.append(newRef);
    });
    
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
    
    // Set up preview and inherit buttons
    block.find(".preview-block-btn").click(function() {
      previewReferencedBlock(this);
    });
    
    block.find(".inherit-tags-btn").click(function() {
      inheritTagsFromBlock(this);
    });
    
    block.find(".remove-ref-btn").click(function() {
      const container = $(this).closest('.block-references-container');
      // Only remove if there's more than one reference
      if (container.find('.input-group').length > 1) {
        $(this).closest('.input-group').remove();
      }
    });
  });
  
  $("#documentForm button[type=submit]").text("Update Document");
  
  // Switch to documents view tab
  $('#viewTabs a[href="#documentsView"]').tab('show');
}

/**
 * Delete a document
 * @param {number} id - The document ID to delete
 */
function deleteDocument(id) {
  if(confirm("Are you sure you want to delete this document?")) {
    if (!db) {
      showNotification("Database not available. Please refresh the page.", "danger");
      return;
    }
    
    const transaction = db.transaction("documents", "readwrite");
    const store = transaction.objectStore("documents");
    
    store.delete(id).onsuccess = function() {
      showNotification("Document deleted successfully!");
      loadDocuments();
    };
  }
}

/**
 * Save result as paragraph
 * @param {string} text - Text to save as paragraph
 */
function saveResultAsParagraph(text) {
  $('#viewTabs a[href="#documentsView"]').tab('show');
  
  if ($("#paragraphContainer").children().length === 0) {
    addParagraph();
  } else {
    addParagraph();
  }
  
  const lastParagraph = $("#paragraphContainer .paragraph-block").last();
  lastParagraph.find(".docParagraph").val(text);
  
  showNotification("Results added as a new paragraph!", "success");
}
