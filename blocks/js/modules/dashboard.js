/**
 * Simplified dashboard functionality
 */

/**
 * Initialize the dashboard with essential features only
 */
function initializeDashboard() {
  // Set dashboard as the first tab to show on initial load
  if (window.location.hash === '' || window.location.hash === '#') {
    setTimeout(() => {
      $('#dashboard-tab').tab('show');
    }, 100);
  }

  // Initialize the search UI if available
  if (typeof SearchUI !== 'undefined') {
    SearchUI.init({
      searchInputSelector: '#universalSearch',
      searchButtonSelector: '#universalSearchBtn',
      searchScopeSelector: '#searchScope',
      resultsContainerSelector: '#searchResultsContainer',
      searchFormSelector: '#searchForm'
    });
  }
  
  // Update system stats
  updateSystemStats();
  
  // Initialize quick action handlers
  initializeQuickActions();
  
  // Update tag cloud with a simpler visualization
  updateTagAutocomplete();
}

/**
 * Update system statistics
 */
function updateSystemStats() {
  if (!db) {
    console.error("Database not initialized");
    return;
  }
  
  // Count blocks
  countObjectStore("blocks").then(count => {
    $("#blocksCount").text(count);
  }).catch(err => {
    console.error("Error counting blocks:", err);
  });
  
  // Count documents
  countObjectStore("documents").then(count => {
    $("#documentsCount").text(count);
  }).catch(err => {
    console.error("Error counting documents:", err);
  });
  
  // Count references
  countObjectStore("references").then(count => {
    $("#referencesCount").text(count);
  }).catch(err => {
    console.error("Error counting references:", err);
  });
  
  // Count unique tags
  countUniqueTags().then(count => {
    $("#tagsCount").text(count);
  }).catch(err => {
    console.error("Error counting tags:", err);
  });
}

/**
 * Count objects in a store
 * @param {string} storeName - The object store name to count
 * @returns {Promise<number>} - Promise that resolves with the count
 */
function countObjectStore(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onsuccess = function() {
        resolve(request.result);
      };
      
      request.onerror = function(e) {
        reject(e.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Count unique tags across all blocks
 * @returns {Promise<number>} - Promise that resolves with the count
 */
function countUniqueTags() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const uniqueTags = new Set();
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          const block = cursor.value;
          if (block.tags && block.tags.length) {
            block.tags.forEach(tag => uniqueTags.add(tag));
          }
          cursor.continue();
        } else {
          resolve(uniqueTags.size);
        }
      };
      
      transaction.onerror = function(e) {
        reject(e.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Simplified quick action buttons
 */
function initializeQuickActions() {
  // Add new block
  $("#quickAddBlock").click(function() {
    $('#blocks-tab').tab('show');
    $("#addBlockBtn").click();
  });
  
  // Add new document
  $("#quickAddDocument").click(function() {
    $('#documents-tab').tab('show');
    $("#addDocumentBtn").click();
  });
  
  // Add new reference
  $("#quickAddReference").click(function() {
    $('#references-tab').tab('show');
    $("#addReferenceBtn").click();
  });

  // AI assistant
  $("#quickAIAssistant").click(function() {
    $('#actions-tab').tab('show');
  });

  
  // Export data
  $("#quickExportData").click(function() {
    exportData();
  });

}

/**
 * Update the tag cloud with interactive tags
 * @param {Object} tagCounts - Object with tag names as keys and counts as values
 */
function updateTagCloud(tagCounts) {
  const tagCloud = $("#tagCloud");
  tagCloud.empty();
  
  // Sort tags by frequency
  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
  
  // Display top 20 tags
  sortedTags.slice(0, 20).forEach(tag => {
    const count = tagCounts[tag];
    // Scale font size between 1em and 2em based on frequency
    const fontSize = 1 + (count / Math.max(...Object.values(tagCounts))) * 1;
    
    const tagBtn = $(`<button class="btn btn-outline-info m-1 dashboard-tag-btn">${tag} <span class="badge badge-light">${count}</span></button>`);
    tagBtn.css('font-size', `${fontSize}em`);
    tagBtn.data('tag', tag);
    
    tagCloud.append(tagBtn);
  });
  
  // Add click handlers for the tags
  $(".dashboard-tag-btn").click(function() {
    const tag = $(this).data('tag');
    loadTagContentForDashboard(tag);
  });
  
  // Add close button handler for tag results
  $("#closeTagResults").click(function() {
    $("#dashboardTagResults").hide();
  });
}

/**
 * Load tag content specifically for the dashboard view
 * @param {string} tag - The tag to load content for
 */
function loadTagContentForDashboard(tag) {
  // Update the selected tag title
  $("#selectedTagTitle span").text(tag);
  
  // Show the results container
  $("#dashboardTagResults").show();
  
  // Show loading indicators
  $("#dashboardTaggedBlocks").html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading blocks...</div>');
  $("#dashboardTaggedDocuments").html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>');
  
  // Use the SearchHelper to find content with this tag
  SearchHelper.searchByTag(tag)
    .then(results => {
      // Update tab counts
      $("#tag-blocks-tab .badge").text(results.blocks.length);
      $("#tag-documents-tab .badge").text(results.documents.length);
      
      // Render blocks
      if (results.blocks.length === 0) {
        $("#dashboardTaggedBlocks").html('<div class="alert alert-info">No blocks found with this tag.</div>');
      } else {
        let blocksHtml = '';
        results.blocks.forEach(result => {
          const block = result.item;
          blocksHtml += `
            <div class="card mb-2">
              <div class="card-body">
                <h6>${block.title || 'Block ' + block.id}</h6>
                <p>${Helpers.truncate(block.text, 150)}</p>
                <div class="d-flex justify-content-between">
                  <div>
                    ${block.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}
                  </div>
                  <button class="btn btn-sm btn-primary view-block-btn" data-block-id="${block.id}">
                    <i class="fas fa-eye"></i> View
                  </button>
                </div>
              </div>
            </div>
          `;
        });
        $("#dashboardTaggedBlocks").html(blocksHtml);
        
        // Add click handlers for view buttons
        $("#dashboardTaggedBlocks .view-block-btn").click(function() {
          const blockId = $(this).data('block-id');
          $('#blocks-tab').tab('show');
          setTimeout(() => {
            fetchBlockById(parseInt(blockId))
              .then(block => {
                if (block) {
                  showBlockDetails(block);
                }
              })
              .catch(error => {
                console.error("Error fetching block:", error);
              });
          }, 300);
        });
      }
      
      // Render documents
      if (results.documents.length === 0) {
        $("#dashboardTaggedDocuments").html('<div class="alert alert-info">No documents found with this tag.</div>');
      } else {
        let docsHtml = '';
        results.documents.forEach(result => {
          const doc = result.item;
          docsHtml += `
            <div class="card mb-2">
              <div class="card-body">
                <h6>${doc.title}</h6>
                <button class="btn btn-sm btn-primary view-doc-btn" data-doc-id="${doc.id}">
                  <i class="fas fa-eye"></i> View Document
                </button>
              </div>
            </div>
          `;
        });
        $("#dashboardTaggedDocuments").html(docsHtml);
        
        // Add click handlers for view buttons
        $("#dashboardTaggedDocuments .view-doc-btn").click(function() {
          const docId = $(this).data('doc-id');
          $('#documents-tab').tab('show');
          setTimeout(() => {
            fetchDocumentById(parseInt(docId))
              .then(doc => {
                if (doc) {
                  previewDocument(doc);
                }
              })
              .catch(error => {
                console.error("Error fetching document:", error);
              });
          }, 300);
        });
      }
    })
    .catch(error => {
      console.error("Error loading tag content:", error);
      $("#dashboardTaggedBlocks").html('<div class="alert alert-danger">Error loading blocks: ' + error.message + '</div>');
      $("#dashboardTaggedDocuments").html('<div class="alert alert-danger">Error loading documents: ' + error.message + '</div>');
    });
}