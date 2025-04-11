/**
 * Enhanced Helpers module - Provides utility functions for the Markdown Note System
 * Uses module pattern for better organization and namespacing
 * Fixed circular dependency issues and improved global accessibility
 */

// Create the global Helpers object immediately to avoid undefined references
window.Helpers = {};

// Initialize the Helpers module with all functionality
(function(exports) {
  /**
   * UI related helper functions
   */
  const ui = {
    /**
     * Shows a temporary notification
     * @param {string} message - The message to display
     * @param {string} type - The notification type (success, warning, danger, info)
     * @param {number} duration - How long to show notification (ms)
     */
    showNotification: function(message, type = 'success', duration = 3000) {
      const notification = $(`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>`);
      
      $(".container").prepend(notification);
      setTimeout(() => {
        notification.alert('close');
      }, duration);
    },
    
    /**
     * Create a content preview with consistent styling and behavior
     * @param {string} content - The content to preview
     * @param {Object} options - Preview options
     * @returns {jQuery} jQuery element with the preview
     */
    createContentPreview: function(content, options = {}) {
      const {
        showControls = true, 
        maxHeight = null, 
        title = "Content Preview",
        allowCopy = true,
        containerClass = "",
        renderMermaidDiagrams = true,
        additionalHeaderContent = "",
        additionalFooterContent = "",
        showBorder = true
      } = options;
      
      const previewHtml = `
        <div class="content-preview-container ${containerClass}">
          ${showControls ? `
            <div class="d-flex justify-content-between align-items-center mb-2 card-header">
              <span class="preview-title">${title}</span>
              ${additionalHeaderContent}
              <div class="btn-group btn-group-sm">
                ${allowCopy ? `
                  <button class="btn btn-sm btn-outline-primary copy-preview-btn">
                    <i class="fas fa-copy"></i> Copy
                  </button>
                ` : ''}
                <button class="btn btn-sm btn-outline-secondary toggle-preview-btn">
                  <i class="fas fa-eye-slash"></i> Hide
                </button>
              </div>
            </div>
          ` : ''}
          <div class="preview-content card-body bg-light p-2 ${showBorder ? 'border rounded' : ''}" 
               ${maxHeight ? `style="max-height: ${maxHeight}px; overflow-y: auto;"` : ''}>
            ${renderMarkdown(content || '<em>No content available</em>')}
          </div>
          ${additionalFooterContent ? `
            <div class="preview-footer mt-2">
              ${additionalFooterContent}
            </div>
          ` : ''}
        </div>
      `;
      
      const previewElement = $(previewHtml);
      
      // Set up event handlers if controls are enabled
      if (showControls) {
        previewElement.find('.toggle-preview-btn').on('click', function() {
          const contentDiv = previewElement.find('.preview-content');
          const btn = $(this);
          
          if (contentDiv.is(':visible')) {
            contentDiv.slideUp();
            btn.html('<i class="fas fa-eye"></i> Show');
          } else {
            contentDiv.slideDown();
            renderMermaidIn(contentDiv.find(".mermaid"));
            btn.html('<i class="fas fa-eye-slash"></i> Hide');
          }
        });
        
        if (allowCopy) {
          previewElement.find('.copy-preview-btn').on('click', function() {
            exports.copyTextToClipboard(content);
            exports.showNotification("Content copied to clipboard!", "success");
          });
        }
      }
      
      // Render mermaid diagrams if requested
      if (renderMermaidDiagrams) {
        setTimeout(() => {
          renderMermaidIn(previewElement.find(".mermaid"));
        }, 100);
      }
      
      return previewElement;
    },
    
    /**
     * Creates a confirmation dialog with Promise interface
     * @param {Object} options - Dialog options
     * @returns {Promise<boolean>} Promise resolving to true if confirmed
     */
    confirm: function(options = {}) {
      const {
        title = 'Confirm Action',
        message = 'Are you sure you want to proceed?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        confirmButtonClass = 'btn-primary',
        size = 'md'
      } = options;
      
      return new Promise((resolve) => {
        const modalId = 'confirm-modal-' + Date.now();
        
        const modal = $(`
          <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" aria-hidden="true">
            <div class="modal-dialog modal-${size}" role="document">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">${title}</h5>
                  <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div class="modal-body">
                  ${message}
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-dismiss="modal">${cancelText}</button>
                  <button type="button" class="btn ${confirmButtonClass}" id="${modalId}-confirm">${confirmText}</button>
                </div>
              </div>
            </div>
          </div>
        `);
        
        $('body').append(modal);
        
        $(`#${modalId}-confirm`).on('click', function() {
          $(`#${modalId}`).modal('hide');
          resolve(true);
        });
        
        $(`#${modalId}`).on('hidden.bs.modal', function() {
          $(this).remove();
          resolve(false);
        });
        
        $(`#${modalId}`).modal('show');
      });
    }
  };
  
  /**
   * Text and content manipulation helpers
   */
  const text = {
    /**
     * Creates a highlighted excerpt of text containing a search term
     * @param {string} fullText - The complete text to search within
     * @param {string} searchTerm - The term to search for and highlight
     * @param {number} contextSize - Number of characters to include before and after the match
     * @return {string} - Rendered HTML with highlighted search term and context
     */
    getHighlightedSearchContext: function(fullText, searchTerm, contextSize = 50) {
      if (!searchTerm || searchTerm.trim() === "" || !fullText) {
        return renderMarkdown(fullText || "");
      }
      
      const lowerText = fullText.toLowerCase();
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchIndex = lowerText.indexOf(lowerSearchTerm);
      
      if (matchIndex >= 0) {
        const startPos = Math.max(0, matchIndex - contextSize);
        const endPos = Math.min(fullText.length, matchIndex + searchTerm.length + contextSize);
        let extractedText = fullText.substring(startPos, endPos);
        
        if (startPos > 0) extractedText = "..." + extractedText;
        if (endPos < fullText.length) extractedText += "...";
        
        const highlightRegex = new RegExp('(' + searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        const highlightedText = extractedText.replace(highlightRegex, '<mark>$1</mark>');
        
        return renderMarkdown(highlightedText);
      }
      
      return renderMarkdown(fullText);
    },
    
    /**
     * Inserts text at cursor position in a textarea
     * @param {HTMLElement} myField - The textarea element
     * @param {string} myValue - Text to insert
     */
    insertAtCursor: function(myField, myValue) {
      if (document.selection) {
        myField.focus();
        let sel = document.selection.createRange();
        sel.text = myValue;
        myField.focus();
      } else if (myField.selectionStart || myField.selectionStart === 0) {
        let startPos = myField.selectionStart;
        let endPos = myField.selectionEnd;
        myField.value = myField.value.substring(0, startPos)
          + myValue
          + myField.value.substring(endPos, myField.value.length);
        
        myField.selectionStart = startPos + myValue.length;
        myField.selectionEnd = startPos + myValue.length;
        myField.focus();
      } else {
        myField.value += myValue;
        myField.focus();
      }
    },
    
    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     */
    copyTextToClipboard: function(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            exports.showNotification("Text copied to clipboard!");
          })
          .catch(() => {
            fallbackCopyTextToClipboard(text);
          });
        return;
      }
      
      fallbackCopyTextToClipboard(text);
      
      function fallbackCopyTextToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        
        textarea.select();
        document.execCommand('copy');
        
        document.body.removeChild(textarea);
        
        exports.showNotification("Text copied to clipboard!");
      }
    },
    
    /**
     * Truncate text to a certain length with ellipsis
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @param {string} suffix - Suffix to add after truncation
     * @returns {string} - Truncated text
     */
    truncate: function(text, length = 100, suffix = '...') {
      if (!text) return '';
      return text.length > length ? text.substring(0, length) + suffix : text;
    },
    
    /**
     * Format a relative date (e.g., "2 days ago")
     * @param {Date|string} date - Date to format
     * @returns {string} - Formatted date string
     */
    formatRelativeDate: function(date) {
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
  };
  
  /**
   * Database helpers for common operations
   */
  const db = {
    /**
     * Executes a database operation with proper error handling
     * @param {string} storeName - The object store name
     * @param {string} mode - Transaction mode: 'readonly' or 'readwrite'
     * @param {Function} operation - Function that performs the actual operation
     * @returns {Promise} Promise resolving with the operation result
     */
    executeOperation: function(storeName, mode, operation) {
      return new Promise((resolve, reject) => {
        if (!window.db) {
          reject(new Error("Database not initialized"));
          return;
        }
        
        try {
          const transaction = window.db.transaction(storeName, mode);
          const store = transaction.objectStore(storeName);
          
          operation(store, transaction, resolve, reject);
          
          transaction.onerror = function(e) {
            console.error(`Transaction error on ${storeName}:`, e.target.error);
            reject(e.target.error);
          };
        } catch (err) {
          console.error(`Error executing operation on ${storeName}:`, err);
          reject(err);
        }
      });
    },
    
    /**
     * Find paragraphs that reference a specific block
     * @param {number} blockId - The block ID
     * @returns {Promise<Array>} - Array of referencing paragraphs
     */
    findParagraphsReferencingBlock: function(blockId) {
      return this.executeOperation("documents", "readonly", (store, transaction, resolve, reject) => {
        const referencingParagraphs = [];
        
        store.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            const doc = cursor.value;
            
            if (doc.paragraphs && doc.paragraphs.length > 0) {
              doc.paragraphs.forEach((para, paraIndex) => {
                // Check both old (blockRef) and new (blockRefs) formats
                const blockRefs = para.blockRefs || (para.blockRef ? [para.blockRef] : []);
                
                if (blockRefs.includes(blockId)) {
                  referencingParagraphs.push({
                    docId: doc.id,
                    docTitle: doc.title,
                    paraIndex: paraIndex,
                    content: para.content.substring(0, 100) + (para.content.length > 100 ? '...' : '')
                  });
                }
              });
            }
            cursor.continue();
          } else {
            // All documents have been processed
            resolve(referencingParagraphs);
          }
        };
      });
    },
    
    /**
     * Get an item by ID from a store
     * @param {string} storeName - The store name
     * @param {number|string} id - The item ID
     * @returns {Promise<Object>} - Promise with the item
     */
    getById: function(storeName, id) {
      return this.executeOperation(storeName, "readonly", (store, transaction, resolve, reject) => {
        const request = store.get(typeof id === 'string' ? id : parseInt(id));
        
        request.onsuccess = function(e) {
          if (e.target.result) {
            resolve(e.target.result);
          } else {
            reject(new Error(`Item with ID ${id} not found in ${storeName}`));
          }
        };
      });
    },
    
    /**
     * Delete an item by ID
     * @param {string} storeName - The store name
     * @param {number|string} id - The item ID
     * @returns {Promise<boolean>} - Promise resolving to true if successful
     */
    deleteById: function(storeName, id) {
      return this.executeOperation(storeName, "readwrite", (store, transaction, resolve) => {
        const request = store.delete(typeof id === 'string' ? id : parseInt(id));
        
        request.onsuccess = function() {
          resolve(true);
        };
      });
    }
  };
  
  /**
   * API helpers
   */
  const api = {
    /**
     * Call the OpenAI API
     * @param {Object} action - The action configuration
     * @param {string} prompt - The prompt to send
     * @returns {Promise<string>} - The API response text
     */
    callOpenAiApi: async function(action, prompt) {
      try {
        if (!openaiApiKey) {
          throw new Error("API key not configured. Please add your OpenAI API key in the Settings tab.");
        }
        
        const payload = {
          model: action.model || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: action.description || "You are a helpful assistant." },
            { role: "user", content: prompt }
          ],
          temperature: parseFloat(action.temperature) || 0.7,
          max_tokens: parseInt(action.maxTokens) || 1000 // Add this line or update existing line
                  };
        
        if (action.enablewebsearch) {
          payload.web_search_options = {};
        }

        if (action.useTools && action.toolsDefinition) {
          try {
            const parsedTools = JSON.parse(action.toolsDefinition);
            payload.tools = Array.isArray(parsedTools) ? parsedTools : [parsedTools];
          } catch (error) {
            throw new Error("Invalid tools definition JSON");
          }
        }

        if (action.enablewebsearch) {
          delete payload.temperature;
        }
        
        console.log("OpenAI API Payload:", payload);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        console.error("OpenAI API Error:", error);
        throw error;
      }
    },
    
    /**
     * Securely store the API key
     * @param {string} apiKey - The API key to store
     */
    secureStoreApiKey: function(apiKey) {
      // Simple obfuscation - not true encryption but better than plain text
      const encodedKey = btoa(apiKey);
      localStorage.setItem('openai_api_key_secure', encodedKey);
    },
    
    /**
     * Retrieve the stored API key
     * @returns {string|null} - The API key or null if not found
     */
    getSecureApiKey: function() {
      const encodedKey = localStorage.getItem('openai_api_key_secure');
      if (!encodedKey) return null;
      
      try {
        return atob(encodedKey);
      } catch (e) {
        console.error("Failed to decode API key");
        return null;
      }
    },
    
    /**
     * Update the API key status display
     */
    updateApiKeyStatus: function() {
      const statusDiv = $("#apiKeyStatus");
      
      if (openaiApiKey) {
        statusDiv.html(`
          <div class="alert alert-success mb-0">
            API key is configured
          </div>
        `);
      } else {
        statusDiv.html(`
          <div class="alert alert-warning mb-0">
            No API key configured
          </div>
        `);
      }
    }
  };
  
  /**
   * Data import/export helpers
   */
  const data = {
    /**
     * Export data to a file
     */
    exportData: function() {
      exportAllData().then(exportData => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `markdown-notes-export-${timestamp}.json`;
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        exports.showNotification("Data exported successfully!");
      }).catch(error => {
        console.error("Export error:", error);
        exports.showNotification("Export failed: " + error.message, "danger");
      });
    },
    
    /**
     * Handle import file selection
     * @param {Event} e - Change event
     */
    handleImportFile: function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          importedData = JSON.parse(e.target.result);
          
          // Check if the file has the expected structure
          if (!importedData.blocks && !importedData.documents && 
              !importedData.references && !importedData.collections &&
              !importedData.actions && !importedData.workflows) {
            throw new Error("Invalid file format - missing required data structures");
          }
          
          const totalItems = (importedData.documents?.length || 0) + 
                          ((importedData.blocks?.length || 0) + (importedData.clauses?.length || 0)) +
                          (importedData.references?.length || 0) +
                          (importedData.actions?.length || 0) +
                          (importedData.collections?.length || 0) +
                          (importedData.workflows?.length || 0);
          
          $("#importItemCount").text(totalItems);
          
          $("#importOptionsModal").modal("show");
        } catch (error) {
          console.error("Error parsing JSON:", error);
          exports.showNotification("Invalid JSON file. Import failed: " + error.message, "danger");
          $("#importFile").val(""); // Clear the file input
        }
      };
      reader.readAsText(file);
    },
    
    /**
     * Handle import confirmation
     */
    handleImportConfirm: function() {
      if (!importedData) {
        $("#importOptionsModal").modal("hide");
        return;
      }
      
      const importOption = $('input[name="importOption"]:checked').val();
      
      exports.showNotification("Import started, please wait...", "info");
      
      // Process import directly with the promise-based approach
      importData(importedData, importOption)
        .then(() => {
          exports.showNotification("Import completed successfully!");
          loadBlocks();
          loadReferencesMetadata();
          loadDocuments();
          loadActions();
          loadCollections();
          loadWorkflows();
          updateBlockAutocomplete();
          updateReferenceAutocomplete();
          updateTagAutocomplete();
          
          // Reset import data and file input
          importedData = null;
          $("#importFile").val("");
        })
        .catch(error => {
          console.error("Import error:", error);
          exports.showNotification("Import failed: " + error.message, "danger");
        });
      
      $("#importOptionsModal").modal("hide");
    }
  };
  
  /**
   * Form handlers for settings
   */
  const forms = {
    /**
     * Function to handle API settings form submission 
     * @param {Event} e - Form submission event
     */
    handleApiSettingsFormSubmit: function(e) {
      e.preventDefault();
      const apiKey = $("#apiKey").val().trim();
      
      if (apiKey) {
        // Use our secure storage instead of direct localStorage
        api.secureStoreApiKey(apiKey);
        openaiApiKey = apiKey;
        exports.showNotification("API key saved successfully!");
        api.updateApiKeyStatus();
      } else {
        exports.showNotification("Please enter an API key", "warning");
      }
    }
  };
  
  // Expose functions to the exports object (the Helpers global)
  // UI helpers
  exports.showNotification = ui.showNotification;
  exports.createContentPreview = ui.createContentPreview;
  exports.confirm = ui.confirm;
  
  // Text helpers
  exports.getHighlightedSearchContext = text.getHighlightedSearchContext;
  exports.insertAtCursor = text.insertAtCursor;
  exports.copyTextToClipboard = text.copyTextToClipboard;
  exports.truncate = text.truncate;
  exports.formatRelativeDate = text.formatRelativeDate;
  
  // Database helpers
  exports.findParagraphsReferencingBlock = db.findParagraphsReferencingBlock.bind(db);
  exports.getById = db.getById.bind(db);
  exports.deleteById = db.deleteById.bind(db);
  exports.db = db;
  
  // API helpers
  exports.callOpenAiApi = api.callOpenAiApi;
  exports.secureStoreApiKey = api.secureStoreApiKey;
  exports.getSecureApiKey = api.getSecureApiKey;
  exports.updateApiKeyStatus = api.updateApiKeyStatus;
  
  // Import/Export helpers
  exports.exportData = data.exportData;
  exports.handleImportFile = data.handleImportFile;
  exports.handleImportConfirm = data.handleImportConfirm;
  
  // Form handlers
  exports.handleApiSettingsFormSubmit = forms.handleApiSettingsFormSubmit;
  
  // Add renderMermaidInElement function
  exports.renderMermaidInElement = function(element) {
    setTimeout(() => {
      renderMermaidIn(element.find(".mermaid"));
    }, 100);
  };
  
})(window.Helpers);

// For backward compatibility, let's create global functions that reference Helpers
window.showNotification = Helpers.showNotification;
window.getHighlightedSearchContext = Helpers.getHighlightedSearchContext;
window.insertAtCursor = Helpers.insertAtCursor;
window.copyTextToClipboard = Helpers.copyTextToClipboard;
window.callOpenAiApi = Helpers.callOpenAiApi;
window.updateApiKeyStatus = Helpers.updateApiKeyStatus;
window.findParagraphsReferencingBlock = Helpers.findParagraphsReferencingBlock;
window.getSecureApiKey = Helpers.getSecureApiKey;
window.secureStoreApiKey = Helpers.secureStoreApiKey;
window.handleApiSettingsFormSubmit = Helpers.handleApiSettingsFormSubmit;
window.exportData = Helpers.exportData;
window.handleImportFile = Helpers.handleImportFile;
window.handleImportConfirm = Helpers.handleImportConfirm;
window.createContentPreview = Helpers.createContentPreview;
window.renderMermaidInElement = Helpers.renderMermaidInElement;