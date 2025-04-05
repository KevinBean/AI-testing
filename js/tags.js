/**
 * Tags management functionality
 */

// Initialize tags view when document is ready
$(document).ready(function() {
  console.log("Tags module initialized");
  
  // Make sure important functions are available globally
  if (!window.appState) window.appState = {};
  window.appState.selectedTag = null;
});

// Function to get all unique tags in the database
function getAllTags() {
  return new Promise((resolve, reject) => {
    ensureDatabaseReady()
      .then(db => {
        const uniqueTags = new Set();
        
        // First get tags from blocks
        const blocksTransaction = db.transaction(["blocks"], "readonly");
        const blocksStore = blocksTransaction.objectStore("blocks");
        
        blocksStore.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if(cursor) {
            const block = cursor.value;
            if (block.tags && Array.isArray(block.tags)) {
              block.tags.forEach(tag => {
                const trimmedTag = tag.trim();
                if (trimmedTag) {
                  uniqueTags.add(trimmedTag);
                }
              });
            }
            cursor.continue();
          } else {
            // After getting all block tags, get document tags
            const docsTransaction = db.transaction(["documents"], "readonly");
            const docsStore = docsTransaction.objectStore("documents");
            
            docsStore.openCursor().onsuccess = function(e) {
              const cursor = e.target.result;
              if(cursor) {
                const doc = cursor.value;
                if (doc.paragraphs && Array.isArray(doc.paragraphs)) {
                  doc.paragraphs.forEach(paragraph => {
                    if (paragraph.tags && Array.isArray(paragraph.tags)) {
                      paragraph.tags.forEach(tag => {
                        const trimmedTag = tag.trim();
                        if (trimmedTag) {
                          uniqueTags.add(trimmedTag);
                        }
                      });
                    }
                  });
                }
                cursor.continue();
              } else {
                // Now we have all unique tags from blocks and documents
                resolve(Array.from(uniqueTags).sort());
              }
            };
            
            docsTransaction.onerror = function(event) {
              console.error("Error getting document tags:", event.target.error);
              // Still resolve with block tags even if document tags fail
              resolve(Array.from(uniqueTags).sort());
            };
          }
        };
        
        blocksTransaction.onerror = function(event) {
          console.error("Error getting block tags:", event.target.error);
          reject(event.target.error);
        };
      })
      .catch(err => {
        console.error("Database not ready when getting all tags:", err);
        reject(err);
      });
  });
}

// Function to get blocks with a specific tag
function getBlocksByTag(tag) {
  return new Promise((resolve, reject) => {
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction(["blocks"], "readonly");
        const store = transaction.objectStore("blocks");
        const request = store.getAll();
        
        request.onsuccess = function(event) {
          const blocks = event.target.result || [];
          const filteredBlocks = blocks.filter(block => 
            block.tags && 
            Array.isArray(block.tags) && 
            (
              // Exact tag match
              block.tags.some(t => t.trim().toLowerCase() === tag.toLowerCase()) ||
              // Tag hierarchy match (tag is a parent)
              block.tags.some(t => {
                const trimmedTag = t.trim().toLowerCase();
                return trimmedTag.startsWith(tag.toLowerCase() + '/');
              })
            )
          );
          
          resolve(filteredBlocks);
        };
        
        request.onerror = function(event) {
          console.error("Error getting blocks by tag:", event.target.error);
          reject(event.target.error);
        };
      })
      .catch(err => {
        console.error("Database not ready when getting blocks by tag:", err);
        reject(err);
      });
  });
}

// Function to get documents with paragraphs containing a specific tag
function getDocumentsByTag(tag) {
  return new Promise((resolve, reject) => {
    ensureDatabaseReady()
      .then(db => {
        const transaction = db.transaction(["documents"], "readonly");
        const store = transaction.objectStore("documents");
        const request = store.getAll();
        
        request.onsuccess = function(event) {
          const documents = event.target.result || [];
          const docsWithTaggedParagraphs = [];
          
          documents.forEach(doc => {
            if (doc.paragraphs && Array.isArray(doc.paragraphs)) {
              // Find paragraphs with the specified tag
              const taggedParagraphs = doc.paragraphs.filter(para => 
                para.tags && 
                Array.isArray(para.tags) && 
                (
                  // Exact tag match
                  para.tags.some(t => t.trim().toLowerCase() === tag.toLowerCase()) ||
                  // Tag hierarchy match (tag is a parent)
                  para.tags.some(t => {
                    const trimmedTag = t.trim().toLowerCase();
                    return trimmedTag.startsWith(tag.toLowerCase() + '/');
                  })
                )
              );
              
              if (taggedParagraphs.length > 0) {
                // Create a result object with document info and tagged paragraphs
                docsWithTaggedParagraphs.push({
                  ...doc,
                  taggedParagraphs: taggedParagraphs
                });
              }
            }
          });
          
          resolve(docsWithTaggedParagraphs);
        };
        
        request.onerror = function(event) {
          console.error("Error getting documents by tag:", event.target.error);
          reject(event.target.error);
        };
      })
      .catch(err => {
        console.error("Database not ready when getting documents by tag:", err);
        reject(err);
      });
  });
}

// Count items (blocks and document paragraphs) by tag
function countItemsByTag() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await ensureDatabaseReady();
      const tagCounts = new Map();
      const tagHierarchyCounts = new Map();
      
      // First count tags in blocks
      const blocksTransaction = db.transaction(["blocks"], "readonly");
      const blocksStore = blocksTransaction.objectStore("blocks");
      
      const blocksRequest = blocksStore.getAll();
      blocksRequest.onsuccess = function(event) {
        const blocks = event.target.result || [];
        
        blocks.forEach(block => {
          if (block.tags && Array.isArray(block.tags)) {
            block.tags.forEach(tag => {
              const trimmedTag = tag.trim();
              if (trimmedTag) {
                // Count the exact tag
                tagCounts.set(trimmedTag, (tagCounts.get(trimmedTag) || 0) + 1);
                
                // Count parent tags in hierarchy
                if (trimmedTag.includes('/')) {
                  const parts = trimmedTag.split('/');
                  
                  // Count each parent level
                  for (let i = 1; i < parts.length; i++) {
                    const parentPath = parts.slice(0, i).join('/');
                    tagHierarchyCounts.set(parentPath, (tagHierarchyCounts.get(parentPath) || 0) + 1);
                  }
                }
              }
            });
          }
        });
        
        // Then count tags in document paragraphs
        const docsTransaction = db.transaction(["documents"], "readonly");
        const docsStore = docsTransaction.objectStore("documents");
        
        docsStore.getAll().onsuccess = function(event) {
          const documents = event.target.result || [];
          
          documents.forEach(doc => {
            if (doc.paragraphs && Array.isArray(doc.paragraphs)) {
              doc.paragraphs.forEach(para => {
                if (para.tags && Array.isArray(para.tags)) {
                  para.tags.forEach(tag => {
                    const trimmedTag = tag.trim();
                    if (trimmedTag) {
                      // Count the exact tag
                      tagCounts.set(trimmedTag, (tagCounts.get(trimmedTag) || 0) + 1);
                      
                      // Count parent tags in hierarchy
                      if (trimmedTag.includes('/')) {
                        const parts = trimmedTag.split('/');
                        
                        // Count each parent level
                        for (let i = 1; i < parts.length; i++) {
                          const parentPath = parts.slice(0, i).join('/');
                          tagHierarchyCounts.set(parentPath, (tagHierarchyCounts.get(parentPath) || 0) + 1);
                        }
                      }
                    }
                  });
                }
              });
            }
          });
          
          // Merge hierarchy counts into the main tag counts
          tagHierarchyCounts.forEach((count, tag) => {
            if (!tagCounts.has(tag)) {
              tagCounts.set(tag, 0); // Parent tag exists but has no direct items
            }
          });
          
          resolve(tagCounts);
        };
        
        docsTransaction.onerror = function(event) {
          console.error("Error counting document tags:", event.target.error);
          // Still resolve with block tag counts
          resolve(tagCounts);
        };
      };
      
      blocksTransaction.onerror = function(event) {
        console.error("Error counting block tags:", event.target.error);
        reject(event.target.error);
      };
    } catch (err) {
      console.error("Database error when counting tags:", err);
      reject(err);
    }
  });
}

/**
 * Get the parent tag paths for a given tag
 * @param {string} tag - The tag to get parents for (e.g., "animals/mammals/cats")
 * @returns {string[]} - Array of parent paths (e.g., ["animals", "animals/mammals"])
 */
function getTagParents(tag) {
  if (!tag.includes('/')) return [];
  
  const parts = tag.split('/');
  const parents = [];
  
  for (let i = 1; i < parts.length; i++) {
    parents.push(parts.slice(0, i).join('/'));
  }
  
  return parents;
}
