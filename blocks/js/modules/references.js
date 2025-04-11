/**
 * References management module
 */

/**
 * Update reference autocomplete data
 */
function updateReferenceAutocomplete() {
  referenceAutocomplete = [];
  
  if (!db) {
    console.error("Database not initialized");
    return;
  }
  
  const transaction = db.transaction("references", "readonly");
  const store = transaction.objectStore("references");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if(cursor) {
      const ref = cursor.value;
      referenceAutocomplete.push({ 
        label: ref.id + " - " + ref.name + (ref.type ? ` (${ref.type})` : ""), 
        value: ref.id 
      });
      cursor.continue();
    } else {
      // Set the block form's reference autocomplete source to the updated list
      $("#blockReference").autocomplete({ source: referenceAutocomplete });
    }
  };
}

/**
 * Handle reference form submission
 * @param {Event} e - Form submission event
 */
function handleReferenceFormSubmit(e) {
  e.preventDefault();
  
  const id = $("#refId").val().trim();
  const name = $("#refName").val().trim();
  const description = $("#refDesc").val().trim();
  const type = $("#refType").val();
  const author = $("#refAuthor").val().trim();
  const year = $("#refYear").val() ? parseInt($("#refYear").val()) : null;
  const version = $("#refVersion").val().trim();
  const url = $("#refUrl").val().trim();
  
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("references", "readwrite");
  const store = transaction.objectStore("references");
  
  if(editingReferenceId) {
    store.get(editingReferenceId).onsuccess = function(e) {
      let ref = e.target.result;
      ref.name = name;
      ref.description = description;
      ref.type = type;
      ref.author = author;
      ref.year = year;
      ref.version = version;
      ref.url = url;
      ref.updated = new Date();
      
      const reqUpdate = store.put(ref);
      reqUpdate.onsuccess = function() {
        showNotification("Reference updated successfully!");
        editingReferenceId = null;
        $("#referenceForm")[0].reset();
        $("#refId").prop("disabled", false);
        $("#referenceForm button[type=submit]").text("Add Reference");
        loadReferencesMetadata();
        updateReferenceAutocomplete();
      };
      reqUpdate.onerror = function(e) {
        console.error(e.target.error);
        showNotification("Error updating reference: " + e.target.error, "danger");
      };
    };
  } else {
    const ref = { 
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
    const reqAdd = store.add(ref);
    reqAdd.onsuccess = function() {
      showNotification("New reference added!");
      $("#referenceForm")[0].reset();
      loadReferencesMetadata();
      updateReferenceAutocomplete();
    };
    reqAdd.onerror = function(e) {
      console.error(e.target.error);
      showNotification("Error adding reference: " + e.target.error, "danger");
    };
  }
}

/**
 * Load references metadata with optional search filtering
 * @param {string} searchTerm - Optional search term
 */
function loadReferencesMetadata(searchTerm = "") {
  $("#referenceList").empty();
  
  if (!db) {
    $("#referenceList").append('<li class="list-group-item text-danger">Database not available. Please refresh the page.</li>');
    return;
  }
  
  const transaction = db.transaction("references", "readonly");
  const store = transaction.objectStore("references");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if(cursor) {
      const ref = cursor.value;
      const searchableText = (
        ref.id + " " + 
        ref.name + " " + 
        (ref.description || "") + " " + 
        (ref.type || "") + " " + 
        (ref.author || "") +
        (ref.year ? ref.year.toString() : "")
      ).toLowerCase();
      
      if(searchTerm === "" || searchableText.indexOf(searchTerm.toLowerCase()) !== -1) {
        let displayText = `<strong>${ref.id} - ${ref.name}</strong>`;
        if(ref.type) displayText += ` <span class="badge badge-secondary">${ref.type}</span>`;
        if(ref.author) displayText += `<br><small>Author: ${ref.author}</small>`;
        if(ref.year) displayText += `<small> (${ref.year})</small>`;
        
        const li = $("<li>")
          .addClass("list-group-item list-item")
          .html(displayText)
          .click(function() { combineReference(ref.id); });
        
        $("#referenceList").append(li);
      }
      cursor.continue();
    }
  };
}

/**
 * Edit a reference
 * @param {Object} ref - The reference to edit
 */
function editReference(ref) {
  editingReferenceId = ref.id;
  $("#refId").val(ref.id).prop("disabled", true);
  $("#refName").val(ref.name);
  $("#refDesc").val(ref.description || "");
  $("#refType").val(ref.type || "");
  $("#refAuthor").val(ref.author || "");
  $("#refYear").val(ref.year || "");
  $("#refVersion").val(ref.version || "");
  $("#refUrl").val(ref.url || "");
  $("#referenceForm button[type=submit]").text("Update Reference");
}

/**
 * Delete a reference
 * @param {string} id - The reference ID to delete
 */
function deleteReference(id) {
  if(confirm("Are you sure you want to delete this reference?")) {
    if (!db) {
      showNotification("Database not available. Please refresh the page.", "danger");
      return;
    }
    
    const transaction = db.transaction("references", "readwrite");
    const store = transaction.objectStore("references");
    
    store.delete(id).onsuccess = function() {
      $("#refId").prop("disabled", false);
      loadReferencesMetadata();
      updateReferenceAutocomplete();
      showNotification("Reference deleted successfully!");
    };
  }
}

/**
 * Combine blocks for a reference and display them
 * @param {string} refId - The reference ID
 */
function combineReference(refId) {
  if (!db) {
    showNotification("Database not available. Please refresh the page.", "danger");
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  let blocksForReference = [];
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if(cursor) {
      const block = cursor.value;
      if(block.reference === refId) {
        blocksForReference.push(block);
      }
      cursor.continue();
    } else {
      // Sort blocks by reference levels
      blocksForReference.sort((a, b) => {
        let al = a.refLevels || [];
        let bl = b.refLevels || [];
        for(let i = 0; i < Math.max(al.length, bl.length); i++){
          let av = al[i] || 0;
          let bv = bl[i] || 0;
          if(av !== bv) return av - bv;
        }
        return 0;
      });
      
      // Get reference metadata
      const trans = db.transaction("references", "readonly");
      const refStore = trans.objectStore("references");
      
      refStore.get(refId).onsuccess = function(ev) {
        let refMeta = ev.target.result;
        const refTitle = (refMeta ? refMeta.name : "");
        
        let html = `<div class='card mb-3'>
              <div class="card-header">
                <strong>${refTitle}</strong>`;
        
        if (refMeta) {
          html += ` (ID: ${refMeta.id})
                <div class="btn-group float-right">
                  <button class="btn btn-sm btn-warning edit-ref-btn" data-block-id="${refMeta.id}">Edit</button>
                  <button class="btn btn-sm btn-danger delete-ref-btn">Delete</button>
                </div>
              </div>
            <div class='card-body'>`;
          
          // Display reference metadata
          if (refMeta.type) html += `<p><strong>Type:</strong> ${refMeta.type}</p>`;
          if (refMeta.description) html += `<p><strong>Description:</strong> ${refMeta.description}</p>`;
          if (refMeta.author) html += `<p><strong>Author(s):</strong> ${refMeta.author}</p>`;
          if (refMeta.year) html += `<p><strong>Year:</strong> ${refMeta.year}</p>`;
          if (refMeta.version) html += `<p><strong>Version:</strong> ${refMeta.version}</p>`;
          if (refMeta.url) html += `<p><strong>URL:</strong> <a href="${refMeta.url}" target="_blank">${refMeta.url}</a></p>`;
          
          html += "</div></div>";
        }
        
        if (blocksForReference.length > 0) {
          html += `<div class='card mb-3'><div class="card-header">Associated Blocks</div><div class='card-body'><ul>`;
          blocksForReference.forEach(block => {
            let level = (block.refLevels && block.refLevels.length) ? block.refLevels.length : 1;
            let indent = (level - 1) * 20;
            html += "<li style='padding: 30px 20px; margin-left:" + indent + "px; list-style-type: none; border: 1px solid #ccc;'>";
            if(block.refLevels && block.refLevels.length > 0) {
              html += "<strong>" + block.refLevels.join(".") + "</strong>";
            }
            html += ": <strong>" + (block.title || "Block " + block.id) + "</strong> - " + renderMarkdown(block.text);
            // Add tags if available
            if(block.tags && block.tags.length) {
              html += " <span class='badge badge-info'>" + block.tags.join("</span> <span class='badge badge-info'>") + "</span>";
            }
            // Add notes if available
            if(block.notes) {
              html += "<br><small>Notes: " + block.notes + "</small>";
            }
            html += `<div class="btn-group float-right"><button class="btn btn-sm btn-outline-primary edit-ref-block-btn ml-2" data-block-id="${block.id}">Edit</button></div>`;
            html += "</li>";
          });
          html += "</ul>";
        } else {
          html += "<p>No blocks associated with this reference.</p>";
        }
        html += "</div></div>";
        
        $("#referenceCombinedView").html(html);
        renderMermaidIn("#referenceCombinedView .mermaid");

        // Add event handler after HTML is inserted
        $(".edit-ref-block-btn").on("click", function() {
          const blockId = $(this).data("block-id");
          editBlockUniversal(blockId);
        });

        // Set up delete button handler
        $(".delete-ref-btn").on("click", function(e) {
          e.stopPropagation(); 
          deleteReference(refMeta.id);
        });
        
        // Set up edit button handler
        $(".edit-ref-btn").on("click", function(e) {
          e.stopPropagation(); 
          editReference(refMeta);
        });
      };
    }
  };
}
