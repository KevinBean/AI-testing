/**
 * SearchUI - User interface components for the search functionality
 * Provides UI elements and interactions for the SearchHelper
 */

const SearchUI = (function() {
  console.log("Initializing SearchUI module");
  // Private properties
  let currentSearchQuery = '';
  let currentSearchOptions = {
    scope: 'all',
    limit: 20,
    includeContent: true,
    contextSize: 100
  };
  
  /**
   * Initialize the universal search UI
   * @param {Object} options - Options for search UI
   */
  function initializeSearchUI(options = {}) {
    const {
      searchInputSelector = '#universalSearch',
      searchButtonSelector = '#universalSearchBtn',
      searchScopeSelector = '#searchScope',
      resultsContainerSelector = '#searchResultsContainer',
      searchFormSelector = '#searchForm',
      autoSuggestDelay = 300
    } = options;
    
    // Initialize the search form
    $(searchFormSelector).on('submit', function(e) {
      e.preventDefault();
      const query = $(searchInputSelector).val().trim();
      const scope = $(searchScopeSelector).val();
      
      performSearch(query, { scope });
    });
    
    // Initialize search button click
    $(searchButtonSelector).on('click', function() {
      $(searchFormSelector).trigger('submit');
    });
    
    // Initialize search scope change
    $(searchScopeSelector).on('change', function() {
      // If there's already a search query, update results with new scope
      if (currentSearchQuery) {
        const scope = $(this).val();
        performSearch(currentSearchQuery, { scope });
      }
    });
    
    // Initialize autosuggest
    let suggestTimeout;
    $(searchInputSelector).on('input', function() {
      clearTimeout(suggestTimeout);
      
      const query = $(this).val().trim();
      if (query.length < 2) return;
      
      suggestTimeout = setTimeout(() => {
        updateSearchSuggestions(query);
      }, autoSuggestDelay);
    });
    
    // Add keyup event for "Enter" key
    $(searchInputSelector).on('keyup', function(e) {
      if (e.key === 'Enter') {
        $(searchFormSelector).trigger('submit');
      }
    });
    
    // Add data-toggle buttons to switch between view types
    $(document).on('click', '.search-view-toggle', function() {
      $('.search-view-toggle').removeClass('active');
      $(this).addClass('active');
      
      const viewType = $(this).data('view');
      
      // Toggle visibility of result sections
      $('.search-results-section').hide();
      $(`.search-results-section[data-view="${viewType}"]`).show();
    });
    
    // Initialize search helper syntax tooltip
    if ($(searchInputSelector).length) {
      const tooltipHtml = `
        <div class="search-syntax-help">
          <h6>Search Syntax Help</h6>
          <ul class="small">
            <li><strong>Phrase search:</strong> "exact phrase"</li>
            <li><strong>Boolean operators:</strong> term1 AND term2, term1 OR term2</li>
            <li><strong>Exclude terms:</strong> NOT term, -term</li>
            <li><strong>Field search:</strong> title:term, content:term, tags:term</li>
          </ul>
        </div>
      `;
      
      $(searchInputSelector).after(tooltipHtml);
      
      // Toggle visibility of syntax help on focus
      $(searchInputSelector).on('focus', function() {
        $('.search-syntax-help').fadeIn(200);
      }).on('blur', function() {
        setTimeout(() => {
          $('.search-syntax-help').fadeOut(200);
        }, 200);
      });
    }
  }
  
  /**
   * Update search suggestions based on partial query
   * @param {string} query - Partial search query
   */
  async function updateSearchSuggestions(query) {
    const suggestions = await SearchHelper.getSuggestions(query);
    
    // If suggestions exist, show them
    if (suggestions.length > 0) {
      let suggestionsHtml = '<div class="search-suggestions">';
      
      suggestions.forEach(suggestion => {
        suggestionsHtml += `
          <div class="search-suggestion" data-suggestion="${suggestion}">
            <i class="fas fa-search-plus"></i> ${suggestion}
          </div>
        `;
      });
      
      suggestionsHtml += '</div>';
      
      // Remove existing suggestions and add new ones
      $('.search-suggestions').remove();
      $('#universalSearch').after(suggestionsHtml);
      
      // Add click handlers
      $('.search-suggestion').on('click', function() {
        const suggestion = $(this).data('suggestion');
        
        // Get current search text and add the suggestion
        const currentText = $('#universalSearch').val();
        const lastSpaceIndex = currentText.lastIndexOf(' ');
        
        if (lastSpaceIndex === -1) {
          // Replace the entire text
          $('#universalSearch').val(suggestion);
        } else {
          // Replace just the last term
          const prefix = currentText.substring(0, lastSpaceIndex + 1);
          $('#universalSearch').val(prefix + suggestion);
        }
        
        // Clear suggestions
        $('.search-suggestions').remove();
        
        // Focus back on search input
        $('#universalSearch').focus();
      });
    } else {
      // Remove existing suggestions if none found
      $('.search-suggestions').remove();
    }
  }
  
  /**
   * Perform a search and update the UI with results
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async function performSearch(query, options = {}) {
    console.log("Performing search:", query, options);
    
    if (!query) return;
    
    // Store current search for potential refinement
    currentSearchQuery = query;
    currentSearchOptions = { ...currentSearchOptions, ...options };
    
    // Show loading indicator
    $('#searchResultsContainer').html(`
      <div class="text-center p-4">
        <i class="fas fa-spinner fa-spin fa-2x"></i>
        <p>Searching for "${query}"...</p>
      </div>
    `);
    
    try {
      // Check if SearchHelper is available
      if (typeof SearchHelper === 'undefined') {
        $('#searchResultsContainer').html(`
          <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            SearchHelper module is not available!
          </div>
        `);
        console.error("SearchHelper is not defined. Make sure search-helper.js is loaded properly.");
        return;
      }
      
      // Check if window.db is available
      if (!window.db) {
        $('#searchResultsContainer').html(`
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            Database is not available!
          </div>
        `);
        console.error("Database is not initialized. Make sure db.js is loaded properly.");
        return;
      }
      
      console.log("About to call SearchHelper.search with:", query, currentSearchOptions);
      
      // Perform the search
      const results = await SearchHelper.search(query, currentSearchOptions);
      console.log("Search results:", results);
      
      // Count total results
      const totalResults = 
        results.blocks.length + 
        results.documents.length + 
        results.references.length + 
        results.tags.blocks.length + 
        results.tags.documents.length;
      
      if (totalResults === 0) {
        $('#searchResultsContainer').html(`
          <div class="alert alert-info">
            <i class="fas fa-info-circle mr-2"></i>
            No results found for "${query}"
          </div>
        `);
        return;
      }
      
      // Generate results HTML
      let resultsHtml = `
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
              <i class="fas fa-search mr-2"></i>
              Search Results for "${query}"
            </h5>
            <span class="badge badge-primary badge-pill">${totalResults} results</span>
          </div>
          <div class="card-body">
            <div class="search-results-nav mb-3">
              <div class="btn-group">
                <button class="btn btn-outline-primary search-view-toggle active" data-view="all">
                  All Results <span class="badge badge-light">${totalResults}</span>
                </button>
                ${results.blocks.length > 0 ? `
                  <button class="btn btn-outline-primary search-view-toggle" data-view="blocks">
                    Blocks <span class="badge badge-light">${results.blocks.length}</span>
                  </button>
                ` : ''}
                ${results.documents.length > 0 ? `
                  <button class="btn btn-outline-primary search-view-toggle" data-view="documents">
                    Documents <span class="badge badge-light">${results.documents.length}</span>
                  </button>
                ` : ''}
                ${results.references.length > 0 ? `
                  <button class="btn btn-outline-primary search-view-toggle" data-view="references">
                    References <span class="badge badge-light">${results.references.length}</span>
                  </button>
                ` : ''}
                ${(results.tags.blocks.length > 0 || results.tags.documents.length > 0) ? `
                  <button class="btn btn-outline-primary search-view-toggle" data-view="tags">
                    Tags <span class="badge badge-light">${results.tags.blocks.length + results.tags.documents.length}</span>
                  </button>
                ` : ''}
              </div>
            </div>
            
            <div class="search-results-content">
              <!-- All Results Section -->
              <div class="search-results-section" data-view="all">
                ${renderResultsSection(results)}
              </div>
              
              <!-- Blocks Results Section -->
              <div class="search-results-section" data-view="blocks" style="display: none;">
                ${renderBlockResults(results.blocks)}
              </div>
              
              <!-- Documents Results Section -->
              <div class="search-results-section" data-view="documents" style="display: none;">
                ${renderDocumentResults(results.documents)}
              </div>
              
              <!-- References Results Section -->
              <div class="search-results-section" data-view="references" style="display: none;">
                ${renderReferenceResults(results.references)}
              </div>
              
              <!-- Tags Results Section -->
              <div class="search-results-section" data-view="tags" style="display: none;">
                <h6 class="border-bottom pb-2">Tagged Blocks</h6>
                ${renderBlockResults(results.tags.blocks)}
                
                <h6 class="border-bottom pb-2 mt-4">Tagged Documents</h6>
                ${renderDocumentResults(results.tags.documents)}
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Update the UI
      $('#searchResultsContainer').html(resultsHtml);
      
      // Render any Mermaid diagrams in the results
      setTimeout(() => {
        renderMermaidIn("#searchResultsContainer .mermaid");
      }, 100);
    } catch (error) {
      console.error("Search error:", error);
      $('#searchResultsContainer').html(`
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          Error performing search: ${error.message}
        </div>
      `);
    }
  }
  
  /**
   * Render the combined results section
   * @param {Object} results - Search results
   * @returns {string} - HTML for the combined results
   */
  function renderResultsSection(results) {
    // Combine all results and sort by score
    const allResults = [
      ...results.blocks,
      ...results.documents,
      ...results.references,
      ...results.tags.blocks,
      ...results.tags.documents
    ].sort((a, b) => b.score - a.score);
    
    if (allResults.length === 0) {
      return '<p class="text-muted">No results found.</p>';
    }
    
    let html = '';
    
    // Render top 10 results (or fewer if less than 10)
    const topResults = allResults.slice(0, 10);
    
    topResults.forEach(result => {
      const item = result.item;
      
      switch (result.type) {
        case 'block':
          html += renderBlockResultCard(result);
          break;
        case 'document':
          html += renderDocumentResultCard(result);
          break;
        case 'reference':
          html += renderReferenceResultCard(result);
          break;
      }
    });
    
    return html;
  }
  
  /**
   * Render block search results
   * @param {Array} blocks - Block search results
   * @returns {string} - HTML for block results
   */
  function renderBlockResults(blocks) {
    if (!blocks || blocks.length === 0) {
      return '<p class="text-muted">No blocks found.</p>';
    }
    
    let html = '';
    blocks.forEach(result => {
      html += renderBlockResultCard(result);
    });
    
    return html;
  }
  
  /**
   * Render document search results
   * @param {Array} documents - Document search results
   * @returns {string} - HTML for document results
   */
  function renderDocumentResults(documents) {
    if (!documents || documents.length === 0) {
      return '<p class="text-muted">No documents found.</p>';
    }
    
    let html = '';
    documents.forEach(result => {
      html += renderDocumentResultCard(result);
    });
    
    return html;
  }
  
  /**
   * Render reference search results
   * @param {Array} references - Reference search results
   * @returns {string} - HTML for reference results
   */
  function renderReferenceResults(references) {
    if (!references || references.length === 0) {
      return '<p class="text-muted">No references found.</p>';
    }
    
    let html = '';
    references.forEach(result => {
      html += renderReferenceResultCard(result);
    });
    
    return html;
  }
  
  /**
   * Render a block result card
   * @param {Object} result - Block search result
   * @returns {string} - HTML for block result card
   */
  function renderBlockResultCard(result) {
    const block = result.item;
    const title = block.title || `Block ${block.id}`;
    
    return `
      <div class="card mb-3 search-result-card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <h6>
              <i class="fas fa-cube text-primary mr-1"></i>
              ${title} <small class="text-muted">(ID: ${block.id})</small>
            </h6>
            <div class="btn-group">
              <button class="btn btn-sm btn-primary view-block-btn" data-block-id="${block.id}">
                <i class="fas fa-eye mr-1"></i> View
              </button>
              <button class="btn btn-sm btn-outline-secondary edit-block-btn" data-block-id="${block.id}">
                <i class="fas fa-edit mr-1"></i> Edit
              </button>
            </div>
          </div>
          
          <div class="search-result-content">
            ${result.highlightedContent || renderMarkdown(block.text)}
          </div>
          
          ${block.tags && block.tags.length ? `
            <div class="mt-2">
              ${block.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}
            </div>
          ` : ''}
          
          ${block.reference ? `
            <div class="mt-1 small text-muted">
              <i class="fas fa-bookmark mr-1"></i> ${block.reference}
              ${block.refLevels && block.refLevels.length ? ' ' + block.refLevels.join('.') : ''}
            </div>
          ` : ''}
          
          <div class="mt-1 text-right">
            <small class="text-muted">Match Score: ${result.score.toFixed(1)}</small>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render a document result card
   * @param {Object} result - Document search result
   * @returns {string} - HTML for document result card
   */
  function renderDocumentResultCard(result) {
    const doc = result.item;
    
    return `
      <div class="card mb-3 search-result-card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <h6>
              <i class="fas fa-file-alt text-success mr-1"></i>
              ${doc.title} <small class="text-muted">(ID: ${doc.id})</small>
            </h6>
            <div class="btn-group">
              <button class="btn btn-sm btn-success view-doc-btn" data-doc-id="${doc.id}">
                <i class="fas fa-eye mr-1"></i> View
              </button>
              <button class="btn btn-sm btn-outline-secondary edit-doc-btn" data-doc-id="${doc.id}">
                <i class="fas fa-edit mr-1"></i> Edit
              </button>
            </div>
          </div>
          
          <div class="search-result-content">
            ${result.highlightedContent || ''}
          </div>
          
          <div class="mt-2">
            <small class="text-muted">${doc.paragraphs ? doc.paragraphs.length : 0} paragraphs</small>
          </div>
          
          <div class="mt-1 text-right">
            <small class="text-muted">Match Score: ${result.score.toFixed(1)}</small>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render a reference result card
   * @param {Object} result - Reference search result
   * @returns {string} - HTML for reference result card
   */
  function renderReferenceResultCard(result) {
    const ref = result.item;
    
    return `
      <div class="card mb-3 search-result-card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <h6>
              <i class="fas fa-bookmark text-warning mr-1"></i>
              ${ref.name} <small class="text-muted">(ID: ${ref.id})</small>
            </h6>
            <div class="btn-group">
              <button class="btn btn-sm btn-warning view-ref-btn" data-ref-id="${ref.id}">
                <i class="fas fa-eye mr-1"></i> View
              </button>
              <button class="btn btn-sm btn-outline-secondary edit-ref-btn" data-ref-id="${ref.id}">
                <i class="fas fa-edit mr-1"></i> Edit
              </button>
            </div>
          </div>
          
          <div class="search-result-content">
            ${result.highlightedContent || ref.description || ''}
          </div>
          
          <div class="mt-2">
            ${ref.type ? `<span class="badge badge-secondary mr-2">${ref.type}</span>` : ''}
            ${ref.author ? `<small class="text-muted mr-2">Author: ${ref.author}</small>` : ''}
            ${ref.year ? `<small class="text-muted mr-2">Year: ${ref.year}</small>` : ''}
          </div>
          
          <div class="mt-1 text-right">
            <small class="text-muted">Match Score: ${result.score.toFixed(1)}</small>
          </div>
        </div>
      </div>
    `;
  }
  
  // Register event handlers
  $(document).ready(function() {
    // Initialize search UI
    initializeSearchUI();
    
    // Add event handlers for result actions
    $(document).on('click', '.view-block-btn', function() {
      const blockId = $(this).data('block-id');
      // Switch to blocks tab
      $('#blocks-tab').tab('show');
      
      // Wait for tab to be visible before showing block details
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
    
    $(document).on('click', '.edit-block-btn', function() {
      const blockId = $(this).data('block-id');
      editBlockUniversal(blockId);
    });
    
    $(document).on('click', '.view-doc-btn', function() {
      const docId = $(this).data('doc-id');
      // Switch to documents tab
      $('#documents-tab').tab('show');
      
      // Wait for tab to be visible before showing document
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
    
    $(document).on('click', '.edit-doc-btn', function() {
      const docId = $(this).data('doc-id');
      $('#documents-tab').tab('show');
      
      setTimeout(() => {
        fetchDocumentById(docId)
          .then(doc => {
            if (doc) {
              editDocument(doc);
            }
          })
          .catch(error => {
            console.error("Error fetching document:", error);
          });
      }, 300);
    });
    
    $(document).on('click', '.view-ref-btn', function() {
      const refId = $(this).data('ref-id');
      // Switch to references tab
      $('#references-tab').tab('show');
      
      // Show the reference details after tab switch
      setTimeout(() => {
        combineReference(refId);
      }, 300);
    });
    
    $(document).on('click', '.edit-ref-btn', function() {
      const refId = $(this).data('ref-id');
      $('#references-tab').tab('show');
      
      setTimeout(() => {
        loadReferenceForEdit(refId);
      }, 300);
    });
  });
  
  /**
   * Load a reference for editing
   * @param {string} refId - Reference ID
   */
  function loadReferenceForEdit(refId) {
    if (!db) return;
    
    const transaction = db.transaction("references", "readonly");
    const store = transaction.objectStore("references");
    
    store.get(refId).onsuccess = function(e) {
      const ref = e.target.result;
      if (ref) {
        editReference(ref);
      }
    };
  }
  
  // Public API
  return {
    /**
     * Initialize the search UI
     * @param {Object} options - UI options
     */
    init: initializeSearchUI,
    
    /**
     * Perform a search and update the UI
     * @param {string} query - Search query
     * @param {Object} options - Search options
     */
    search: performSearch,
    
    /**
     * Get the current search query
     * @returns {string} - Current search query
     */
    getCurrentQuery: function() {
      return currentSearchQuery;
    },
    
    /**
     * Get the current search options
     * @returns {Object} - Current search options
     */
    getCurrentOptions: function() {
      return { ...currentSearchOptions };
    },
    
    /**
     * Update search suggestions for a partial query
     * @param {string} query - Partial query
     */
    updateSuggestions: updateSearchSuggestions
  };
})();