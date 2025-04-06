// Standards/References Management Functions

// Add this at the top to ensure there's a clear variable for tracking which standard is being edited
let editingStandardId = null;

// Initialize standards view
$(document).ready(function() {
  console.log("Standards view initialized");
  
  // Attach event handler to save reference button
  $("#saveReferenceButton").click(function(event) {
    event.preventDefault(); // Add this line to prevent form submission
    handleStandardFormSubmit(event);
  });
  
  // Attach event handler to search field
  $("#stdSearch").on("keyup", function() {
    const searchTerm = $(this).val().trim();
    loadStandardsMetadata(searchTerm);
  });
  
  // Reset form when opening modal for new reference
  $("#createReferenceButton").click(function() {
    console.log("Create new reference button clicked");
    resetReferenceForm();
  });
  
  // Initialize tooltips
  $('[data-toggle="tooltip"]').tooltip();
  
  // Fix event delegation for edit and delete buttons
  $(document).on("click", ".edit-standard-btn", function(e) {
    e.stopPropagation();
    const stdId = $(this).data("id");
    console.log("Edit button clicked for standard ID:", stdId);
    fetchStandardById(stdId, function(std) {
      editStandard(std);
      $("#referenceModal").modal("show");
    });
  });
  
  $(document).on("click", ".delete-standard-btn", function(e) {
    e.stopPropagation();
    const stdId = $(this).data("id");
    deleteStandard(stdId);
  });
  
  // Load references right away
  loadStandardsMetadata();
});

// Helper function to reset the reference form
function resetReferenceForm() {
  $("#standardForm")[0].reset();
  $("#stdId").prop("disabled", false);
  $("#referenceModalTitle").text("Create New Reference");
  editingStandardId = null;
}

// Function to fetch standard by ID
function fetchStandardById(id, callback) {
  if (!id) {
    console.error("No standard ID provided");
    return;
  }
  
  console.log("Fetching standard with ID:", id);
  
  ensureDatabaseReady()
    .then(db => {
      const transaction = db.transaction(["standards"], "readonly");
      const store = transaction.objectStore("standards");
      const request = store.get(id);
      
      request.onsuccess = function(event) {
        const standard = event.target.result;
        if (standard) {
          console.log("Standard found:", standard);
          callback(standard);
        } else {
          console.error("Standard not found:", id);
          showNotification("Reference not found", "warning");
        }
      };
      
      request.onerror = function(event) {
        console.error("Error fetching standard:", event.target.error);
        showNotification("Error loading reference", "danger");
      };
    })
    .catch(err => {
      console.error("Database not ready when fetching standard:", err);
      showNotification("Database error. Please try again.", "danger");
    });
}

function updateStandardAutocomplete() {
  // Ensure we check for database availability
  if (!db) {
    console.error("Database not available for standard autocomplete");
    return Promise.reject("Database not available");
  }
  
  return new Promise((resolve, reject) => {
    standardAutocomplete = [];
    const transaction = db.transaction("standards", "readonly");
    const store = transaction.objectStore("standards");
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if(cursor) {
        const std = cursor.value;
        standardAutocomplete.push({ 
          label: std.id + " - " + std.name + (std.type ? ` (${std.type})` : ""), 
          value: std.id 
        });
        cursor.continue();
      } else {
        // Set the block form's standard autocomplete source to the updated list
        $("#blockStandard").autocomplete({ source: standardAutocomplete });
        resolve(standardAutocomplete);
      }
    };
    
    transaction.onerror = function(e) {
      console.error("Error in updateStandardAutocomplete:", e.target.error);
      reject(e.target.error);
    };
  });
}

function handleStandardFormSubmit(e) {
  if (e) e.preventDefault();
  
  // Check if database is available
  if (!db || db.version === null) {
    showNotification("Database is not available. Please refresh the page.", "danger");
    return;
  }
  
  const id = $("#stdId").val().trim();
  const name = $("#stdName").val().trim();
  const description = $("#stdDesc").val().trim();
  const type = $("#refType").val();
  const author = $("#refAuthor").val().trim();
  const year = $("#refYear").val() ? parseInt($("#refYear").val()) : null;
  const version = $("#refVersion").val().trim();
  const url = $("#refUrl").val().trim();
  
  // Basic validation
  if (!id || !name) {
    showNotification("Reference ID and title are required", "warning");
    return;
  }
  
  try {
    const transaction = db.transaction("standards", "readwrite");
    const store = transaction.objectStore("standards");
    
    transaction.onerror = function(event) {
      console.error("Transaction error:", event.target.error);
      showNotification("Error saving reference: " + event.target.error.message, "danger");
    };
    
    if (editingStandardId) {
      console.log("Updating reference with ID:", editingStandardId);
      
      // Get the existing standard
      store.get(editingStandardId).onsuccess = function(e) {
        const std = e.target.result;
        if (!std) {
          console.error("Reference not found for ID:", editingStandardId);
          showNotification("Error: Reference not found", "danger");
          return;
        }
        
        // Update the standard properties
        std.name = name;
        std.description = description;
        std.type = type;
        std.author = author;
        std.year = year;
        std.version = version;
        std.url = url;
        std.updated = new Date();
        
        // Save the updated standard
        const updateRequest = store.put(std);
        
        updateRequest.onsuccess = function() {
          console.log("Reference updated successfully");
          showNotification("Reference updated successfully!");
          $("#referenceModal").modal("hide");
          resetReferenceForm();
          loadStandardsMetadata();
          updateStandardAutocomplete();
        };
        
        updateRequest.onerror = function(event) {
          console.error("Error updating reference:", event.target.error);
          showNotification("Error updating reference", "danger");
        };
      };
    } else {
      // Check if a standard with the same ID already exists
      store.get(id).onsuccess = function(e) {
        const existingStd = e.target.result;
        if (existingStd) {
          showNotification("A reference with this ID already exists. Please use a different ID.", "warning");
          return;
        }
        
        // Create new standard
        const newStd = { 
          id, 
          name, 
          description, 
          type, 
          author, 
          year, 
          version, 
          url,
          created: new Date()
        };
        
        // Add the new standard
        const addRequest = store.add(newStd);
        
        addRequest.onsuccess = function() {
          console.log("New reference added successfully");
          showNotification("New reference added!");
          $("#referenceModal").modal("hide");
          resetReferenceForm();
          loadStandardsMetadata();
          updateStandardAutocomplete();
        };
        
        addRequest.onerror = function(event) {
          console.error("Error adding reference:", event.target.error);
          showNotification("Error creating reference", "danger");
        };
      };
    }
  } catch (err) {
    console.error("Database error:", err);
    showNotification("Failed to save reference. The database might be closing or unavailable. Please try again after refreshing the page.", "danger");
  }
}

// Adding robust error handling and database checking
async function loadStandardsMetadata(searchTerm = "") {
  console.log("Loading standards metadata with search:", searchTerm);
  
  // Clear and add loading indicator
  $("#standardList").html('<li class="list-group-item text-center"><i class="fas fa-spinner fa-spin"></i> Loading references...</li>');
  
  // Ensure database is ready
  await ensureDatabaseReady();
  
  // Check if db exists
  if (!db) {
    console.error("Database not available for loading standards");
    $("#standardList").html(`
      <li class="list-group-item text-danger">
        <i class="fas fa-exclamation-triangle"></i> 
        Database not available. Please refresh the page.
      </li>`);
    return;
  }
  
  try {
    const transaction = db.transaction("standards", "readonly");
    const store = transaction.objectStore("standards");
    let standardsFound = 0;
    
    store.openCursor().onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        const std = cursor.value;
        const searchableText = (
          std.id + " " + 
          std.name + " " + 
          (std.description || "") + " " + 
          (std.type || "") + " " + 
          (std.author || "") +
          (std.year ? std.year.toString() : "")
        ).toLowerCase();
        
        if (searchTerm === "" || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
          standardsFound++;
          
          // Create list item for the standard
          const li = $("<li>")
            .addClass("list-group-item list-item")
            .attr("data-id", std.id)  // Add data-id attribute to the list item
            .html(`
              <strong>${std.id} - ${std.name}</strong>
              ${std.type ? ` <span class="badge badge-secondary">${std.type}</span>` : ''}
              ${std.author ? `<br><small>Author: ${std.author}${std.year ? ` (${std.year})` : ''}</small>` : ''}
            `)
            .click(function() { combineStandard(std.id); });
          
          // Create edit and delete buttons
          const btnGroup = $('<div class="mt-2 action-buttons">');
          
          const editBtn = $("<button>")
            .addClass("btn btn-sm btn-warning action-btn edit-standard-btn")
            .html('<i class="fas fa-edit"></i> Edit')
            .attr("data-id", std.id);
            
          const delBtn = $("<button>")
            .addClass("btn btn-sm btn-danger action-btn delete-standard-btn")
            .html('<i class="fas fa-trash-alt"></i> Delete')
            .attr("data-id", std.id);
            
          btnGroup.append(editBtn, delBtn);
          li.append(btnGroup);
          
          $("#standardList").append(li);
        }
        
        cursor.continue();
      } else {
        // Remove loading indicator if present
        $("#standardList .text-center").remove();
        
        console.log(`Found ${standardsFound} standards`);
        
        // Show message if no standards found
        if (standardsFound === 0) {
          if (searchTerm) {
            $("#standardList").html(`
              <li class="list-group-item">
                <div class="alert alert-info mb-0">
                  No references found matching "${searchTerm}"
                </div>
              </li>`);
          } else {
            $("#standardList").html(`
              <li class="list-group-item">
                <div class="alert alert-info mb-0">
                  <h5 class="alert-heading">No references yet</h5>
                  <p>Create your first reference using the form on the right.</p>
                </div>
              </li>`);
          }
        }
      }
    };
    
    transaction.onerror = function(event) {
      console.error("Transaction error:", event.target.error);
      $("#standardList").html(`
        <li class="list-group-item text-danger">
          <i class="fas fa-exclamation-triangle"></i> 
          Error loading references. Please try refreshing the page.
        </li>`);
    };
  } catch (err) {
    console.error("Error in loadStandardsMetadata:", err);
    $("#standardList").html(`
      <li class="list-group-item text-danger">
        <i class="fas fa-exclamation-triangle"></i> 
        Failed to load references. Please try refreshing the page.
      </li>`);
  }
}

function editStandard(std) {
  if (!std) {
    showNotification("Reference not found", "warning");
    return;
  }
  
  console.log("Editing reference:", std.id);
  
  // Set editing state
  editingStandardId = std.id;
  
  // Update form title
  $("#referenceModalTitle").text("Edit Reference");
  
  // Fill the form with standard data
  $("#stdId").val(std.id).prop("disabled", true); // Disable the ID field
  $("#stdName").val(std.name || "");
  $("#stdDesc").val(std.description || "");
  $("#refType").val(std.type || "");
  $("#refAuthor").val(std.author || "");
  $("#refYear").val(std.year || "");
  $("#refVersion").val(std.version || "");
  $("#refUrl").val(std.url || "");
  
  // Show the modal
  $("#referenceModal").modal("show");
}

function deleteStandard(id) {
  if (id && confirm("Are you sure you want to delete this reference?")) {
    console.log("Deleting reference with ID:", id);
    
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction("standards", "readwrite");
        const store = transaction.objectStore("standards");
        const request = store.delete(id);
        
        request.onsuccess = function() {
          console.log("Reference deleted successfully");
          showNotification("Reference deleted successfully!", "success");
          loadStandardsMetadata();
          updateStandardAutocomplete();
        };
        
        request.onerror = function(event) {
          console.error("Error deleting standard:", event.target.error);
          showNotification("Failed to delete reference. Please try again.", "danger");
        };
      })
      .catch(err => {
        console.error("Database error when deleting standard:", err);
        showNotification("Database error. Please try refreshing the page.", "danger");
      });
  }
}

function combineStandard(stdId) {
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  let blocksForStandard = [];
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if(cursor) {
      const block = cursor.value;
      if(block.standard === stdId) {
        blocksForStandard.push(block);
      }
      cursor.continue();
    } else {
      blocksForStandard.sort((a, b) => {
        let al = a.stdLevels || [];
        let bl = b.stdLevels || [];
        for(let i = 0; i < Math.max(al.length, bl.length); i++){
          let av = al[i] || 0;
          let bv = bl[i] || 0;
          if(av !== bv) return av - bv;
        }
        return 0;
      });
      const trans = db.transaction("standards", "readonly");
      const stdStore = trans.objectStore("standards");
      stdStore.get(stdId).onsuccess = function(ev) {
        let stdMeta = ev.target.result;
        let html = "<h5>Reference: " + stdId + " - " + (stdMeta ? stdMeta.name : "") + "</h5>";
        
        if (stdMeta) {
          html += "<div class='card mb-3'><div class='card-body'>";
          
          // Display reference metadata
          if (stdMeta.type) html += `<p><strong>Type:</strong> ${stdMeta.type}</p>`;
          if (stdMeta.description) html += `<p><strong>Description:</strong> ${stdMeta.description}</p>`;
          if (stdMeta.author) html += `<p><strong>Author(s):</strong> ${stdMeta.author}</p>`;
          if (stdMeta.year) html += `<p><strong>Year:</strong> ${stdMeta.year}</p>`;
          if (stdMeta.version) html += `<p><strong>Version:</strong> ${stdMeta.version}</p>`;
          if (stdMeta.url) html += `<p><strong>URL:</strong> <a href="${stdMeta.url}" target="_blank">${stdMeta.url}</a></p>`;
          
          html += "</div></div>";
        }
        
        if (blocksForStandard.length > 0) {
          html += "<h6>Associated Blocks:</h6><ul>";
          blocksForStandard.forEach(block => {
            let level = (block.levels && block.levels.length) ? block.levels.filter(l => l !== null).length : 1;
            let indent = (level - 1) * 20;
            html += "<li style='margin-left:" + indent + "px; list-style-type: none;'>";
            
            // Handle levels - check both legacy stdLevels and newer levels property
            let levelDisplay = "";
            if (block.levels && block.levels.some(l => l !== null)) {
              levelDisplay = block.levels.filter(l => l !== null).join(".");
            } else if (block.stdLevels && block.stdLevels.length > 0) {
              levelDisplay = block.stdLevels.join(".");
            }
            
            if (levelDisplay) {
              html += "<strong>" + levelDisplay + "</strong>";
            }
            
            // Get block content - handle both text and content properties
            const blockContent = block.content || block.text || '';
            
            html += ": <strong>" + (block.title || "Block " + block.id) + "</strong> - " + 
                    (blockContent ? marked.parse(blockContent) : "<em>No content</em>");
            
            // add notes if available
            if (block.notes) {
              html += "<br><small><strong>Notes:</strong></small><pre><code>" + block.notes + "</code></pre><br>";
            }
            html += `<button class="btn btn-sm btn-warning edit-std-block-btn ml-2" data-block-id="${block.id}">Edit</button>`;
            html += "</li>";
          });
          html += "</ul>";
        } else {
          html += "<p>No blocks associated with this reference.</p>";
        }
        
        $("#standardCombined").html(html);

        // Add event handler after HTML is inserted
        $(".edit-std-block-btn").on("click", function() {
          const blockId = $(this).data("block-id");
          editBlockUniversal(blockId);
        });
      };
    }
  };
}
