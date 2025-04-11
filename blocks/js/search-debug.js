/**
 * Search Debugging Tool
 * Simple utility for testing and debugging the search functionality
 */

const SearchDebugger = {
  /**
   * Initialize the debugging UI
   */
  init: function() {
    // Create debugging panel
    const debugPanel = $(`
      <div id="search-debug-panel" style="position: fixed; bottom: 10px; right: 10px; width: 400px; 
           background: white; border: 1px solid #ccc; border-radius: 5px; z-index: 9999; 
           box-shadow: 0 0 10px rgba(0,0,0,0.2); display: none;">
        <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <strong>Search Debugger</strong>
          <button id="search-debug-close" class="btn btn-sm btn-outline-secondary">Close</button>
        </div>
        <div style="padding: 10px;">
          <div class="input-group mb-3">
            <input type="text" id="debug-search-input" class="form-control" placeholder="Enter search query">
            <div class="input-group-append">
              <button class="btn btn-primary" id="debug-search-btn">Test</button>
            </div>
          </div>
          
          <div class="form-group">
            <label>Search Scope:</label>
            <select id="debug-search-scope" class="form-control">
              <option value="all">All</option>
              <option value="blocks">Blocks</option>
              <option value="documents">Documents</option>
              <option value="references">References</option>
              <option value="tags">Tags</option>
            </select>
          </div>
          
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="debug-verbose" checked>
            <label class="form-check-label" for="debug-verbose">
              Verbose Logging
            </label>
          </div>
          
          <div id="debug-status" class="alert alert-info">Ready to test search functionality</div>
          
          <div id="debug-results" style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; padding: 10px; display: none;"></div>
        </div>
      </div>
      
      <button id="show-search-debug" style="position: fixed; bottom: 10px; right: 10px; z-index: 9998;" 
              class="btn btn-sm btn-info">
        <i class="fas fa-bug"></i> Debug Search
      </button>
    `);
    
    // Add to body
    $('body').append(debugPanel);
    
    // Set up event handlers
    $('#show-search-debug').click(() => {
      $('#search-debug-panel').show();
      $('#show-search-debug').hide();
    });
    
    $('#search-debug-close').click(() => {
      $('#search-debug-panel').hide();
      $('#show-search-debug').show();
    });
    
    $('#debug-search-btn').click(() => this.testSearch());
    
    $('#debug-search-input').on('keypress', (e) => {
      if (e.which === 13) {
        this.testSearch();
      }
    });
  },
  
  /**
   * Test the search functionality
   */
  testSearch: function() {
    const query = $('#debug-search-input').val().trim();
    const scope = $('#debug-search-scope').val();
    const verbose = $('#debug-verbose').is(':checked');
    
    if (!query) {
      this.setStatus('Please enter a search query', 'warning');
      return;
    }
    
    this.setStatus('Running search...', 'info');
    $('#debug-results').hide();
    
    // Check if db is available
    if (!window.db) {
      this.setStatus('Database not available!', 'danger');
      console.error("SearchDebugger: Database not available");
      return;
    }
    
    // Check if SearchHelper is available
    if (!window.SearchHelper) {
      this.setStatus('SearchHelper not defined!', 'danger');
      console.error("SearchDebugger: SearchHelper not defined");
      return;
    }
    
    // Test basic database access
    try {
      const tx = window.db.transaction("blocks", "readonly");
      const store = tx.objectStore("blocks");
      store.count();
      
      if (verbose) {
        console.log("SearchDebugger: Database access successful");
      }
    } catch (err) {
      this.setStatus('Database access error: ' + err.message, 'danger');
      console.error("SearchDebugger: Database access error", err);
      return;
    }
    
    // Parse query
    const parsedQuery = SearchHelper.parseQuery(query);
    if (verbose) {
      console.log("SearchDebugger: Parsed query", parsedQuery);
    }
    
    // Run the search
    const startTime = performance.now();
    
    try {
      SearchHelper.search(query, { scope: scope })
        .then(results => {
          const endTime = performance.now();
          const duration = (endTime - startTime).toFixed(2);
          
          // Count results
          const totalResults = 
            results.blocks?.length || 0 + 
            results.documents?.length || 0 + 
            results.references?.length || 0 + 
            (results.tags?.blocks?.length || 0) + 
            (results.tags?.documents?.length || 0);
          
          this.setStatus(`Found ${totalResults} results in ${duration}ms`, 'success');
          
          if (verbose) {
            console.log("SearchDebugger: Search results", results);
          }
          
          // Display results summary
          let resultsHtml = `
            <h6>Results Summary (${totalResults} total)</h6>
            <ul>
              <li>Blocks: ${results.blocks?.length || 0}</li>
              <li>Documents: ${results.documents?.length || 0}</li>
              <li>References: ${results.references?.length || 0}</li>
              <li>Tagged Blocks: ${results.tags?.blocks?.length || 0}</li>
              <li>Tagged Documents: ${results.tags?.documents?.length || 0}</li>
            </ul>
          `;
          
          // Show results for blocks
          if (results.blocks && results.blocks.length > 0) {
            resultsHtml += `<h6>Block Results</h6><ul>`;
            results.blocks.forEach(result => {
              resultsHtml += `
                <li>
                  ${result.item.title || 'Block ' + result.item.id} (Score: ${result.score.toFixed(1)})
                </li>
              `;
            });
            resultsHtml += `</ul>`;
          }
          
          // Show results for documents
          if (results.documents && results.documents.length > 0) {
            resultsHtml += `<h6>Document Results</h6><ul>`;
            results.documents.forEach(result => {
              resultsHtml += `
                <li>
                  ${result.item.title} (Score: ${result.score.toFixed(1)})
                </li>
              `;
            });
            resultsHtml += `</ul>`;
          }
          
          // Show results for references
          if (results.references && results.references.length > 0) {
            resultsHtml += `<h6>Reference Results</h6><ul>`;
            results.references.forEach(result => {
              resultsHtml += `
                <li>
                  ${result.item.name} (Score: ${result.score.toFixed(1)})
                </li>
              `;
            });
            resultsHtml += `</ul>`;
          }
          
          $('#debug-results').html(resultsHtml).show();
        })
        .catch(err => {
          this.setStatus('Search error: ' + err.message, 'danger');
          console.error("SearchDebugger: Search error", err);
        });
    } catch (err) {
      this.setStatus('Search error: ' + err.message, 'danger');
      console.error("SearchDebugger: Search exception", err);
    }
  },
  
  /**
   * Set status message
   * @param {string} message - Status message
   * @param {string} type - Status type (info, success, warning, danger)
   */
  setStatus: function(message, type = 'info') {
    $('#debug-status').attr('class', `alert alert-${type}`).text(message);
  }
};

// Initialize debugger when document is ready
$(document).ready(function() {
  SearchDebugger.init();
});
