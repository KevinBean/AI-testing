/**
 * Collections management module
 */

/**
 * Load collections with optional search filtering
 * @param {string} searchTerm - Optional search term
 */
function loadCollections(searchTerm = "") {
  $("#collectionList").empty();
  
  if (!db) {
    $("#collectionList").append('<li class="list-group-item text-danger">Database not available. Please refresh the page.</li>');
    return;
  }
  
  const transaction = db.transaction("collections", "readonly");
  const store = transaction.objectStore("collections");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const collection = cursor.value;
      const searchableText = (collection.name + " " + collection.description + " " + collection.tags.join(" ")).toLowerCase();
      
      if (!searchTerm || searchableText.includes(searchTerm.toLowerCase())) {
        const li = $("<li>")
          .addClass("list-group-item list-item")
          .html(`
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong>${collection.name}</strong>
                <br><small>${collection.description || ""}</small>
                ${collection.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join("")}
              </div>
            </div>
          `);

        li.click(() => previewCollection(collection));
        $("#collectionList").append(li);
      }
      cursor.continue();
    }
  };
}

/**
 * Edit a collection
 * @param {Object} collection - The collection to edit
 */
function editCollection(collection) {
  editingCollectionId = collection.id;
  $("#collectionName").val(collection.name);
  $("#collectionDesc").val(collection.description || "");
  $("#collectionTags").val(collection.tags.join(", "));
  collectionItems = [...collection.items];
  updateCollectionItemsUI();
}

/**
 * Delete a collection
 * @param {number} id - The collection ID to delete
 */
function deleteCollection(id) {
  if (confirm("Are you sure you want to delete this collection?")) {
    if (!db) {
      showNotification("Database not available. Please refresh the page.", "danger");
      return;
    }
    
    const transaction = db.transaction("collections", "readwrite");
    const store = transaction.objectStore("collections");
    
    store.delete(id).onsuccess = function() {
      loadCollections();
      if (editingCollectionId === id) {
        resetCollectionForm();
      }
      showNotification("Collection deleted successfully!");
    };
  }
}

/**
 * Reset the collection form
 */
function resetCollectionForm() {
  editingCollectionId = null;
  collectionItems = [];
  $("#collectionForm")[0].reset();
  updateCollectionItemsUI();
}

/**
 * Update the collection items UI
 */
function updateCollectionItemsUI() {
  const container = $("#collectionItems");
  if (collectionItems.length === 0) {
    container.html('<p class="text-muted text-center mb-0">No items added yet</p>');
    return;
  }

  let html = '<ul class="list-group">';
  collectionItems.forEach((item, index) => {
    html += `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        ${item.type === 'block' ? '<i class="fas fa-cube"></i>' : '<i class="fas fa-file-alt"></i>'}
        ${item.title}
        <button class="btn btn-sm btn-outline-danger remove-item-btn" data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      </li>
    `;
  });
  html += '</ul>';
  container.html(html);

  $(".remove-item-btn").click(function() {
    const index = $(this).data("index");
    collectionItems.splice(index, 1);
    updateCollectionItemsUI();
  });
}

/**
 * Load blocks for collection selection
 * @param {string} searchTerm - Optional search term
 */
function loadBlocksForCollection(searchTerm = "") {
  const list = $("#blockSelectionList");
  list.empty();

  if (!db) {
    list.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }

  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (!searchTerm || block.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        const item = $(`
          <div class="card mb-2">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6>${block.title || 'Block ' + block.id}</h6>
                  <small>${block.text.substring(0, 100)}...</small>
                </div>
                <button class="btn btn-sm btn-primary add-block-btn">Add</button>
              </div>
            </div>
          </div>
        `);

        item.find(".add-block-btn").click(() => {
          collectionItems.push({
            type: 'block',
            id: block.id,
            title: block.title || 'Block ' + block.id
          });
          updateCollectionItemsUI();
          $("#selectBlockModal").modal('hide');
        });

        list.append(item);
      }
      cursor.continue();
    }
  };
}

/**
 * Load documents for collection selection
 * @param {string} searchTerm - Optional search term
 */
function loadDocsForCollection(searchTerm = "") {
  const list = $("#docSelectionList");
  list.empty();

  if (!db) {
    list.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }

  const transaction = db.transaction("documents", "readonly");
  const store = transaction.objectStore("documents");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const doc = cursor.value;
      if (!searchTerm || doc.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        const item = $(`
          <div class="card mb-2">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6>${doc.title}</h6>
                  <small>${doc.paragraphs.length} paragraphs</small>
                </div>
                <button class="btn btn-sm btn-primary add-doc-btn">Add</button>
              </div>
            </div>
          </div>
        `);

        item.find(".add-doc-btn").click(() => {
          collectionItems.push({
            type: 'document',
            id: doc.id,
            title: doc.title
          });
          updateCollectionItemsUI();
          $("#selectDocModal").modal('hide');
        });

        list.append(item);
      }
      cursor.continue();
    }
  };
}

/**
 * Handle collection form submission
 * @param {Event} e - Form submission event
 */
function handleCollectionFormSubmit(e) {
  e.preventDefault();
  
  const name = $("#collectionName").val().trim();
  const description = $("#collectionDesc").val().trim();
  const tags = $("#collectionTags").val().split(",").map(t => t.trim()).filter(t => t);
  
  if (!name) {
    showNotification("Collection name is required", "warning");
    return;
  }
  
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const collection = {
    name,
    description,
    tags,
    items: collectionItems,
    updated: new Date()
  };

  const transaction = db.transaction("collections", "readwrite");
  const store = transaction.objectStore("collections");

  if (editingCollectionId) {
    collection.id = editingCollectionId;
    store.put(collection).onsuccess = function() {
      showNotification("Collection updated successfully!");
      resetCollectionForm();
      loadCollections();
    };
  } else {
    store.add(collection).onsuccess = function() {
      showNotification("Collection created successfully!");
      resetCollectionForm();
      loadCollections();
    };
  }
}

/**
 * Preview a collection
 * @param {Object} collection - The collection to preview
 */
function previewCollection(collection) {
  let html = `
    <div class="card-header">${collection.name}
      <div class="btn-group float-right">
        <button class="btn btn-sm btn-warning edit-collection-btn">Edit</button>
        <button class="btn btn-sm btn-danger delete-collection-btn">Delete</button>
      </div>
    </div>
    ${collection.description ? `<p>${collection.description}</p>` : ''}
    ${collection.tags.length ? `
      <div class="mb-3">
        ${collection.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}
      </div>
    ` : ''}
  `;

  if (collection.items.length === 0) {
    html += '<p class="text-muted">This collection is empty.</p>';
  } else {
    html += '<div class="list-group">';
    collection.items.forEach(item => {
      html += `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              ${item.title}
              ${item.type === 'block' ? '<i class="fas fa-cube mr-2">block</i>' : '<i class="fas fa-file-alt mr-2">document</i>'}
            </div>
            <button class="btn btn-sm btn-outline-primary preview-item-btn" 
              data-type="${item.type}" data-id="${item.id}">
              Preview
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  $("#collectionPreview").html(html);

  // Set up delete button handler
  $(".delete-collection-btn").on("click", function(e) {
    e.stopPropagation();
    deleteCollection(collection.id);
  });
  
  // Set up edit button handler
  $(".edit-collection-btn").on("click", function(e) {
    e.stopPropagation();
    editCollection(collection);
  });

  // Add preview handlers
  $(".preview-item-btn").click(function() {
    const type = $(this).data("type");
    const id = $(this).data("id");
    
    if (type === "block") {
      fetchBlockById(id)
        .then(block => {
          if (block) {
            // Go to blocks tab and show block details
            $("#blocks-tab").tab('show');
            showBlockDetails(block);
          } else {
            showNotification("Block not found", "danger");
          }
        })
        .catch(error => {
          console.error("Error fetching block:", error);
          showNotification("Error: " + error.message, "danger");
        });
    } else {
      fetchDocumentById(id)
        .then(doc => {
          if (doc) {
            $("#documents-tab").tab('show');
            previewDocument(doc);
          } else {
            showNotification("Document not found", "danger");
          }
        })
        .catch(error => {
          console.error("Error fetching document:", error);
          showNotification("Error: " + error.message, "danger");
        });
    }
  });
}

// Initialize event listeners for collections
$("#addBlockToCollection").click(function() {
  const selectDialog = $(`
    <div class="modal fade" id="selectBlockModal">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Select Blocks</h5>
            <button type="button" class="close" data-dismiss="modal">&times;</button>
          </div>
          <div class="modal-body">
            <input type="text" class="form-control mb-3" id="blockSearchInput" placeholder="Search blocks...">
            <div id="blockSelectionList"></div>
          </div>
        </div>
      </div>
    </div>
  `).appendTo('body');

  loadBlocksForCollection();
  selectDialog.modal('show');

  selectDialog.on('hidden.bs.modal', function() {
    selectDialog.remove();
  });
});

$("#addDocToCollection").click(function() {
  const selectDialog = $(`
    <div class="modal fade" id="selectDocModal">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Select Documents</h5>
            <button type="button" class="close" data-dismiss="modal">&times;</button>
          </div>
          <div class="modal-body">
            <input type="text" class="form-control mb-3" id="docSearchInput" placeholder="Search documents...">
            <div id="docSelectionList"></div>
          </div>
        </div>
      </div>
    </div>
  `).appendTo('body');

  loadDocsForCollection();
  selectDialog.modal('show');

  selectDialog.on('hidden.bs.modal', function() {
    selectDialog.remove();
  });
});

$("#cancelCollectionBtn").click(resetCollectionForm);
