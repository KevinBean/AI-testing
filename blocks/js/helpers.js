/**
 * Helper utility functions
 */

/**
 * Shows a temporary notification
 * @param {string} message - The message to display
 * @param {string} type - The notification type (success, warning, danger, info)
 */
function showNotification(message, type = 'success') {
  const notification = $(`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
    ${message}
    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>`);
  
  $(".container").prepend(notification);
  setTimeout(() => {
    notification.alert('close');
  }, 3000);
}

/**
 * Creates a highlighted excerpt of text containing a search term
 * 
 * @param {string} fullText - The complete text to search within
 * @param {string} searchTerm - The term to search for and highlight
 * @param {number} contextSize - Number of characters to include before and after the match (default: 50)
 * @return {string} - Rendered HTML with highlighted search term and context, or the original text if no match
 */
function getHighlightedSearchContext(fullText, searchTerm, contextSize = 50) {
  // If no search term or it's empty, return the original rendered text
  if (!searchTerm || searchTerm.trim() === "" || !fullText) {
    return renderMarkdown(fullText || "");
  }
  
  // Create a context window around the matched term
  const lowerText = fullText.toLowerCase();
  const lowerSearchTerm = searchTerm.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerSearchTerm);
  
  if (matchIndex >= 0) {
    // Extract context (about contextSize chars before and after)
    const startPos = Math.max(0, matchIndex - contextSize);
    const endPos = Math.min(fullText.length, matchIndex + searchTerm.length + contextSize);
    let extractedText = fullText.substring(startPos, endPos);
    
    // Add ellipses if we're not showing from the beginning/end
    if (startPos > 0) extractedText = "..." + extractedText;
    if (endPos < fullText.length) extractedText += "...";
    
    // Highlight the matched term with mark tags
    const highlightRegex = new RegExp('(' + searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    const highlightedText = extractedText.replace(highlightRegex, '<mark>$1</mark>');
    
    // Render only the extracted part with highlight
    return renderMarkdown(highlightedText);
  }
  
  // If no match found, return the original rendered text
  return renderMarkdown(fullText);
}

/**
 * Inserts text at cursor position in a textarea
 * @param {HTMLElement} myField - The textarea element
 * @param {string} myValue - Text to insert
 */
function insertAtCursor(myField, myValue) {
  // For browsers like IE
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
    // Reposition the cursor after inserted text
    myField.selectionStart = startPos + myValue.length;
    myField.selectionEnd = startPos + myValue.length;
    myField.focus();
  } else {
    myField.value += myValue;
    myField.focus();
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyTextToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  
  textarea.select();
  document.execCommand('copy');
  
  document.body.removeChild(textarea);
  
  showNotification("Text copied to clipboard!");
}

/**
 * Call the OpenAI API
 * @param {Object} action - The action configuration
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string>} - The API response text
 */
async function callOpenAiApi(action, prompt) {
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
      max_tokens: 800
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

    //show payload in console for debugging
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
}

/**
 * Updates the API key status display
 */
function updateApiKeyStatus() {
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

/**
 * Finds paragraphs that reference a specific block
 * @param {number} blockId - The block ID
 * @returns {Promise<Array>} - Array of referencing paragraphs
 */
function findParagraphsReferencingBlock(blockId) {
  return new Promise((resolve, reject) => {
    const referencingParagraphs = [];
    
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    
    try {
      const transaction = db.transaction("documents", "readonly");
      const store = transaction.objectStore("documents");
      
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
      
      transaction.onerror = function(e) {
        reject(e.target.error);
      };
    } catch(err) {
      reject(err);
    }
  });
}

/**
 * Function to handle API settings form submission 
 * @param {Event} e - Form submission event
 */
function handleApiSettingsFormSubmit(e) {
  e.preventDefault();
  const apiKey = $("#apiKey").val().trim();
  
  if (apiKey) {
    localStorage.setItem('openai_api_key', apiKey);
    openaiApiKey = apiKey;
    showNotification("API key saved successfully!");
    updateApiKeyStatus();
  } else {
    showNotification("Please enter an API key", "warning");
  }
}

/**
 * Export data to a file
 */
function exportData() {
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
    showNotification("Data exported successfully!");
  }).catch(error => {
    console.error("Export error:", error);
    showNotification("Export failed: " + error.message, "danger");
  });
}

/**
 * Handle import file selection
 * @param {Event} e - Change event
 */
function handleImportFile(e) {
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
      showNotification("Invalid JSON file. Import failed: " + error.message, "danger");
      $("#importFile").val(""); // Clear the file input
    }
  };
  reader.readAsText(file);
}

/**
 * Handle import confirmation
 */
function handleImportConfirm() {
  if (!importedData) {
    $("#importOptionsModal").modal("hide");
    return;
  }
  
  const importOption = $('input[name="importOption"]:checked').val();
  
  showNotification("Import started, please wait...", "info");
  
  // Process import directly with the promise-based approach
  importData(importedData, importOption)
    .then(() => {
      showNotification("Import completed successfully!");
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
      showNotification("Import failed: " + error.message, "danger");
    });
  
  $("#importOptionsModal").modal("hide");
}
