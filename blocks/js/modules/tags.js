/**
 * Tags management module
 */

/**
 * Update the tag autocomplete data
 */
function updateTagAutocomplete() {
  tagAutocomplete = [];
  
  if (!db) {
    console.error("Database not initialized");
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  const tagCounts = {}; // To count tag frequency
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.tags && block.tags.length) {
        block.tags.forEach(tag => {
          if (tagCounts[tag]) {
            tagCounts[tag]++;
          } else {
            tagCounts[tag] = 1;
            tagAutocomplete.push(tag);
          }
        });
      }
      cursor.continue();
    } else {
      // After counting all tags, update the tag visualizations
      updateTagVisualization(tagCounts);
      
      // Set the tag autocomplete
      $("#tagSearch").autocomplete({
        source: tagAutocomplete,
        minLength: 1
      });

      // Set paragraph tags autocomplete
      $(".paraTags").autocomplete({
        source: function(request, response) {
          const term = request.term.split(/,\s*/).pop();
          const results = $.ui.autocomplete.filter(tagAutocomplete, term);
          response(results.slice(0, 10));
        },
        focus: function() {
          return false;
        },
        select: function(event, ui) {
          const terms = this.value.split(/,\s*/);
          terms.pop();
          terms.push(ui.item.value);
          terms.push("");
          this.value = terms.join(", ");
          return false;
        },
        minLength: 1
      });
    }
  };
}

/**
 * Build a tag tree from flat tag list
 * @param {Object} tagCounts - Object with tag names as keys and counts as values
 * @returns {Object} - Hierarchical tree structure
 */
function buildTagTree(tagCounts) {
  const tree = { name: 'root', children: {}, count: 0 };
  
  // Build the tree structure
  Object.keys(tagCounts).forEach(tag => {
    const count = tagCounts[tag];
    const parts = tag.split('/');
    
    // Handle both hierarchical and flat tags
    if (parts.length > 1) {
      // It's a hierarchical tag
      let currentLevel = tree;
      parts.forEach((part, idx) => {
        if (!currentLevel.children[part]) {
          currentLevel.children[part] = { 
            name: part, 
            children: {}, 
            count: 0,
            // Store the path up to this level for navigation purposes
            path: parts.slice(0, idx + 1).join('/') 
          };
        }
        
        // If it's a leaf node (final part of the path), add the count
        if (idx === parts.length - 1) {
          currentLevel.children[part].count += count;
          currentLevel.children[part].fullPath = tag;
        }
        
        // Increment parent counts to represent total items in branch
        currentLevel.count += count;
        
        // Move to next level
        currentLevel = currentLevel.children[part];
      });
    } else {
      // It's a flat tag
      if (!tree.children[tag]) {
        tree.children[tag] = { name: tag, children: {}, count: 0, fullPath: tag };
      }
      tree.children[tag].count += count;
      tree.count += count;
    }
  });
  
  return tree;
}

/**
 * Enhanced renderTagTree function with better support for deep nesting
 * @param {Object} treeNode - The tag tree node to render
 * @param {jQuery} container - The container to append to
 * @param {number} level - The current nesting level
 * @returns {jQuery} - The rendered UL element
 */
function renderTagTree(treeNode, container, level = 0) {
  const childrenKeys = Object.keys(treeNode.children).sort();
  if (childrenKeys.length === 0) return;
  
  // Each level should get its own UL for proper nesting
  const ul = $('<ul>').addClass('tag-tree');
  if (level === 0) ul.addClass('tag-tree-root');
  
  childrenKeys.forEach(key => {
    const child = treeNode.children[key];
    const hasChildren = Object.keys(child.children).length > 0;
    
    // Improved indent with more visual spacing per level
    const li = $('<li>').css('margin-left', `${level * 12}px`);
    
    // Visual indicator of hierarchy level
    const tagItem = $('<div>').addClass('tag-tree-item');
    
    // Add toggle icon for nodes with children
    if (hasChildren) {
      const toggleIcon = $('<i>').addClass('fas fa-caret-right tag-tree-toggle mr-1');
      tagItem.append(toggleIcon);
      
      // Improved toggle behavior to properly show/hide deeply nested children
      toggleIcon.click(function(e) {
        e.stopPropagation();
        const nestedUl = $(this).closest('li').children('ul').first();
        nestedUl.toggle();
        $(this).toggleClass('fa-caret-right fa-caret-down');
      });
    } else {
      // Add indentation for leaf nodes to align with parent toggles
      tagItem.append($('<i>').addClass('fas fa-tag mr-1 text-muted'));
    }
    
    // Visual enhancements to better show the tag hierarchy level
    const tagBtn = $('<button>')
      .addClass('btn btn-sm btn-outline-info tag-tree-btn')
      .text(child.name);
      
    // Better visual cue for depth with increasing color intensity
    if (level > 0) {
      // Gradient border color that gets darker with depth
      const opacity = Math.min(0.4 + (level * 0.15), 1.0);
      const hue = 180 + (level * 10); // Slight hue change by level
      tagBtn.css('border-left', `4px solid hsla(${hue}, 70%, 40%, ${opacity})`);
      
      // Add indentation marker to show the hierarchy
      tagBtn.prepend(`<span class="text-muted mr-1">${'•'.repeat(level)}</span>`);
    }
    
    // Add count badge
    tagBtn.append($('<span>').addClass('badge badge-light ml-1').text(child.count));
    
    // Add click handler to trigger tag filtering
    if (child.fullPath) {
      tagBtn.click(function() {
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
      const childUl = renderTagTree(child, li, level + 1);
      li.append(childUl);
      
      // Only hide deeper levels (3+) by default for better UX
      if (level >= 2) {
        childUl.hide();
      }
    }
    
    ul.append(li);
  });
  
  container.append(ul);
  return ul;
}

/**
 * Update the tag cloud (traditional flat view)
 * @param {Object} tagCounts - Object with tag names as keys and counts as values
 */
function updateTagCloud(tagCounts) {
  const tagCloud = $("#tagCloud");
  tagCloud.empty();
  
  // Sort tags by frequency
  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
  
  // Display top 20 tags
  sortedTags.slice(0, 20).forEach(tag => {
    const count = tagCounts[tag];
    // Scale font size between 1em and 2em based on frequency
    const fontSize = 1 + (count / Math.max(...Object.values(tagCounts))) * 1;
    
    const tagBtn = $(`<button class="btn btn-outline-info m-1">${tag} <span class="badge badge-light">${count}</span></button>`);
    tagBtn.css('font-size', `${fontSize}em`);
    tagBtn.click(function() {
      selectedTag = tag;
      $("#tagSearch").val(tag);
      $("#selectedTagName").text(tag);
      loadContentByTag(tag);
    });
    
    tagCloud.append(tagBtn);
  });
}

/**
 * Function to update the tag visualization
 * @param {Object} tagCounts - Object with tag names as keys and counts as values
 */
function updateTagVisualization(tagCounts) {
  // Create the traditional tag cloud
  updateTagCloud(tagCounts);
  
  // Create hierarchical tag tree
  const tagTreeContainer = $("#tagTreeContainer");
  tagTreeContainer.empty();
  
  // Build and render the tree
  const tagTree = buildTagTree(tagCounts);
  
  // Add a heading
  const heading = $('<h5>').text('Tag Hierarchy').addClass('mb-3');
  tagTreeContainer.append(heading);
  
  renderTagTree(tagTree, tagTreeContainer);
  
  // Add info about usage
  const info = $('<div>').addClass('text-muted small mt-2')
    .html('<i class="fas fa-info-circle"></i> Use slashes to create hierarchical tags (e.g., "power/cables/rating")');
  tagTreeContainer.append(info);
}

/**
 * Load blocks and documents by tag
 * @param {string} tag - Tag to filter by
 */
function loadContentByTag(tag) {
  // Load blocks with the tag
  loadBlocksByTag(tag);
  
  // Load documents with the tag
  loadDocumentsByTag(tag);
}

/**
 * Load blocks by tag
 * @param {string} tag - Tag to filter by
 */
function loadBlocksByTag(tag) {
  const blocksList = $("#taggedBlocksList");
  blocksList.empty();
  
  if (!db) {
    blocksList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.tags && block.tags.includes(tag)) {
        let renderedText = renderMarkdown(block.text);
        const blockItem = $(`
          <div class="card mb-2">
            <div class="card-body">
              <h6>${block.title || 'Block'} (ID: ${block.id})</h6>
              <div>${renderedText}</div>
              <div class="mt-2 d-flex justify-content-between">
                <div>
                  ${block.tags.map(t => `<span class="badge badge-info mr-1">${t}</span>`).join('')}
                </div>
                <div>
                  <button class="btn btn-sm btn-warning edit-tag-block-btn" data-block-id="${block.id}">Edit</button>
                </div>
              </div>
            </div>
          </div>
        `);
        
        // Add event handler for the edit button
        blockItem.find(".edit-tag-block-btn").on("click", function() {
          const blockId = $(this).data("block-id");
          editBlockUniversal(blockId);
        });
        
        blocksList.append(blockItem);
      }
      cursor.continue();
    }
  };
}

/**
 * Load documents by tag
 * @param {string} tag - Tag to filter by
 */
function loadDocumentsByTag(tag) {
  const documentsList = $("#taggedDocumentsList");
  documentsList.empty();
  
  if (!db) {
    documentsList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
  const transaction = db.transaction("documents", "readonly");
  const store = transaction.objectStore("documents");
  
  store.openCursor().onsuccess = function(e) {
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
        const docItem = $(`
          <div class="card mb-2">
            <div class="card-body">
              <h6>Document: ${doc.title}</h6>
              <button class="btn btn-sm btn-outline-primary view-doc-btn" data-id="${doc.id}">View Document</button>
            </div>
          </div>
        `);
        
        docItem.find(".view-doc-btn").click(function() {
          previewDocument(doc);
          $('#viewTabs a[href="#documentsView"]').tab('show');
        });
        
        documentsList.append(docItem);
      }
      cursor.continue();
    }
  };
}

/**
 * Load tags for content selection modal
 * @param {string} searchTerm - Optional search term
 */
function loadTagsForSelection(searchTerm = "") {
  const tagsCloud = $(".tag-selection-cloud");
  tagsCloud.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading tags...</div>');
  
  const tagCounts = {};
  
  if (!db) {
    tagsCloud.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
  const transaction = db.transaction("blocks", "readonly");
  const store = transaction.objectStore("blocks");
  
  store.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.tags && block.tags.length) {
        block.tags.forEach(tag => {
          if (!searchTerm || tag.toLowerCase().includes(searchTerm.toLowerCase())) {
            if (tagCounts[tag]) {
              tagCounts[tag]++;
            } else {
              tagCounts[tag] = 1;
            }
          }
        });
      }
      cursor.continue();
    } else {
      if (Object.keys(tagCounts).length === 0) {
        tagsCloud.html('<p class="text-center text-muted">No tags found matching your search.</p>');
        return;
      }
      
      const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
      let tagsHtml = '';
      
      sortedTags.forEach(tag => {
        const count = tagCounts[tag];
        tagsHtml += `
          <button class="btn btn-sm btn-outline-info m-1 selectable-tag" data-tag="${tag}">
            ${tag} <span class="badge badge-light">${count}</span>
          </button>
        `;
      });
      
      tagsCloud.html(tagsHtml);
      
      $(".selectable-tag").click(function() {
        const tag = $(this).data("tag");
        $(".selectable-tag").removeClass("active");
        $(this).addClass("active");
        loadContentByTagForSelection(tag);
      });
    }
  };
}

/**
 * Load content by tag for selection modal
 * @param {string} tag - Tag to filter by
 */
function loadContentByTagForSelection(tag) {
  const taggedItemsList = $(".tagged-items-list");
  taggedItemsList.html('<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading content...</div>');
  
  const taggedBlocks = [];
  const taggedParagraphs = [];
  let blocksLoaded = false;
  let paragraphsLoaded = false;
  
  if (!db) {
    taggedItemsList.html('<p class="text-danger">Database not available. Please refresh the page.</p>');
    return;
  }
  
  function renderResults() {
    if (!blocksLoaded || !paragraphsLoaded) return;
    
    if (taggedBlocks.length === 0 && taggedParagraphs.length === 0) {
      taggedItemsList.html('<p class="text-center text-muted">No content found with this tag.</p>');
      return;
    }
    
    let resultsHtml = '';
    
    if (taggedBlocks.length > 0) {
      resultsHtml += '<h6 class="mt-2">Blocks:</h6>';
      taggedBlocks.forEach(block => {
        const preview = block.text.length > 100 ? block.text.substring(0, 100) + "..." : block.text;
        resultsHtml += `
          <div class="card mb-2 selectable-tag-item" data-id="${block.id}" data-type="block" data-title="${block.title || 'Block ' + block.id}">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="tag-block-${block.id}">
                <label class="form-check-label w-100" for="tag-block-${block.id}">
                  <strong>${block.title || 'Block ' + block.id}</strong> <small class="text-muted">(ID: ${block.id})</small><br>
                  <small>${preview}</small>
                </label>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    if (taggedParagraphs.length > 0) {
      resultsHtml += '<h6 class="mt-3">Paragraphs:</h6>';
      taggedParagraphs.forEach(para => {
        const preview = para.content.length > 100 ? para.content.substring(0, 100) + "..." : para.content;
        resultsHtml += `
          <div class="card mb-2 selectable-tag-item" data-id="${para.docId}-${para.index}" data-doc-id="${para.docId}" 
               data-para-index="${para.index}" data-type="paragraph" data-title="Paragraph ${para.index + 1} from ${para.docTitle}">
            <div class="card-body py-2">
              <div class="form-check">
                <input class="form-check-input select-content-item" type="checkbox" id="tag-para-${para.docId}-${para.index}">
                <label class="form-check-label w-100" for="tag-para-${para.docId}-${para.index}">
                  <strong>Paragraph ${para.index + 1}</strong> <small class="text-muted">(Document: ${para.docTitle})</small><br>
                  <small>${preview}</small>
                </label>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    taggedItemsList.html(resultsHtml);
    
    $(".selectable-tag-item .select-content-item").change(function() {
      const item = $(this).closest(".selectable-tag-item");
      const itemType = item.data("type");
      const itemId = item.data("id");
      const itemTitle = item.data("title");
      const selectionMode = $("#contentSelectionModal").data("selection-mode");
      
      if ($(this).prop("checked")) {
        if (selectionMode === "single" && selectedContentItems.length > 0) {
          $(".select-content-item").not(this).prop("checked", false);
          selectedContentItems = [];
        }
        
        if (itemType === "block") {
          selectedContentItems.push({
            id: parseInt(itemId),
            type: "block",
            title: itemTitle
          });
        } else if (itemType === "paragraph") {
          const docId = item.data("doc-id");
          const paraIndex = item.data("para-index");
          selectedContentItems.push({
            id: itemId,
            docId: parseInt(docId),
            paraIndex: parseInt(paraIndex),
            type: "paragraph",
            title: itemTitle
          });
        }
      } else {
        selectedContentItems = selectedContentItems.filter(selected => 
          !(selected.type === itemType && selected.id.toString() === itemId.toString())
        );
      }
      
      updateSelectedItemsUI();
    });
  }
  
  // Load blocks with tag
  const blockTx = db.transaction("blocks", "readonly");
  const blockStore = blockTx.objectStore("blocks");
  
  blockStore.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const block = cursor.value;
      if (block.tags && block.tags.includes(tag)) {
        taggedBlocks.push(block);
      }
      cursor.continue();
    } else {
      blocksLoaded = true;
      renderResults();
    }
  };
  
  // Load documents with tag
  const docTx = db.transaction("documents", "readonly");
  const docStore = docTx.objectStore("documents");
  
  docStore.openCursor().onsuccess = function(e) {
    const cursor = e.target.result;
    if (cursor) {
      const doc = cursor.value;
      if (doc.paragraphs) {
        doc.paragraphs.forEach((para, index) => {
          if (para.tags && para.tags.includes(tag)) {
            taggedParagraphs.push({
              docId: doc.id,
              index: index,
              content: para.content,
              docTitle: doc.title
            });
          }
        });
      }
      cursor.continue();
    } else {
      paragraphsLoaded = true;
      renderResults();
    }
  };
}