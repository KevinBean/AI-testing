/**
 * Enhanced dashboard functionality
 */

/**
 * Initialize the dashboard with improvements
 */
function initializeDashboard() {
  // Set dashboard as the first tab to show on initial load
  if (window.location.hash === '' || window.location.hash === '#') {
    setTimeout(() => {
      $('#dashboard-tab').tab('show');
    }, 100);
  }
  
  // Update system stats
  updateSystemStats();
  
  // Initialize quick action handlers
  initializeQuickActions();
  
  // Initialize universal search with improvements
  initializeEnhancedUniversalSearch();
  
  // Load recent activity (most recently modified items)
  loadRecentActivity();
  
  // Initialize enhanced tag visualization
  initializeEnhancedTagVisualization();

  // Initialize dashboard AI actions panel
  initializeDashboardActions();
}

/**
 * Initialize enhanced universal search with better UX
 */
function initializeEnhancedUniversalSearch() {
  $("#universalSearchBtn").click(function() {
    const searchTerm = $("#universalSearch").val().trim();
    const searchScope = $("#searchScope").val();
    
    if (searchTerm) {
      performUniversalSearch(searchTerm, searchScope);
    }
  });
  
  // Also trigger search on Enter key
  $("#universalSearch").keypress(function(e) {
    if (e.which === 13) {
      $("#universalSearchBtn").click();
    }
  });

  // Add clear search results functionality
  $(document).on('click', '.clear-search-results-btn', function() {
    $("#dashboardSearchResults").slideUp(300, function() {
      $(this).remove();
    });
  });
}

/**
 * Perform universal search across content with improved results display
 * @param {string} searchTerm - The search term
 * @param {string} scope - The search scope (all, blocks, documents, references, tags)
 */
function performUniversalSearch(searchTerm, scope) {
  // Remove existing search results
  $("#dashboardSearchResults").remove();
  
  const resultsContainer = $(`
    <div id="dashboardSearchResults" class="card mt-4 shadow-sm">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">
          <i class="fas fa-search mr-2"></i>
          Search Results: "${searchTerm}"
        </h5>
        <div>
          <button class="btn btn-sm btn-outline-secondary clear-search-results-btn">
            <i class="fas fa-times"></i> Close Results
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin"></i> Searching...
        </div>
      </div>
    </div>
  `);
  
  resultsContainer.insertAfter($("#universalSearch").closest(".card"));
  
  const searchPromises = [];
  
  // Determine which stores to search based on scope
  if (scope === 'all' || scope === 'blocks') {
    searchPromises.push(searchBlocks(searchTerm));
  }
  
  if (scope === 'all' || scope === 'documents') {
    searchPromises.push(searchDocuments(searchTerm));
  }
  
  if (scope === 'all' || scope === 'references') {
    searchPromises.push(searchReferences(searchTerm));
  }
  
  if (scope === 'all' || scope === 'tags') {
    searchPromises.push(searchByTag(searchTerm));
  }
  
  // Wait for all searches to complete
  Promise.all(searchPromises)
    .then(results => {
      let blocksResults = [];
      let documentsResults = [];
      let referencesResults = [];
      let tagResults = [];
      
      // Combine results based on which searches were performed
      results.forEach(result => {
        if (result.type === 'blocks') blocksResults = result.items;
        if (result.type === 'documents') documentsResults = result.items;
        if (result.type === 'references') referencesResults = result.items;
        if (result.type === 'tags') tagResults = result.items;
      });
      
      // Display results with improved UI
      displayEnhancedSearchResults(
        resultsContainer, 
        searchTerm, 
        blocksResults, 
        documentsResults, 
        referencesResults,
        tagResults
      );
    })
    .catch(error => {
      console.error("Search error:", error);
      resultsContainer.find(".card-body").html(`
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          Error performing search: ${error.message}
          <button class="close" data-dismiss="alert">&times;</button>
        </div>
      `);
    });
}

/**
 * Display search results with improved UI
 * @param {jQuery} container - Results container
 * @param {string} searchTerm - The search term
 * @param {Array} blocksResults - Blocks results
 * @param {Array} documentsResults - Documents results
 * @param {Array} referencesResults - References results
 * @param {Object} tagResults - Tag search results
 */
function displayEnhancedSearchResults(
  container, 
  searchTerm, 
  blocksResults, 
  documentsResults, 
  referencesResults,
  tagResults
) {
  const blocksCount = blocksResults.length;
  const docsCount = documentsResults.length;
  const refsCount = referencesResults.length;
  const tagBlocksCount = tagResults.blocks ? tagResults.blocks.length : 0;
  const tagDocsCount = tagResults.documents ? tagResults.documents.length : 0;
  
  // Calculate total results
  const totalResults = blocksCount + docsCount + refsCount + tagBlocksCount + tagDocsCount;
  
  if (totalResults === 0) {
    container.find(".card-body").html(`
      <div class="alert alert-info">
        <i class="fas fa-info-circle mr-2"></i> No results found for "${searchTerm}"
      </div>
    `);
    return;
  }
  
  // Create the results tabs
  const resultsContent = $(`
    <div>
      <p class="lead">
        <span class="badge badge-primary badge-pill">${totalResults}</span> 
        result${totalResults !== 1 ? 's' : ''} found for "${searchTerm}"
      </p>
      
      <ul class="nav nav-tabs nav-fill" id="searchResultsTabs" role="tablist">
        ${blocksCount > 0 ? `
          <li class="nav-item">
            <a class="nav-link active" id="blocks-results-tab" data-toggle="tab" href="#blocksResultsContent" role="tab">
              <i class="fas fa-cube mr-1"></i> Blocks <span class="badge badge-pill badge-light">${blocksCount}</span>
            </a>
          </li>
        ` : ''}
        
        ${docsCount > 0 ? `
          <li class="nav-item">
            <a class="nav-link ${blocksCount === 0 ? 'active' : ''}" id="docs-results-tab" data-toggle="tab" href="#docsResultsContent" role="tab">
              <i class="fas fa-file-alt mr-1"></i> Documents <span class="badge badge-pill badge-light">${docsCount}</span>
            </a>
          </li>
        ` : ''}
        
        ${refsCount > 0 ? `
          <li class="nav-item">
            <a class="nav-link ${blocksCount === 0 && docsCount === 0 ? 'active' : ''}" id="refs-results-tab" data-toggle="tab" href="#refsResultsContent" role="tab">
              <i class="fas fa-bookmark mr-1"></i> References <span class="badge badge-pill badge-light">${refsCount}</span>
            </a>
          </li>
        ` : ''}
        
        ${(tagBlocksCount > 0 || tagDocsCount > 0) ? `
          <li class="nav-item">
            <a class="nav-link ${blocksCount === 0 && docsCount === 0 && refsCount === 0 ? 'active' : ''}" id="tags-results-tab" data-toggle="tab" href="#tagsResultsContent" role="tab">
              <i class="fas fa-tags mr-1"></i> Tags <span class="badge badge-pill badge-light">${tagBlocksCount + tagDocsCount}</span>
            </a>
          </li>
        ` : ''}
      </ul>
      
      <div class="tab-content border border-top-0 p-3 mb-3">
        ${blocksCount > 0 ? `
          <div class="tab-pane fade show active" id="blocksResultsContent" role="tabpanel">
            <div id="blocksResultsList" class="results-scrollable"></div>
          </div>
        ` : ''}
        
        ${docsCount > 0 ? `
          <div class="tab-pane fade ${blocksCount === 0 ? 'show active' : ''}" id="docsResultsContent" role="tabpanel">
            <div id="docsResultsList" class="results-scrollable"></div>
          </div>
        ` : ''}
        
        ${refsCount > 0 ? `
          <div class="tab-pane fade ${blocksCount === 0 && docsCount === 0 ? 'show active' : ''}" id="refsResultsContent" role="tabpanel">
            <div id="refsResultsList" class="results-scrollable"></div>
          </div>
        ` : ''}
        
        ${(tagBlocksCount > 0 || tagDocsCount > 0) ? `
          <div class="tab-pane fade ${blocksCount === 0 && docsCount === 0 && refsCount === 0 ? 'show active' : ''}" id="tagsResultsContent" role="tabpanel">
            <div id="tagsResultsList" class="results-scrollable"></div>
          </div>
        ` : ''}
      </div>
    </div>
  `);
  
  container.find(".card-body").html(resultsContent);
  
  // Add styles for scrollable results areas
  if (!$('#searchResultsStyles').length) {
    $('head').append(`
      <style id="searchResultsStyles">
        .results-scrollable {
          max-height: 500px;
          overflow-y: auto;
          padding-right: 5px;
        }
        .results-scrollable::-webkit-scrollbar {
          width: 6px;
        }
        .results-scrollable::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .results-scrollable::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .results-scrollable::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .search-result-card {
          transition: all 0.2s ease;
          border-left: 3px solid transparent;
        }
        .search-result-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          border-left: 3px solid #007bff;
        }
        .search-result-card .badge {
          font-size: 85%;
        }
        mark {
          background-color: rgba(255, 230, 0, 0.4);
          padding: 0 2px;
          border-radius: 2px;
        }
        .tag-item {
          display: inline-block;
          margin: 5px;
          padding: 5px 10px;
          border-radius: 15px;
          background: #f8f9fa;
          transition: all 0.2s;
          border: 1px solid #ddd;
        }
        .tag-item:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          background: #e9ecef;
        }
        .tag-item .badge {
          margin-left: 5px;
          font-size: 80%;
        }
      </style>
    `);
  }
  
  // Generate results for each category
  if (blocksCount > 0) {
    const blocksList = $("#blocksResultsList");
    blocksResults.forEach(block => {
      const title = block.title || `Block ${block.id}`;
      
      blocksList.append(`
        <div class="card mb-2 search-result-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <h6>
                <i class="fas fa-cube text-primary mr-1"></i>
                ${title} <small class="text-muted">(ID: ${block.id})</small>
              </h6>
              <button class="btn btn-sm btn-primary view-block-btn" data-block-id="${block.id}">
                <i class="fas fa-eye mr-1"></i> View
              </button>
            </div>
            <div>${getHighlightedSearchContext(block.text, searchTerm, 100)}</div>
            ${block.tags && block.tags.length ? `
              <div class="mt-2">
                ${block.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `);
    });
    
    blocksList.on("click", ".view-block-btn", function() {
      const blockId = $(this).data("block-id");
      $('#blocks-tab').tab('show');
      setTimeout(() => {
        fetchBlockById(blockId)
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
  
  if (docsCount > 0) {
    const docsList = $("#docsResultsList");
    documentsResults.forEach(doc => {
      docsList.append(`
        <div class="card mb-2 search-result-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <h6>
                <i class="fas fa-file-alt text-success mr-1"></i>
                ${doc.title} <small class="text-muted">(ID: ${doc.id})</small>
              </h6>
              <button class="btn btn-sm btn-success view-doc-btn" data-doc-id="${doc.id}">
                <i class="fas fa-eye mr-1"></i> View
              </button>
            </div>
            <div>
              ${doc.combinedContent ? 
                getHighlightedSearchContext(doc.combinedContent, searchTerm, 100) : 
                (doc.paragraphs && doc.paragraphs.length ? 
                  getHighlightedSearchContext(doc.paragraphs[0].content, searchTerm, 100) : '')}
            </div>
          </div>
        </div>
      `);
    });
    
    docsList.on("click", ".view-doc-btn", function() {
      const docId = $(this).data("doc-id");
      $('#documents-tab').tab('show');
      setTimeout(() => {
        fetchDocumentById(docId)
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
  
  if (refsCount > 0) {
    const refsList = $("#refsResultsList");
    referencesResults.forEach(ref => {
      refsList.append(`
        <div class="card mb-2 search-result-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <h6>
                <i class="fas fa-bookmark text-warning mr-1"></i>
                ${ref.name} <small class="text-muted">(ID: ${ref.id})</small>
              </h6>
              <button class="btn btn-sm btn-warning view-ref-btn" data-ref-id="${ref.id}">
                <i class="fas fa-eye mr-1"></i> View
              </button>
            </div>
            ${ref.description ? `<p>${ref.description}</p>` : ''}
            <div class="d-flex flex-wrap mt-2">
              ${ref.type ? `<span class="badge badge-secondary mr-2">Type: ${ref.type}</span>` : ''}
              ${ref.author ? `<span class="badge badge-secondary mr-2">Author: ${ref.author}${ref.year ? ` (${ref.year})` : ''}</span>` : ''}
            </div>
          </div>
        </div>
      `);
    });
    
    refsList.on("click", ".view-ref-btn", function() {
      const refId = $(this).data("ref-id");
      $('#references-tab').tab('show');
      setTimeout(() => {
        combineReference(refId);
      }, 300);
    });
  }
  
  if (tagBlocksCount > 0 || tagDocsCount > 0) {
    const tagsList = $("#tagsResultsList");
    
    if (tagBlocksCount > 0) {
      tagsList.append(`<h6 class="border-bottom pb-2 mb-3"><i class="fas fa-cube"></i> Blocks</h6>`);
      
      tagResults.blocks.forEach(block => {
        const title = block.title || `Block ${block.id}`;
        
        tagsList.append(`
          <div class="card mb-2 search-result-card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <h6>
                  <i class="fas fa-cube text-primary mr-1"></i>
                  ${title} <small class="text-muted">(ID: ${block.id})</small>
                </h6>
                <button class="btn btn-sm btn-primary view-block-btn" data-block-id="${block.id}">
                  <i class="fas fa-eye mr-1"></i> View
                </button>
              </div>
              <div>${getHighlightedSearchContext(block.text, searchTerm, 100)}</div>
              ${block.tags && block.tags.length ? `
                <div class="mt-2">
                  ${block.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `);
      });
      
      tagsList.on("click", ".view-block-btn", function() {
        const blockId = $(this).data("block-id");
        $('#blocks-tab').tab('show');
        setTimeout(() => {
          fetchBlockById(blockId)
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
    
    if (tagDocsCount > 0) {
      tagsList.append(`<h6 class="border-bottom pb-2 mb-3 mt-4"><i class="fas fa-file-alt"></i> Documents</h6>`);
      
      tagResults.documents.forEach(doc => {
        tagsList.append(`
          <div class="card mb-2 search-result-card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <h6>
                  <i class="fas fa-file-alt text-success mr-1"></i>
                  ${doc.title} <small class="text-muted">(ID: ${doc.id})</small>
                </h6>
                <button class="btn btn-sm btn-success view-doc-btn" data-doc-id="${doc.id}">
                  <i class="fas fa-eye mr-1"></i> View
                </button>
              </div>
            </div>
          </div>
        `);
      });
      
      tagsList.on("click", ".view-doc-btn", function() {
        const docId = $(this).data("doc-id");
        $('#documents-tab').tab('show');
        setTimeout(() => {
          fetchDocumentById(docId)
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
  }
}

/**
 * Initialize enhanced tag visualization
 */
function initializeEnhancedTagVisualization() {
  // Add CSS for enhanced tag visualization if not already added
  if (!$('#enhancedTagStyles').length) {
    $('head').append(`
      <style id="enhancedTagStyles">
        /* Enhanced Tag Cloud */
        .tag-cloud-container {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 20px;
        }
        
        .tag-cloud-btn {
          margin: 0.25rem;
          padding: 0.35rem 0.8rem;
          border-radius: 20px;
          font-size: 0.875rem;
          transition: all 0.2s;
          border: 1px solid #dee2e6;
          background: white;
          color: #007bff;
          display: flex;
          align-items: center;
        }
        
        .tag-cloud-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 3px 10px rgba(0,0,0,0.1);
          border-color: #007bff;
        }
        
        .tag-cloud-btn .badge {
          margin-left: 5px;
          background-color: #f8f9fa;
          color: #6c757d;
          font-weight: normal;
        }
        
        /* Enhanced Tag Tree */
        .tag-tree {
          list-style: none;
          padding-left: 0.5rem;
          margin-bottom: 10px;
        }
        
        .tag-tree-root {
          padding-left: 0;
          border: 1px solid #f0f0f0;
          border-radius: 4px;
          background: #fcfcfc;
        }
        
        .tag-tree-item {
          display: flex;
          align-items: center;
          padding: 4px 0;
          transition: all 0.15s;
        }
        
        .tag-tree-item:hover {
          background-color: #f8f9fa;
        }
        
        .tag-tree-toggle {
          cursor: pointer;
          transition: transform 0.2s;
          width: 20px;
          text-align: center;
          color: #6c757d;
        }
        
        .tag-tree-toggle.fa-caret-down {
          transform: rotate(90deg);
        }
        
        .tag-tree-btn {
          flex-grow: 1;
          padding: 0.25rem 0.5rem;
          transition: all 0.2s;
          border: none;
          background: transparent;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .tag-tree-btn:hover {
          color: #007bff;
        }
        
        .tag-tree-btn-content {
          display: flex;
          align-items: center;
        }
        
        .tag-tree-btn .badge {
          background-color: #f0f0f0;
          color: #6c757d;
          font-weight: normal;
        }
        
        .tag-level-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 5px;
        }
        
        /* Nested tags styling */
        li .tag-tree {
          position: relative;
          margin-left: 20px; 
        }
        
        li .tag-tree:before {
          content: '';
          position: absolute;
          top: 0;
          left: -10px;
          height: 100%;
          border-left: 1px dashed #dee2e6;
        }
      </style>
    `);
  }
}

/**
 * Enhanced function to update the tag visualization
 * @param {Object} tagCounts - Object with tag names as keys and counts as values
 */
function updateTagVisualization(tagCounts) {
  // Create the improved tag cloud
  updateEnhancedTagCloud(tagCounts);
  
  // Create improved hierarchical tag tree
  const tagTreeContainer = $("#tagTreeContainer");
  tagTreeContainer.empty();
  
  // Build and render the tree
  const tagTree = buildTagTree(tagCounts);
  
  // Add a heading
  const heading = $('<h5>').text('Tag Hierarchy').addClass('mb-3 border-bottom pb-2');
  tagTreeContainer.append(heading);
  
  renderEnhancedTagTree(tagTree, tagTreeContainer);
  
  // Add info about usage
  const info = $('<div>').addClass('alert alert-info mt-3 small')
    .html('<i class="fas fa-info-circle mr-1"></i> Use slashes to create hierarchical tags (e.g., "power/cables/rating")');
  tagTreeContainer.append(info);
}

/**
 * Update the tag cloud with enhanced styling
 * @param {Object} tagCounts - Object with tag names as keys and counts as values
 */
function updateEnhancedTagCloud(tagCounts) {
  const tagCloud = $("#tagCloud");
  tagCloud.empty();
  
  // Create container for flex layout
  const cloudContainer = $('<div class="tag-cloud-container"></div>');
  tagCloud.append(cloudContainer);
  
  // Sort tags by frequency
  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
  
  // Display top 20 tags with enhanced styling
  sortedTags.slice(0, 20).forEach(tag => {
    const count = tagCounts[tag];
    // Scale font size between 0.8em and 1.3em based on frequency
    const fontSize = 0.8 + (count / Math.max(...Object.values(tagCounts))) * 0.5;
    // More saturated color for more frequent tags
    const colorSaturation = 40 + Math.min((count / Math.max(...Object.values(tagCounts))) * 30, 30);
    
    const tagBtn = $(`
      <button class="tag-cloud-btn">
        <i class="fas fa-tag mr-1" style="color: hsl(210, ${colorSaturation}%, 50%);"></i>
        ${tag}
        <span class="badge badge-pill ml-1">${count}</span>
      </button>
    `);
    tagBtn.css('font-size', `${fontSize}em`);
    
    tagBtn.click(function() {
      selectedTag = tag;
      $("#tagSearch").val(tag);
      $("#selectedTagName").text(tag);
      loadContentByTag(tag);
    });
    
    cloudContainer.append(tagBtn);
  });
}

/**
 * Enhanced tag tree rendering with better styling and UX
 * @param {Object} treeNode - The tag tree node to render
 * @param {jQuery} container - The container to append to
 * @param {number} level - The current nesting level
 * @returns {jQuery} - The rendered UL element
 */
function renderEnhancedTagTree(treeNode, container, level = 0) {
  const childrenKeys = Object.keys(treeNode.children).sort();
  if (childrenKeys.length === 0) return;
  
  // Each level gets its own UL for proper nesting
  const ul = $('<ul>').addClass('tag-tree');
  if (level === 0) ul.addClass('tag-tree-root');
  
  childrenKeys.forEach(key => {
    const child = treeNode.children[key];
    const hasChildren = Object.keys(child.children).length > 0;
    
    const li = $('<li>');
    
    // Visual indicator of hierarchy level
    const tagItem = $('<div>').addClass('tag-tree-item');
    
    // Add toggle icon for nodes with children
    if (hasChildren) {
      const toggleIcon = $('<i>').addClass('fas fa-caret-right tag-tree-toggle');
      tagItem.append(toggleIcon);
      
      // Improved toggle behavior
      toggleIcon.click(function(e) {
        e.stopPropagation();
        const nestedUl = $(this).closest('li').children('ul').first();
        nestedUl.slideToggle(200);
        $(this).toggleClass('fa-caret-right fa-caret-down');
      });
    } else {
      // Add indentation for leaf nodes to align with parent toggles
      tagItem.append($('<span style="width: 20px;"></span>'));
    }
    
    // Calculate color based on depth
    const hue = 210; // Blue
    const lightness = Math.max(50 - (level * 5), 30); // Darker with depth
    
    // Create button with better layout
    const tagBtn = $('<button>').addClass('tag-tree-btn');
    
    // Button content with level indicator
    const btnContent = $('<div>').addClass('tag-tree-btn-content');
    
    // Level indicator dot
    const levelIndicator = $('<span>')
      .addClass('tag-level-indicator')
      .css('background-color', `hsl(${hue}, 70%, ${lightness}%)`);
      
    // Tag name with appropriate indentation
    const tagName = $('<span>').text(child.name);
    
    btnContent.append(levelIndicator, tagName);
    
    // Count badge on the right
    const countBadge = $('<span>')
      .addClass('badge badge-pill')
      .text(child.count);
      
    // Add all elements to button
    tagBtn.append(btnContent, countBadge);
    
    // Add click handler to trigger tag filtering
    if (child.fullPath) {
      tagBtn.click(function(e) {
        e.stopPropagation(); // Prevent parent toggles from triggering
        selectedTag = child.fullPath;
        $("#tagSearch").val(child.fullPath);
        $("#selectedTagName").text(child.fullPath);
        loadContentByTag(child.fullPath);
        
        // Visual feedback
        $('.tag-tree-btn').removeClass('active');
        $(this).addClass('active');
      });
    }
    
    tagItem.append(tagBtn);
    li.append(tagItem);
    
    // Recursively build child nodes with proper DOM nesting
    if (hasChildren) {
      const childUl = renderEnhancedTagTree(child, li, level + 1);
      li.append(childUl);
      
      // Only hide deeper levels (2+) by default
      if (level >= 1) {
        childUl.hide();
      }
    }
    
    ul.append(li);
  });
  
  container.append(ul);
  return ul;
}


/**
 * Load documents by tag with enhanced UI
 * @param {string} tag - Tag to filter by
 */
function loadDocumentsByTag(tag) {
  const documentsList = $("#taggedDocumentsList");
  documentsList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>');
  
  if (!db) {
    documentsList.html('<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> Database not available. Please refresh the page.</div>');
    return;
  }
  
  const transaction = db.transaction("documents", "readonly");
  const store = transaction.objectStore("documents");
  let documentsFound = false;
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const doc = cursor.value;
      let hasTag = false;
      let matchingParagraphs = [];
      
      if (doc.paragraphs) {
        doc.paragraphs.forEach((para, index) => {
          if (para.tags && para.tags.includes(tag)) {
            hasTag = true;
            matchingParagraphs.push({
              index: index,
              content: para.content.substring(0, 150) + (para.content.length > 150 ? '...' : '')
            });
          }
        });
      }
      
      if (hasTag) {
        if (!documentsFound) {
          documentsList.empty();
          documentsFound = true;
        }
        
        // Create enhanced document card
        const docCard = $(`
          <div class="card mb-3 search-result-card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="mb-0">
                  <i class="fas fa-file-alt text-success mr-1"></i>
                  ${doc.title} 
                  <small class="text-muted">(ID: ${doc.id})</small>
                </h6>
                <button class="btn btn-sm btn-success view-doc-btn" data-doc-id="${doc.id}">
                  <i class="fas fa-eye mr-1"></i> View Document
                </button>
              </div>
              
              <div class="mb-2">
                <small class="text-muted">Found in ${matchingParagraphs.length} paragraph(s):</small>
                ${matchingParagraphs.map(p => `
                  <div class="border-left pl-2 my-1 text-truncate">
                    <small class="text-secondary">Paragraph ${p.index + 1}:</small> ${p.content}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `);
        
        // Add event handler for the view button
        docCard.find(".view-doc-btn").click(function() {
          const docId = $(this).data("doc-id");
          $('#documents-tab').tab('show');
          
          // Add small delay to ensure tab has switched
          setTimeout(() => {
            fetchDocumentById(docId)
              .then(doc => {
                if (doc) {
                  previewDocument(doc);
                  
                  // Highlight the paragraphs with the tag
                  setTimeout(() => {
                    doc.paragraphs.forEach((para, index) => {
                      if (para.tags && para.tags.includes(tag)) {
                        const paraElement = $("#docPreviewContent .card-body").eq(index);
                        if (paraElement.length) {
                          paraElement.addClass("highlight-paragraph");
                          
                          // Scroll to the first highlighted paragraph
                          if (index === matchingParagraphs[0].index) {
                            $('html, body').animate({
                              scrollTop: paraElement.offset().top - 100
                            }, 500);
                          }
                        }
                      }
                    });
                  }, 300);
                }
              })
              .catch(error => {
                console.error("Error fetching document:", error);
                showNotification("Error loading document: " + error.message, "danger");
              });
          }, 300);
        });
        
        documentsList.append(docCard);
      }
      cursor.continue();
    } else if (!documentsFound) {
      documentsList.html(`
        <div class="alert alert-info">
          <i class="fas fa-info-circle mr-2"></i> No documents found with tag "${tag}"
        </div>
      `);
    }
  };
}

/**
 * Highlight the selected tag in tag cloud and tree
 * @param {string} tag - Tag to highlight
 */
function highlightSelectedTag(tag) {
  // Remove existing highlights
  $(".tag-cloud-btn").removeClass("active");
  $(".tag-tree-btn").removeClass("active");
  
  // Highlight matching tag in cloud
  $(`.tag-cloud-btn:contains("${tag}")`).addClass("active");
  
  // Highlight and expand to matching tag in tree
  const tagParts = tag.split('/');
  let currentPath = '';
  
  // First make sure all parent paths are expanded
  for (let i = 0; i < tagParts.length; i++) {
    currentPath += (i > 0 ? '/' : '') + tagParts[i];
    
    // Find the tag node
    const tagNode = $(`.tag-tree-btn[data-path="${currentPath}"]`);
    if (tagNode.length && i < tagParts.length - 1) {
      // Expand parent nodes by clicking their toggle icons
      const toggleIcon = tagNode.closest('.tag-tree-item').find('.tag-tree-toggle');
      if (toggleIcon.length && !toggleIcon.hasClass('fa-caret-down')) {
        toggleIcon.click();
      }
    }
  }
  
  // Highlight the exact tag
  const tagBtn = $(`.tag-tree-btn[data-path="${tag}"]`);
  if (tagBtn.length) {
    tagBtn.addClass("active");
    
    // Scroll tag tree to make the selected tag visible
    const treeContainer = $("#tagTreeContainer");
    const tagOffset = tagBtn.offset().top - treeContainer.offset().top;
    
    if (tagOffset < 0 || tagOffset > treeContainer.height()) {
      treeContainer.animate({
        scrollTop: treeContainer.scrollTop() + tagOffset - treeContainer.height()/2
      }, 300);
    }
  }
}

/**
 * Initialize event handlers for dashboard components
 */
function initializeDashboardEvents() {
  // Make stats cards clickable to quick-navigate to related tabs
  $("#blocksCount").parent().click(function() {
    $('#blocks-tab').tab('show');
  });
  
  $("#documentsCount").parent().click(function() {
    $('#documents-tab').tab('show');
  });
  
  $("#referencesCount").parent().click(function() {
    $('#references-tab').tab('show');
  });
  
  // Add tooltips to stats cards
  $(".stats-card").tooltip({
    title: "Click to navigate",
    placement: "bottom"
  });
}

/**
 * Render enhanced tag tree with better data attributes
 * @param {Object} treeNode - The tag tree node to render
 * @param {jQuery} container - The container to append to
 * @param {number} level - The current nesting level
 * @returns {jQuery} - The rendered UL element
 */
function renderEnhancedTagTree(treeNode, container, level = 0) {
  const childrenKeys = Object.keys(treeNode.children).sort();
  if (childrenKeys.length === 0) return;
  
  // Each level gets its own UL for proper nesting
  const ul = $('<ul>').addClass('tag-tree');
  if (level === 0) ul.addClass('tag-tree-root');
  
  childrenKeys.forEach(key => {
    const child = treeNode.children[key];
    const hasChildren = Object.keys(child.children).length > 0;
    
    const li = $('<li>');
    
    // Visual indicator of hierarchy level
    const tagItem = $('<div>').addClass('tag-tree-item');
    
    // Add toggle icon for nodes with children
    if (hasChildren) {
      const toggleIcon = $('<i>').addClass('fas fa-caret-right tag-tree-toggle');
      tagItem.append(toggleIcon);
      
      // Improved toggle behavior
      toggleIcon.click(function(e) {
        e.stopPropagation();
        const nestedUl = $(this).closest('li').children('ul').first();
        nestedUl.slideToggle(200);
        $(this).toggleClass('fa-caret-right fa-caret-down');
      });
    } else {
      // Add indentation for leaf nodes to align with parent toggles
      tagItem.append($('<span style="width: 20px;"></span>'));
    }
    
    // Calculate color based on depth
    const hue = 210; // Blue
    const lightness = Math.max(50 - (level * 5), 30); // Darker with depth
    
    // Create button with better layout
    const tagBtn = $('<button>').addClass('tag-tree-btn');
    
    // Add data attributes for easier selection
    if (child.fullPath) {
      tagBtn.attr('data-path', child.fullPath);
    }
    
    // Button content with level indicator
    const btnContent = $('<div>').addClass('tag-tree-btn-content');
    
    // Level indicator dot
    const levelIndicator = $('<span>')
      .addClass('tag-level-indicator')
      .css('background-color', `hsl(${hue}, 70%, ${lightness}%)`);
      
    // Tag name with appropriate indentation
    const tagName = $('<span>').text(child.name);
    
    btnContent.append(levelIndicator, tagName);
    
    // Count badge on the right
    const countBadge = $('<span>')
      .addClass('badge badge-pill')
      .text(child.count);
      
    // Add all elements to button
    tagBtn.append(btnContent, countBadge);
    
    // Add click handler to trigger tag filtering
    if (child.fullPath) {
      tagBtn.click(function(e) {
        e.stopPropagation(); // Prevent parent toggles from triggering
        selectedTag = child.fullPath;
        $("#tagSearch").val(child.fullPath);
        $("#selectedTagName").text(child.fullPath);
        loadContentByTag(child.fullPath);
      });
    }
    
    tagItem.append(tagBtn);
    li.append(tagItem);
    
    // Recursively build child nodes with proper DOM nesting
    if (hasChildren) {
      const childUl = renderEnhancedTagTree(child, li, level + 1);
      li.append(childUl);
      
      // Only hide deeper levels (2+) by default
      if (level >= 1) {
        childUl.hide();
      }
    }
    
    ul.append(li);
  });
  
  container.append(ul);
  return ul;
}

/**
 * Update the tag cloud with enhanced styling and data attributes
 * @param {Object} tagCounts - Object with tag names as keys and counts as values
 */
function updateEnhancedTagCloud(tagCounts) {
  const tagCloud = $("#tagCloud");
  tagCloud.empty();
  
  // Create container for flex layout
  const cloudContainer = $('<div class="tag-cloud-container"></div>');
  tagCloud.append(cloudContainer);
  
  // Sort tags by frequency
  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
  
  // Display top 20 tags with enhanced styling
  sortedTags.slice(0, 20).forEach(tag => {
    const count = tagCounts[tag];
    // Scale font size between 0.8em and 1.3em based on frequency
    const fontSize = 0.8 + (count / Math.max(...Object.values(tagCounts))) * 0.5;
    // More saturated color for more frequent tags
    const colorSaturation = 40 + Math.min((count / Math.max(...Object.values(tagCounts))) * 30, 30);
    
    const tagBtn = $(`
      <button class="tag-cloud-btn" data-tag="${tag}">
        <i class="fas fa-tag mr-1" style="color: hsl(210, ${colorSaturation}%, 50%);"></i>
        ${tag}
        <span class="badge badge-pill ml-1">${count}</span>
      </button>
    `);
    tagBtn.css('font-size', `${fontSize}em`);
    
    tagBtn.click(function() {
      selectedTag = tag;
      $("#tagSearch").val(tag);
      $("#selectedTagName").text(tag);
      loadContentByTag(tag);
    });
    
    cloudContainer.append(tagBtn);
  });
}
/**
 * Additional functions to improve dashboard functionality
 * These functions enhance the dashboard with better UI and UX
 */

/**
 * Update the recent activity list with enhanced UI
 */
function loadRecentActivity() {
  if (!db) {
    $("#recentActivityList").html('<li class="list-group-item text-danger">Database not available. Please refresh the page.</li>');
    return;
  }
  
  // Maximum number of recent items to show
  const maxItems = 5;
  
  // Function to load items from a store with a 'created' or 'updated' field
  function loadRecentFromStore(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const items = [];
        
        store.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const item = cursor.value;
            // Add store name and original ID for reference
            item._storeType = storeName;
            items.push(item);
            cursor.continue();
          } else {
            resolve(items);
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
  
  // Load recent items from all stores
  Promise.all([
    loadRecentFromStore("blocks"),
    loadRecentFromStore("documents"),
    loadRecentFromStore("references"),
    loadRecentFromStore("actions"),
    loadRecentFromStore("workflows")
  ])
    .then(results => {
      // Combine all results
      const allItems = [];
      results.forEach(items => allItems.push(...items));
      
      // Sort by updated or created date, most recent first
      allItems.sort((a, b) => {
        const dateA = a.updated || a.created || new Date(0);
        const dateB = b.updated || b.created || new Date(0);
        return new Date(dateB) - new Date(dateA);
      });
      
      // Take the most recent items
      const recentItems = allItems.slice(0, maxItems);
      
      if (recentItems.length === 0) {
        $("#recentActivityList").html('<li class="list-group-item text-center text-muted">No recent activity to show</li>');
        return;
      }
      
      // Display recent items with enhanced UI
      $("#recentActivityList").empty();
      recentItems.forEach(item => {
        let title = '';
        let icon = '';
        let iconClass = '';
        let bgColor = '';
        let date = formatDate(item.updated || item.created);
        
        switch (item._storeType) {
          case 'blocks':
            title = item.title || `Block ${item.id}`;
            icon = 'cube';
            iconClass = 'text-primary';
            bgColor = 'rgba(0, 123, 255, 0.1)';
            break;
          case 'documents':
            title = item.title;
            icon = 'file-alt';
            iconClass = 'text-success';
            bgColor = 'rgba(40, 167, 69, 0.1)';
            break;
          case 'references':
            title = item.name;
            icon = 'bookmark';
            iconClass = 'text-warning';
            bgColor = 'rgba(255, 193, 7, 0.1)';
            break;
          case 'actions':
            title = item.title;
            icon = 'robot';
            iconClass = 'text-info';
            bgColor = 'rgba(23, 162, 184, 0.1)';
            break;
          case 'workflows':
            title = item.name;
            icon = 'cogs';
            iconClass = 'text-secondary';
            bgColor = 'rgba(108, 117, 125, 0.1)';
            break;
        }
        
        const li = $(`
          <li class="list-group-item p-0">
            <div class="recent-activity-item">
              <div class="recent-activity-icon ${iconClass}" style="background-color: ${bgColor}">
                <i class="fas fa-${icon}"></i>
              </div>
              <div class="recent-activity-content">
                <div class="recent-activity-title">${title}</div>
                <div class="recent-activity-time">${date}</div>
              </div>
            </div>
          </li>
        `);
        
        // Add click event to open the item
        li.click(function() {
          openRecentItem(item);
        });
        
        $("#recentActivityList").append(li);
      });
    })
    .catch(error => {
      console.error("Error loading recent activity:", error);
      $("#recentActivityList").html(`<li class="list-group-item text-danger">Error loading recent activity: ${error.message}</li>`);
    });
}

/**
 * Load blocks and documents by tag with updated UI
 * @param {string} tag - Tag to filter by
 */
function loadContentByTag(tag) {
  // Show a loading spinner while content is being loaded
  $("#taggedBlocksList, #taggedDocumentsList").html(
    '<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading content...</div>'
  );
  
  // Load blocks with the tag
  loadBlocksByTag(tag);
  
  // Load documents with the tag
  loadDocumentsByTag(tag);
  
  // Update tagged count
  updateTaggedItemCount(tag);
  
  // Highlight the selected tag in the tag cloud and tree
  highlightSelectedTag(tag);
}

/**
 * Update the tagged item count badge
 * @param {string} tag - The selected tag
 */
function updateTaggedItemCount(tag) {
  if (!db) {
    $("#taggedItemCount").text("0");
    return;
  }
  
  let blocksCount = 0;
  let docsCount = 0;
  let blocksDone = false;
  let docsDone = false;
  
  // Count blocks with tag
  const blocksTx = db.transaction("blocks", "readonly");
  const blocksStore = blocksTx.objectStore("blocks");
  
  blocksStore.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.tags && block.tags.includes(tag)) {
        blocksCount++;
      }
      cursor.continue();
    } else {
      blocksDone = true;
      updateBadge();
    }
  };
  
  // Count documents with tag
  const docsTx = db.transaction("documents", "readonly");
  const docsStore = docsTx.objectStore("documents");
  
  docsStore.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const doc = cursor.value;
      let hasTag = false;
      
      if (doc.paragraphs) {
        for (const para of doc.paragraphs) {
          if (para.tags && para.tags.includes(tag)) {
            hasTag = true;
            break;
          }
        }
      }
      
      if (hasTag) {
        docsCount++;
      }
      cursor.continue();
    } else {
      docsDone = true;
      updateBadge();
    }
  };
  
  function updateBadge() {
    if (blocksDone && docsDone) {
      const totalCount = blocksCount + docsCount;
      $("#taggedItemCount").text(totalCount);
      
      // Update tabs with counts
      $("#tag-blocks-tab").html(`<i class="fas fa-cube"></i> Blocks <span class="badge badge-light">${blocksCount}</span>`);
      $("#tag-documents-tab").html(`<i class="fas fa-file-alt"></i> Documents <span class="badge badge-light">${docsCount}</span>`);
    }
  }
}

/**
 * Load blocks by tag with enhanced UI
 * @param {string} tag - Tag to filter by
 */
function loadBlocksByTag(tag) {
  const blocksList = $("#taggedBlocksList");
  blocksList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading blocks...</div>');
  
  if (!db) {
    blocksList.html('<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> Database not available. Please refresh the page.</div>');
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  let blocksFound = false;
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.tags && block.tags.includes(tag)) {
        if (!blocksFound) {
          blocksList.empty();
          blocksFound = true;
        }
        
        // Create enhanced block card
        const blockCard = $(`
          <div class="card mb-3 search-result-card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="mb-0">
                  <i class="fas fa-cube text-primary mr-1"></i>
                  ${block.title || 'Block ' + block.id} 
                  <small class="text-muted">(ID: ${block.id})</small>
                </h6>
                <div class="btn-group">
                  <button class="btn btn-sm btn-primary view-tag-block-btn" data-block-id="${block.id}">
                    <i class="fas fa-eye mr-1"></i> View
                  </button>
                  <button class="btn btn-sm btn-warning edit-tag-block-btn" data-block-id="${block.id}">
                    <i class="fas fa-edit mr-1"></i> Edit
                  </button>
                </div>
              </div>
              
              <div class="block-content mb-2">${renderMarkdown(block.text)}</div>
              
              <div class="mt-2">
                ${block.tags.map(t => {
                  const isCurrentTag = t === tag;
                  return `<span class="badge ${isCurrentTag ? 'badge-primary' : 'badge-info'} mr-1">
                    ${t}${isCurrentTag ? ' <i class="fas fa-check"></i>' : ''}
                  </span>`;
                }).join('')}
                ${block.reference ? `<span class="badge badge-secondary">${block.reference}</span>` : ''}
              </div>
            </div>
          </div>
        `);
        
        // Add event handlers for the buttons
        blockCard.find(".view-tag-block-btn").on("click", function() {
          const blockId = $(this).data("block-id");
          fetchBlockById(blockId)
            .then(block => {
              if (block) {
                showBlockDetails(block);
              }
            })
            .catch(error => {
              console.error("Error fetching block:", error);
              showNotification("Error loading block: " + error.message, "danger");
            });
        });
        
        blockCard.find(".edit-tag-block-btn").on("click", function() {
          const blockId = $(this).data("block-id");
          editBlockUniversal(blockId);
        });
        
        blocksList.append(blockCard);
      }
      cursor.continue();
    } else if (!blocksFound) {
      blocksList.html(`
        <div class="alert alert-info">
          <i class="fas fa-info-circle mr-2"></i> No blocks found with tag "${tag}"
        </div>
      `);
    }
    
    // Render any Mermaid diagrams in the blocks
    renderMermaidIn("#taggedBlocksList .mermaid");
  };
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
 * Initialize quick action buttons
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
  
  // Add new action
  $("#quickAddAction").click(function() {
    $('#actions-tab').tab('show');
    $("#addActionBtn").click();
  });
  
  // Add new workflow
  $("#quickAddWorkflow").click(function() {
    $('#workflows-tab').tab('show');
    // Check if addWorkflowStep is available before calling
    if (typeof addWorkflowStep === 'function') {
      addWorkflowStep();
    }
  });
  
  // Export data
  $("#quickExportData").click(function() {
    exportData();
  });
}

/**
 * Format a date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  if (!date) return 'Unknown date';
  
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return d.toLocaleDateString();
  }
}

/**
 * Search blocks
 * @param {string} searchTerm - The search term
 * @returns {Promise<Object>} - Promise with search results
 */
function searchBlocks(searchTerm) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const results = [];
      const transaction = db.transaction("blocks", "readonly");
      const store = transaction.objectStore("blocks");
      
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
          
          if (searchableText.includes(searchTerm.toLowerCase())) {
            results.push(block);
          }
          cursor.continue();
        } else {
          resolve({ type: 'blocks', items: results });
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
 * Search documents
 * @param {string} searchTerm - The search term
 * @returns {Promise<Object>} - Promise with search results
 */
function searchDocuments(searchTerm) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const results = [];
      const transaction = db.transaction("documents", "readonly");
      const store = transaction.objectStore("documents");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          const doc = cursor.value;
          let searchableText = doc.title;
          
          // Add combined content if available
          if (doc.combinedContent) {
            searchableText += " " + doc.combinedContent;
          } else if (doc.paragraphs) {
            // Otherwise combine paragraph content
            doc.paragraphs.forEach(p => {
              searchableText += " " + p.content;
              if (p.tags) searchableText += " " + p.tags.join(" ");
            });
          }
          
          if (searchableText.toLowerCase().includes(searchTerm.toLowerCase())) {
            results.push(doc);
          }
          
          cursor.continue();
        } else {
          resolve({ type: 'documents', items: results });
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
 * Search references
 * @param {string} searchTerm - The search term
 * @returns {Promise<Object>} - Promise with search results
 */
function searchReferences(searchTerm) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const results = [];
      const transaction = db.transaction("references", "readonly");
      const store = transaction.objectStore("references");
      
      store.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          const ref = cursor.value;
          const searchableText = (
            ref.id + " " + 
            ref.name + " " + 
            (ref.description || "") + " " + 
            (ref.type || "") + " " + 
            (ref.author || "")
          ).toLowerCase();
          
          if (searchableText.includes(searchTerm.toLowerCase())) {
            results.push(ref);
          }
          cursor.continue();
        } else {
          resolve({ type: 'references', items: results });
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
 * Search by tag
 * @param {string} tagName - The tag to search for
 * @returns {Promise<Object>} - Promise with search results
 */
function searchByTag(tagName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const results = {
        blocks: [],
        documents: []
      };
      let blocksDone = false;
      let documentsDone = false;
      
      // Search blocks with the tag
      const blocksTx = db.transaction("blocks", "readonly");
      const blocksStore = blocksTx.objectStore("blocks");
      
      blocksStore.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          const block = cursor.value;
          if (block.tags && block.tags.some(tag => 
            tag.toLowerCase().includes(tagName.toLowerCase())
          )) {
            results.blocks.push(block);
          }
          cursor.continue();
        } else {
          blocksDone = true;
          checkDone();
        }
      };
      
      // Search documents with the tag
      const docsTx = db.transaction("documents", "readonly");
      const docsStore = docsTx.objectStore("documents");
      
      docsStore.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          const doc = cursor.value;
          let hasTag = false;
          
          if (doc.paragraphs) {
            for (const para of doc.paragraphs) {
              if (para.tags && para.tags.some(tag => 
                tag.toLowerCase().includes(tagName.toLowerCase())
              )) {
                hasTag = true;
                break;
              }
            }
          }
          
          if (hasTag) {
            results.documents.push(doc);
          }
          cursor.continue();
        } else {
          documentsDone = true;
          checkDone();
        }
      };
      
      function checkDone() {
        if (blocksDone && documentsDone) {
          resolve({ 
            type: 'tags', 
            items: { 
              blocks: results.blocks, 
              documents: results.documents 
            } 
          });
        }
      }
      
      blocksTx.onerror = function(e) {
        reject(e.target.error);
      };
      
      docsTx.onerror = function(e) {
        reject(e.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Dashboard AI Actions Integration
 * This code adds an AI Actions panel to the dashboard tab, allowing users to
 * quickly execute actions without navigating to the Actions tab.
 */

// Add this to the dashboard.js file

/**
 * Initialize AI Actions panel on dashboard
 */
function initializeDashboardActions() {
  // Create AI Actions panel
  const actionsPanel = $(`
    <div class="card shadow-sm mt-4">
      <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
        <h5 class="mb-0"><i class="fas fa-robot mr-2"></i> Quick AI Actions</h5>
        <button class="btn btn-sm btn-outline-primary" id="refreshActionsBtn">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
      <div class="card-body">
        <div class="alert alert-warning" id="dashboardActionsInfo">
          <i class="fas fa-info-circle mr-2"></i>Select an action and content to process, then run the action directly from the dashboard. Pay attention not to type in and select sensitive data as input.
        </div>
        
        <div class="form-group">
          <label for="dashboardActionSelect"><strong>Select Action</strong></label>
          <select id="dashboardActionSelect" class="form-control">
            <option value="">Choose an action...</option>
          </select>
          <small class="form-text text-muted">These actions are configured in the Actions tab</small>
        </div>
        
        <div id="dashboardActionDetails" class="mb-3 d-none">
          <div class="card bg-light">
            <div class="card-body">
              <h6 class="card-title" id="dashboardActionTitle"></h6>
              <p class="card-text small" id="dashboardActionDescription"></p>
              <div class="badge badge-info mb-2" id="dashboardActionModel"></div>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="dashboardActionInput"><strong>Input Content</strong></label>
          <div class="input-source-options mb-2">
            <div class="custom-control custom-radio custom-control-inline">
              <input type="radio" id="inputSourceDirect" name="inputSource" class="custom-control-input" value="direct" checked>
              <label class="custom-control-label" for="inputSourceDirect">Direct Input</label>
            </div>
            <div class="custom-control custom-radio custom-control-inline">
              <input type="radio" id="inputSourceSelect" name="inputSource" class="custom-control-input" value="select">
              <label class="custom-control-label" for="inputSourceSelect">Select Content</label>
            </div>
          </div>
          
          <div id="directInputContainer">
            <textarea id="dashboardActionInput" class="form-control" rows="4" placeholder="Enter content to process..."></textarea>
          </div>
          
          <div id="selectContentContainer" class="d-none">
            <button id="dashboardSelectContentBtn" class="btn btn-outline-secondary btn-block">
              <i class="fas fa-list"></i> Select Content Items
            </button>
            <div id="dashboardSelectedItems" class="mt-2">
              <small class="text-muted">No items selected</small>
            </div>
          </div>
        </div>
        
        <button id="dashboardRunActionBtn" class="btn btn-primary btn-block" disabled>
          <i class="fas fa-play"></i> Run Action
        </button>
      </div>
    </div>
    
    <div id="dashboardActionResultContainer" class="mt-3"></div>
  `);
  
  // Add the panel to the dashboard after the search card
  actionsPanel.insertAfter($("#dashboardView .universal-search-container").closest(".row").next());
  
  // Setup event handlers
  initializeDashboardActionHandlers();
  
  // Load available actions
  loadActionsForDashboard();
}

/**
 * Initialize event handlers for dashboard actions panel
 */
function initializeDashboardActionHandlers() {
  // Action selection change handler
  $("#dashboardActionSelect").on("change", function() {
    const actionId = $(this).val();
    if (actionId) {
      fetchActionDetails(actionId);
      $("#dashboardRunActionBtn").prop("disabled", false);
    } else {
      $("#dashboardActionDetails").addClass("d-none");
      $("#dashboardRunActionBtn").prop("disabled", true);
    }
  });
  
  // Input source radio buttons
  $("input[name='inputSource']").on("change", function() {
    const inputSource = $(this).val();
    if (inputSource === "direct") {
      $("#directInputContainer").removeClass("d-none");
      $("#selectContentContainer").addClass("d-none");
    } else {
      $("#directInputContainer").addClass("d-none");
      $("#selectContentContainer").removeClass("d-none");
    }
  });
  
  // Select content button
  $("#dashboardSelectContentBtn").on("click", function() {
    dashboardPrepareContentSelection();
  });
  
  // Run action button
  $("#dashboardRunActionBtn").on("click", function() {
    runActionFromDashboard();
  });
  
  // Refresh actions button
  $("#refreshActionsBtn").on("click", function() {
    $(this).find("i").addClass("fa-spin");
    loadActionsForDashboard().then(() => {
      setTimeout(() => {
        $(this).find("i").removeClass("fa-spin");
      }, 500);
    });
  });
}

/**
 * Load available actions for the dashboard dropdown
 * @returns {Promise} Promise that resolves when actions are loaded
 */
function loadActionsForDashboard() {
  return new Promise((resolve, reject) => {
    const actionSelect = $("#dashboardActionSelect");
    actionSelect.html('<option value="">Choose an action...</option>');
    
    if (!db) {
      actionSelect.append('<option value="" disabled>Database not available</option>');
      resolve();
      return;
    }
    
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        const action = cursor.value;
        actionSelect.append(`<option value="${action.id}">${action.title}</option>`);
        cursor.continue();
      } else {
        resolve();
      }
    };
    
    transaction.onerror = function(e) {
      console.error("Error loading actions:", e.target.error);
      reject(e.target.error);
    };
  });
}

/**
 * Fetch action details when selected
 * @param {number} actionId - The action ID
 */
function fetchActionDetails(actionId) {
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("actions", "readonly");
  const store = transaction.objectStore("actions");
  
  store.get(parseInt(actionId)).onsuccess = function(e) {
    const action = e.target.result;
    if (action) {
      $("#dashboardActionTitle").text(action.title);
      $("#dashboardActionDescription").text(action.description || "No description available.");
      $("#dashboardActionModel").text(`Model: ${action.model || "Default"}`);
      $("#dashboardActionDetails").removeClass("d-none");
    } else {
      $("#dashboardActionDetails").addClass("d-none");
      showNotification("Action not found", "warning");
    }
  };
}

/**
 * Prepare content selection for dashboard action
 */
function dashboardPrepareContentSelection() {
  // Initialize selection modal with empty selection
  selectedContentItems = [];
  updateSelectedItemsUI();
  
  // Set modal title and info
  $("#contentSelectionModalLabel").text("Select Content for Action");
  $(".action-selection-info").text("Select content to process with this action");
  $("#contentSelectionModal").data("selection-mode", "multiple");
  
  // Clear dashboard-specific flag if present
  $("#contentSelectionModal").removeData("dashboard-action");
  // Set dashboard flag to handle confirmation differently
  $("#contentSelectionModal").data("dashboard-action", true);
  
  // Load content for selection
  loadBlocksForSelection();
  loadDocumentsForSelection();
  loadTagsForSelection();
  loadReferencesForSelection();
  
  // Custom handling for dashboard actions
  $("#confirmContentSelection").off("click").on("click", function() {
    // Update the dashboard UI with selection info
    $("#dashboardSelectedItems").html(
      `<small class="text-success"><i class="fas fa-check-circle"></i> ${selectedContentItems.length} item(s) selected</small>`
    );
    
    // Close the modal
    $("#contentSelectionModal").modal("hide");
  });
  
  // Show the modal
  $("#contentSelectionModal").modal("show");
}

/**
 * Run action from dashboard
 */
async function runActionFromDashboard() {
  const actionId = $("#dashboardActionSelect").val();
  if (!actionId) {
    showNotification("Please select an action first", "warning");
    return;
  }
  
  const inputSource = $("input[name='inputSource']:checked").val();
  let content = "";
  
  // Show loading indicator
  $("#dashboardActionResultContainer").html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Processing...</div>');
  
  try {
    if (inputSource === "direct") {
      // Get direct input content
      content = $("#dashboardActionInput").val().trim();
      if (!content) {
        showNotification("Please enter some content to process", "warning");
        $("#dashboardActionResultContainer").empty();
        return;
      }
    } else {
      // Get content from selected items
      if (selectedContentItems.length === 0) {
        showNotification("Please select some content items first", "warning");
        $("#dashboardActionResultContainer").empty();
        return;
      }
      
      try {
        content = await assembleContentFromSelectedItems();
      } catch (error) {
        console.error("Error assembling content:", error);
        showNotification("Error preparing selected content: " + error.message, "danger");
        $("#dashboardActionResultContainer").empty();
        return;
      }
    }
    
    // Custom version of runActionWithContent specifically for dashboard
    executeDashboardAction(actionId, content);
    
  } catch (error) {
    console.error("Error running action:", error);
    $("#dashboardActionResultContainer").html(`
      <div class="alert alert-danger">
        <strong>Error:</strong> ${error.message || "An error occurred while running the action"}
      </div>
    `);
  }
}

/**
 * Execute an action from the dashboard
 * @param {number} actionId - The action ID
 * @param {string} content - The content to process
 */
function executeDashboardAction(actionId, content) {
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("actions", "readonly");
  const store = transaction.objectStore("actions");
  
  store.get(parseInt(actionId)).onsuccess = function(e) {
    const action = e.target.result;
    if (!action) {
      $("#dashboardActionResultContainer").html('<div class="alert alert-danger">Action not found</div>');
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
      $("#dashboardActionResultContainer").html(`
        <div class="alert alert-warning">
          <strong>API Key Missing!</strong> Please add your OpenAI API key in the Settings tab to use this feature.
        </div>
      `);
      return;
    }
    
    $("#dashboardActionResultContainer").html('');
    $("#dashboardActionResultContainer").append(contentPreview);
    $("#dashboardActionResultContainer").append('<div class="text-center my-3"><i class="fas fa-spinner fa-spin"></i> Processing your request...</div>');
    
    callOpenAiApi(action, processedPrompt).then(response => {
      $("#dashboardActionResultContainer").find('.text-center').remove();
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

      $("#dashboardActionResultContainer").append(resultPreview);
$("#dashboardActionResultContainer").data("raw-result", response);

// Add event handlers for the buttons
resultPreview.find(".copy-result-btn").click(function() {
  copyTextToClipboard(response);
});

resultPreview.find(".save-as-paragraph-btn").click(function() {
  saveResultAsParagraph(response);
});
      
    }).catch(error => {
      $("#dashboardActionResultContainer").find('.text-center').remove();
      $("#dashboardActionResultContainer").append(`
        <div class="alert alert-danger">
          <strong>Error:</strong> ${error.message || error}
        </div>
      `);
    });
  };
}