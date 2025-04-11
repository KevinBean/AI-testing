/**
 * Conversations management module
 */

// Global variables
let activeConversationId = null;

/**
 * Load available actions for conversations
 */
function loadConversationActions() {
    console.log("DEBUG: loadConversationActions called, db availability:", !!window.db);
    const select = $("#conversationActionSelect");
    select.empty();
    select.append('<option value="">Default Assistant</option>');
    
    // Wait for database to be available
    if (!window.db) {
      console.log("DEBUG: Database not available yet, will retry in 1 second");
      setTimeout(loadConversationActions, 1000);
      return;
    }
    
    const transaction = db.transaction("actions", "readonly");
    const store = transaction.objectStore("actions");
    console.log("DEBUG: Loading actions from database...");
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        const action = cursor.value;
        console.log(`DEBUG: Action loaded: ${action.title}`);
        select.append(`<option value="${action.id}">${action.title}</option>`);
        cursor.continue();
      }
    };
  }
  

/**
 * Initialize conversation UI and handlers
 */
function initializeConversations() {
  // Load conversation actions
console.log("DEBUG: Initializing conversations module...");
  
  // Set up event handlers
  $("#newConversationBtn").click(startNewConversation);
  $("#sendMessageBtn").click(sendMessage);
  $("#addContentReferenceBtn").click(showReferenceSelector);
  $("#exportConversationBtn").click(exportConversation);
  $("#saveInsightsBtn").click(saveConversationInsights);
  
  // Handle context menu actions
  $(document).on("click", ".start-conversation", function(e) {
    e.preventDefault();
    const type = $(this).data("type");
    const id = $(this).data("id");
    const title = $(this).data("title");
    startConversationWithContent(type, id, title);
  });
  
  // Load conversation list
  loadConversations();
  console.log("DEBUG: Loading conversation actions...");
  loadConversationActions();
}


/**
 * Load saved conversations
 */
function loadConversations(searchTerm = "") {
  $("#conversationList").empty();
  
    // Wait for database to be available
    if (!window.db) {
        console.log("DEBUG: Database not available yet, will retry in 1 second");
        setTimeout(loadConversations, 1000);
        return;
      }
  
  const transaction = db.transaction("conversations", "readonly");
  const store = transaction.objectStore("conversations");
  const index = store.index("updated");
  
  // Use reverse direction to get newest first
  const request = index.openCursor(null, "prev");
  
  request.onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const conversation = cursor.value;
      const searchText = conversation.title.toLowerCase();
      
      if (!searchTerm || searchText.includes(searchTerm.toLowerCase())) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const date = Helpers.formatRelativeDate(conversation.updated);
        
        const item = $(`<li class="list-group-item list-item conversation-item" data-id="${conversation.id}">
          <div class="d-flex justify-content-between">
            <strong>${conversation.title}</strong>
            <small>${date}</small>
          </div>
          <p class="text-muted small">${Helpers.truncate(lastMessage.content, 60)}</p>
        </li>`);
        
        item.click(function() {
          loadConversation(conversation.id);
        });
        
        $("#conversationList").append(item);
      }
      
      cursor.continue();
    }
  };
}

/**
 * Start a new empty conversation
 */
function startNewConversation() {
  const conversation = {
    title: "New Conversation",
    created: new Date(),
    updated: new Date(),
    messages: [],
    tags: [],
    relatedContent: []
  };
  
  saveConversation(conversation).then(id => {
    activeConversationId = id;
    displayConversation(conversation);
  });
}

/**
 * Start a conversation with specific content
 */
function startConversationWithContent(contentType, contentId, contentTitle) {
    console.log(`DEBUG: startConversationWithContent called with ${contentType}, ${contentId}, ${contentTitle}`);
    // Get the content
  Helpers.getById(contentType + "s", contentId).then(content => {
    console.log(`DEBUG: Content retrieved for ${contentId}`);
    // Create initial message with content reference
    const initialMessage = {
      id: generateMessageId(),
      sender: "user",
      content: `I'd like to discuss this ${contentType}: ${contentTitle}`,
      timestamp: new Date(),
      references: [
        {
          type: contentType,
          id: contentId,
          title: contentTitle
        }
      ]
    };
    
    // Create the conversation
    const conversation = {
      title: `Conversation about ${contentTitle}`,
      created: new Date(),
      updated: new Date(),
      messages: [initialMessage],
      tags: [],
      relatedContent: [
        {
          type: contentType,
          id: contentId
        }
      ]
    };
    
    // Save and display
    saveConversation(conversation).then(id => {
        console.log(`DEBUG: Conversation saved with ID ${id}`);
      activeConversationId = id;
      displayConversation(conversation);
      
      // Auto-respond to start the conversation
      console.log(`DEBUG: About to call generateResponse()`);
    generateResponse();
    });
  }).catch(error => {
    console.error(`Error loading ${contentType}:`, error);
    Helpers.showNotification(`Could not load ${contentType}`, "danger");
  });
}

/**
 * Load an existing conversation
 */
function loadConversation(id) {
  if (!db) return;
  
  const transaction = db.transaction("conversations", "readonly");
  const store = transaction.objectStore("conversations");
  
  store.get(parseInt(id)).onsuccess = function(e) {
    const conversation = e.target.result;
    if (conversation) {
      activeConversationId = conversation.id;
      displayConversation(conversation);
    }
  };
}

/**
 * Display a conversation in the UI
 */
function displayConversation(conversation) {
  // Set title
  $("#conversationTitle").text(conversation.title);
  
  // Display messages
  const messagesContainer = $("#conversationMessages");
  messagesContainer.empty();
  
  conversation.messages.forEach(message => {
    const messageElement = createMessageElement(message);
    messagesContainer.append(messageElement);
  });
  
  // Scroll to bottom
  messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
  
  // Enable input
  $("#conversationInputContainer").show();
  $("#conversationInput").focus();
  
  // Switch to conversations tab if not already active
  $('#conversations-tab').tab('show');
}

/**
 * Create a message element for display
 */
function createMessageElement(message) {
  const isUser = message.sender === "user";
  const alignClass = isUser ? "text-right" : "text-left";
  const bubbleClass = isUser ? "bg-primary text-white" : "bg-light";
  
  const element = $(`<div class="message ${alignClass} mb-3">
    <div class="message-bubble ${bubbleClass} p-3 rounded" style="display: inline-block; max-width: 80%;">
      <div class="message-content">${renderMarkdown(message.content)}</div>
      ${message.references && message.references.length ? createReferencesElement(message.references) : ''}
      <div class="message-meta text-muted small">
        <span>${formatMessageTime(message.timestamp)}</span>
        ${message.actionId ? `<span class="ml-2 badge badge-info">Action: ${getActionName(message.actionId)}</span>` : ''}
      </div>
    </div>
  </div>`);
  
  // Render any mermaid diagrams
  setTimeout(() => {
    renderMermaidIn(element.find(".mermaid"));
  }, 100);
  
  return element;
}

/**
 * Create elements for message references
 */
function createReferencesElement(references) {
  let html = '<div class="message-references mt-2">';
  
  references.forEach(ref => {
    const iconClass = ref.type === 'block' ? 'fa-cube' : 
                     (ref.type === 'document' ? 'fa-file-alt' : 'fa-folder');
                     
    html += `<div class="reference-item">
      <a href="#" class="view-reference" data-type="${ref.type}" data-id="${ref.id}">
        <i class="fas ${iconClass} mr-1"></i> ${ref.title}
      </a>
    </div>`;
  });
  
  html += '</div>';
  return html;
}

/**
 * Send a new message
 */
function sendMessage() {
  const input = $("#conversationInput");
  const content = input.val().trim();
  
  if (!content) {
    Helpers.showNotification("Please enter a message", "warning");
    return;
  }
  
  if (!activeConversationId) {
    Helpers.showNotification("No active conversation", "warning");
    return;
  }
  
  // Get selected action
  const actionId = $("#conversationActionSelect").val() ? 
    parseInt($("#conversationActionSelect").val()) : null;
  
  // Create message object
  const message = {
    id: generateMessageId(),
    sender: "user",
    content: content,
    timestamp: new Date(),
    references: [], // Will be populated if references are added
    actionId: actionId
  };
  
  // Add message to conversation
  addMessageToConversation(message).then(() => {
    // Clear input
    input.val('');
    
    // Generate response
    generateResponse();
  });
}

/**
 * Add a message to the active conversation
 */
function addMessageToConversation(message) {
  return new Promise((resolve, reject) => {
    if (!activeConversationId) {
      reject(new Error("No active conversation"));
      return;
    }
    
    if (!db) {
      reject(new Error("Database not available"));
      return;
    }
    
    const transaction = db.transaction("conversations", "readwrite");
    const store = transaction.objectStore("conversations");
    
    store.get(activeConversationId).onsuccess = function(e) {
      const conversation = e.target.result;
      if (!conversation) {
        reject(new Error("Conversation not found"));
        return;
      }
      
      // Add message
      conversation.messages.push(message);
      conversation.updated = new Date();
      
      // Update conversation
      store.put(conversation).onsuccess = function() {
        // Add message to UI
        const messageElement = createMessageElement(message);
        $("#conversationMessages").append(messageElement);
        
        // Scroll to bottom
        $("#conversationMessages").scrollTop($("#conversationMessages")[0].scrollHeight);
        
        resolve();
      };
    };
  });
}

/**
 * Generate an AI response to the conversation
 */
function generateResponse() {
    console.log(`DEBUG: generateResponse called with activeConversationId=${activeConversationId}`);
  if (!activeConversationId) return;
  
  // Get the conversation
  const transaction = db.transaction("conversations", "readonly");
  const store = transaction.objectStore("conversations");
  
  store.get(activeConversationId).onsuccess = function(e) {
    const conversation = e.target.result;
    console.log(`DEBUG: Retrieved conversation:`, conversation);
    if (!conversation || !conversation.messages.length) return;
    
    // Get the last message
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    console.log(`DEBUG: Last message:`, lastMessage);
    if (lastMessage.sender !== "user") {
        console.log(`DEBUG: Last message is not from user, skipping response`);
        return; // Don't respond to assistant messages

    }
    
    // Check if an action is specified
    const actionId = lastMessage.actionId;
    
    // Create a loading message
    const loadingElement = $(`<div class="message text-left mb-3" id="loading-message">
      <div class="message-bubble bg-light p-3 rounded" style="display: inline-block; max-width: 80%;">
        <div class="message-content">
          <i class="fas fa-spinner fa-spin"></i> Assistant is thinking...
        </div>
      </div>
    </div>`);
    
    $("#conversationMessages").append(loadingElement);
    $("#conversationMessages").scrollTop($("#conversationMessages")[0].scrollHeight);
    
    // Get conversation context
    const context = prepareConversationContext(conversation);
    
    // If using an action, call it with the context
    if (actionId) {
      const actionTransaction = db.transaction("actions", "readonly");
      const actionStore = actionTransaction.objectStore("actions");
      
      actionStore.get(actionId).onsuccess = function(e) {
        const action = e.target.result;
        if (!action) {
          handleResponseError("Action not found");
          return;
        }
        
        // Prepare prompt with context
        const prompt = action.prompt.replace(/{content}/g, context);

            // Before calling OpenAI API
    console.log(`DEBUG: About to call OpenAI API`);
        
        // Call OpenAI API
        callOpenAiApi(action, prompt)
          .then(response => {
            handleResponse(response, actionId);
          })
          .catch(error => {
            handleResponseError(error.message);
          });
      };
    } else {
      // Use default assistant behavior
      const defaultAction = {
        description: "You are a helpful assistant for a markdown note-taking system. Help the user with their notes and respond to their queries.",
        model: "gpt-3.5-turbo"
      };
      
      // Create a simple prompt
      const prompt = `User's message: ${lastMessage.content}\n\nConversation context:\n${context}`;
      
    // Before calling OpenAI API
    console.log(`DEBUG: About to call OpenAI API`);

      // Call OpenAI API
      callOpenAiApi(defaultAction, prompt)
        .then(response => {
            console.log(`DEBUG: API call succeeded`);
          handleResponse(response);
        })
        .catch(error => {
            console.log(`DEBUG: API call failed:`, error);
          handleResponseError(error.message);
        });
    }
  };
}

/**
 * Prepare conversation context
 */
function prepareConversationContext(conversation) {
  // Get the last few messages
  const recentMessages = conversation.messages
    .slice(-5) // Last 5 messages
    .map(msg => `${msg.sender === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n\n");
  
  // Add referenced content
  let referencedContent = "";
  const referencedItems = [];
  
  // Collect all references from messages
  conversation.messages.forEach(message => {
    if (message.references && message.references.length) {
      message.references.forEach(ref => {
        if (!referencedItems.some(item => item.type === ref.type && item.id === ref.id)) {
          referencedItems.push(ref);
        }
      });
    }
  });
  
  // Fetch content for references
  // Note: This would be async in a real implementation
  // For simplicity, we'll assume the content is available
  
  if (referencedItems.length) {
    referencedContent = "\n\nReferenced content:\n";
    referencedItems.forEach(ref => {
      referencedContent += `[${ref.type} ${ref.id}]: ${ref.title}\n`;
    });
  }
  
  return recentMessages + referencedContent;
}

/**
 * Handle the API response
 */
function handleResponse(response, actionId = null) {
  // Remove loading message
  $("#loading-message").remove();
  
  // Create response message
  const message = {
    id: generateMessageId(),
    sender: "assistant",
    content: response,
    timestamp: new Date(),
    actionId: actionId
  };
  
  // Add to conversation
  addMessageToConversation(message);
}

/**
 * Handle API response error
 */
function handleResponseError(errorMessage) {
  // Remove loading message
  $("#loading-message").remove();
  
  // Show error message
  Helpers.showNotification("Error generating response: " + errorMessage, "danger");
}

/**
 * Save conversation
 */
function saveConversation(conversation) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not available"));
      return;
    }
    
    const transaction = db.transaction("conversations", "readwrite");
    const store = transaction.objectStore("conversations");
    
    if (conversation.id) {
      store.put(conversation).onsuccess = function(e) {
        resolve(conversation.id);
      };
    } else {
      store.add(conversation).onsuccess = function(e) {
        resolve(e.target.result);
      };
    }
    
    transaction.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

/**
 * Show reference selector for adding content to messages
 */
function showReferenceSelector() {
  // Create modal for selecting content
  const modal = $(`<div class="modal fade" id="referenceSelector">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Add Reference</h5>
          <button type="button" class="close" data-dismiss="modal">&times;</button>
        </div>
        <div class="modal-body">
          <ul class="nav nav-tabs" id="referenceTabs" role="tablist">
            <li class="nav-item">
              <a class="nav-link active" id="blocks-ref-tab" data-toggle="tab" href="#blocksRef" role="tab">Blocks</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" id="documents-ref-tab" data-toggle="tab" href="#documentsRef" role="tab">Documents</a>
            </li>
          </ul>
          
          <div class="tab-content mt-3">
            <div class="tab-pane fade show active" id="blocksRef" role="tabpanel">
              <input type="text" class="form-control mb-2" placeholder="Search blocks...">
              <div id="blocksList" class="reference-list">Loading...</div>
            </div>
            <div class="tab-pane fade" id="documentsRef" role="tabpanel">
              <input type="text" class="form-control mb-2" placeholder="Search documents...">
              <div id="documentsList" class="reference-list">Loading...</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>`);
  
  // Add to body and show
  $("body").append(modal);
  modal.modal("show");
  
  // Load content
  loadReferencableBlocks();
  loadReferencableDocuments();
  loadReferencableCollections();
  
  // Remove when hidden
  modal.on("hidden.bs.modal", function() {
    modal.remove();
  });
}


/**
 * Load blocks for referencing in conversations
 */
function loadReferencableBlocks() {
    const blocksList = $("#blocksList");
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
        const title = block.title || "Block " + block.id;
        
        blocksHtml += `
          <div class="card mb-2 selectable-item" data-id="${block.id}" data-type="block" data-title="${title}" data-content="${encodeURIComponent(block.text)}">
            <div class="card-body py-2">
              <strong>${title}</strong> <small class="text-muted">(ID: ${block.id})</small><br>
              <small>${Helpers.truncate(block.text, 100)}</small>
              ${block.tags && block.tags.length ? 
                `<div class="mt-1">${block.tags.map(t => `<span class="badge badge-info">${t}</span>`).join(' ')}</div>` : ''}
            </div>
          </div>
        `;
        cursor.continue();
      } else {
        if (blocksHtml) {
          blocksList.html(blocksHtml);
          
          // Add click handler for selecting blocks
          $(".selectable-item").click(function() {
            const id = $(this).data("id");
            const type = $(this).data("type");
            const title = $(this).data("title");
            const content = decodeURIComponent($(this).data("content"));
            
            // Add to message
            addReferenceToMessage(type, id, title, content);
            
            // Close modal
            $("#referenceSelector").modal("hide");
          });
        } else {
          blocksList.html('<p class="text-center text-muted">No blocks found.</p>');
        }
      }
    };
  }
  
  /**
   * Load documents for referencing in conversations
   */
  function loadReferencableDocuments() {
    const docsList = $("#documentsList");
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
        
        // Combine all paragraph content
        let combinedContent = "";
        if (doc.paragraphs && doc.paragraphs.length) {
          combinedContent = doc.paragraphs.map(p => p.content || '').join('\n\n');
        }
        
        docsHtml += `
          <div class="card mb-2 selectable-item" data-id="${doc.id}" data-type="document" data-title="${doc.title}" data-content="${encodeURIComponent(combinedContent)}">
            <div class="card-body py-2">
              <strong>${doc.title}</strong> <small class="text-muted">(ID: ${doc.id})</small><br>
              <small>${doc.paragraphs ? doc.paragraphs.length : 0} paragraphs</small>
            </div>
          </div>
        `;
        cursor.continue();
      } else {
        if (docsHtml) {
          docsList.html(docsHtml);
          
          // Add click handler for selecting documents
          $(".selectable-item").click(function() {
            const id = $(this).data("id");
            const type = $(this).data("type");
            const title = $(this).data("title");
            const content = decodeURIComponent($(this).data("content"));
            
            // Add to message
            addReferenceToMessage(type, id, title, content);
            
            // Close modal
            $("#referenceSelector").modal("hide");
          });
        } else {
          docsList.html('<p class="text-center text-muted">No documents found.</p>');
        }
      }
    };
  }
  
  /**
   * Add a reference to the current message
   */
  function addReferenceToMessage(type, id, title, content) {
    const input = $("#conversationInput");
    const currentText = input.val();
    
    // Create reference text
    const referenceText = `[Reference to ${type}: ${title}] """${content}"""`;
    
    // Add the reference text to the input
    input.val(currentText + "\n" + referenceText);
    
    // Store the reference for later use when sending the message
    let messageReferences = input.data("references") || [];
    messageReferences.push({
      type: type,
      id: id,
      title: title,
      content: content
    });
    
    input.data("references", messageReferences);
    
    // Show notification
    Helpers.showNotification(`Added reference to ${type}: ${title}`);
  }
  
  /**
   * Update sendMessage function to include references
   * Replace the existing function with this one
   */
  function sendMessage() {
    const input = $("#conversationInput");
    const content = input.val().trim();
    
    if (!content) {
      Helpers.showNotification("Please enter a message", "warning");
      return;
    }
    
    if (!activeConversationId) {
      Helpers.showNotification("No active conversation", "warning");
      return;
    }
    
    // Get selected action
    const actionId = $("#conversationActionSelect").val() ? 
      parseInt($("#conversationActionSelect").val()) : null;
    
    // Get references attached to the message
    const references = input.data("references") || [];
    
    // Create message object
    const message = {
      id: generateMessageId(),
      sender: "user",
      content: content,
      timestamp: new Date(),
      references: references,
      actionId: actionId
    };
    
    // Add message to conversation
    addMessageToConversation(message).then(() => {
      // Clear input and references
      input.val('');
      input.data("references", []);
      
      // Generate response
      generateResponse();
    });
  }
  
  /**
   * Modify showReferenceSelector to only show blocks and documents tabs
   * Replace the existing function with this one
   */
  function showReferenceSelector() {
    // Create modal for selecting content
    const modal = $(`<div class="modal fade" id="referenceSelector">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add Reference</h5>
            <button type="button" class="close" data-dismiss="modal">&times;</button>
          </div>
          <div class="modal-body">
            <ul class="nav nav-tabs" id="referenceTabs" role="tablist">
              <li class="nav-item">
                <a class="nav-link active" id="blocks-ref-tab" data-toggle="tab" href="#blocksRef" role="tab">Blocks</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" id="documents-ref-tab" data-toggle="tab" href="#documentsRef" role="tab">Documents</a>
              </li>
            </ul>
            
            <div class="tab-content mt-3">
              <div class="tab-pane fade show active" id="blocksRef" role="tabpanel">
                <input type="text" class="form-control mb-2" placeholder="Search blocks...">
                <div id="blocksList" class="reference-list">Loading...</div>
              </div>
              <div class="tab-pane fade" id="documentsRef" role="tabpanel">
                <input type="text" class="form-control mb-2" placeholder="Search documents...">
                <div id="documentsList" class="reference-list">Loading...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`);
    
    // Add to body and show
    $("body").append(modal);
    modal.modal("show");
    
    // Load content
    loadReferencableBlocks();
    loadReferencableDocuments();
    
    // Remove when hidden
    modal.on("hidden.bs.modal", function() {
      modal.remove();
    });
  }

  /**
 * Generate a unique ID for messages
 * @returns {string} A unique message ID
 */
function generateMessageId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
  }

  
/**
 * Format message timestamp to a readable time
 * @param {Date|string|number} timestamp - The timestamp to format
 * @returns {string} Formatted time string (e.g., "2:30 PM")
 */
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
 * Export conversation to a markdown file
 */
function exportConversation() {
    if (!activeConversationId) {
      Helpers.showNotification("No active conversation", "warning");
      return;
    }
    
    // Get the conversation
    const transaction = db.transaction("conversations", "readonly");
    const store = transaction.objectStore("conversations");
    
    store.get(activeConversationId).onsuccess = function(e) {
      const conversation = e.target.result;
      if (!conversation) return;
      
      // Format for export
      let export_text = `# ${conversation.title}\n\n`;
      export_text += `Date: ${new Date(conversation.created).toLocaleString()}\n\n`;
      
      // Add messages
      conversation.messages.forEach(message => {
        const sender = message.sender === "user" ? "You" : "Assistant";
        export_text += `## ${sender} (${new Date(message.timestamp).toLocaleString()})\n\n`;
        export_text += message.content + "\n\n";
        
        // Add references
        if (message.references && message.references.length) {
          export_text += "References:\n";
          message.references.forEach(ref => {
            export_text += `- ${ref.type} ${ref.id}: ${ref.title}\n`;
          });
          export_text += "\n";
        }
      });
      
      // Create download
      const blob = new Blob([export_text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${conversation.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
      
      Helpers.showNotification("Conversation exported successfully!", "success");
    };
  }

  /**
 * Save insights from conversation as a new block
 */
function saveConversationInsights() {
    if (!activeConversationId) {
      Helpers.showNotification("No active conversation", "warning");
      return;
    }
    
    // First, ask the AI to summarize the conversation
    const transaction = db.transaction("conversations", "readonly");
    const store = transaction.objectStore("conversations");
    
    store.get(activeConversationId).onsuccess = function(e) {
      const conversation = e.target.result;
      if (!conversation) return;
      
      // Create a loading message
      const loadingElement = $(`<div class="message text-left mb-3" id="summary-loading">
        <div class="message-bubble bg-light p-3 rounded" style="display: inline-block; max-width: 80%;">
          <div class="message-content">
            <i class="fas fa-spinner fa-spin"></i> Generating insights summary...
          </div>
        </div>
      </div>`);
      
      $("#conversationMessages").append(loadingElement);
      
      // Prepare entire conversation
      const conversationText = conversation.messages
        .map(msg => `${msg.sender === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n\n");
      
      // Create prompt for summarization
      const prompt = `Please create a concise summary of the key insights and takeaways from this conversation. Format it as a markdown document with appropriate headers and bullet points:
  
  ${conversationText}`;
      
      // Use default assistant config
      const action = {
        description: "Please summarize the key insights from this conversation in a well-formatted markdown document.",
        model: "gpt-3.5-turbo"
      };
      
      // Call OpenAI API
      callOpenAiApi(action, prompt)
        .then(response => {
          // Remove loading message
          $("#summary-loading").remove();
          
          // Show the block creation dialog
          showInsightSaveDialog(response, conversation.title);
        })
        .catch(error => {
          // Remove loading message
          $("#summary-loading").remove();
          
          Helpers.showNotification("Error generating insights: " + error.message, "danger");
        });
    };
  }

  /**
 * Show dialog to save insights as a block
 */
function showInsightSaveDialog(content, conversationTitle) {
    const modal = $(`<div class="modal fade" id="insightsSaveModal">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Save Conversation Insights</h5>
            <button type="button" class="close" data-dismiss="modal">&times;</button>
          </div>
          <div class="modal-body">
            <form id="insightsForm">
              <div class="form-group">
                <label for="insightTitle">Block Title</label>
                <input type="text" class="form-control" id="insightTitle" value="Insights from ${conversationTitle}">
              </div>
              <div class="form-group">
                <label for="insightContent">Content</label>
                <textarea class="form-control" id="insightContent" rows="12">${content}</textarea>
              </div>
              <div class="form-group">
                <label for="insightTags">Tags</label>
                <input type="text" class="form-control" id="insightTags" value="insights, conversation">
              </div>
              <div class="form-group">
                <label for="insightReference">Reference</label>
                <input type="text" class="form-control" id="insightReference" placeholder="Select a reference">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="saveInsightBtn">Save as Block</button>
          </div>
        </div>
      </div>
    </div>`);
    
    // Add to body and show
    $("body").append(modal);
    modal.modal("show");
    
    // Set up autocomplete for reference
    $("#insightReference").autocomplete({
      source: referenceAutocomplete,
      minLength: 1
    });
    
    // Save button handler
    $("#saveInsightBtn").click(function() {
      const block = {
        title: $("#insightTitle").val(),
        text: $("#insightContent").val(),
        notes: `Generated from conversation ${activeConversationId} on ${new Date().toLocaleString()}`,
        tags: $("#insightTags").val().split(",").map(s => s.trim()).filter(s => s),
        reference: $("#insightReference").val(),
        refLevels: [],
        created: new Date()
      };
      
      // Save to database
      const transaction = db.transaction("blocks", "readwrite");
      const store = transaction.objectStore("blocks");
      
      store.add(block).onsuccess = function(e) {
        const blockId = e.target.result;
        
        // Close modal
        modal.modal("hide");
        
        // Show success message
        Helpers.showNotification("Insights saved as Block #" + blockId, "success");
        
        // Update blocks list
        if (typeof loadBlocks === 'function') {
          loadBlocks();
        }
      };
    });
    
    // Remove when hidden
    modal.on("hidden.bs.modal", function() {
      modal.remove();
    });
  }

  /**
 * Get the name of an action by ID
 * @param {number} actionId - The action ID
 * @returns {string} - The action name or a default string
 */
function getActionName(actionId) {
    if (!db || !actionId) return "Action #" + actionId;
    
    try {
      // Return a placeholder immediately
      setTimeout(() => {
        // Then try to update with actual name asynchronously
        const transaction = db.transaction("actions", "readonly");
        const store = transaction.objectStore("actions");
        
        store.get(parseInt(actionId)).onsuccess = function(e) {
          const action = e.target.result;
          if (action) {
            // Find and update the action name in displayed messages
            $(`.message-meta .badge[data-action-id="${actionId}"]`).text(`Action: ${action.title}`);
          }
        };
      }, 100);
      
      // Return placeholder for immediate display
      return "Action #" + actionId;
    } catch (error) {
      console.error("Error getting action name:", error);
      return "Action #" + actionId;
    }
  }