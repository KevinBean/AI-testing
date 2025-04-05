/**
 * Collections management functionality
 */

let editingCollectionId = null;
let selectedCollectionId = null;

// Initialize collections view
$(document).ready(function() {
  console.log("Collections view initialized");
  
  // Hook up search functionality
  $("#collectionSearch").on("keyup", function() {
    const searchTerm = $(this).val().trim();
    loadCollections(searchTerm);
  });
  
  // Hook up create button
  $("#createCollectionButton").on("click", function() {
    showCollectionModal();
  });
  
  // Hook up save collection button
  $(document).on("click", "#saveCollectionButton", function() {
    saveCollection();
  });
  
  // Initialize collections data
  initializeCollections();
});

// Initialize collections data
function initializeCollections() {
  console.log("Initializing collections data");
  
  // Ensure the database is ready before attempting to load collections
  ensureDatabaseReady()
    .then(db => {
      if (db) {
        // Check if collections store exists before loading
        checkCollectionsStore(db)
          .then(storeExists => {
            if (storeExists) {
              loadCollections();
            } else {
              console.warn("Collections store does not exist yet. Attempting to create it.");
              createCollectionsStore(db)
                .then(() => loadCollections())
                .catch(err => {
                  console.error("Failed to create collections store:", err);
                  showCollectionsError("Failed to create collections store. Try refreshing the page or using the database repair tools in Settings.");
                });
            }
          })
          .catch(err => {
            console.error("Error checking collections store:", err);
            showCollectionsError("Error checking collections store. Try refreshing the page.");
          });
      } else {
        console.error("Database not available for collections");
        showCollectionsError("Database connection is not available. Please try refreshing the page.");
      }
    })
    .catch(err => {
      console.error("Error ensuring database ready for collections:", err);
      showCollectionsError("Error connecting to database. Please try refreshing the page.");
    });
}

// Show collection modal - either for creating new or editing
function showCollectionModal(collectionId = null) {
  // Reset the form
  $("#collectionForm")[0].reset();
  $("#collectionColor").val("#007bff"); // Default color
  
  if (collectionId) {
    // We're editing an existing collection
    editingCollectionId = collectionId;
    $("#collectionModalTitle").text("Edit Collection");
    
    // Load collection data
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction(["collections"], "readonly");
        const store = transaction.objectStore("collections");
        const request = store.get(collectionId);
        
        request.onsuccess = function(event) {
          const collection = event.target.result;
          if (collection) {
            $("#collectionName").val(collection.name);
            $("#collectionDescription").val(collection.description || "");
            $("#collectionColor").val(collection.color || "#007bff");
          }
        };
        
        request.onerror = function(event) {
          console.error("Error loading collection for editing:", event.target.error);
          showNotification("Error loading collection data", "danger");
        };
      })
      .catch(err => {
        console.error("Database not ready when loading collection:", err);
        showNotification("Database error. Please try again.", "danger");
      });
  } else {
    // We're creating a new collection
    editingCollectionId = null;
    $("#collectionModalTitle").text("Create New Collection");
  }
  
  // Show the modal
  $("#collectionModal").modal("show");
}

// Save collection (create new or update existing)
function saveCollection() {
  const name = $("#collectionName").val().trim();
  const description = $("#collectionDescription").val().trim();
  const color = $("#collectionColor").val();
  
  if (!name) {
    showNotification("Collection name is required", "warning");
    return;
  }
  
  const collection = {
    name: name,
    description: description,
    color: color,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["collections"], "readwrite");
      const store = transaction.objectStore("collections");
      
      let request;
      if (editingCollectionId) {
        // Update existing collection
        collection.id = editingCollectionId;
        request = store.put(collection);
      } else {
        // Create new collection
        request = store.add(collection);
      }
      
      request.onsuccess = function(event) {
        console.log("Collection saved successfully");
        $("#collectionModal").modal("hide");
        showNotification(editingCollectionId ? "Collection updated" : "Collection created", "success");
        loadCollections(); // Reload collections list
      };
      
      request.onerror = function(event) {
        console.error("Error saving collection:", event.target.error);
        showNotification("Error saving collection", "danger");
      };
    })
    .catch(err => {
      console.error("Database not ready when saving collection:", err);
      showNotification("Database error. Please try again.", "danger");
    });
}

// Check if collections store exists
function checkCollectionsStore(db) {
  return new Promise((resolve) => {
    try {
      if (Array.from(db.objectStoreNames).includes('collections')) {
        resolve(true);
      } else {
        resolve(false);
      }
    } catch (err) {
      console.error("Error checking collections store:", err);
      resolve(false);
    }
  });
}

// Create collections store if it doesn't exist
function createCollectionsStore(db) {
  return new Promise((resolve, reject) => {
    try {
      // Close current connection and upgrade database
      db.close();
      const request = indexedDB.open(db.name, db.version + 1);
      
      request.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('documentCollections')) {
          const mappingStore = db.createObjectStore('documentCollections', { keyPath: 'id', autoIncrement: true });
          mappingStore.createIndex('documentId', 'documentId', { unique: false });
          mappingStore.createIndex('collectionId', 'collectionId', { unique: false });
        }
      };
      
      request.onsuccess = function(event) {
        window.appState.db = event.target.result;
        window.db = event.target.result;
        resolve(event.target.result);
      };
      
      request.onerror = function(event) {
        reject(event.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

// Load collections, optionally filtered by search term
function loadCollections(searchTerm = '') {
  console.log("Loading collections", searchTerm ? "with search term: " + searchTerm : "");
  
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["collections"], "readonly");
      const store = transaction.objectStore("collections");
      const request = store.getAll();
      
      request.onsuccess = function(event) {
        let collections = event.target.result || [];
        
        // Filter by search term if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          collections = collections.filter(collection => 
            collection.name.toLowerCase().includes(searchLower) || 
            (collection.description && collection.description.toLowerCase().includes(searchLower))
          );
        }
        
        // Sort collections alphabetically
        collections.sort((a, b) => a.name.localeCompare(b.name));
        
        // Display collections
        renderCollectionsList(collections);
      };
      
      request.onerror = function(event) {
        console.error("Error loading collections:", event.target.error);
        showCollectionsError("Error loading collections. Please try refreshing the page.");
      };
    })
    .catch(err => {
      console.error("Database not ready when loading collections:", err);
      showCollectionsError("Database error. Please try refreshing the page.");
    });
}

// Render collections list
function renderCollectionsList(collections) {
  const $listContainer = $("#collectionsList");
  $listContainer.empty();
  
  if (collections.length === 0) {
    $listContainer.html(`
      <li class="list-group-item text-center text-muted">
        <em>No collections found</em>
      </li>
    `);
    return;
  }
  
  collections.forEach(collection => {
    const $item = $(`
      <li class="list-group-item collection-item" data-id="${collection.id}">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <span class="collection-color-dot" style="background-color: ${collection.color || '#007bff'}"></span>
            <span class="collection-name">${escapeHtml(collection.name)}</span>
          </div>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary edit-collection" data-id="${collection.id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger delete-collection" data-id="${collection.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        ${collection.description ? `<div class="collection-description text-muted small mt-1">${escapeHtml(collection.description)}</div>` : ''}
      </li>
    `);
    
    $listContainer.append($item);
  });
  
  // Add click handlers
  $(".collection-item").on("click", function(e) {
    if (!$(e.target).closest('.btn').length) {
      const collectionId = $(this).data("id");
      selectCollection(collectionId);
    }
  });
  
  $(".edit-collection").on("click", function(e) {
    e.stopPropagation();
    const collectionId = $(this).data("id");
    showCollectionModal(collectionId);
  });
  
  $(".delete-collection").on("click", function(e) {
    e.stopPropagation();
    const collectionId = $(this).data("id");
    confirmDeleteCollection(collectionId);
  });
}

// Select a collection to view its details
function selectCollection(collectionId) {
  selectedCollectionId = collectionId;
  $(".collection-item").removeClass("active");
  $(`.collection-item[data-id="${collectionId}"]`).addClass("active");
  
  // Load collection details and documents
  loadCollectionDetails(collectionId);
}

// Load collection details and documents
function loadCollectionDetails(collectionId) {
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["collections"], "readonly");
      const store = transaction.objectStore("collections");
      const request = store.get(collectionId);
      
      request.onsuccess = function(event) {
        const collection = event.target.result;
        if (collection) {
          renderCollectionDetails(collection);
          loadCollectionDocuments(collectionId);
        } else {
          console.error("Collection not found:", collectionId);
          showNotification("Collection not found", "danger");
        }
      };
      
      request.onerror = function(event) {
        console.error("Error loading collection details:", event.target.error);
        showNotification("Error loading collection", "danger");
      };
    })
    .catch(err => {
      console.error("Database not ready when loading collection details:", err);
      showNotification("Database error. Please try again.", "danger");
    });
}

// Render collection details
function renderCollectionDetails(collection) {
  $("#collectionDetails").html(`
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center" style="background-color: ${collection.color || '#007bff'}; color: white;">
        <h5 class="m-0">${escapeHtml(collection.name)}</h5>
        <button class="btn btn-sm btn-light add-to-collection-btn">
          <i class="fas fa-plus"></i> Add Documents
        </button>
      </div>
      <div class="card-body">
        ${collection.description ? `<p class="collection-description">${escapeHtml(collection.description)}</p>` : ''}
        <div id="collectionDocuments" class="mt-3">
          <p class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Loading documents...</p>
        </div>
      </div>
    </div>
  `);
  
  // Add click handler for adding documents
  $(".add-to-collection-btn").on("click", function() {
    if (window.showAddToCollectionModal) {
      window.showAddToCollectionModal(collection.id);
    } else {
      console.error("showAddToCollectionModal function not found");
      alert("Document collection feature is not fully loaded. Please refresh the page.");
    }
  });
}

// Load documents for a collection
function loadCollectionDocuments(collectionId) {
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["documentCollections", "documents"], "readonly");
      const mappingStore = transaction.objectStore("documentCollections");
      const documentsStore = transaction.objectStore("documents");
      
      // Get all mappings for this collection
      const index = mappingStore.index("collectionId");
      const request = index.getAll(parseInt(collectionId, 10) || collectionId);
      
      request.onsuccess = function(event) {
        const mappings = event.target.result || [];
        
        if (mappings.length === 0) {
          $("#collectionDocuments").html(`
            <div class="alert alert-info">
              <p>This collection doesn't have any documents yet.</p>
              <p>Click "Add Documents" to add existing documents to this collection.</p>
            </div>
          `);
          return;
        }
        
        // Get all documents for these mappings
        const documents = [];
        let documentLoadCount = 0;
        
        mappings.forEach(mapping => {
          const docRequest = documentsStore.get(mapping.documentId);
          
          docRequest.onsuccess = function(event) {
            const document = event.target.result;
            if (document) {
              documents.push({
                ...document,
                mappingId: mapping.id,
                order: mapping.order || 0
              });
            }
            
            documentLoadCount++;
            if (documentLoadCount === mappings.length) {
              // All documents loaded, render them
              if (window.renderCollectionDocuments) {
                window.renderCollectionDocuments(documents);
              } else {
                renderBasicCollectionDocuments(documents);
              }
            }
          };
          
          docRequest.onerror = function(event) {
            console.error("Error loading document:", event.target.error);
            documentLoadCount++;
          };
        });
      };
      
      request.onerror = function(event) {
        console.error("Error loading collection documents:", event.target.error);
        $("#collectionDocuments").html(`
          <div class="alert alert-danger">
            <p>Error loading documents. Please try refreshing the page.</p>
          </div>
        `);
      };
    })
    .catch(err => {
      console.error("Database not ready when loading collection documents:", err);
      $("#collectionDocuments").html(`
        <div class="alert alert-danger">
          <p>Database error loading documents. Please try refreshing the page.</p>
        </div>
      `);
    });
}

// Basic rendering function as fallback
function renderBasicCollectionDocuments(documents) {
  const $container = $("#collectionDocuments");
  
  if (documents.length === 0) {
    $container.html(`
      <div class="alert alert-info">
        <p>This collection doesn't have any documents yet.</p>
        <p>Click "Add Documents" to add existing documents to this collection.</p>
      </div>
    `);
    return;
  }
  
  let html = '<ul class="list-group">';
  documents.forEach(doc => {
    html += `
      <li class="list-group-item">
        <strong>${escapeHtml(doc.title)}</strong>
        <br>
        <small class="text-muted">Created: ${doc.created ? new Date(doc.created).toLocaleDateString() : 'Unknown'}</small>
      </li>
    `;
  });
  html += '</ul>';
  
  $container.html(html);
}

// Show collection error message
function showCollectionsError(message) {
  $("#collectionsList").html(`
    <li class="list-group-item text-danger">
      <i class="fas fa-exclamation-triangle"></i> ${message}
    </li>
  `);
}

// Show notification
function showNotification(message, type = "info") {
  const $notification = $(`
    <div class="alert alert-${type} alert-dismissible fade show notification-toast" role="alert">
      ${message}
      <button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  `);
  
  // Remove existing notifications
  $(".notification-toast").remove();
  
  // Add to page
  $("body").append($notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    $notification.alert('close');
  }, 3000);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
